// ============================================================
// Ticket de venta compartido (80mm, imprimible).
// Uso:
//   nvTicket({ folio, tienda, cajero, fecha, items, total,
//              pago, cambio, cancelada }, onCerrar)
//     items: [{ cantidad, descripcion, importe }]
//     cancelada: opcional -> imprime sello CANCELADA
//     onCerrar: callback opcional al cerrar el modal
// El markup y el CSS se inyectan solos.
// ============================================================

(function () {
    const css = `
        .nv-ticket-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,.5);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 18px; z-index: 150;
        }
        .nv-ticket-overlay[hidden] { display: none; }
        .nv-ticket {
            width: 72mm; background: #fff; padding: 6mm 4mm;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px; color: #000; text-align: left;
            box-shadow: 0 4px 20px rgba(0,0,0,.3);
            max-height: 80vh; overflow-y: auto;
        }
        .nv-ticket .encabezado {
            border-bottom: 1px dashed #000;
            padding-bottom: 8px; margin-bottom: 6px;
        }
        .nv-ticket .encabezado p { margin: 0; }
        .nv-ticket .negocio {
            font-weight: 700; font-size: 15px; text-transform: uppercase;
            text-align: center; margin-bottom: 2px !important;
        }
        .nv-ticket .sub {
            font-size: 10px; color: #444;
            text-align: center; margin-bottom: 8px !important;
        }
        .nv-ticket .datos {
            display: flex; flex-direction: column; gap: 3px;
            font-size: 11px;
        }
        .nv-ticket .datos .fila {
            display: flex; justify-content: space-between;
        }
        .nv-ticket table { width: 100%; border-collapse: collapse; }
        .nv-ticket th {
            border-bottom: 1px dashed #000; padding: 3px 2px;
            text-align: left; font-size: 11px;
        }
        .nv-ticket td { padding: 3px 2px; vertical-align: top; }
        .nv-ticket .num { text-align: right; white-space: nowrap; }
        .nv-ticket .totales {
            border-top: 1px dashed #000; margin-top: 6px; padding-top: 6px;
        }
        .nv-ticket .fila {
            display: flex; justify-content: space-between; padding: 2px 0;
        }
        .nv-ticket .fila.grande { font-weight: 700; font-size: 14px; }
        .nv-ticket .gracias {
            text-align: center; border-top: 1px dashed #000;
            margin-top: 6px; padding-top: 8px; font-weight: 700;
        }
        .nv-ticket .sello-cancelada {
            text-align: center; font-weight: 700; font-size: 16px;
            color: #c62828; border: 2px solid #c62828;
            margin: 6px 0; padding: 4px;
        }
        .nv-ticket-acciones { display: flex; gap: 12px; }

        @media print {
            body > *:not(#nvTicketOverlay) { display: none !important; }
            .nv-ticket-overlay {
                position: static !important; background: none !important;
                padding: 0 !important; display: block !important;
            }
            .nv-ticket {
                width: 72mm; max-height: none; overflow: visible;
                box-shadow: none; padding: 0 2mm; margin-left: 12mm;
            }
            .nv-ticket-acciones { display: none !important; }
            @page { margin: 10mm 5mm 10mm 0; }
        }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
})();

let _nvTicketCerrar = null;

function _nvTicketDOM() {
    let overlay = document.getElementById("nvTicketOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "nvTicketOverlay";
    overlay.className = "nv-ticket-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
        <div class="nv-ticket">
            <div class="encabezado">
                <p class="negocio" id="nvTkTienda"></p>
                <p class="sub">NeoVenta · Punto de venta</p>
                <div class="datos">
                    <div class="fila"><span>Folio:</span><span id="nvTkFolio"></span></div>
                    <div class="fila"><span>Fecha:</span><span id="nvTkFecha"></span></div>
                    <div class="fila"><span>Atendió:</span><span id="nvTkCajero"></span></div>
                </div>
            </div>
            <div class="sello-cancelada" id="nvTkSello" hidden>— CANCELADA —</div>
            <table id="nvTkItems"></table>
            <div class="totales" id="nvTkTotales"></div>
            <p class="gracias">¡Gracias por su compra!</p>
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
        if (i === 2) th.className = "num";
        filaEnc.appendChild(th);
    });
    enc.appendChild(filaEnc);
    tabla.appendChild(enc);

    const tb = document.createElement("tbody");
    v.items.forEach(it => {
        const tr = document.createElement("tr");
        const c1 = document.createElement("td");
        c1.textContent = it.cantidad;
        const c2 = document.createElement("td");
        c2.textContent = it.descripcion;
        const c3 = document.createElement("td");
        c3.className = "num";
        c3.textContent = "$" + Number(it.importe).toFixed(2);
        tr.append(c1, c2, c3);
        tb.appendChild(tr);
    });
    tabla.appendChild(tb);

    const tot = document.getElementById("nvTkTotales");
    tot.textContent = "";
    const linea = (lbl, val, grande) => {
        const d = document.createElement("div");
        d.className = "fila" + (grande ? " grande" : "");
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
