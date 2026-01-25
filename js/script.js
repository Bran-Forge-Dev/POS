document.addEventListener("DOMContentLoaded", function () {
    const btnLogin = document.getElementById("btnlogin");
    const mensajeError = document.getElementById("mensajeError");

    btnLogin.addEventListener("click", function () {
        const usuarioInput = document.getElementById("usuario");
        const passwordInput = document.getElementById("password");

        const usuario = usuarioInput.value.trim();
        const password = passwordInput.value.trim();

        // Oculta mensaje previo
        mensajeError.style.display = "none";
        mensajeError.textContent = "";

        if (usuario === "admin" && password === "1234") {
            window.location.href = "html/menu.html"; // Redirige al menú
        } else {
            mensajeError.textContent = "Usuario o contraseña incorrectos.";
            mensajeError.style.display = "block";

            // Borra los campos
            usuarioInput.value = "";
            passwordInput.value = "";

            // Coloca el cursor nuevamente en el campo de usuario
            usuarioInput.focus();
        }
    });
});
