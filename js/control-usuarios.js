// ===============================
// Array de usuarios en memoria
// ===============================
let listaUsuarios = getUsuarios();

// ===============================
// Helpers de tabla
// ===============================
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

// ===============================
// Función para actualizar tabla
// ===============================
function actualizarTablaUsuarios() {
    const tbody = document.getElementById("tbodyUsuarios");
    tbody.innerHTML = "";

    listaUsuarios.forEach((usuario, index) => {
        const fila = document.createElement("tr");
        fila.appendChild(celda(usuario.cuenta));
        fila.appendChild(celda(usuario.rol));
        fila.appendChild(celda(usuario.telefono));
        fila.appendChild(celda(usuario.correo));
        fila.appendChild(celdaIcono("la-trash-alt", () => eliminarUsuario(index)));
        fila.appendChild(celdaIcono("la-edit", () => editarUsuario(index)));
        tbody.appendChild(fila);
    });
}

// ===============================
// Función para eliminar usuario
// ===============================
function eliminarUsuario(index) {
    const usuario = listaUsuarios[index];
    const sesion = getSesion();
    if (sesion && usuario.cuenta === sesion.cuenta) {
        alert("No puedes eliminar tu propia cuenta en sesión.");
        return;
    }
    if (confirm("¿Deseas eliminar este usuario?")) {
        listaUsuarios.splice(index, 1);
        guardarUsuarios(listaUsuarios);
        actualizarTablaUsuarios();
    }
}

// ===============================
// Función para editar usuario
// ===============================
function editarUsuario(index) {
    const usuario = listaUsuarios[index];
    const nuevaCuenta = prompt("Editar cuenta:", usuario.cuenta);
    const nuevoRol = prompt("Editar rol (admin/cajero):", usuario.rol);
    const nuevoTelefono = prompt("Editar teléfono:", usuario.telefono);
    const nuevoCorreo = prompt("Editar correo:", usuario.correo);

    if (nuevaCuenta && nuevoRol && nuevoTelefono && nuevoCorreo) {
        listaUsuarios[index] = {
            ...usuario,
            cuenta: nuevaCuenta.trim(),
            rol: nuevoRol.trim().toLowerCase(),
            telefono: nuevoTelefono.trim(),
            correo: nuevoCorreo.trim()
        };

        guardarUsuarios(listaUsuarios);
        actualizarTablaUsuarios();
    }
}

// ===============================
// Ejecutar al cargar la página
// ===============================
window.addEventListener("DOMContentLoaded", () => {
    actualizarTablaUsuarios();
});
