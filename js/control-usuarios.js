// ===============================
// Usuarios desde Supabase (pos_perfiles)
// ===============================
let listaUsuarios = [];

// ===============================
// Helpers de tabla
// ===============================
function celda(texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    return td;
}

function celdaIcono(clase, onClick) {
    const td = document.createElement("td");
    td.className = "col-icono";
    const icono = document.createElement("i");
    icono.className = `las ${clase} icono-tabla`;
    icono.addEventListener("click", onClick);
    td.appendChild(icono);
    return td;
}

// ===============================
// Función para actualizar tabla
// ===============================
function actualizarTablaUsuarios() {
    const tbody = document.getElementById("tbodyUsuarios");
    tbody.innerHTML = "";

    listaUsuarios.forEach((usuario, index) => {
        const fila = document.createElement("tr");
        fila.appendChild(celda(usuario.cuenta));
        fila.appendChild(celda(usuario.rol));
        fila.appendChild(celda(usuario.telefono));
        fila.appendChild(celda(usuario.correo));
        fila.appendChild(celdaIcono("la-trash-alt", () => eliminarUsuario(index)));
        fila.appendChild(celdaIcono("la-edit", () => editarUsuario(index)));
        tbody.appendChild(fila);
    });
}

async function cargarUsuarios() {
    const { data, error } = await _supabase
        .from("pos_perfiles")
        .select("*")
        .order("cuenta");

    if (error) {
        console.error("Error cargando usuarios:", error.message);
        toast("No se pudieron cargar los usuarios.", "error");
        return;
    }
    listaUsuarios = data;
    actualizarTablaUsuarios();
}

// ===============================
// Función para eliminar usuario
// Nota: elimina el perfil (acceso al POS). La cuenta de auth
// queda registrada en el panel de Supabase sin acceso a datos.
// ===============================
async function eliminarUsuario(index) {
    const usuario = listaUsuarios[index];
    const perfil = await getPerfil();
    if (perfil && usuario.id === perfil.id) {
        toast("No puedes eliminar tu propia cuenta en sesión.", "error");
        return;
    }
    if (!await confirmar("¿Deseas eliminar este usuario?")) return;

    const { error } = await _supabase
        .from("pos_perfiles")
        .delete()
        .eq("id", usuario.id);

    if (error) {
        toast("No se pudo eliminar: " + error.message, "error");
        return;
    }
    listaUsuarios.splice(index, 1);
    actualizarTablaUsuarios();
    toast("Usuario eliminado.", "ok");
}

// ===============================
// Función para editar usuario
// ===============================
async function editarUsuario(index) {
    const usuario = listaUsuarios[index];
    const valores = await preguntarCampos("Editar usuario", [
        { label: "Cuenta", valor: usuario.cuenta },
        { label: "Rol (admin / cajero)", valor: usuario.rol },
        { label: "Teléfono", valor: usuario.telefono },
        { label: "Correo", valor: usuario.correo }
    ]);
    if (!valores) return;

    const [cuenta, rol, telefono, correo] = valores;
    if (!cuenta.trim() || !rol.trim() || !telefono.trim() || !correo.trim()) return;

    const cambios = {
        cuenta: cuenta.trim().toLowerCase(),
        rol: rol.trim().toLowerCase(),
        telefono: telefono.trim(),
        correo: correo.trim()
    };

    const { error } = await _supabase
        .from("pos_perfiles")
        .update(cambios)
        .eq("id", usuario.id);

    if (error) {
        toast("No se pudo actualizar: " + error.message, "error");
        return;
    }
    listaUsuarios[index] = { ...usuario, ...cambios };
    actualizarTablaUsuarios();
    toast("Usuario actualizado.", "ok");
}

// ===============================
// Ejecutar al cargar la página
// ===============================
window.addEventListener("DOMContentLoaded", cargarUsuarios);
