-- Datos de ejemplo para demo — ejecutar después de schema.sql
-- Productos de prueba para el punto de venta
insert into pos_productos (codigo, descripcion, costo, venta, mayoreo, cantidad, minimo) values
    ('1001', 'Coca-Cola 600ml', 10.00, 18.00, 16.00, 25, 5),
    ('1002', 'Galletas Oreo', 8.00, 14.50, 13.00, 10, 3),
    ('1003', 'Sabritas 45g', 7.00, 12.00, 10.50, 15, 5),
    ('1004', 'Agua Bonafont 1L', 8.00, 13.00, 11.50, 20, 6),
    ('1005', 'Pan Bimbo Grande', 30.00, 42.00, 38.00, 8, 2)
on conflict (codigo) do nothing;

-- Proveedores de ejemplo
insert into pos_proveedores (codigo, nombre, razon, telefono, direccion, correo) values
    ('P001', 'Coca-Cola FEMSA', 'Coca-Cola FEMSA S.A.B. de C.V.', '8000000000', 'Monterrey, N.L.', 'ventas@cocacola.com'),
    ('P002', 'Bimbo', 'Grupo Bimbo S.A.B. de C.V.', '8001111111', 'Ciudad de México', 'contacto@bimbo.com')
on conflict (codigo) do nothing;
