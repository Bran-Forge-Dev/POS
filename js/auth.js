// ============================================================
// Utilidades de autenticación y sesión (NeoVenta)
// Fase 1: persistencia en localStorage/sessionStorage.
// NOTA: seguridad de lado cliente es limitada por naturaleza;
// la seguridad real llegará con el backend (Fase 2 - Supabase).
// ============================================================

const NEOV_SESION_KEY = "neov_sesion";

// Hash SHA-256 de la clave (evita guardar texto plano en localStorage)
async function hashClave(texto) {
    if (window.crypto && crypto.subtle) {
        const datos = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
        return [...new Uint8Array(datos)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback simple cuando SubtleCrypto no está disponible (p. ej. file://)
    let h = 5381;
    for (let i = 0; i < texto.length; i++) {
        h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
    }
    return h.toString(16);
}

function getUsuarios() {
    return JSON.parse(localStorage.getItem("usuarios")) || [];
}

function guardarUsuarios(lista) {
    localStorage.setItem("usuarios", JSON.stringify(lista));
}

// Migra claves en texto plano a hash y crea el admin por defecto si no hay usuarios
async function asegurarUsuariosIniciales() {
    const usuarios = getUsuarios();
    let cambio = false;

    for (const u of usuarios) {
        if (u.clave !== undefined) {
            u.claveHash = await hashClave(u.clave);
            delete u.clave;
            cambio = true;
        }
    }

    if (usuarios.length === 0) {
        usuarios.push({
            cuenta: "admin",
            claveHash: await hashClave("1234"),
            rol: "admin",
            telefono: "",
            correo: ""
        });
        cambio = true;
    }

    if (cambio) guardarUsuarios(usuarios);
}

function getSesion() {
    try {
        return JSON.parse(sessionStorage.getItem(NEOV_SESION_KEY));
    } catch {
        return null;
    }
}

// Llamar al inicio de cada página interna: rebota al login si no hay sesión
function requerirSesion() {
    if (!getSesion()) {
        window.location.replace("../index.html");
    }
}

// Para páginas solo de administrador: rebota al menú si el rol no coincide
function requerirRol(rol) {
    const sesion = getSesion();
    if (!sesion || sesion.rol !== rol) {
        window.location.replace("menu.html");
    }
}

function cerrarSesion() {
    sessionStorage.removeItem(NEOV_SESION_KEY);
}
