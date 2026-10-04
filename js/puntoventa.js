document.addEventListener("DOMContentLoaded", async function () {
    await requerirSesion();

    // Catálogo real desde Supabase (tabla pos_productos)
    let productos = [];
    async function cargarCatalogo() {
        const { data, error } = await _supabase
            .from("pos_productos")
            .select("*")
            .order("codigo");
        if (error) {
            alert("No se pudo cargar el catálogo de productos.");
            return;
        }
        productos = data;
    }
    await cargarCatalogo();

    // Perfil en caché para datos del ticket (tienda + cajero)
    const perfil = await getPerfil();

    // Elementos del DOM
    const btnAgregar = document.querySelector(".btn-agregar");
    const inputCodigo = document.getElementById("codigo");
    const tbody = document.querySelector(".tabla tbody");
    const totalSpan = document.getElementById("total");
    const montoFinalDiv = document.querySelector(".monto-final");
    const botonCobrar = document.querySelector(".btn.verde");
    const botonCancelar = document.querySelector(".btn.gris");
    const botonEliminar = document.querySelector(".btn.rojo");
    const botonCambiar = document.querySelector(".btn.dorado");
    const productosCountP = document.querySelector(".acciones-izquierda p");

    const pagoContainer = document.querySelector(".totales div:nth-child(2)");
    const cambioContainer = document.querySelector(".totales div:nth-child(3)");

    // Input de "Pago con"
    let inputPago = document.querySelector("#pagoCliente");
    if (!inputPago) {
        inputPago = document.createElement("input");
        inputPago.type = "number";
        inputPago.id = "pagoCliente";
        inputPago.min = "0";
        inputPago.placeholder = "0.00";
        inputPago.style.width = "80px";
        inputPago.style.textAlign = "right";
        pagoContainer.innerHTML = "";
        const lbl = document.createElement("span");
        lbl.textContent = "Pago con:";
        pagoContainer.appendChild(lbl);
        pagoContainer.appendChild(document.createElement("br"));
        pagoContainer.appendChild(inputPago);
    }

    // Span fijo para el cambio
    let cambioMonto = document.querySelector("#montoCambio");
    if (!cambioMonto) {
        cambioMonto = document.createElement("span");
        cambioMonto.id = "montoCambio";
        cambioMonto.textContent = "$0.00";
        cambioContainer.innerHTML = "";
        const lbl = document.createElement("span");
        lbl.textContent = "Cambio:";
        cambioContainer.appendChild(lbl);
        cambioContainer.appendChild(document.createElement("br"));
        cambioContainer.appendChild(cambioMonto);
    }

    let total = 0;
    let filaSeleccionada = null;

    function celda(texto) {
        const td = document.createElement("td");
        td.textContent = texto;
        return td;
    }

    function recalcularTotalesYUI() {
        total = 0;
        [...tbody.rows].forEach(row => {
            const importe = parseFloat(row.cells[4].textContent.replace("$", "").trim()) || 0;
            total += importe;
        });
        totalSpan.innerHTML = "";
        const lbl = document.createElement("span");
        lbl.textContent = "Total:";
        totalSpan.appendChild(lbl);
        totalSpan.appendChild(document.createTextNode(" $" + total.toFixed(2)));
        montoFinalDiv.textContent = `$${total.toFixed(2)}`;
    }

    function actualizarContadorProductos() {
        let totalProductos = 0;
        for (let i = 0; i < tbody.rows.length; i++) {
            const cantidad = parseInt(tbody.rows[i].cells[3].textContent, 10) || 0;
            totalProductos += cantidad;
        }
        productosCountP.textContent = `${totalProductos} Producto${totalProductos !== 1 ? "s" : ""}`;
    }

    function seleccionarFila(fila) {
        if (filaSeleccionada) filaSeleccionada.classList.remove("seleccionada");
        filaSeleccionada = (filaSeleccionada === fila) ? null : fila;
        if (filaSeleccionada) filaSeleccionada.classList.add("seleccionada");
    }

    function limpiarTicket() {
        tbody.innerHTML = "";
        filaSeleccionada = null;
        total = 0;
        recalcularTotalesYUI();
        actualizarContadorProductos();
        cambioMonto.textContent = "$0.00";
        inputPago.value = "";
        inputCodigo.value = "";
        inputCodigo.focus();
    }

    // Agregar producto al ticket
    btnAgregar.addEventListener("click", function () {
        const codigo = inputCodigo.value.trim();
        if (!codigo) {
            alert("Ingresa un código.");
            return;
        }

        const producto = productos.find(p => p.codigo === codigo);
        if (!producto) {
            alert("Producto no encontrado");
            inputCodigo.value = "";
            inputCodigo.focus();
            return;
        }

        const filaExistente = [...tbody.rows].find(r => r.cells[0].textContent === codigo);
        if (filaExistente) {
            const cantidadCell = filaExistente.cells[3];
            const importeCell = filaExistente.cells[4];
            const nuevaCantidad = parseInt(cantidadCell.textContent, 10) + 1;
            if (nuevaCantidad > producto.cantidad) {
                alert(`Sin existencia suficiente. Disponible: ${producto.cantidad}`);
                inputCodigo.value = "";
                inputCodigo.focus();
                return;
            }
            cantidadCell.textContent = nuevaCantidad;
            importeCell.textContent = `$${(producto.venta * nuevaCantidad).toFixed(2)}`;
        } else {
            if (producto.cantidad < 1) {
                alert("Producto sin existencia.");
                inputCodigo.value = "";
                inputCodigo.focus();
                return;
            }
            const fila = document.createElement("tr");
            fila.appendChild(celda(producto.codigo));
            fila.appendChild(celda(producto.descripcion));
            fila.appendChild(celda(`$${Number(producto.venta).toFixed(2)}`));
            fila.appendChild(celda("1"));
            fila.appendChild(celda(`$${Number(producto.venta).toFixed(2)}`));
            fila.appendChild(celda(String(producto.cantidad)));
            fila.addEventListener("click", () => seleccionarFila(fila));
            tbody.appendChild(fila);
        }

        recalcularTotalesYUI();
        actualizarContadorProductos();
        inputCodigo.value = "";
        inputCodigo.focus();
    });

    // Cancelar: limpia todo el ticket
    botonCancelar.addEventListener("click", limpiarTicket);

    // Eliminar: quita la fila seleccionada del ticket
    botonEliminar.addEventListener("click", function () {
        if (!filaSeleccionada) {
            alert("Selecciona un producto del ticket primero (clic en la fila).");
            return;
        }
        filaSeleccionada.remove();
        filaSeleccionada = null;
        recalcularTotalesYUI();
        actualizarContadorProductos();
    });

    // Cambiar: edita la cantidad de la fila seleccionada
    botonCambiar.addEventListener("click", function () {
        if (!filaSeleccionada) {
            alert("Selecciona un producto del ticket primero (clic en la fila).");
            return;
        }
        const codigo = filaSeleccionada.cells[0].textContent;
        const producto = productos.find(p => p.codigo === codigo);
        const actual = parseInt(filaSeleccionada.cells[3].textContent, 10);
        const entrada = prompt("Nueva cantidad:", actual);
        if (entrada === null) return;

        const nueva = parseInt(entrada, 10);
        if (isNaN(nueva) || nueva <= 0) {
            alert("Cantidad inválida.");
            return;
        }
        if (nueva > producto.cantidad) {
            alert(`Sin existencia suficiente. Disponible: ${producto.cantidad}`);
            return;
        }
        filaSeleccionada.cells[3].textContent = nueva;
        filaSeleccionada.cells[4].textContent = `$${(producto.venta * nueva).toFixed(2)}`;
        recalcularTotalesYUI();
        actualizarContadorProductos();
    });

    // Cobrar: valida pago, descuenta inventario y registra la venta
    botonCobrar.addEventListener("click", async function (e) {
        e.preventDefault();
        recalcularTotalesYUI();

        const totalActual = total || 0;
        const pagoVal = parseFloat(inputPago.value);

        if (totalActual === 0) {
            alert("No hay productos para cobrar.");
            return;
        }
        if (isNaN(pagoVal) || pagoVal <= 0) {
            alert("Ingrese un monto válido en 'Pago con'.");
            return;
        }
        if (pagoVal < totalActual) {
            alert(`El pago es insuficiente. Faltan $${(totalActual - pagoVal).toFixed(2)}.`);
            return;
        }

        const cambioTotal = pagoVal - totalActual;
        cambioMonto.textContent = `$${cambioTotal.toFixed(2)}`;

        // Registrar la venta en el servidor: valida stock, calcula
        // el total y descuenta inventario en UNA transacción
        const items = [...tbody.rows].map(row => {
            const codigo = row.cells[0].textContent;
            const producto = productos.find(p => p.codigo === codigo);
            return {
                producto_id: producto.id,
                cantidad: parseInt(row.cells[3].textContent, 10)
            };
        });

        const { data: folio, error } = await _supabase.rpc("pos_registrar_venta", {
            p_items: items,
            p_pago: pagoVal
        });

        if (error) {
            alert("No se pudo registrar la venta: " + error.message);
            cambioMonto.textContent = "$0.00";
            return;
        }

        // Ticket imprimible con los datos de la venta registrada
        mostrarTicket({
            folio,
            tienda: perfil && perfil.pos_tiendas ? perfil.pos_tiendas.nombre : "NeoVenta",
            cajero: perfil ? perfil.cuenta : "",
            items: items.map(it => {
                const p = productos.find(x => x.id === it.producto_id);
                return {
                    cantidad: it.cantidad,
                    descripcion: p.descripcion,
                    importe: Number(p.venta) * it.cantidad
                };
            }),
            total: totalActual,
            pago: pagoVal,
            cambio: cambioTotal
        });

        // Reflejar el nuevo stock en el catálogo local
        items.forEach(it => {
            const p = productos.find(x => x.id === it.producto_id);
            if (p) p.cantidad -= it.cantidad;
        });
    });

    // ---------- Ticket de venta ----------

    const overlay = document.getElementById("ticketOverlay");

    function mostrarTicket(v) {
        document.getElementById("tkTienda").textContent = v.tienda;
        document.getElementById("tkFolioFecha").textContent =
            `Folio: ${String(v.folio).padStart(6, "0")}  ${new Date().toLocaleString("es-MX")}`;
        document.getElementById("tkCajero").textContent = `Atendió: ${v.cajero}`;

        const tabla = document.getElementById("tkItems");
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
            c3.textContent = "$" + it.importe.toFixed(2);
            tr.append(c1, c2, c3);
            tb.appendChild(tr);
        });
        tabla.appendChild(tb);

        const tot = document.getElementById("tkTotales");
        tot.textContent = "";
        const linea = (lbl, val, grande) => {
            const d = document.createElement("div");
            d.className = "fila" + (grande ? " grande" : "");
            const s1 = document.createElement("span");
            s1.textContent = lbl;
            const s2 = document.createElement("span");
            s2.textContent = "$" + val.toFixed(2);
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

    document.getElementById("btnImprimir").addEventListener("click", function () {
        window.print();
    });
    document.getElementById("btnCerrarTicket").addEventListener("click", function () {
        overlay.hidden = true;
        limpiarTicket();
    });

    // Enter para agregar desde campo código + detección de escáner
    // (los escáneres teclean muy rápido; si no mandan Enter, agregamos al detectar la ráfaga)
    let ultimaTecla = 0;
    let timerEscaneo = null;
    inputCodigo.addEventListener("keydown", function (e) {
        const ahora = Date.now();
        const esRafaga = ahora - ultimaTecla < 40;
        ultimaTecla = ahora;
        clearTimeout(timerEscaneo);

        if (e.key === "Enter") {
            e.preventDefault();
            btnAgregar.click();
            return;
        }
        timerEscaneo = setTimeout(() => {
            if (esRafaga && inputCodigo.value.trim().length >= 4) {
                btnAgregar.click();
            }
        }, 90);
    });

    // Inicializar
    recalcularTotalesYUI();
    actualizarContadorProductos();
});
