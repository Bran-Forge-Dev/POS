document.addEventListener("DOMContentLoaded", async function () {
    // Si ya hay sesión activa, ir directo al menú
    if (getSesion()) {
        window.location.replace("html/menu.html");
        return;
    }

    await asegurarUsuariosIniciales();

    const mensajeError = document.getElementById("mensajeError");
    const usuarioInput = document.getElementById("usuario");
    const passwordInput = document.getElementById("password");
    const form = document.getElementById("formLogin");

    async function intentarLogin() {
        const cuenta = usuarioInput.value.trim();
        const clave = passwordInput.value.trim();

        // Oculta mensaje previo
        mensajeError.style.display = "none";
        mensajeError.textContent = "";

        const hash = await hashClave(clave);
        const usuario = getUsuarios().find(u => u.cuenta === cuenta && u.claveHash === hash);

        if (usuario) {
            sessionStorage.setItem(NEOV_SESION_KEY, JSON.stringify({
                cuenta: usuario.cuenta,
                rol: usuario.rol,
                loginAt: Date.now()
            }));
            window.location.href = "html/menu.html";
        } else {
            mensajeError.textContent = "Usuario o contraseña incorrectos.";
            mensajeError.style.display = "block";

            // Borra los campos y regresa el cursor al usuario
            usuarioInput.value = "";
            passwordInput.value = "";
            usuarioInput.focus();
        }
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        intentarLogin();
    });
});
