// ============================================================
// Autenticación y sesión — Supabase Auth (NeoVenta)
// El login usa email sintético: cuenta@neoventa.local
// El rol vive en pos_perfiles y se cachea en sessionStorage.
// ============================================================

const NEOV_PERFIL_KEY = "neov_perfil";
const DOMINIO_USUARIOS = "neoventa.local";

let _perfilCache = null;

// Sesión activa de Supabase Auth (null si no hay)
async function getSesion() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session;
}

// Perfil del usuario (cuenta, rol...) cacheado por pestaña
async function getPerfil() {
    if (_perfilCache) return _perfilCache;

    const cached = sessionStorage.getItem(NEOV_PERFIL_KEY);
    if (cached) {
        _perfilCache = JSON.parse(cached);
        return _perfilCache;
    }

    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return null;

    // Trae también el nombre de la tienda (embed por FK tienda_id)
    const { data: perfil } = await _supabase
        .from("pos_perfiles")
        .select("*, pos_tiendas(nombre)")
        .eq("id", user.id)
        .single();

    if (perfil) {
        _perfilCache = perfil;
        sessionStorage.setItem(NEOV_PERFIL_KEY, JSON.stringify(perfil));
    }
    return perfil;
}

// Llamar al inicio de cada página interna: rebota al login si no hay sesión
async function requerirSesion() {
    const sesion = await getSesion();
    if (!sesion) {
        window.location.replace("../index.html");
    }
}

// Para páginas restringidas por rol: rebota al menú si el rol
// no está entre los permitidos. requerirRol("admin", "superadmin")
async function requerirRol(...roles) {
    const perfil = await getPerfil();
    if (!perfil || !roles.includes(perfil.rol)) {
        window.location.replace("menu.html");
    }
}

async function cerrarSesion() {
    await _supabase.auth.signOut();
    sessionStorage.removeItem(NEOV_PERFIL_KEY);
}
