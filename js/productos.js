// Productos desde Supabase (tabla pos_productos)
let productos = [];

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

async function cargarProductos() {
    const { data, error } = await _supabase
        .from("pos_productos")
        .select("*")
        .order("codigo");

    if (error) {
        console.error("Error cargando productos:", error.message);
        alert("No se pudieron cargar los productos.");
        return;
    }
    productos = data;
    renderizarProductos();
}

/**
 * Elimina un producto por su índice
 * @param {number} index - Posición del producto en el array
 */
async function eliminarProducto(index) {
    if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;

    const { error } = await _supabase
        .from("pos_productos")
        .delete()
        .eq("id", productos[index].id);

    if (error) {
        alert("No se pudo eliminar: " + error.message);
        return;
    }
    productos.splice(index, 1);
    renderizarProductos();
}

/**
 * Edita un producto por su índice
 * @param {number} index - Posición del producto en el array
 */
async function editarProducto(index) {
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

    const cambios = {
        descripcion: descripcion.trim(),
        costo: nums[0],
        venta: nums[1],
        mayoreo: nums[2],
        cantidad: nums[3]
    };

    const { error } = await _supabase
        .from("pos_productos")
        .update(cambios)
        .eq("id", p.id);

    if (error) {
        alert("No se pudo actualizar: " + error.message);
        return;
    }
    productos[index] = { ...p, ...cambios };
    renderizarProductos();
}

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", cargarProductos);
