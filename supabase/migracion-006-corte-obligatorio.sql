-- ============================================================
-- Migración 006 — Corte obligatorio para vender
-- Ejecutar UNA VEZ después de migracion-005-mayoreo.sql
--
-- Antes: la venta se registraba aunque no hubiera corte abierto
--        (corte_id quedaba null → dinero fuera del arqueo).
-- Ahora: sin corte abierto la venta se rechaza en el servidor.
-- ============================================================

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
