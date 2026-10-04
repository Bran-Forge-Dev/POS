// ============================================================
// Edge Function: admin-reset-password
// accion "reset"    -> admin resetea contraseña de usuarios de SU
//                      tienda (superadmin: de cualquiera).
// accion "eliminar" -> borra al usuario: hard delete si no tiene
//                      historial; soft delete + activo=false si
//                      tiene ventas/cortes (conserva auditoría).
// Usa service_role — NUNCA exponer esa llave en el frontend.
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

    const { perfil_id, nueva_clave, accion } = await req.json().catch(() => ({}));
    const esEliminar = accion === "eliminar";
    if (!perfil_id) {
        return resp({ error: "Datos inválidos" }, 400);
    }
    if (!esEliminar && (typeof nueva_clave !== "string" || nueva_clave.length < 6)) {
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
    if (!ok) return resp({ error: "Sin permiso sobre este usuario" }, 403);

    // ---------- Eliminar usuario ----------
    if (esEliminar) {
        if (perfil_id === user.id) {
            return resp({ error: "No puedes eliminar tu propia cuenta" }, 400);
        }

        // ventas/cortes referencian auth.users sin cascade: con
        // historial no se puede borrar físicamente -> desactivar
        const [{ count: ventas }, { count: cortes }, { count: cancelaciones }] =
            await Promise.all([
                supaAdmin.from("pos_ventas")
                    .select("*", { count: "exact", head: true })
                    .eq("cajero_id", perfil_id),
                supaAdmin.from("pos_cortes")
                    .select("*", { count: "exact", head: true })
                    .eq("cajero_id", perfil_id),
                supaAdmin.from("pos_ventas")
                    .select("*", { count: "exact", head: true })
                    .eq("cancelada_por", perfil_id)
            ]);
        const conHistorial =
            (ventas ?? 0) + (cortes ?? 0) + (cancelaciones ?? 0) > 0;

        // soft delete conserva el registro de auth (FK válidas) y
        // bloquea el login; hard delete borra todo y libera el email
        const { error } = await supaAdmin.auth.admin.deleteUser(
            perfil_id, conHistorial
        );
        if (error) return resp({ error: error.message }, 500);

        if (conHistorial) {
            await supaAdmin.from("pos_perfiles")
                .update({ activo: false }).eq("id", perfil_id);
        }
        return resp({ ok: true, desactivado: conHistorial });
    }

    // ---------- Reset de contraseña ----------
    const { error } = await supaAdmin.auth.admin.updateUserById(
        perfil_id, { password: nueva_clave }
    );
    if (error) return resp({ error: error.message }, 500);

    return resp({ ok: true });
});
