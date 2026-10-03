-- ============================================================
-- Datos de la TIENDA DEMO — ejecutar después del esquema.
-- La tienda demo es un tenant más: sus datos nunca se mezclan
-- con los de tiendas reales (lo garantiza el RLS por tienda_id).
-- Ideal para el link "Demo en vivo" del portafolio.
-- ============================================================

-- Tienda demo con UUID fijo para poder ligar sus usuarios después
insert into pos_tiendas (id, nombre, es_demo)
values ('a0000000-0000-4000-8000-000000000001', 'Tienda Demo', true)
on conflict (id) do nothing;

insert into pos_productos (tienda_id, codigo, descripcion, costo, venta, mayoreo, cantidad, minimo) values
    ('a0000000-0000-4000-8000-000000000001', '1001', 'Coca-Cola 600ml',   10.00, 18.00, 16.00, 25, 5),
    ('a0000000-0000-4000-8000-000000000001', '1002', 'Galletas Oreo',      8.00, 14.50, 13.00, 10, 3),
    ('a0000000-0000-4000-8000-000000000001', '1003', 'Sabritas 45g',       7.00, 12.00, 10.50, 15, 5),
    ('a0000000-0000-4000-8000-000000000001', '1004', 'Agua Bonafont 1L',   8.00, 13.00, 11.50, 20, 6),
    ('a0000000-0000-4000-8000-000000000001', '1005', 'Pan Bimbo Grande',  30.00, 42.00, 38.00,  8, 2)
on conflict (tienda_id, codigo) do nothing;

insert into pos_proveedores (tienda_id, codigo, nombre, razon, telefono, direccion, correo) values
    ('a0000000-0000-4000-8000-000000000001', 'P001', 'Coca-Cola FEMSA', 'Coca-Cola FEMSA S.A.B. de C.V.', '8000000000', 'Monterrey, N.L.', 'ventas@cocacola.com'),
    ('a0000000-0000-4000-8000-000000000001', 'P002', 'Bimbo',           'Grupo Bimbo S.A.B. de C.V.',     '8001111111', 'Ciudad de México', 'contacto@bimbo.com')
on conflict (tienda_id, codigo) do nothing;

-- ============================================================
-- USUARIOS DEMO (hacer en el dashboard, no aquí):
--
-- 1. Authentication → Users → Add user (Auto Confirm ON):
--      demo_admin@neoventa.local   contraseña que quieras publicar
--      demo_cajero@neoventa.local  contraseña que quieras publicar
--
-- 2. Copiar el UUID de cada uno y ligarlos a la tienda demo:
--
--      insert into pos_perfiles (id, tienda_id, cuenta, rol) values
--          ('UUID-DEMO-ADMIN',  'a0000000-0000-4000-8000-000000000001', 'demo_admin',  'admin'),
--          ('UUID-DEMO-CAJERO', 'a0000000-0000-4000-8000-000000000001', 'demo_cajero', 'cajero');
--
-- 3. Esas credenciales (demo_admin / tu-contraseña) son las que
--    van en la tarjeta del portafolio.
-- ============================================================
