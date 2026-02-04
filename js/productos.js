// ===============================
// Obtener productos desde localStorage
// ===============================
let productos = JSON.parse(localStorage.getItem("productos")) || [];

// ===============================
// Referencias del DOM
// ===============================
const tablaBody = document.getElementById("tablaProductosBody");
const btnAgregar = document.getElementById("btnAgregarProducto");

// ===============================
// Renderizar tabla de productos
// ===============================
function renderizarProductos() {
    // Limpiar tabla
    tablaBody.innerHTML = "";

    // Si no hay productos, no mostrar filas
    if (productos.length === 0) {
        return;
    }

    productos.forEach((producto, index) => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.descripcion}</td>
            <td>$${Number(producto.precioCosto).toFixed(2)}</td>
            <td>$${Number(producto.precioVenta).toFixed(2)}</td>
            <td>$${Number(producto.precioMayoreo).toFixed(2)}</td>
            <td>${producto.existencia}</td>
            <td class="acciones">
                <a href="agregar-producto.html?editar=${index}" class="icon editar" title="Editar">
                    <i class="la la-edit"></i>
                </a>
                <a href="#" class="icon eliminar" title="Eliminar" onclick="eliminarProducto(${index})">
                    <i class="la la-trash"></i>
                </a>
            </td>
        `;

        tablaBody.appendChild(fila);
    });
}

// ===============================
// Eliminar producto
// ===============================
function eliminarProducto(index) {
    const confirmar = confirm("¿Seguro que deseas eliminar este producto?");
    if (!confirmar) return;

    productos.splice(index, 1);
    localStorage.setItem("productos", JSON.stringify(productos));
    renderizarProductos();
}

// ===============================
// Botón Agregar Producto
// ===============================
if (btnAgregar) {
    btnAgregar.addEventListener("click", () => {
        window.location.href = "agregar-producto.html";
    });
}

// ===============================
// Inicializar
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    renderizarProductos();
});
