// ===============================
// Tiendas (solo superadmin)
// Lista las tiendas del proyecto y da de alta una nueva con
// su usuario admin en un solo paso (Edge Function).
// ===============================
document.addEventListener("DOMContentLoaded", async function () {
    await requerirSesion();

    const perfil = await getPerfil();
    if (!perfil || perfil.rol !== "superadmin") {
        window.location.href = "menu.html";
        return;
    }

    await cargarTiendas();
    document.getElementById("btnNuevaTienda")
        .addEventListener("click", nuevaTienda);
});

async function cargarTiendas() {
    const [{ data: tiendas, error: e1 }, { data: admins, error: e2 }] =
        await Promise.all([
            _supabase.from("pos_tiendas").select("*").order("created_at"),
            _supabase.from("pos_perfiles")
                .select("tienda_id, cuenta")
                .eq("rol", "admin")
        ]);

    if (e1 || e2) {
        toast("No se pudieron cargar las tiendas.", "error");
        return;
    }

    const adminPorTienda = {};
    (admins || []).forEach(a => {
        adminPorTienda[a.tienda_id] = adminPorTienda[a.tienda_id]
            ? adminPorTienda[a.tienda_id] + ", " + a.cuenta
            : a.cuenta;
    });

    const tbody = document.getElementById("tbodyTiendas");
    tbody.innerHTML = "";
    tiendas.forEach(t => {
        const fila = document.createElement("tr");
        const celdas = [
            t.nombre,
            t.es_demo ? "Demo" : "Producción",
            adminPorTienda[t.id] || "—",
            new Date(t.created_at).toLocaleDateString("es-MX")
        ];
        celdas.forEach(txt => {
            const td = document.createElement("td");
            td.textContent = txt;
            fila.appendChild(td);
        });
        tbody.appendChild(fila);
    });
}

// Alta: tienda + auth user + perfil admin en una sola llamada
async function nuevaTienda() {
    const valores = await preguntarCampos("Nueva tienda", [
        { label: "Nombre de la tienda" },
        { label: "Cuenta del admin" },
        { label: "Correo del dueño (contacto)" },
        { label: "Contraseña temporal", tipo: "password" }
    ]);
    if (!valores) return;

    const [nombre, cuenta, correo, clave] = valores.map(v => v.trim());
    if (!nombre || !/^[a-z0-9_]{3,30}$/.test(cuenta.toLowerCase()) || clave.length < 6
        || (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))) {
        toast("Revisa los datos: cuenta con letras/números/_ (3-30), correo válido y clave mínimo 6.", "error");
        return;
    }

    const { error } = await _supabase.functions.invoke("superadmin-crear-tienda", {
        body: {
            nombre_tienda: nombre,
            cuenta: cuenta.toLowerCase(),
            correo: correo.toLowerCase(),
            clave
        }
    });

    if (error) {
        let detalle = error.message;
        try {
            const cuerpo = await error.context?.json();
            if (cuerpo?.error) detalle = cuerpo.error;
        } catch { /* respuesta sin cuerpo */ }
        toast("No se pudo crear: " + detalle, "error");
        return;
    }

    toast(`Tienda "${nombre}" lista. El admin entra con la cuenta "${cuenta.toLowerCase()}".`, "ok");
    await cargarTiendas();
}
