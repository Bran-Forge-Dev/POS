document.addEventListener("DOMContentLoaded", function () {
    // Mostrar el usuario con sesión activa
    const sesion = getSesion();
    const usuarioSpan = document.getElementById("usuario-activo");
    if (sesion && usuarioSpan) {
        usuarioSpan.textContent = `${sesion.cuenta} · ${sesion.rol}`;
    }

    // Selecciona el enlace Cerrar sesión
    const logoutLink = document.querySelector(".logout");

    if (logoutLink) {
        logoutLink.addEventListener("click", function (e) {
            e.preventDefault(); // Evita que redirija de inmediato

            const confirmar = confirm("¿Seguro que deseas cerrar sesión?");
            if (confirmar) {
                cerrarSesion();
                // Si el usuario confirma, redirige al enlace original
                window.location.href = logoutLink.href;
            }
            // Si el usuario cancela, simplemente no pasa nada
        });
    }
});
