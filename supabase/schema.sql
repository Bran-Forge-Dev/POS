-- ============================================================
-- NeoVenta POS — Esquema multi-tienda (Supabase)
-- Ejecutar completo en: SQL Editor del proyecto en supabase.com
--
-- Multi-tenancy: cada usuario pertenece a una tienda y solo ve
-- sus datos. El RLS hace la separación, no el cliente.
-- 'superadmin' opera entre tiendas (tienda_id null).
--
-- Prefijo pos_ para coexistir con otras apps del mismo proyecto
-- (p. ej. inv_* de inventario).
-- ============================================================

-- ---------- TABLAS ----------

-- Una tienda = un tenant. es_demo marca la tienda del demo público.
create table if not exists pos_tiendas (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    es_demo boolean not null default false,
    created_at timestamptz not null default now()
);

-- Perfil de usuario ligado a auth.users (cuenta + rol + tienda).
-- cuenta es única GLOBAL (es el login: cuenta@neoventa.local).
-- superadmin es el único rol sin tienda (opera entre tiendas).
create table if not exists pos_perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    tienda_id uuid references pos_tiendas(id),
    cuenta text not null unique,
    rol text not null default 'cajero' check (rol in ('admin', 'cajero', 'superadmin')),
    telefono text default '',
    correo text default '',
    fecha_nacimiento date,
    -- false = usuario desactivado (con historial: no se puede
    -- borrar auth.users porque ventas/cortes lo referencian)
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    check (tienda_id is not null or rol = 'superadmin')
);

create table if not exists pos_productos (
    id bigint generated always as identity primary key,
    tienda_id uuid not null references pos_tiendas(id),
    codigo text not null,
    descripcion text not null,
    costo numeric(10,2) not null default 0 check (costo >= 0),
    venta numeric(10,2) not null default 0 check (venta >= 0),
    mayoreo numeric(10,2) not null default 0 check (mayoreo >= 0),
    cantidad integer not null default 0 check (cantidad >= 0),
    minimo integer not null default 0,
    created_at timestamptz not null default now(),
    -- el código se repite entre tiendas, único solo dentro de cada una
    unique (tienda_id, codigo)
);

create table if not exists pos_proveedores (
    id bigint generated always as identity primary key,
    tienda_id uuid not null references pos_tiendas(id),
    codigo text not null,
    nombre text not null,
    razon text default '',
    telefono text default '',
    direccion text default '',
    correo text default '',
    created_at timestamptz not null default now(),
    unique (tienda_id, codigo)
);

-- Corte de caja: apertura con fondo, cierre con arqueo
-- (esperado vs contado -> faltante/sobrante)
create table if not exists pos_cortes (
    id bigint generated always as identity primary key,
    tienda_id uuid not null references pos_tiendas(id),
    cajero_id uuid not null references auth.users(id),  -- quien abrió
    abierto_en timestamptz not null default now(),
    cerrado_en timestamptz,
    fondo_inicial numeric(10,2) not null default 0 check (fondo_inicial >= 0),
    total_ventas numeric(12,2),
    num_ventas integer,
    efectivo_esperado numeric(12,2),   -- fondo + ventas
    efectivo_contado numeric(12,2),    -- lo contado físicamente
    diferencia numeric(12,2),          -- contado - esperado (- faltante / + sobrante)
    estado text not null default 'abierto' check (estado in ('abierto', 'cerrado'))
);

-- Una sola caja abierta por tienda a la vez
create unique index if not exists pos_cortes_una_abierta
    on pos_cortes (tienda_id) where estado = 'abierto';

-- Encabezado de venta; el folio ES la llave primaria (global,
-- no reinicia por tienda — para folios por tienda haría falta
-- una secuencia por tenant, overkill por ahora)
create table if not exists pos_ventas (
    folio bigint generated always as identity primary key,
    tienda_id uuid not null references pos_tiendas(id),
    cajero_id uuid not null references auth.users(id),
    corte_id bigint references pos_cortes(id),  -- corte vigente al vender
    fecha timestamptz not null default now(),
    total numeric(12,2) not null check (total >= 0),
    pago numeric(12,2) not null check (pago >= 0),
    cambio numeric(12,2) not null check (cambio >= 0),
    -- cancelación: la venta no se borra, queda el audit trail
    cancelada boolean not null default false,
    cancelada_en timestamptz,
    cancelada_por uuid references auth.users(id)
);

-- Detalle: copia codigo/descripcion/precio para conservar
-- el histórico aunque el producto cambie o se borre después.
-- Su tienda se hereda de la venta padre (join en las políticas).
create table if not exists pos_detalle_venta (
    id bigint generated always as identity primary key,
    venta_id bigint not null references pos_ventas(folio) on delete cascade,
    producto_id bigint references pos_productos(id) on delete set null,
    codigo text not null,
    descripcion text not null,
    precio numeric(10,2) not null,
    cantidad integer not null check (cantidad > 0)
);

-- ---------- FUNCIONES DE ROL / TENANT ----------

-- security definer evita recursión con las políticas de perfiles

-- Tienda del usuario autenticado (null si es superadmin)
create or replace function pos_mi_tienda()
returns uuid
language sql stable security definer
set search_path = public
as $$
    select tienda_id from pos_perfiles
    where id = auth.uid() and activo
$$;

create or replace function pos_es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1 from pos_perfiles
        where id = auth.uid() and rol = 'admin' and activo
    );
$$;

create or replace function pos_es_superadmin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1 from pos_perfiles
        where id = auth.uid() and rol = 'superadmin' and activo
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
        where id = auth.uid() and activo
    );
$$;

-- Los inserts del cliente no mandan tienda_id: la columna la
-- llena sola con la tienda del usuario autenticado.
alter table pos_perfiles    alter column tienda_id set default pos_mi_tienda();
alter table pos_productos   alter column tienda_id set default pos_mi_tienda();
alter table pos_proveedores alter column tienda_id set default pos_mi_tienda();
alter table pos_ventas      alter column tienda_id set default pos_mi_tienda();

create index if not exists idx_pos_productos_tienda on pos_productos(tienda_id);
create index if not exists idx_pos_proveedores_tienda on pos_proveedores(tienda_id);
create index if not exists idx_pos_ventas_tienda_fecha on pos_ventas(tienda_id, fecha);
create index if not exists idx_pos_ventas_corte on pos_ventas(corte_id);
create index if not exists idx_pos_cortes_tienda on pos_cortes(tienda_id);
create index if not exists idx_pos_perfiles_tienda on pos_perfiles(tienda_id);

-- ---------- CORTE DE CAJA (RPC) ----------

-- Abrir caja: una sola abierta por tienda (índice lo garantiza)
create or replace function pos_abrir_corte(p_fondo numeric)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
    v_tienda uuid;
    v_id bigint;
begin
    select tienda_id into v_tienda from pos_perfiles where id = auth.uid();
    if v_tienda is null then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;
    if exists (select 1 from pos_cortes where tienda_id = v_tienda and estado = 'abierto') then
        raise exception 'Ya hay un corte abierto en esta tienda';
    end if;

    insert into pos_cortes (tienda_id, cajero_id, fondo_inicial)
    values (v_tienda, auth.uid(), p_fondo)
    returning id into v_id;

    return v_id;
end;
$$;

-- Cerrar caja: arqueo en una transacción, devuelve el corte como json
create or replace function pos_cerrar_corte(p_contado numeric)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    v_tienda uuid;
    v_corte pos_cortes;
    v_total numeric;
    v_num int;
begin
    select tienda_id into v_tienda from pos_perfiles where id = auth.uid();
    if v_tienda is null then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;

    select * into v_corte
    from pos_cortes
    where tienda_id = v_tienda and estado = 'abierto'
    for update;

    if not found then
        raise exception 'No hay corte abierto en esta tienda';
    end if;

    select coalesce(sum(total), 0), count(*)
    into v_total, v_num
    from pos_ventas
    where corte_id = v_corte.id
      and not cancelada;

    update pos_cortes set
        estado            = 'cerrado',
        cerrado_en        = now(),
        total_ventas      = v_total,
        num_ventas        = v_num,
        efectivo_esperado = fondo_inicial + v_total,
        efectivo_contado  = p_contado,
        diferencia        = p_contado - (fondo_inicial + v_total)
    where id = v_corte.id
    returning * into v_corte;

    return row_to_json(v_corte);
end;
$$;

-- ---------- VENTA ATÓMICA (RPC) ----------

-- Registra la venta + detalle + descuento de inventario en UNA
-- transacción, limitada a la tienda del cajero. El cajero no
-- tiene permiso directo de UPDATE en productos, así que esta
-- función corre como definer.
create or replace function pos_registrar_venta(p_items jsonb, p_pago numeric)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
    v_folio bigint;
    v_tienda uuid;
    v_corte bigint;
    v_precio numeric;
    v_total numeric := 0;
    item jsonb;
    prod record;
begin
    select tienda_id into v_tienda from pos_perfiles where id = auth.uid();
    if v_tienda is null then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;

    -- Corte abierto obligatorio: sin caja abierta no se vende
    select id into v_corte
    from pos_cortes
    where tienda_id = v_tienda and estado = 'abierto';

    if v_corte is null then
        raise exception 'La caja está cerrada. Abre un corte en la sección Ventas antes de cobrar.';
    end if;

    -- Validar existencia y calcular total en el servidor,
    -- solo contra productos de la propia tienda
    -- (nunca confiar en el total que manda el cliente)
    for item in select * from jsonb_array_elements(p_items) loop
        select * into prod
        from pos_productos
        where id = (item->>'producto_id')::bigint
          and tienda_id = v_tienda
        for update;

        if not found then
            raise exception 'Producto % no existe en esta tienda', item->>'producto_id';
        end if;
        if prod.cantidad < (item->>'cantidad')::int then
            raise exception 'Sin existencia suficiente para % (disponible: %)',
                prod.descripcion, prod.cantidad;
        end if;

        -- El servidor decide el precio; el cliente solo pide la modalidad
        v_precio := case when coalesce((item->>'es_mayoreo')::boolean, false)
                         then prod.mayoreo else prod.venta end;
        v_total := v_total + v_precio * (item->>'cantidad')::int;
    end loop;

    if p_pago < v_total then
        raise exception 'Pago insuficiente: faltan %', (v_total - p_pago);
    end if;

    insert into pos_ventas (cajero_id, tienda_id, corte_id, total, pago, cambio)
    values (auth.uid(), v_tienda, v_corte, v_total, p_pago, p_pago - v_total)
    returning folio into v_folio;

    for item in select * from jsonb_array_elements(p_items) loop
        update pos_productos
        set cantidad = cantidad - (item->>'cantidad')::int
        where id = (item->>'producto_id')::bigint
          and tienda_id = v_tienda;

        insert into pos_detalle_venta (venta_id, producto_id, codigo, descripcion, precio, cantidad)
        select v_folio, p.id, p.codigo, p.descripcion,
               case when coalesce((item->>'es_mayoreo')::boolean, false)
                    then p.mayoreo else p.venta end,
               (item->>'cantidad')::int
        from pos_productos p
        where p.id = (item->>'producto_id')::bigint;
    end loop;

    return v_folio;
end;
$$;

-- Cancelar venta: la marca (sin borrarla) y regresa el stock
-- en una transacción. admin cancela cualquiera de su tienda;
-- el cajero solo las suyas mientras su corte siga abierto.
create or replace function pos_cancelar_venta(p_folio bigint)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
    v_tienda uuid;
    v_venta pos_ventas;
begin
    select tienda_id into v_tienda from pos_perfiles where id = auth.uid();
    if v_tienda is null then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;

    select * into v_venta
    from pos_ventas
    where folio = p_folio and tienda_id = v_tienda
    for update;

    if not found then
        raise exception 'La venta no existe en esta tienda';
    end if;
    if v_venta.cancelada then
        raise exception 'La venta ya está cancelada';
    end if;

    if not pos_es_admin() then
        if v_venta.cajero_id <> auth.uid() then
            raise exception 'Solo un admin puede cancelar ventas de otros';
        end if;
        if v_venta.corte_id is null or not exists (
            select 1 from pos_cortes
            where id = v_venta.corte_id and estado = 'abierto'
        ) then
            raise exception 'El corte ya está cerrado; pide a un admin cancelarla';
        end if;
    end if;

    update pos_ventas set
        cancelada      = true,
        cancelada_en   = now(),
        cancelada_por  = auth.uid()
    where folio = p_folio;

    update pos_productos p
    set cantidad = p.cantidad + d.cantidad
    from pos_detalle_venta d
    where d.venta_id = p_folio
      and p.id = d.producto_id
      and p.tienda_id = v_tienda;

    return true;
end;
$$;

revoke all on function pos_registrar_venta(jsonb, numeric) from public;
grant execute on function pos_registrar_venta(jsonb, numeric) to authenticated;
revoke all on function pos_abrir_corte(numeric) from public;
revoke all on function pos_cerrar_corte(numeric) from public;
grant execute on function pos_abrir_corte(numeric) to authenticated;
grant execute on function pos_cerrar_corte(numeric) to authenticated;
revoke all on function pos_cancelar_venta(bigint) from public;
grant execute on function pos_cancelar_venta(bigint) to authenticated;

-- ---------- REPORTES (RPC) ----------

-- Top productos por rango de fechas. El cajero ve solo lo suyo.
create or replace function pos_top_productos(p_desde date, p_hasta date, p_limite int default 20)
returns table(codigo text, descripcion text, unidades bigint, importe numeric)
language sql stable security definer
set search_path = public
as $$
    select d.codigo,
           d.descripcion,
           sum(d.cantidad)::bigint as unidades,
           sum(d.precio * d.cantidad) as importe
    from pos_detalle_venta d
    join pos_ventas v on v.folio = d.venta_id
    where v.tienda_id = pos_mi_tienda()
      and not v.cancelada
      and v.fecha::date between p_desde and p_hasta
      and (pos_es_admin() or pos_es_superadmin() or v.cajero_id = auth.uid())
    group by d.codigo, d.descripcion
    order by unidades desc
    limit p_limite;
$$;

revoke all on function pos_top_productos(date, date, int) from public;
grant execute on function pos_top_productos(date, date, int) to authenticated;

-- ---------- ROW LEVEL SECURITY ----------

alter table pos_tiendas enable row level security;
alter table pos_cortes enable row level security;
alter table pos_perfiles enable row level security;
alter table pos_productos enable row level security;
alter table pos_proveedores enable row level security;
alter table pos_ventas enable row level security;
alter table pos_detalle_venta enable row level security;

-- tiendas: cada usuario lee la suya; superadmin las gestiona todas
create policy "tiendas_lectura" on pos_tiendas
    for select to authenticated
    using (id = pos_mi_tienda() or pos_es_superadmin());
create policy "tiendas_superadmin" on pos_tiendas
    for all to authenticated
    using (pos_es_superadmin())
    with check (pos_es_superadmin());

-- cortes: visibles para toda la tienda (la caja se comparte);
-- escritura solo dentro de la propia tienda
create policy "cortes_lectura" on pos_cortes
    for select to authenticated
    using (tienda_id = pos_mi_tienda() or pos_es_superadmin());
create policy "cortes_insert" on pos_cortes
    for insert to authenticated
    with check (tienda_id = pos_mi_tienda() or pos_es_superadmin());
create policy "cortes_update" on pos_cortes
    for update to authenticated
    using (tienda_id = pos_mi_tienda() or pos_es_superadmin())
    with check (tienda_id = pos_mi_tienda() or pos_es_superadmin());

-- perfiles: usuarios de la misma tienda se ven entre sí
-- (necesario para el listado de Control de Usuarios)
create policy "perfiles_lectura" on pos_perfiles
    for select to authenticated
    using (id = auth.uid() or tienda_id = pos_mi_tienda() or pos_es_superadmin());
create policy "perfiles_admin_insert" on pos_perfiles
    for insert to authenticated
    with check (
        pos_es_superadmin()
        or (pos_es_admin() and tienda_id = pos_mi_tienda())
    );
create policy "perfiles_admin_update" on pos_perfiles
    for update to authenticated
    using (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()))
    with check (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));
create policy "perfiles_admin_delete" on pos_perfiles
    for delete to authenticated
    using (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));

-- productos: la tienda los lee; solo su admin escribe
create policy "productos_lectura" on pos_productos
    for select to authenticated
    using (tienda_id = pos_mi_tienda() or pos_es_superadmin());
create policy "productos_admin_insert" on pos_productos
    for insert to authenticated
    with check (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));
create policy "productos_admin_update" on pos_productos
    for update to authenticated
    using (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()))
    with check (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));
create policy "productos_admin_delete" on pos_productos
    for delete to authenticated
    using (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));

-- proveedores: igual que productos
create policy "proveedores_lectura" on pos_proveedores
    for select to authenticated
    using (tienda_id = pos_mi_tienda() or pos_es_superadmin());
create policy "proveedores_admin_insert" on pos_proveedores
    for insert to authenticated
    with check (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));
create policy "proveedores_admin_update" on pos_proveedores
    for update to authenticated
    using (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()))
    with check (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));
create policy "proveedores_admin_delete" on pos_proveedores
    for delete to authenticated
    using (pos_es_superadmin() or (pos_es_admin() and tienda_id = pos_mi_tienda()));

-- ventas: cajero inserta en su tienda y ve las suyas;
-- admin ve todas las de su tienda; superadmin todo
create policy "ventas_insert" on pos_ventas
    for insert to authenticated
    with check (
        cajero_id = auth.uid()
        and tienda_id = pos_mi_tienda()
        and pos_tiene_perfil()
    );
create policy "ventas_lectura" on pos_ventas
    for select to authenticated
    using (
        pos_es_superadmin()
        or (tienda_id = pos_mi_tienda() and (cajero_id = auth.uid() or pos_es_admin()))
    );

-- detalle_venta: sigue el acceso de su venta padre
create policy "detalle_insert" on pos_detalle_venta
    for insert to authenticated
    with check (
        exists (
            select 1 from pos_ventas v
            where v.folio = pos_detalle_venta.venta_id
              and v.cajero_id = auth.uid()
              and v.tienda_id = pos_mi_tienda()
        )
    );
create policy "detalle_lectura" on pos_detalle_venta
    for select to authenticated
    using (
        exists (
            select 1 from pos_ventas v
            where v.folio = pos_detalle_venta.venta_id
              and (
                    pos_es_superadmin()
                    or (v.tienda_id = pos_mi_tienda()
                        and (v.cajero_id = auth.uid() or pos_es_admin()))
                  )
        )
    );

-- ============================================================
-- SETUP INICIAL (después de correr este archivo):
--
-- 1. Crear la(s) tienda(s):
--      insert into pos_tiendas (nombre) values ('Mi Tienda');
--
-- 2. Crear el primer superadmin en Authentication → Users
--    (email: root@neoventa.local, Auto Confirm ON) y luego:
--      insert into pos_perfiles (id, cuenta, rol)
--      values ('UUID-DEL-USUARIO', 'root', 'superadmin');
--
--    O para un admin de tienda (flujo normal):
--      insert into pos_perfiles (id, tienda_id, cuenta, rol)
--      values ('UUID', (select id from pos_tiendas where nombre='Mi Tienda'), 'admin', 'admin');
--
-- 3. Para el demo público: correr seed.sql (crea 'Tienda Demo'
--    con productos) y registrar sus usuarios con tienda_id = la
--    tienda demo. Las credenciales demo van en el portafolio.
-- ============================================================
