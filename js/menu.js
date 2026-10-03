document.addEventListener("DOMContentLoaded", async function () {
    // Mostrar el usuario con sesión activa
    const perfil = await getPerfil();
    const usuarioSpan = document.getElementById("usuario-activo");
    if (perfil && usuarioSpan) {
        usuarioSpan.textContent = `${perfil.cuenta} · ${perfil.rol}`;
    }

    // Selecciona el enlace Cerrar sesión
    const logoutLink = document.querySelector(".logout");

    if (logoutLink) {
        logoutLink.addEventListener("click", async function (e) {
            e.preventDefault(); // Evita que redirija de inmediato

            const confirmar = confirm("¿Seguro que deseas cerrar sesión?");
            if (confirmar) {
                await cerrarSesion();
                // Si el usuario confirma, redirige al enlace original
                window.location.href = logoutLink.href;
            }
            // Si el usuario cancela, simplemente no pasa nada
        });
    }
});
