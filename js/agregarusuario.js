// ===============================
// Array en memoria y persistencia
// ===============================
let listaUsuarios = getUsuarios();

// ===============================
// Función para guardar usuario
// ===============================
async function guardarUsuario(event) {
    event.preventDefault();

    const cuenta = document.getElementById("cuenta").value.trim();
    const clave = document.getElementById("clave").value.trim();
    const rol = document.getElementById("rol").value.trim().toLowerCase();
    const telefono = document.getElementById("telefono").value.trim();
    const fecha = document.getElementById("fecha").value.trim();
    const correo = document.getElementById("correo").value.trim();

    // Validación de campos
    if (!cuenta || !clave || !rol || !telefono || !fecha || !correo) {
        alert("Por favor, llena todos los campos.");
        return;
    }

    if (listaUsuarios.some(u => u.cuenta === cuenta)) {
        alert("Ya existe un usuario con esa cuenta.");
        return;
    }

    const nuevoUsuario = {
        cuenta,
        claveHash: await hashClave(clave),
        rol,
        telefono,
        fecha,
        correo
    };

    // Guardar en array en memoria y en localStorage
    listaUsuarios.push(nuevoUsuario);
    guardarUsuarios(listaUsuarios);

    // Limpiar formulario
    document.getElementById("formUsuario").reset();

    // Actualizar tabla en Control de Usuarios si está abierta
    if (window.opener && typeof window.opener.actualizarTablaUsuarios === "function") {
        window.opener.listaUsuarios = listaUsuarios;
        window.opener.actualizarTablaUsuarios();
    }

    alert("Usuario guardado correctamente.");
}
