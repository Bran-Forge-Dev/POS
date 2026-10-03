-- ============================================================
-- NeoVenta POS — Esquema inicial (Supabase)
-- Ejecutar completo en: SQL Editor del proyecto en supabase.com
-- Tablas y funciones con prefijo pos_ para coexistir con otras
-- apps en el mismo proyecto (p. ej. inv_* de inventario).
-- ============================================================

-- ---------- TABLAS ----------

-- Perfil de usuario ligado a auth.users (cuenta + rol)
create table if not exists pos_perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    cuenta text not null unique,
    rol text not null default 'cajero' check (rol in ('admin', 'cajero')),
    telefono text default '',
    correo text default '',
    fecha_nacimiento date,
    created_at timestamptz not null default now()
);

create table if not exists pos_productos (
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

create table if not exists pos_proveedores (
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
create table if not exists pos_ventas (
    folio bigint generated always as identity primary key,
    cajero_id uuid not null references auth.users(id),
    fecha timestamptz not null default now(),
    total numeric(12,2) not null check (total >= 0),
    pago numeric(12,2) not null check (pago >= 0),
    cambio numeric(12,2) not null check (cambio >= 0)
);

-- Detalle: copia codigo/descripcion/precio para conservar
-- el histórico aunque el producto cambie o se borre después
create table if not exists pos_detalle_venta (
    id bigint generated always as identity primary key,
    venta_id bigint not null references pos_ventas(folio) on delete cascade,
    producto_id bigint references pos_productos(id) on delete set null,
    codigo text not null,
    descripcion text not null,
    precio numeric(10,2) not null,
    cantidad integer not null check (cantidad > 0)
);

-- ---------- FUNCIÓN DE ROL ----------

-- security definer evita recursión con las políticas de perfiles
create or replace function pos_es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1 from pos_perfiles
        where id = auth.uid() and rol = 'admin'
    );
$$;

-- ¿Es usuario del POS? En proyecto compartido, "authenticated"
-- no basta: también entrarían los usuarios de la app inv_*.
create or replace function pos_tiene_perfil()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1 from pos_perfiles
        where id = auth.uid()
    );
$$;

-- ---------- VENTA ATÓMICA (RPC) ----------

-- Registra la venta + detalle + descuento de inventario en UNA
-- transacción. El cajero no tiene permiso directo de UPDATE en
-- productos, así que esta función corre como definer.
create or replace function pos_registrar_venta(p_items jsonb, p_pago numeric)
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
    if not pos_tiene_perfil() then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;

    -- Validar existencia y calcular total en el servidor
    -- (nunca confiar en el total que manda el cliente)
    for item in select * from jsonb_array_elements(p_items) loop
        select * into prod
        from pos_productos
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

    insert into pos_ventas (cajero_id, total, pago, cambio)
    values (auth.uid(), v_total, p_pago, p_pago - v_total)
    returning folio into v_folio;

    for item in select * from jsonb_array_elements(p_items) loop
        update pos_productos
        set cantidad = cantidad - (item->>'cantidad')::int
        where id = (item->>'producto_id')::bigint;

        insert into pos_detalle_venta (venta_id, producto_id, codigo, descripcion, precio, cantidad)
        select v_folio, p.id, p.codigo, p.descripcion, p.venta, (item->>'cantidad')::int
        from pos_productos p
        where p.id = (item->>'producto_id')::bigint;
    end loop;

    return v_folio;
end;
$$;

revoke all on function pos_registrar_venta(jsonb, numeric) from public;
grant execute on function pos_registrar_venta(jsonb, numeric) to authenticated;

-- ---------- ROW LEVEL SECURITY ----------

alter table pos_perfiles enable row level security;
alter table pos_productos enable row level security;
alter table pos_proveedores enable row level security;
alter table pos_ventas enable row level security;
alter table pos_detalle_venta enable row level security;

-- perfiles: cada usuario lee el suyo; admin gestiona todos
create policy "perfiles_lectura_propia" on pos_perfiles
    for select to authenticated
    using (id = auth.uid() or pos_es_admin());
create policy "perfiles_admin" on pos_perfiles
    for all to authenticated
    using (pos_es_admin());

-- productos: usuarios del POS leen; solo admin escribe
create policy "productos_lectura" on pos_productos
    for select to authenticated
    using (pos_tiene_perfil());
create policy "productos_admin" on pos_productos
    for all to authenticated
    using (pos_es_admin());

-- proveedores: igual que productos
create policy "proveedores_lectura" on pos_proveedores
    for select to authenticated
    using (pos_tiene_perfil());
create policy "proveedores_admin" on pos_proveedores
    for all to authenticated
    using (pos_es_admin());

-- ventas: cajero inserta y ve las suyas; admin ve todo
create policy "ventas_insert" on pos_ventas
    for insert to authenticated
    with check (cajero_id = auth.uid() and pos_tiene_perfil());
create policy "ventas_lectura" on pos_ventas
    for select to authenticated
    using (cajero_id = auth.uid() or pos_es_admin());

-- detalle_venta: sigue el acceso de su venta padre
create policy "detalle_insert" on pos_detalle_venta
    for insert to authenticated
    with check (
        exists (
            select 1 from pos_ventas v
            where v.folio = pos_detalle_venta.venta_id
              and v.cajero_id = auth.uid()
        )
    );
create policy "detalle_lectura" on pos_detalle_venta
    for select to authenticated
    using (
        exists (
            select 1 from pos_ventas v
            where v.folio = pos_detalle_venta.venta_id
              and (v.cajero_id = auth.uid() or pos_es_admin())
        )
    );
