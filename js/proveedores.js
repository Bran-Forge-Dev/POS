// Cambiamos "tablaProveedoresBody" por "tablaProveedores" para que coincida con tu HTML
const tablaBody = document.getElementById("tablaProveedores"); 

let proveedores = JSON.parse(localStorage.getItem("proveedores")) || [];

function renderTabla() {
    // Si no hay proveedores, podrías mostrar el mensaje de "No hay proveedores registrados"
    const mensajeVacio = document.getElementById("sinProveedores");
    
    if (proveedores.length === 0) {
        mensajeVacio.style.display = "block";
    } else {
        mensajeVacio.style.display = "none";
    }

    tablaBody.innerHTML = "";
    // ... resto de tu código igual

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
