-- ============================================================
-- Migración 001 — Multi-tenancy (ejecutar UNA VEZ si la base
-- ya tiene el esquema anterior sin tiendas).
-- Convierte los datos existentes en la tienda 'Principal'.
-- Idempotente: se puede re-correr sin romper nada.
-- ============================================================

-- 1. Tabla de tiendas + tienda principal
create table if not exists pos_tiendas (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    es_demo boolean not null default false,
    created_at timestamptz not null default now()
);

insert into pos_tiendas (nombre)
select 'Principal' where not exists (select 1 from pos_tiendas);

-- 2. Columna tienda_id en las tablas que la necesitan
alter table pos_perfiles    add column if not exists tienda_id uuid references pos_tiendas(id);
alter table pos_productos   add column if not exists tienda_id uuid references pos_tiendas(id);
alter table pos_proveedores add column if not exists tienda_id uuid references pos_tiendas(id);
alter table pos_ventas      add column if not exists tienda_id uuid references pos_tiendas(id);

-- 3. Rol superadmin + regla: solo superadmin puede no tener tienda
alter table pos_perfiles drop constraint if exists pos_perfiles_rol_check;
alter table pos_perfiles add constraint pos_perfiles_rol_check
    check (rol in ('admin', 'cajero', 'superadmin'));
alter table pos_perfiles drop constraint if exists pos_perfiles_tienda_check;
alter table pos_perfiles add constraint pos_perfiles_tienda_check
    check (tienda_id is not null or rol = 'superadmin');

-- 4. Backfill: todo lo existente pasa a la tienda 'Principal'
update pos_perfiles    set tienda_id = (select id from pos_tiendas order by created_at limit 1) where tienda_id is null and rol <> 'superadmin';
update pos_productos   set tienda_id = (select id from pos_tiendas order by created_at limit 1) where tienda_id is null;
update pos_proveedores set tienda_id = (select id from pos_tiendas order by created_at limit 1) where tienda_id is null;
update pos_ventas      set tienda_id = (select id from pos_tiendas order by created_at limit 1) where tienda_id is null;

-- 5. NOT NULL donde aplica (perfiles queda nullable por superadmin)
alter table pos_productos   alter column tienda_id set not null;
alter table pos_proveedores alter column tienda_id set not null;
alter table pos_ventas      alter column tienda_id set not null;

-- 6. El código pasa a ser único por tienda (dos tiendas pueden
--    tener productos con el mismo código)
alter table pos_productos   drop constraint if exists pos_productos_codigo_key;
alter table pos_proveedores drop constraint if exists pos_proveedores_codigo_key;
alter table pos_productos   drop constraint if exists pos_productos_tienda_codigo_key;
alter table pos_proveedores drop constraint if exists pos_proveedores_tienda_codigo_key;
alter table pos_productos   add constraint pos_productos_tienda_codigo_key unique (tienda_id, codigo);
alter table pos_proveedores add constraint pos_proveedores_tienda_codigo_key unique (tienda_id, codigo);

-- 7. Funciones nuevas
create or replace function pos_mi_tienda()
returns uuid
language sql stable security definer
set search_path = public
as $$
    select tienda_id from pos_perfiles where id = auth.uid()
$$;

create or replace function pos_es_superadmin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1 from pos_perfiles
        where id = auth.uid() and rol = 'superadmin'
    );
$$;

-- 8. Defaults: los inserts del cliente heredan la tienda solos
alter table pos_perfiles    alter column tienda_id set default pos_mi_tienda();
alter table pos_productos   alter column tienda_id set default pos_mi_tienda();
alter table pos_proveedores alter column tienda_id set default pos_mi_tienda();
alter table pos_ventas      alter column tienda_id set default pos_mi_tienda();

create index if not exists idx_pos_productos_tienda on pos_productos(tienda_id);
create index if not exists idx_pos_proveedores_tienda on pos_proveedores(tienda_id);
create index if not exists idx_pos_ventas_tienda_fecha on pos_ventas(tienda_id, fecha);
create index if not exists idx_pos_perfiles_tienda on pos_perfiles(tienda_id);

-- 9. RPC actualizada: venta limitada a la tienda del cajero
create or replace function pos_registrar_venta(p_items jsonb, p_pago numeric)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
    v_folio bigint;
    v_tienda uuid;
    v_total numeric := 0;
    item jsonb;
    prod record;
begin
    select tienda_id into v_tienda from pos_perfiles where id = auth.uid();
    if v_tienda is null then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;

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

        v_total := v_total + prod.venta * (item->>'cantidad')::int;
    end loop;

    if p_pago < v_total then
        raise exception 'Pago insuficiente: faltan %', (v_total - p_pago);
    end if;

    insert into pos_ventas (cajero_id, tienda_id, total, pago, cambio)
    values (auth.uid(), v_tienda, v_total, p_pago, p_pago - v_total)
    returning folio into v_folio;

    for item in select * from jsonb_array_elements(p_items) loop
        update pos_productos
        set cantidad = cantidad - (item->>'cantidad')::int
        where id = (item->>'producto_id')::bigint
          and tienda_id = v_tienda;

        insert into pos_detalle_venta (venta_id, producto_id, codigo, descripcion, precio, cantidad)
        select v_folio, p.id, p.codigo, p.descripcion, p.venta, (item->>'cantidad')::int
        from pos_productos p
        where p.id = (item->>'producto_id')::bigint;
    end loop;

    return v_folio;
end;
$$;

-- 10. RLS: políticas viejas fuera, nuevas con scope de tienda
alter table pos_tiendas enable row level security;

drop policy if exists "perfiles_lectura_propia" on pos_perfiles;
drop policy if exists "perfiles_admin" on pos_perfiles;
drop policy if exists "productos_lectura" on pos_productos;
drop policy if exists "productos_admin" on pos_productos;
drop policy if exists "proveedores_lectura" on pos_proveedores;
drop policy if exists "proveedores_admin" on pos_proveedores;
drop policy if exists "ventas_insert" on pos_ventas;
drop policy if exists "ventas_lectura" on pos_ventas;
drop policy if exists "detalle_insert" on pos_detalle_venta;
drop policy if exists "detalle_lectura" on pos_detalle_venta;

create policy "tiendas_lectura" on pos_tiendas
    for select to authenticated
    using (id = pos_mi_tienda() or pos_es_superadmin());
create policy "tiendas_superadmin" on pos_tiendas
    for all to authenticated
    using (pos_es_superadmin())
    with check (pos_es_superadmin());

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
