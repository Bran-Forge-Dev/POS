document.addEventListener("DOMContentLoaded", async function () {
    // Si ya hay sesión activa, ir directo al menú
    const sesion = await getSesion();
    if (sesion) {
        window.location.replace("html/menu.html");
        return;
    }

    const mensajeError = document.getElementById("mensajeError");
    const usuarioInput = document.getElementById("usuario");
    const passwordInput = document.getElementById("password");
    const form = document.getElementById("formLogin");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const cuenta = usuarioInput.value.trim().toLowerCase();
        const clave = passwordInput.value;

        // Oculta mensaje previo
        mensajeError.style.display = "none";
        mensajeError.textContent = "";

        const { error } = await _supabase.auth.signInWithPassword({
            email: `${cuenta}@${DOMINIO_USUARIOS}`,
            password: clave
        });

        if (!error) {
            window.location.href = "html/menu.html";
        } else {
            console.error("Error de login:", error.message);
            mensajeError.textContent = "Usuario o contraseña incorrectos. (" + error.message + ")";
            mensajeError.style.display = "block";

            // Borra los campos y regresa el cursor al usuario
            usuarioInput.value = "";
            passwordInput.value = "";
            usuarioInput.focus();
        }
    });
});
