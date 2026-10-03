// Cambiamos "tablaProveedoresBody" por "tablaProveedores" para que coincida con tu HTML
const tablaBody = document.getElementById("tablaProveedores");

let proveedores = JSON.parse(localStorage.getItem("proveedores")) || [];

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

    if (proveedores.length === 0) {
        mensajeVacio.style.display = "block";
    } else {
        mensajeVacio.style.display = "none";
    }

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

function eliminarProveedor(index) {
    if (confirm("¿Eliminar proveedor?")) {
        proveedores.splice(index, 1);
        localStorage.setItem("proveedores", JSON.stringify(proveedores));
        renderTabla();
    }
}

function editarProveedor(index) {
    const prov = proveedores[index];
    const nombre = prompt("Nombre:", prov.nombre);
    const razon = prompt("Razón social:", prov.razon);
    const telefono = prompt("Teléfono:", prov.telefono);
    const direccion = prompt("Dirección:", prov.direccion);
    const correo = prompt("Correo:", prov.correo);

    if (!nombre || !razon || !telefono || !direccion || !correo) return;

    proveedores[index] = {
        ...prov,
        nombre: nombre.trim(),
        razon: razon.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        correo: correo.trim()
    };
    localStorage.setItem("proveedores", JSON.stringify(proveedores));
    renderTabla();
}

renderTabla();
