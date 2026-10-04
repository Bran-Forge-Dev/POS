-- ============================================================
-- Migración 003 — Cancelación de ventas (devolución de stock)
-- Ejecutar UNA VEZ después de migracion-002-cortes.sql
--
-- Reglas:
--   admin      -> cancela cualquier venta de su tienda
--   cajero     -> solo sus ventas y solo si su corte sigue abierto
--   El stock regresa a inventario; la venta NO se borra
--   (queda folio, quién canceló y cuándo — audit trail).
-- ============================================================

-- 1. Campos de cancelación en ventas
alter table pos_ventas add column if not exists cancelada boolean not null default false;
alter table pos_ventas add column if not exists cancelada_en timestamptz;
alter table pos_ventas add column if not exists cancelada_por uuid references auth.users(id);

-- 2. El arqueo del corte ignora ventas canceladas
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

-- 3. Cancelar venta: marca la venta + regresa stock, en una
--    sola transacción. Los permisos se validan aquí, en el servidor.
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
        -- Cajero: solo ventas propias de un corte aún abierto
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

    -- Regresar el stock de cada línea al inventario
    update pos_productos p
    set cantidad = p.cantidad + d.cantidad
    from pos_detalle_venta d
    where d.venta_id = p_folio
      and p.id = d.producto_id
      and p.tienda_id = v_tienda;

    return true;
end;
$$;

revoke all on function pos_cancelar_venta(bigint) from public;
grant execute on function pos_cancelar_venta(bigint) to authenticated;
