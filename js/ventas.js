// ============================================================
// Panel de caja: estado del corte, ventas del día e historial.
// Abrir/cerrar van por RPC (cálculo del arqueo en el servidor).
// ============================================================

const _fmt = n => "$" + Number(n).toFixed(2);
const _fmtFecha = iso => new Date(iso).toLocaleString("es-MX",
    { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

let _perfiles = {};   // id -> cuenta
let _corteAbierto = null;

document.addEventListener("DOMContentLoaded", async function () {
    document.getElementById("btnAbrir").addEventListener("click", abrirCorte);
    document.getElementById("btnCerrar").addEventListener("click", cerrarCorte);
    await cargarPanel();
});

async function cargarPanel() {
    const { data: perfiles } = await _supabase.from("pos_perfiles").select("id, cuenta");
    _perfiles = {};
    (perfiles || []).forEach(p => _perfiles[p.id] = p.cuenta);

    await Promise.all([cargarCorte(), cargarVentasHoy(), cargarHistorial()]);
}

// ---------- Corte de caja ----------

async function cargarCorte() {
    const { data } = await _supabase
        .from("pos_cortes")
        .select("*")
        .eq("estado", "abierto")
        .limit(1);
    _corteAbierto = data && data[0];

    const panel = document.getElementById("corteEstado");
    const btnAbrir = document.getElementById("btnAbrir");
    const btnCerrar = document.getElementById("btnCerrar");
    panel.textContent = "";

    const badge = document.createElement("span");
    const detalle = document.createElement("div");
    detalle.className = "corte-detalle";

    if (_corteAbierto) {
        // Totales en vivo de las ventas de este corte
        const { data: ventas } = await _supabase
            .from("pos_ventas")
            .select("total")
            .eq("corte_id", _corteAbierto.id);
        const num = (ventas || []).length;
        const total = (ventas || []).reduce((s, v) => s + Number(v.total), 0);
        const esperado = Number(_corteAbierto.fondo_inicial) + total;

        badge.className = "badge badge-abierto";
        badge.textContent = "Caja abierta";
        detalle.append(
            _linea("Abierta por", `${_perfiles[_corteAbierto.cajero_id] || "?"} · ${_fmtFecha(_corteAbierto.abierto_en)}`),
            _linea("Fondo inicial", _fmt(_corteAbierto.fondo_inicial)),
            _linea("Ventas", `${num} ticket(s)`),
            _linea("Total vendido", _fmt(total)),
            _linea("Efectivo esperado", _fmt(esperado), true)
        );
        btnAbrir.style.display = "none";
        btnCerrar.style.display = "";
    } else {
        badge.className = "badge badge-cerrado";
        badge.textContent = "Caja cerrada";
        const nota = document.createElement("p");
        nota.className = "corte-nota";
        nota.textContent = "Abre un corte para empezar a registrar ventas en caja.";
        detalle.appendChild(nota);
        btnAbrir.style.display = "";
        btnCerrar.style.display = "none";
    }

    panel.append(badge, detalle);
}

function _linea(etiqueta, valor, fuerte) {
    const div = document.createElement("div");
    div.className = "corte-linea" + (fuerte ? " fuerte" : "");
    const span1 = document.createElement("span");
    span1.textContent = etiqueta;
    const span2 = document.createElement("span");
    span2.textContent = valor;
    div.append(span1, span2);
    return div;
}

async function abrirCorte() {
    const input = await preguntar("Fondo inicial en caja (efectivo con el que empiezas)", "0");
    if (input === null) return;
    const fondo = parseFloat(input);
    if (isNaN(fondo) || fondo < 0) {
        toast("Fondo inválido.", "error");
        return;
    }
    const { error } = await _supabase.rpc("pos_abrir_corte", { p_fondo: fondo });
    if (error) {
        toast("No se pudo abrir el corte: " + error.message, "error");
        return;
    }
    toast("Corte abierto.", "ok");
    await cargarPanel();
}

async function cerrarCorte() {
    const input = await preguntar("Efectivo contado físicamente en caja", "");
    if (input === null) return;
    const contado = parseFloat(input);
    if (isNaN(contado) || contado < 0) {
        toast("Cantidad inválida.", "error");
        return;
    }
    const { data: c, error } = await _supabase.rpc("pos_cerrar_corte", { p_contado: contado });
    if (error) {
        toast("No se pudo cerrar el corte: " + error.message, "error");
        return;
    }
    const dif = Number(c.diferencia);
    const etiqueta = dif < 0 ? " (FALTANTE)" : dif > 0 ? " (sobrante)" : " (cuadro exacto)";
    await alerta(
        `Ventas: ${c.num_ventas}\n` +
        `Total vendido: ${_fmt(c.total_ventas)}\n` +
        `Fondo inicial: ${_fmt(c.fondo_inicial)}\n` +
        `Efectivo esperado: ${_fmt(c.efectivo_esperado)}\n` +
        `Efectivo contado: ${_fmt(c.efectivo_contado)}\n` +
        `Diferencia: ${_fmt(dif)}${etiqueta}`,
        "Corte cerrado"
    );
    await cargarPanel();
}

// ---------- Ventas de hoy ----------

async function cargarVentasHoy() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const { data: ventas } = await _supabase
        .from("pos_ventas")
        .select("folio, cajero_id, fecha, total, pago, cambio")
        .gte("fecha", hoy.toISOString())
        .order("folio", { ascending: false });

    const tbody = document.getElementById("tbodyVentas");
    tbody.textContent = "";
    let totalDia = 0;

    (ventas || []).forEach(v => {
        totalDia += Number(v.total);
        const tr = document.createElement("tr");
        _td(tr, "#" + v.folio);
        _td(tr, _fmtFecha(v.fecha));
        _td(tr, _perfiles[v.cajero_id] || "?");
        _td(tr, _fmt(v.total));
        _td(tr, _fmt(v.pago));
        _td(tr, _fmt(v.cambio));
        tbody.appendChild(tr);
    });

    document.getElementById("totalHoy").textContent =
        ventas && ventas.length ? ` — ${ventas.length} venta(s), ${_fmt(totalDia)}` : "";
}

// ---------- Historial de cortes ----------

async function cargarHistorial() {
    const { data: cortes } = await _supabase
        .from("pos_cortes")
        .select("*")
        .order("abierto_en", { ascending: false })
        .limit(20);

    const tbody = document.getElementById("tbodyCortes");
    tbody.textContent = "";

    (cortes || []).forEach(c => {
        const tr = document.createElement("tr");
        _td(tr, _fmtFecha(c.abierto_en));
        _td(tr, _perfiles[c.cajero_id] || "?");
        _td(tr, c.cerrado_en ? _fmtFecha(c.cerrado_en) : "—");
        _td(tr, c.estado === "abierto" ? "Abierto" : "Cerrado");
        _td(tr, _fmt(c.fondo_inicial));
        _td(tr, c.num_ventas ?? "—");
        _td(tr, c.total_ventas != null ? _fmt(c.total_ventas) : "—");
        _td(tr, c.efectivo_contado != null ? _fmt(c.efectivo_contado) : "—");
        const tdDif = _td(tr, c.diferencia != null ? _fmt(c.diferencia) : "—");
        if (c.diferencia != null) {
            tdDif.className = Number(c.diferencia) < 0 ? "dif-neg" : Number(c.diferencia) > 0 ? "dif-pos" : "";
        }
        tbody.appendChild(tr);
    });
}

function _td(tr, texto) {
    const td = document.createElement("td");
    td.textContent = texto;
    tr.appendChild(td);
    return td;
}
