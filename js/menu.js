document.addEventListener("DOMContentLoaded", async function () {
    // Mostrar el usuario con sesión activa
    const perfil = await getPerfil();
    const usuarioSpan = document.getElementById("usuario-activo");
    if (perfil && usuarioSpan) {
        const tienda = perfil.pos_tiendas ? ` · ${perfil.pos_tiendas.nombre}` : "";
        usuarioSpan.textContent = `${perfil.cuenta} · ${perfil.rol}${tienda}`;
    }

    // Cambiar contraseña: self-service del usuario logueado,
    // desde el ícono de ajustes del footer.
    async function cambiarClave(e) {
        e.preventDefault();
        const valores = await preguntarCampos("Cambiar contraseña", [
            { label: "Nueva contraseña", tipo: "password" },
            { label: "Confirmar contraseña", tipo: "password" }
        ]);
        if (!valores) return;
        const [c1, c2] = valores;
        if (c1.length < 6) {
            toast("La contraseña debe tener mínimo 6 caracteres.", "error");
            return;
        }
        if (c1 !== c2) {
            toast("Las contraseñas no coinciden.", "error");
            return;
        }
        const { error } = await _supabase.auth.updateUser({ password: c1 });
        if (error) {
            toast("No se pudo cambiar: " + error.message, "error");
        } else {
            toast("Contraseña actualizada.", "ok");
        }
    }

    const iconoAjustes = document.getElementById("iconoAjustes");
    if (iconoAjustes) iconoAjustes.addEventListener("click", cambiarClave);

    // Selecciona el enlace Cerrar sesión (el que apunta al login)
    const logoutLink = document.querySelector('a.logout[href="../index.html"]');

    if (logoutLink) {
        logoutLink.addEventListener("click", async function (e) {
            e.preventDefault(); // Evita que redirija de inmediato

            if (await confirmar("¿Seguro que deseas cerrar sesión?")) {
                await cerrarSesion();
                // Si el usuario confirma, redirige al enlace original
                window.location.href = logoutLink.href;
            }
            // Si el usuario cancela, simplemente no pasa nada
        });
    }
});
