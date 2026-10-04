-- ============================================================
-- Migración 004 — Reporte de productos más vendidos
-- Ejecutar UNA VEZ después de migracion-003-cancelaciones.sql
-- ============================================================

-- Top productos por rango de fechas.
-- Respeta el mismo criterio de lectura de ventas: el cajero
-- solo ve lo suyo; admin toda su tienda; superadmin todo.
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
