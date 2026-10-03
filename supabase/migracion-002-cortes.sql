-- ============================================================
-- Migración 002 — Corte de caja + ventas ligadas al corte
-- Ejecutar UNA VEZ después de migracion-001-tiendas.sql
-- ============================================================

-- 1. Tabla de cortes: apertura con fondo, cierre con arqueo
--    (esperado vs contado -> faltante/sobrante)
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

-- 2. Las ventas quedan etiquetadas con el corte vigente
alter table pos_ventas add column if not exists corte_id bigint references pos_cortes(id);
create index if not exists idx_pos_ventas_corte on pos_ventas(corte_id);
create index if not exists idx_pos_cortes_tienda on pos_cortes(tienda_id);

-- 3. RPC: abrir corte
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

-- 4. RPC: cerrar corte -> arqueo completo en una transacción.
--    Devuelve el corte como json para mostrar el resumen.
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
    where corte_id = v_corte.id;

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

-- 5. registrar_venta ahora etiqueta con el corte abierto (si hay)
create or replace function pos_registrar_venta(p_items jsonb, p_pago numeric)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
    v_folio bigint;
    v_tienda uuid;
    v_corte bigint;
    v_total numeric := 0;
    item jsonb;
    prod record;
begin
    select tienda_id into v_tienda from pos_perfiles where id = auth.uid();
    if v_tienda is null then
        raise exception 'Usuario no autorizado en NeoVenta';
    end if;

    -- Corte abierto de la tienda (puede no haber: venta sin etiquetar)
    select id into v_corte
    from pos_cortes
    where tienda_id = v_tienda and estado = 'abierto';

    -- Validar existencia y calcular total en el servidor,
    -- solo contra productos de la propia tienda
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

    insert into pos_ventas (cajero_id, tienda_id, corte_id, total, pago, cambio)
    values (auth.uid(), v_tienda, v_corte, v_total, p_pago, p_pago - v_total)
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

revoke all on function pos_abrir_corte(numeric) from public;
revoke all on function pos_cerrar_corte(numeric) from public;
grant execute on function pos_abrir_corte(numeric) to authenticated;
grant execute on function pos_cerrar_corte(numeric) to authenticated;

-- 6. RLS: cortes visibles para toda la tienda (la caja se comparte);
--    escritura solo dentro de la propia tienda
alter table pos_cortes enable row level security;

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
