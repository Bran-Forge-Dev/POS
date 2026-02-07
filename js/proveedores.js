const tablaBody = document.getElementById("tablaProveedoresBody");

let proveedores = JSON.parse(localStorage.getItem("proveedores")) || [];

function renderTabla() {
    tablaBody.innerHTML = "";

    proveedores.forEach((prov, index) => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>${prov.codigo}</td>
            <td>${prov.nombre}</td>
            <td>${prov.razon}</td>
            <td>${prov.telefono}</td>
            <td>${prov.direccion}</td>
            <td>${prov.correo}</td>
            <td>
                <i class="las la-trash-alt" onclick="eliminarProveedor(${index})"></i>
            </td>
            <td>
                <i class="las la-edit"></i>
            </td>
        `;

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

renderTabla();
