// 1. Obtener productos desde localStorage
let productos = JSON.parse(localStorage.getItem("productos")) || [];

// 2. Referencia al cuerpo de la tabla
const tablaBody = document.getElementById("tablaProductosBody");

function celda(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function celdaIcono(clase, onClick) {
    const td = document.createElement("td");
    td.className = "col-icono";
    const icono = document.createElement("i");
    icono.className = `las ${clase} icono-tabla`;
    icono.addEventListener("click", onClick);
    td.appendChild(icono);
    return td;
}

/**
 * Renderiza la lista de productos en el HTML
 */
function renderizarProductos() {
    if (!tablaBody) {
        console.error("No se encontró el elemento con ID 'tablaProductosBody'");
        return;
    }
    tablaBody.innerHTML = "";

    productos.forEach((producto, index) => {
        const fila = document.createElement("tr");
        fila.appendChild(celda(producto.codigo));
        fila.appendChild(celda(producto.descripcion));
        fila.appendChild(celda(`$${Number(producto.costo).toFixed(2)}`));
        fila.appendChild(celda(`$${Number(producto.venta).toFixed(2)}`));
        fila.appendChild(celda(`$${Number(producto.mayoreo).toFixed(2)}`));
        fila.appendChild(celda(String(producto.cantidad)));
        fila.appendChild(celdaIcono("la-trash-alt", () => eliminarProducto(index)));
        fila.appendChild(celdaIcono("la-edit", () => editarProducto(index)));
        tablaBody.appendChild(fila);
    });
}

/**
 * Elimina un producto por su índice
 * @param {number} index - Posición del producto en el array
 */
function eliminarProducto(index) {
    if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
        productos.splice(index, 1);
        localStorage.setItem("productos", JSON.stringify(productos));
        renderizarProductos();
    }
}

/**
 * Edita un producto por su índice
 * @param {number} index - Posición del producto en el array
 */
function editarProducto(index) {
    const p = productos[index];
    const descripcion = prompt("Descripción:", p.descripcion);
    const costo = prompt("Precio costo:", p.costo);
    const venta = prompt("Precio venta:", p.venta);
    const mayoreo = prompt("Precio mayoreo:", p.mayoreo);
    const cantidad = prompt("Cantidad actual:", p.cantidad);

    if (!descripcion || costo === null || venta === null || mayoreo === null || cantidad === null) return;

    const nums = [Number(costo), Number(venta), Number(mayoreo), Number(cantidad)];
    if (nums.some(isNaN)) {
        alert("Los precios y la cantidad deben ser números.");
        return;
    }

    productos[index] = {
        ...p,
        descripcion: descripcion.trim(),
        costo: nums[0],
        venta: nums[1],
        mayoreo: nums[2],
        cantidad: nums[3]
    };
    localStorage.setItem("productos", JSON.stringify(productos));
    renderizarProductos();
}

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    renderizarProductos();
});
