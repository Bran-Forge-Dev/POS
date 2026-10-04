// ============================================================
// UI compartida NeoVenta — toasts y modales
// Reemplaza alert()/confirm()/prompt() nativos.
// API:
//   toast(msg, "ok"|"error"|"info")          -> notificación
//   await alerta(msg)                         -> modal, Aceptar
//   await confirmar(msg)                      -> true / false
//   await preguntar(msg, valorInicial)        -> string / null
//   await preguntarCampos(titulo, campos)     -> array / null
//     campos: [{ label: "Nombre", valor: "x" }, ...]
// ============================================================

(function () {
    const css = `
        .nv-overlay {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(0,0,0,.45);
            display: flex; align-items: center; justify-content: center;
        }
        .nv-modal {
            background: #fff; border-radius: 10px;
            padding: 24px 28px; min-width: 300px; max-width: 420px;
            box-shadow: 0 10px 40px rgba(0,0,0,.25);
            font-family: 'Inter', sans-serif;
        }
        .nv-modal h3 { margin: 0 0 12px; color: #222; font-size: 1.1rem; }
        .nv-modal .nv-msg { margin: 0 0 18px; color: #444; font-size: .95rem; white-space: pre-line; }
        .nv-modal label { display: block; font-size: .8rem; color: #666; margin: 10px 0 4px; }
        .nv-modal input {
            width: 100%; box-sizing: border-box; padding: 9px 10px;
            border: 1px solid #ccc; border-radius: 6px; font-size: .95rem;
            font-family: 'Inter', sans-serif;
        }
        .nv-modal input:focus { outline: none; border-color: #c67f00; }
        .nv-botones { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .nv-btn {
            border: none; border-radius: 8px; padding: 9px 20px;
            font-weight: 700; font-size: .9rem; cursor: pointer;
            font-family: 'Inter', sans-serif;
        }
        .nv-btn-aceptar { background: #c67f00; color: #fff; }
        .nv-btn-aceptar:hover { background: #a56a00; }
        .nv-btn-cancelar { background: #eee; color: #444; }
        .nv-btn-cancelar:hover { background: #ddd; }

        .nv-toasts {
            position: fixed; top: 18px; right: 18px; z-index: 300;
            display: flex; flex-direction: column; gap: 10px;
        }
        .nv-toast {
            background: #fff; border-left: 5px solid #c67f00;
            padding: 12px 18px; border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,.18);
            font-family: 'Inter', sans-serif; font-size: .9rem; color: #333;
            max-width: 340px;
            animation: nvSlideIn .25s ease;
        }
        .nv-toast.ok    { border-left-color: #2e7d32; }
        .nv-toast.error { border-left-color: #c62828; }
        @keyframes nvSlideIn {
            from { transform: translateX(30px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }
    `;
    document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
    });
})();

function toast(mensaje, tipo = "info") {
    let cont = document.querySelector(".nv-toasts");
    if (!cont) {
        cont = document.createElement("div");
        cont.className = "nv-toasts";
        document.body.appendChild(cont);
    }
    const t = document.createElement("div");
    t.className = `nv-toast ${tipo}`;
    t.textContent = mensaje;
    cont.appendChild(t);
    setTimeout(() => t.remove(), 4200);
}

// Modal genérico: resuelve con los valores de los inputs o null si cancela
function _nvModal({ titulo, mensaje, campos = [], textoAceptar = "Aceptar", cancelable = true }) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "nv-overlay";

        const modal = document.createElement("div");
        modal.className = "nv-modal";

        const h3 = document.createElement("h3");
        h3.textContent = titulo;
        modal.appendChild(h3);

        if (mensaje) {
            const p = document.createElement("p");
            p.className = "nv-msg";
            p.textContent = mensaje;
            modal.appendChild(p);
        }

        const inputs = campos.map(c => {
            const lbl = document.createElement("label");
            lbl.textContent = c.label;
            const inp = document.createElement("input");
            inp.type = c.tipo || "text";
            inp.value = c.valor != null ? c.valor : "";
            modal.append(lbl, inp);
            return inp;
        });

        const cerrar = valor => {
            overlay.remove();
            document.removeEventListener("keydown", onKey);
            resolve(valor);
        };

        const btns = document.createElement("div");
        btns.className = "nv-botones";

        if (cancelable) {
            const btnCancel = document.createElement("button");
            btnCancel.type = "button";
            btnCancel.className = "nv-btn nv-btn-cancelar";
            btnCancel.textContent = "Cancelar";
            btnCancel.addEventListener("click", () => cerrar(null));
            btns.appendChild(btnCancel);
        }

        const btnOk = document.createElement("button");
        btnOk.type = "button";
        btnOk.className = "nv-btn nv-btn-aceptar";
        btnOk.textContent = textoAceptar;
        btnOk.addEventListener("click", () =>
            cerrar(inputs.length ? inputs.map(i => i.value) : true));
        btns.appendChild(btnOk);
        modal.appendChild(btns);

        const onKey = e => {
            if (e.key === "Escape" && cancelable) cerrar(null);
            if (e.key === "Enter") {
                e.preventDefault();
                cerrar(inputs.length ? inputs.map(i => i.value) : true);
            }
        };
        document.addEventListener("keydown", onKey);

        overlay.addEventListener("click", e => {
            if (e.target === overlay && cancelable) cerrar(null);
        });

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        (inputs[0] || btnOk).focus();
        if (inputs[0]) inputs[0].select();
    });
}

function alerta(mensaje, titulo = "NeoVenta") {
    return _nvModal({ titulo, mensaje, cancelable: false }).then(() => {});
}

function confirmar(mensaje) {
    return _nvModal({ titulo: "Confirmar", mensaje }).then(v => v === true);
}

async function preguntar(mensaje, valorInicial = "") {
    const r = await _nvModal({ titulo: mensaje, campos: [{ label: "", valor: valorInicial }] });
    return r === null ? null : r[0];
}

async function preguntarCampos(titulo, campos) {
    return _nvModal({ titulo, campos });
}
