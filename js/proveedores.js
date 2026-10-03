// Proveedores desde Supabase (tabla pos_proveedores)
const tablaBody = document.getElementById("tablaProveedores");

let proveedores = [];

function celda(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function celdaIcono(clase, onClick) {
    const td = document.createElement("td");
    const icono = document.createElement("i");
    icono.className = `las ${clase}`;
    icono.addEventListener("click", onClick);
    td.appendChild(icono);
    return td;
}

function renderTabla() {
    const mensajeVacio = document.getElementById("sinProveedores");

    mensajeVacio.style.display = proveedores.length === 0 ? "block" : "none";
    tablaBody.innerHTML = "";

    proveedores.forEach((prov, index) => {
        const fila = document.createElement("tr");
        fila.appendChild(celda(prov.codigo));
        fila.appendChild(celda(prov.nombre));
        fila.appendChild(celda(prov.razon));
        fila.appendChild(celda(prov.telefono));
        fila.appendChild(celda(prov.direccion));
        fila.appendChild(celda(prov.correo));
        fila.appendChild(celdaIcono("la-trash-alt", () => eliminarProveedor(index)));
        fila.appendChild(celdaIcono("la-edit", () => editarProveedor(index)));
        tablaBody.appendChild(fila);
    });
}

async function cargarProveedores() {
    const { data, error } = await _supabase
        .from("pos_proveedores")
        .select("*")
        .order("codigo");

    if (error) {
        console.error("Error cargando proveedores:", error.message);
        alert("No se pudieron cargar los proveedores.");
        return;
    }
    proveedores = data;
    renderTabla();
}

async function eliminarProveedor(index) {
    if (!confirm("¿Eliminar proveedor?")) return;

    const { error } = await _supabase
        .from("pos_proveedores")
        .delete()
        .eq("id", proveedores[index].id);

    if (error) {
        alert("No se pudo eliminar: " + error.message);
        return;
    }
    proveedores.splice(index, 1);
    renderTabla();
}

async function editarProveedor(index) {
    const prov = proveedores[index];
    const nombre = prompt("Nombre:", prov.nombre);
    const razon = prompt("Razón social:", prov.razon);
    const telefono = prompt("Teléfono:", prov.telefono);
    const direccion = prompt("Dirección:", prov.direccion);
    const correo = prompt("Correo:", prov.correo);

    if (!nombre || !razon || !telefono || !direccion || !correo) return;

    const cambios = {
        nombre: nombre.trim(),
        razon: razon.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        correo: correo.trim()
    };

    const { error } = await _supabase
        .from("pos_proveedores")
        .update(cambios)
        .eq("id", prov.id);

    if (error) {
        alert("No se pudo actualizar: " + error.message);
        return;
    }
    proveedores[index] = { ...prov, ...cambios };
    renderTabla();
}

document.addEventListener("DOMContentLoaded", cargarProveedores);
