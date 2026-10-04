// ============================================================
// Edge Function: admin-reset-password
// Permite a un admin resetear la contraseña de usuarios de SU
// tienda (o al superadmin de cualquiera). Usa service_role —
// NUNCA exponer esa llave en el frontend.
//
// Desplegar en: Supabase Dashboard -> Edge Functions ->
//   New function -> nombre "admin-reset-password" -> pegar.
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

    const { perfil_id, nueva_clave } = await req.json().catch(() => ({}));
    if (!perfil_id || typeof nueva_clave !== "string" || nueva_clave.length < 6) {
        return resp({ error: "Datos inválidos (clave mínimo 6 caracteres)" }, 400);
    }

    // Cliente con la sesión del que llama -> saber quién es
    const supaUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return resp({ error: "Sesión inválida" }, 401);

    // Cliente service_role para leer perfiles y cambiar la clave
    const supaAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: caller } = await supaAdmin
        .from("pos_perfiles").select("rol, tienda_id").eq("id", user.id).single();
    if (!caller) return resp({ error: "Sin perfil POS" }, 403);

    const { data: target } = await supaAdmin
        .from("pos_perfiles").select("rol, tienda_id").eq("id", perfil_id).single();
    if (!target) return resp({ error: "Usuario no encontrado" }, 404);

    // superadmin: cualquiera. admin: solo su tienda y jamás a un superadmin.
    const ok = caller.rol === "superadmin"
        || (caller.rol === "admin"
            && target.tienda_id === caller.tienda_id
            && target.rol !== "superadmin");
    if (!ok) return resp({ error: "Sin permiso para resetear a este usuario" }, 403);

    const { error } = await supaAdmin.auth.admin.updateUserById(
        perfil_id, { password: nueva_clave }
    );
    if (error) return resp({ error: error.message }, 500);

    return resp({ ok: true });
});
