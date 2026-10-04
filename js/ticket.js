// ============================================================
// Ticket de venta compartido (80mm, imprimible).
// Uso:
//   nvTicket({ folio, tienda, cajero, fecha, items, total,
//              pago, cambio, cancelada }, onCerrar)
//     items: [{ cantidad, descripcion, importe }]
//     cancelada: opcional -> imprime sello CANCELADA
//     onCerrar: callback opcional al cerrar el modal
// El markup y el CSS se inyectan solos. Todas las clases usan
// prefijo nv-tk- para no chocar con el CSS de las páginas.
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
            font-size: 13px; color: #000; text-align: left;
            box-shadow: 0 4px 20px rgba(0,0,0,.3);
            max-height: 80vh; overflow-y: auto;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .nv-ticket, .nv-ticket * {
            margin: 0; padding: 0; border: 0;
            font-family: 'Consolas', 'Courier New', monospace;
            color: #000 !important; background: transparent;
            font-size: 13px; font-weight: 600;
        }
        .nv-tk-enc {
            border-bottom: 1px dashed #000 !important;
            padding-bottom: 8px !important; margin-bottom: 6px !important;
        }
        .nv-tk-negocio {
            font-weight: 700 !important; font-size: 16px !important;
            text-transform: uppercase; text-align: center;
            margin-bottom: 2px !important;
        }
        .nv-tk-sub {
            font-size: 11px !important; color: #333 !important;
            text-align: center; margin-bottom: 8px !important;
        }
        .nv-tk-datos {
            display: flex; flex-direction: column; gap: 3px;
            font-size: 12px;
        }
        .nv-tk-datos .nv-tk-fila {
            display: flex; justify-content: space-between;
            font-size: 12px !important;
        }
        .nv-tk-tabla { width: 100%; border-collapse: collapse; }
        .nv-tk-tabla th {
            border-bottom: 1px dashed #000 !important; padding: 3px 2px !important;
            text-align: left; font-size: 12px !important; font-weight: 700 !important;
        }
        .nv-tk-tabla td { padding: 3px 2px !important; vertical-align: top; }
        .nv-tk-tabla .nv-tk-num { text-align: right; white-space: nowrap; }
        .nv-tk-tot {
            border-top: 1px dashed #000 !important;
            margin-top: 6px !important; padding-top: 6px !important;
        }
        .nv-tk-tot .nv-tk-fila {
            display: flex; justify-content: space-between;
            padding: 2px 0 !important;
        }
        .nv-tk-tot .nv-tk-grande {
            font-weight: 700 !important; font-size: 15px !important;
        }
        .nv-tk-gracias {
            text-align: center; border-top: 1px dashed #000 !important;
            margin-top: 6px !important; padding-top: 8px !important;
            font-weight: 700 !important;
        }
        .nv-tk-sello {
            text-align: center; font-weight: 700 !important; font-size: 16px !important;
            color: #c62828 !important; border: 2px solid #c62828 !important;
            margin: 6px 0 !important; padding: 4px !important;
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
            <div class="nv-tk-enc">
                <p class="nv-tk-negocio" id="nvTkTienda"></p>
                <p class="nv-tk-sub">NeoVenta · Punto de venta</p>
                <div class="nv-tk-datos">
                    <div class="nv-tk-fila"><span>Folio:</span><span id="nvTkFolio"></span></div>
                    <div class="nv-tk-fila"><span>Fecha:</span><span id="nvTkFecha"></span></div>
                    <div class="nv-tk-fila"><span>Atendió:</span><span id="nvTkCajero"></span></div>
                </div>
            </div>
            <div class="nv-tk-sello" id="nvTkSello" hidden>— CANCELADA —</div>
            <table class="nv-tk-tabla" id="nvTkItems"></table>
            <div class="nv-tk-tot" id="nvTkTotales"></div>
            <p class="nv-tk-gracias">¡Gracias por su compra!</p>
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
        if (i === 2) th.className = "nv-tk-num";
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
        c3.className = "nv-tk-num";
        c3.textContent = "$" + Number(it.importe).toFixed(2);
        tr.append(c1, c2, c3);
        tb.appendChild(tr);
    });
    tabla.appendChild(tb);

    const tot = document.getElementById("nvTkTotales");
    tot.textContent = "";
    const linea = (lbl, val, grande) => {
        const d = document.createElement("div");
        d.className = "nv-tk-fila" + (grande ? " nv-tk-grande" : "");
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
