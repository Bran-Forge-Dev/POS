-- ============================================================
-- NeoVenta POS — Esquema inicial (Supabase)
-- Ejecutar completo en: SQL Editor del proyecto en supabase.com
-- ============================================================

-- ---------- TABLAS ----------

-- Perfil de usuario ligado a auth.users (cuenta + rol)
create table if not exists perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    cuenta text not null unique,
    rol text not null default 'cajero' check (rol in ('admin', 'cajero')),
    telefono text default '',
    correo text default '',
    fecha_nacimiento date,
    created_at timestamptz not null default now()
);

create table if not exists productos (
    id bigint generated always as identity primary key,
    codigo text not null unique,
    descripcion text not null,
    costo numeric(10,2) not null default 0 check (costo >= 0),
    venta numeric(10,2) not null default 0 check (venta >= 0),
    mayoreo numeric(10,2) not null default 0 check (mayoreo >= 0),
    cantidad integer not null default 0 check (cantidad >= 0),
    minimo integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists proveedores (
    id bigint generated always as identity primary key,
    codigo text not null unique,
    nombre text not null,
    razon text default '',
    telefono text default '',
    direccion text default '',
    correo text default '',
    created_at timestamptz not null default now()
);

-- Encabezado de venta; el folio ES la llave primaria
create table if not exists ventas (
    folio bigint generated always as identity primary key,
    cajero_id uuid not null references auth.users(id),
    fecha timestamptz not null default now(),
    total numeric(12,2) not null check (total >= 0),
    pago numeric(12,2) not null check (pago >= 0),
    cambio numeric(12,2) not null check (cambio >= 0)
);

-- Detalle: copia codigo/descripcion/precio para conservar
-- el histórico aunque el producto cambie o se borre después
create table if not exists detalle_venta (
    id bigint generated always as identity primary key,
    venta_id bigint not null references ventas(folio) on delete cascade,
    producto_id bigint references productos(id) on delete set null,
    codigo text not null,
    descripcion text not null,
    precio numeric(10,2) not null,
    cantidad integer not null check (cantidad > 0)
);

-- ---------- FUNCIÓN DE ROL ----------

-- security definer evita recursión con las políticas de perfiles
create or replace function es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1 from perfiles
        where id = auth.uid() and rol = 'admin'
    );
$$;

-- ---------- VENTA ATÓMICA (RPC) ----------

-- Registra la venta + detalle + descuento de inventario en UNA
-- transacción. El cajero no tiene permiso directo de UPDATE en
-- productos, así que esta función corre como definer.
create or replace function registrar_venta(p_items jsonb, p_pago numeric)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
    v_folio bigint;
    v_total numeric := 0;
    item jsonb;
    prod record;
begin
    if auth.uid() is null then
        raise exception 'Sesión requerida';
    end if;

    -- Validar existencia y calcular total en el servidor
    -- (nunca confiar en el total que manda el cliente)
    for item in select * from jsonb_array_elements(p_items) loop
        select * into prod
        from productos
        where id = (item->>'producto_id')::bigint
        for update;

        if not found then
            raise exception 'Producto % no existe', item->>'producto_id';
        end if;
        if prod.cantidad < (item->>'cantidad')::int then
            raise exception 'Sin existencia suficiente para % (disponible: %)',
                prod.descripcion, prod.cantidad;
        end if;

        v_total := v_total + prod.venta * (item->>'cantidad')::int;
    end loop;

    if p_pago < v_total then
        raise exception 'Pago insuficiente: faltan %', (v_total - p_pago);
    end if;

    insert into ventas (cajero_id, total, pago, cambio)
    values (auth.uid(), v_total, p_pago, p_pago - v_total)
    returning folio into v_folio;

    for item in select * from jsonb_array_elements(p_items) loop
        update productos
        set cantidad = cantidad - (item->>'cantidad')::int
        where id = (item->>'producto_id')::bigint;

        insert into detalle_venta (venta_id, producto_id, codigo, descripcion, precio, cantidad)
        select v_folio, p.id, p.codigo, p.descripcion, p.venta, (item->>'cantidad')::int
        from productos p
        where p.id = (item->>'producto_id')::bigint;
    end loop;

    return v_folio;
end;
$$;

revoke all on function registrar_venta(jsonb, numeric) from public;
grant execute on function registrar_venta(jsonb, numeric) to authenticated;

-- ---------- ROW LEVEL SECURITY ----------

alter table perfiles enable row level security;
alter table productos enable row level security;
alter table proveedores enable row level security;
alter table ventas enable row level security;
alter table detalle_venta enable row level security;

-- perfiles: cada usuario lee el suyo; admin gestiona todos
create policy "perfiles_lectura_propia" on perfiles
    for select to authenticated
    using (id = auth.uid() or es_admin());
create policy "perfiles_admin" on perfiles
    for all to authenticated
    using (es_admin());

-- productos: todos los autenticados leen; solo admin escribe
create policy "productos_lectura" on productos
    for select to authenticated
    using (true);
create policy "productos_admin" on productos
    for all to authenticated
    using (es_admin());

-- proveedores: igual que productos
create policy "proveedores_lectura" on proveedores
    for select to authenticated
    using (true);
create policy "proveedores_admin" on proveedores
    for all to authenticated
    using (es_admin());

-- ventas: cajero inserta y ve las suyas; admin ve todo
create policy "ventas_insert" on ventas
    for insert to authenticated
    with check (cajero_id = auth.uid());
create policy "ventas_lectura" on ventas
    for select to authenticated
    using (cajero_id = auth.uid() or es_admin());

-- detalle_venta: sigue el acceso de su venta padre
create policy "detalle_insert" on detalle_venta
    for insert to authenticated
    with check (
        exists (
            select 1 from ventas v
            where v.folio = detalle_venta.venta_id
              and v.cajero_id = auth.uid()
        )
    );
create policy "detalle_lectura" on detalle_venta
    for select to authenticated
    using (
        exists (
            select 1 from ventas v
            where v.folio = detalle_venta.venta_id
              and (v.cajero_id = auth.uid() or es_admin())
        )
    );
