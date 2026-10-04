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
        const tdCantidad = celda(String(producto.cantidad));
        // Stock bajo: en o por debajo del mínimo configurado
        if (Number(producto.minimo) > 0 && producto.cantidad <= producto.minimo) {
            tdCantidad.classList.add("stock-bajo");
            tdCantidad.title = `Stock bajo (mínimo ${producto.minimo})`;
        }
        fila.appendChild(tdCantidad);
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
        toast("No se pudieron cargar los productos.", "error");
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
    if (!await confirmar("¿Estás seguro de que deseas eliminar este producto?")) return;

    const { error } = await _supabase
        .from("pos_productos")
        .delete()
        .eq("id", productos[index].id);

    if (error) {
        toast("No se pudo eliminar: " + error.message, "error");
        return;
    }
    toast("Producto eliminado.", "ok");
    productos.splice(index, 1);
    renderizarProductos();
}

/**
 * Edita un producto por su índice
 * @param {number} index - Posición del producto en el array
 */
async function editarProducto(index) {
    const p = productos[index];
    const valores = await preguntarCampos("Editar producto", [
        { label: "Descripción", valor: p.descripcion },
        { label: "Precio costo", valor: p.costo },
        { label: "Precio venta", valor: p.venta },
        { label: "Precio mayoreo", valor: p.mayoreo },
        { label: "Cantidad actual", valor: p.cantidad }
    ]);
    if (!valores) return;

    const [descripcion, costo, venta, mayoreo, cantidad] = valores;
    const nums = [Number(costo), Number(venta), Number(mayoreo), Number(cantidad)];
    if (!descripcion.trim() || nums.some(isNaN)) {
        toast("Revisa los datos: precios y cantidad deben ser números.", "error");
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
        toast("No se pudo actualizar: " + error.message, "error");
        return;
    }
    productos[index] = { ...p, ...cambios };
    renderizarProductos();
    toast("Producto actualizado.", "ok");
}

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", cargarProductos);
