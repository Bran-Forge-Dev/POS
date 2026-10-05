// ===============================
// Usuarios desde Supabase (pos_perfiles)
// ===============================
let listaUsuarios = [];
let esSuperadmin = false;

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
        if (esSuperadmin) {
            fila.appendChild(celda(
                usuario.pos_tiendas ? usuario.pos_tiendas.nombre : "—"
            ));
        }
        fila.appendChild(celda(usuario.telefono));
        fila.appendChild(celda(usuario.correo));
        fila.appendChild(celdaIcono("la-trash-alt", () => eliminarUsuario(index)));
        fila.appendChild(celdaIcono("la-edit", () => editarUsuario(index)));
        fila.appendChild(celdaIcono("la-key", () => resetearClave(index)));
        tbody.appendChild(fila);
    });
}

async function cargarUsuarios() {
    // El superadmin ve usuarios de TODAS las tiendas (columna
    // Tienda). El admin ve solo los de la suya (lo hace el RLS).
    const perfil = await getPerfil();
    esSuperadmin = perfil && perfil.rol === "superadmin";
    if (esSuperadmin) {
        document.getElementById("thTienda").hidden = false;
        // Crear usuarios va ligado a una tienda: el superadmin
        // da de alta admins desde Tiendas, no crea cajeros aquí
        const btnAgregar = document.querySelector(".contenedor-agregar");
        if (btnAgregar) btnAgregar.hidden = true;
    }

    const { data, error } = await _supabase
        .from("pos_perfiles")
        .select("*, pos_tiendas(nombre)")
        .eq("activo", true)
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
// Eliminar usuario por completo (Edge Function).
// Sin historial: borra auth + perfil (el email queda libre).
// Con historial: soft delete + activo=false — conserva la
// auditoría de sus ventas/cortes y bloquea su acceso.
// ===============================
async function eliminarUsuario(index) {
    const usuario = listaUsuarios[index];
    const perfil = await getPerfil();
    if (perfil && usuario.id === perfil.id) {
        toast("No puedes eliminar tu propia cuenta en sesión.", "error");
        return;
    }
    if (!await confirmar(
        `¿Eliminar a ${usuario.cuenta}?\n` +
        "Si tiene ventas registradas se desactivará para conservar el historial."
    )) return;

    const { data, error } = await _supabase.functions.invoke("admin-reset-password", {
        body: { perfil_id: usuario.id, accion: "eliminar" }
    });

    if (error) {
        let detalle = error.message;
        try {
            const cuerpo = await error.context?.json();
            if (cuerpo?.error) detalle = cuerpo.error;
        } catch { /* respuesta sin cuerpo */ }
        toast("No se pudo eliminar: " + detalle, "error");
        return;
    }
    listaUsuarios.splice(index, 1);
    actualizarTablaUsuarios();
    toast(data && data.desactivado
        ? `${usuario.cuenta} desactivado: tenía ventas registradas, se conserva su historial.`
        : "Usuario eliminado por completo.", "ok");
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
// Resetear contraseña de un usuario (Edge Function admin-reset-password)
// El servidor valida: admin solo dentro de su tienda, superadmin todo.
// ===============================
async function resetearClave(index) {
    const usuario = listaUsuarios[index];
    const valores = await preguntarCampos(`Nueva contraseña para ${usuario.cuenta}`, [
        { label: "Contraseña", tipo: "password" }
    ]);
    if (!valores) return;
    const nueva = valores[0];
    if (nueva.length < 6) {
        toast("La contraseña debe tener mínimo 6 caracteres.", "error");
        return;
    }

    const { error } = await _supabase.functions.invoke("admin-reset-password", {
        body: { perfil_id: usuario.id, nueva_clave: nueva }
    });

    if (error) {
        let detalle = error.message;
        try {
            const cuerpo = await error.context?.json();
            if (cuerpo?.error) detalle = cuerpo.error;
        } catch { /* respuesta sin cuerpo */ }
        toast("No se pudo resetear: " + detalle, "error");
        return;
    }
    toast(`Contraseña de ${usuario.cuenta} actualizada.`, "ok");
}

// ===============================
// Ejecutar al cargar la página
// ===============================
window.addEventListener("DOMContentLoaded", cargarUsuarios);
