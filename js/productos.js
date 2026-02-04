// 1. Obtener productos desde localStorage
let productos = JSON.parse(localStorage.getItem("productos")) || [];

// 2. Referencia al cuerpo de la tabla
const tablaBody = document.getElementById("tablaProductosBody");

/**
 * Renderiza la lista de productos en el HTML
 */
function renderizarProductos() {
    // Limpiar tabla antes de renderizar para evitar duplicados
    if (tablaBody) {
        tablaBody.innerHTML = "";
    } else {
        console.error("No se encontró el elemento con ID 'tablaProductosBody'");
        return;
    }

    // Si no hay productos, la tabla se queda vacía
    if (productos.length === 0) {
        return;
    }

    productos.forEach((producto, index) => {
        const fila = document.createElement("tr");

        // Estructura de la fila con los datos y botones de acción
        fila.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.descripcion}</td>
            <td>$${Number(producto.costo).toFixed(2)}</td>
            <td>$${Number(producto.venta).toFixed(2)}</td>
            <td>$${Number(producto.mayoreo).toFixed(2)}</td>
            <td>${producto.cantidad}</td>
            
            <td class="col-icono">
                <a href="#" class="enlace-icono" onclick="eliminarProducto(${index})">
                    <i class="las la-trash-alt icono-tabla"></i>
                </a>
            </td>
            
            <td class="col-icono">
                <a href="EditarProducto.html?index=${index}" class="enlace-icono">
                    <i class="las la-edit icono-tabla"></i>
                </a>
            </td>
        `;

        tablaBody.appendChild(fila);
    });
}

/**
 * Elimina un producto por su índice
 * @param {number} index - Posición del producto en el array
 */
function eliminarProducto(index) {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
        // Eliminar del array
        productos.splice(index, 1);
        
        // Actualizar LocalStorage
        localStorage.setItem("productos", JSON.stringify(productos));
        
        // Volver a dibujar la tabla
        renderizarProductos();
    }
}

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    renderizarProductos();
});