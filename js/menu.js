document.addEventListener("DOMContentLoaded", function () {
    // Selecciona el enlace Cerrar sesión
    const logoutLink = document.querySelector(".logout");

    if (logoutLink) {
        logoutLink.addEventListener("click", function (e) {
            e.preventDefault(); // Evita que redirija de inmediato

            const confirmar = confirm("¿Seguro que deseas cerrar sesión?");
            if (confirmar) {
                // Si el usuario confirma, redirige al enlace original
                window.location.href = logoutLink.href;
            }
            // Si el usuario cancela, simplemente no pasa nada
        });
    }
});
