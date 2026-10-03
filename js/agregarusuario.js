// ===============================
// Registro de usuario: crea la cuenta en Supabase Auth
// y su perfil con rol en pos_perfiles.
// Se usa _supabaseAdmin (persistSession: false) para que el
// signUp del nuevo usuario no cierre la sesión del admin.
// ===============================
async function guardarUsuario(event) {
    event.preventDefault();

    const cuenta = document.getElementById("cuenta").value.trim().toLowerCase();
    const clave = document.getElementById("clave").value;
    const rol = document.getElementById("rol").value.trim().toLowerCase();
    const telefono = document.getElementById("telefono").value.trim();
    const fecha = document.getElementById("fecha").value.trim();
    const correo = document.getElementById("correo").value.trim();

    // Validación de campos
    if (!cuenta || !clave || !rol || !telefono || !fecha || !correo) {
        alert("Por favor, llena todos los campos.");
        return;
    }

    // 1. Crear la cuenta de autenticación (email sintético)
    const { data, error } = await _supabaseAdmin.auth.signUp({
        email: `${cuenta}@${DOMINIO_USUARIOS}`,
        password: clave
    });

    if (error) {
        alert("No se pudo crear la cuenta: " + error.message);
        return;
    }

    // 2. Crear el perfil con rol (lo hace el cliente del admin,
    //    que sí tiene permiso por RLS)
    const { error: errorPerfil } = await _supabase
        .from("pos_perfiles")
        .insert({
            id: data.user.id,
            cuenta,
            rol,
            telefono,
            correo,
            fecha_nacimiento: fecha
        });

    if (errorPerfil) {
        alert("Cuenta creada pero falló el perfil: " + errorPerfil.message);
        return;
    }

    // Limpiar formulario
    document.getElementById("formUsuario").reset();
    alert("Usuario guardado correctamente.");
}
