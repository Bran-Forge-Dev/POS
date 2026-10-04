// ============================================================
// Ticket de venta compartido (80mm, imprimible).
// Uso:
//   nvTicket({ folio, tienda, cajero, fecha, items, total,
//              pago, cambio, cancelada }, onCerrar)
//     items: [{ cantidad, descripcion, importe }]
//     cancelada: opcional -> imprime sello CANCELADA
//     onCerrar: callback opcional al cerrar el modal
//
// Los estilos del ticket van INLINE: el CSS de las páginas usa
// selectores de elemento (ej. ".totales div") que pintarían el
// ticket si solo usáramos clases.
// ============================================================

(function () {
    const css = `
        .nv-ticket-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.5);
            display: flex !important; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 18px; z-index: 150;
        }
        .nv-ticket-overlay[hidden] { display: none !important; }
        .nv-ticket-acciones { display: flex; gap: 12px; }

        @media print {
            body > *:not(#nvTicketOverlay) { display: none !important; }
            .nv-ticket-overlay {
                position: static !important; background: none !important;
                padding: 0 !important; display: block !important;
            }
            .nv-ticket {
                width: 72mm !important; max-height: none !important;
                overflow: visible !important; box-shadow: none !important;
                padding: 0 2mm !important; margin-left: 12mm !important;
            }
            .nv-ticket-acciones { display: none !important; }
            @page { margin: 10mm 5mm 10mm 0; }
        }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
})();

// ---------- helpers de estilo inline ----------
const TK = {
    ticket: "width:72mm;background:#fff;padding:6mm 4mm;box-sizing:border-box;" +
        "font-family:Consolas,'Courier New',monospace;font-size:13px;color:#000;" +
        "text-align:left;box-shadow:0 4px 20px rgba(0,0,0,.3);max-height:80vh;overflow-y:auto;",
    enc: "display:block;text-align:left;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:6px;",
    negocio: "display:block;text-align:center;font-weight:700;font-size:16px;text-transform:uppercase;margin:0 0 2px;",
    sub: "display:block;text-align:center;font-size:11px;color:#333;margin:0 0 8px;",
    datos: "display:block;font-size:12px;",
    datoFila: "display:flex;justify-content:space-between;margin:0 0 3px;font-size:12px;",
    sello: "text-align:center;font-weight:700;font-size:16px;color:#c62828;" +
        "border:2px solid #c62828;margin:6px 0;padding:4px;",
    tabla: "width:100%;border-collapse:collapse;",
    th: "border-bottom:1px dashed #000;padding:3px 2px;text-align:left;font-size:12px;font-weight:700;",
    td: "padding:3px 2px;vertical-align:top;font-size:13px;",
    num: "text-align:right;white-space:nowrap;",
    tot: "display:block;border-top:1px dashed #000;margin-top:6px;padding-top:6px;",
    totFila: "display:flex;justify-content:space-between;padding:2px 0;font-size:13px;background:#fff;color:#000;",
    totGrande: "font-weight:700;font-size:15px;",
    gracias: "display:block;text-align:center;font-weight:700;border-top:1px dashed #000;margin-top:6px;padding-top:8px;"
};

let _nvTicketCerrar = null;

function _nvTicketDOM() {
    let overlay = document.getElementById("nvTicketOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "nvTicketOverlay";
    overlay.className = "nv-ticket-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
        <div class="nv-ticket" style="${TK.ticket}">
            <div style="${TK.enc}">
                <p style="${TK.negocio}" id="nvTkTienda"></p>
                <p style="${TK.sub}">NeoVenta · Punto de venta</p>
                <div style="${TK.datos}">
                    <div style="${TK.datoFila}"><span>Folio:</span><span id="nvTkFolio"></span></div>
                    <div style="${TK.datoFila}"><span>Fecha:</span><span id="nvTkFecha"></span></div>
                    <div style="${TK.datoFila}"><span>Atendió:</span><span id="nvTkCajero"></span></div>
                </div>
            </div>
            <div style="${TK.sello}" id="nvTkSello" hidden>— CANCELADA —</div>
            <table style="${TK.tabla}" id="nvTkItems"></table>
            <div style="${TK.tot}" id="nvTkTotales"></div>
            <p style="${TK.gracias}">¡Gracias por su compra!</p>
        </div>
        <div class="nv-ticket-acciones">
            <button id="nvTkImprimir" class="btn verde" type="button">Imprimir</button>
            <button id="nvTkCerrar" class="btn gris" type="button">Cerrar</button>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector("#nvTkImprimir").addEventListener("click", () => window.print());
    overlay.querySelector("#nvTkCerrar").addEventListener("click", () => {
        overlay.hidden = true;
        if (_nvTicketCerrar) {
            const cb = _nvTicketCerrar;
            _nvTicketCerrar = null;
            cb();
        }
    });
    return overlay;
}

function nvTicket(v, onCerrar) {
    _nvTicketCerrar = onCerrar || null;
    const overlay = _nvTicketDOM();

    document.getElementById("nvTkTienda").textContent = v.tienda || "NeoVenta";
    const fecha = v.fecha ? new Date(v.fecha) : new Date();
    document.getElementById("nvTkFolio").textContent = String(v.folio).padStart(6, "0");
    document.getElementById("nvTkFecha").textContent = fecha.toLocaleString("es-MX");
    document.getElementById("nvTkCajero").textContent = v.cajero || "";
    document.getElementById("nvTkSello").hidden = !v.cancelada;

    const tabla = document.getElementById("nvTkItems");
    tabla.textContent = "";
    const enc = document.createElement("thead");
    const filaEnc = document.createElement("tr");
    ["Cant", "Producto", "Importe"].forEach((t, i) => {
        const th = document.createElement("th");
        th.textContent = t;
        th.style.cssText = TK.th + (i === 2 ? TK.num : "");
        filaEnc.appendChild(th);
    });
    enc.appendChild(filaEnc);
    tabla.appendChild(enc);

    const tb = document.createElement("tbody");
    v.items.forEach(it => {
        const tr = document.createElement("tr");
        const c1 = document.createElement("td");
        c1.textContent = it.cantidad;
        c1.style.cssText = TK.td;
        const c2 = document.createElement("td");
        c2.textContent = it.descripcion;
        c2.style.cssText = TK.td;
        const c3 = document.createElement("td");
        c3.textContent = "$" + Number(it.importe).toFixed(2);
        c3.style.cssText = TK.td + TK.num;
        tr.append(c1, c2, c3);
        tb.appendChild(tr);
    });
    tabla.appendChild(tb);

    const tot = document.getElementById("nvTkTotales");
    tot.textContent = "";
    const linea = (lbl, val, grande) => {
        const d = document.createElement("div");
        d.style.cssText = TK.totFila + (grande ? TK.totGrande : "");
        const s1 = document.createElement("span");
        s1.textContent = lbl;
        const s2 = document.createElement("span");
        s2.textContent = "$" + Number(val).toFixed(2);
        d.append(s1, s2);
        return d;
    };
    tot.append(
        linea("TOTAL", v.total, true),
        linea("Pago", v.pago),
        linea("Cambio", v.cambio)
    );

    overlay.hidden = false;
}
