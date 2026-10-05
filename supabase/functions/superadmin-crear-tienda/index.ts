// ============================================================
// Edge Function: superadmin-crear-tienda
// Onboarding de un cliente nuevo en un solo paso:
//   1. crea el usuario de auth (cuenta@neoventa.local)
//   2. crea la tienda en pos_tiendas
//   3. crea su perfil admin ligado a la tienda
//
// Solo un superadmin puede llamarla. Usa service_role —
// NUNCA exponer esa llave en el frontend.
//
// Si un paso falla se deshace lo anterior para no dejar
// registros huérfanos (auth sin perfil / tienda sin admin).
//
// Desplegar en: Supabase Dashboard -> Edge Functions ->
//   New function -> nombre "superadmin-crear-tienda" -> pegar.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function resp(body: object, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" }
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return resp({ error: "Método no permitido" }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return resp({ error: "Sin sesión" }, 401);

    const { nombre_tienda, cuenta, clave, correo } = await req.json().catch(() => ({}));
    const cuentaLimpia = String(cuenta || "").trim().toLowerCase();
    const correoLimpio = String(correo || "").trim().toLowerCase();
    if (!String(nombre_tienda || "").trim()
        || !/^[a-z0-9_]{3,30}$/.test(cuentaLimpia)
        || typeof clave !== "string" || clave.length < 6
        || (correoLimpio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio))) {
        return resp({
            error: "Datos inválidos: nombre de tienda, cuenta (3-30, letras/números/_), clave mínimo 6 y correo válido"
        }, 400);
    }

    // Quien llama debe ser superadmin
    const supaUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return resp({ error: "Sesión inválida" }, 401);

    const supaAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: caller } = await supaAdmin
        .from("pos_perfiles").select("rol, activo").eq("id", user.id).single();
    if (!caller || caller.rol !== "superadmin" || !caller.activo) {
        return resp({ error: "Solo el superadmin puede crear tiendas" }, 403);
    }

    // 1. Usuario de auth (email sintético, confirmado de una vez)
    const { data: authData, error: authError } = await supaAdmin.auth.admin.createUser({
        email: `${cuentaLimpia}@neoventa.local`,
        password: clave,
        email_confirm: true
    });
    if (authError || !authData.user) {
        return resp({ error: "No se pudo crear la cuenta: " + (authError?.message ?? "error") }, 400);
    }
    const userId = authData.user.id;

    // 2. La tienda
    const { data: tienda, error: tiendaError } = await supaAdmin
        .from("pos_tiendas")
        .insert({ nombre: String(nombre_tienda).trim() })
        .select("id")
        .single();
    if (tiendaError) {
        await supaAdmin.auth.admin.deleteUser(userId);
        return resp({ error: "No se pudo crear la tienda: " + tiendaError.message }, 500);
    }

    // 3. Perfil admin ligado a la tienda
    const { error: perfilError } = await supaAdmin
        .from("pos_perfiles")
        .insert({
            id: userId,
            tienda_id: tienda.id,
            cuenta: cuentaLimpia,
            rol: "admin",
            correo: correoLimpio
        });
    if (perfilError) {
        // rollback: ni tienda ni auth user deben quedar sueltos
        await supaAdmin.from("pos_tiendas").delete().eq("id", tienda.id);
        await supaAdmin.auth.admin.deleteUser(userId);
        return resp({ error: "No se pudo crear el perfil: " + perfilError.message }, 500);
    }

    return resp({ ok: true, tienda_id: tienda.id, cuenta: cuentaLimpia });
});
