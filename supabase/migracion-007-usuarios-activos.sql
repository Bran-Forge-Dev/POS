-- ============================================================
-- Migración 007 — Usuarios desactivables (borrado completo)
-- Ejecutar UNA VEZ después de migracion-006-corte-obligatorio.sql
--
-- pos_ventas.cajero_id y pos_cortes.cajero_id referencian
-- auth.users SIN cascade: un usuario con historial no puede
-- borrarse físicamente sin romper la auditoría.
--
-- Modelo:
--   - Sin historial  -> la Edge Function borra auth.users
--                       (cascade elimina el perfil)
--   - Con historial  -> soft delete de auth + activo=false
--
-- Las funciones de RLS exigen activo para que un JWT aún
-- vigente pierda acceso a los datos de inmediato.
-- ============================================================

alter table pos_perfiles
    add column if not exists activo boolean not null default true;

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
