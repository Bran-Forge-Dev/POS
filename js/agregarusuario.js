// ===============================
// Array en memoria y persistencia
// ===============================
let listaUsuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

// ===============================
// Función para guardar usuario
// ===============================
function guardarUsuario(event) {
    event.preventDefault();

    const cuenta = document.getElementById("cuenta").value.trim();
    const clave = document.getElementById("clave").value.trim();
    const rol = document.getElementById("rol").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const fecha = document.getElementById("fecha").value.trim();
    const correo = document.getElementById("correo").value.trim();

    // Validación de campos
    if (!cuenta || !clave || !rol || !telefono || !fecha || !correo) {
        alert("Por favor, llena todos los campos.");
        return;
    }

    const nuevoUsuario = { cuenta, clave, rol, telefono, fecha, correo };

    // Guardar en array en memoria
    listaUsuarios.push(nuevoUsuario);

    // Guardar en localStorage
    localStorage.setItem("usuarios", JSON.stringify(listaUsuarios));

    // Limpiar formulario
    document.getElementById("formUsuario").reset();

    // Mostrar array en consola
    console.log("Usuarios guardados en memoria:", listaUsuarios);

    // Actualizar tabla en Control de Usuarios si está abierta
    if (window.opener && typeof window.opener.actualizarTablaUsuarios === "function") {
        window.opener.listaUsuarios = listaUsuarios;
        window.opener.actualizarTablaUsuarios();
    }

    alert("Usuario guardado correctamente.");
}
