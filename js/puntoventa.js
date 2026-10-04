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
            toast("No se pudo cargar el catálogo de productos.", "error");
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
    const botonMayoreo = document.querySelector(".btn.azul");
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
            toast("Ingresa un código.", "error");
            return;
        }

        const producto = productos.find(p => p.codigo === codigo);
        if (!producto) {
            toast("Producto no encontrado.", "error");
            inputCodigo.value = "";
            inputCodigo.focus();
            return;
        }

        const filaExistente = [...tbody.rows].find(r => r.cells[0].textContent === codigo);
        let cantidadEnTicket;
        if (filaExistente) {
            const cantidadCell = filaExistente.cells[3];
            const importeCell = filaExistente.cells[4];
            cantidadEnTicket = parseInt(cantidadCell.textContent, 10) + 1;
            if (cantidadEnTicket > producto.cantidad) {
                toast(`Sin existencia suficiente. Disponible: ${producto.cantidad}`, "error");
                inputCodigo.value = "";
                inputCodigo.focus();
                return;
            }
            cantidadCell.textContent = cantidadEnTicket;
            // respeta el precio aplicado en la fila (venta o mayoreo)
            const precioUnit = parseFloat(filaExistente.cells[2].textContent.replace("$", ""));
            importeCell.textContent = `$${(precioUnit * cantidadEnTicket).toFixed(2)}`;
        } else {
            cantidadEnTicket = 1;
            if (producto.cantidad < 1) {
                toast("Producto sin existencia.", "error");
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

        // Aviso de stock bajo al quedar en o por debajo del mínimo
        const restante = producto.cantidad - cantidadEnTicket;
        if (Number(producto.minimo) > 0 && restante <= Number(producto.minimo)) {
            toast(`Stock bajo: ${producto.descripcion} quedará en ${restante} (mínimo ${producto.minimo})`, "info");
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
            toast("Selecciona un producto del ticket primero (clic en la fila).", "error");
            return;
        }
        filaSeleccionada.remove();
        filaSeleccionada = null;
        recalcularTotalesYUI();
        actualizarContadorProductos();
    });

    // Cambiar: edita la cantidad de la fila seleccionada
    botonCambiar.addEventListener("click", async function () {
        if (!filaSeleccionada) {
            toast("Selecciona un producto del ticket primero (clic en la fila).", "error");
            return;
        }
        const codigo = filaSeleccionada.cells[0].textContent;
        const producto = productos.find(p => p.codigo === codigo);
        const actual = parseInt(filaSeleccionada.cells[3].textContent, 10);
        const entrada = await preguntar("Nueva cantidad", actual);
        if (entrada === null) return;

        const nueva = parseInt(entrada, 10);
        if (isNaN(nueva) || nueva <= 0) {
            toast("Cantidad inválida.", "error");
            return;
        }
        if (nueva > producto.cantidad) {
            toast(`Sin existencia suficiente. Disponible: ${producto.cantidad}`, "error");
            return;
        }
        filaSeleccionada.cells[3].textContent = nueva;
        // respeta el precio aplicado en la fila (venta o mayoreo)
        const precioUnit = parseFloat(filaSeleccionada.cells[2].textContent.replace("$", ""));
        filaSeleccionada.cells[4].textContent = `$${(precioUnit * nueva).toFixed(2)}`;
        recalcularTotalesYUI();
        actualizarContadorProductos();
    });

    // Mayoreo: alterna el precio de la fila seleccionada entre
    // precio de venta y precio de mayoreo del catálogo
    botonMayoreo.addEventListener("click", function () {
        if (!filaSeleccionada) {
            toast("Selecciona un producto del ticket primero (clic en la fila).", "error");
            return;
        }
        const codigo = filaSeleccionada.cells[0].textContent;
        const producto = productos.find(p => p.codigo === codigo);
        const cantidad = parseInt(filaSeleccionada.cells[3].textContent, 10);
        const precioCell = filaSeleccionada.cells[2];
        const esMayoreo = filaSeleccionada.dataset.mayoreo === "1";

        const precioNuevo = esMayoreo ? Number(producto.venta) : Number(producto.mayoreo);
        filaSeleccionada.dataset.mayoreo = esMayoreo ? "" : "1";
        precioCell.textContent = `$${precioNuevo.toFixed(2)}`;
        precioCell.classList.toggle("precio-mayoreo", !esMayoreo);
        filaSeleccionada.cells[4].textContent = `$${(precioNuevo * cantidad).toFixed(2)}`;

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
            toast("No hay productos para cobrar.", "error");
            return;
        }
        if (isNaN(pagoVal) || pagoVal <= 0) {
            toast("Ingrese un monto válido en 'Pago con'.", "error");
            return;
        }
        if (pagoVal < totalActual) {
            toast(`El pago es insuficiente. Faltan $${(totalActual - pagoVal).toFixed(2)}.`, "error");
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
                cantidad: parseInt(row.cells[3].textContent, 10),
                es_mayoreo: row.dataset.mayoreo === "1"
            };
        });

        const { data: folio, error } = await _supabase.rpc("pos_registrar_venta", {
            p_items: items,
            p_pago: pagoVal
        });

        if (error) {
            toast("No se pudo registrar la venta: " + error.message, "error");
            cambioMonto.textContent = "$0.00";
            return;
        }

        // Ticket imprimible con los precios aplicados en cada fila
        const ticketItems = [...tbody.rows].map(row => ({
            cantidad: parseInt(row.cells[3].textContent, 10),
            descripcion: row.cells[1].textContent,
            importe: parseFloat(row.cells[4].textContent.replace("$", ""))
        }));
        nvTicket({
            folio,
            tienda: perfil && perfil.pos_tiendas ? perfil.pos_tiendas.nombre : "NeoVenta",
            cajero: perfil ? perfil.cuenta : "",
            items: ticketItems,
            total: totalActual,
            pago: pagoVal,
            cambio: cambioTotal
        }, limpiarTicket);

        // Reflejar el nuevo stock en el catálogo local
        items.forEach(it => {
            const p = productos.find(x => x.id === it.producto_id);
            if (p) p.cantidad -= it.cantidad;
        });
    });

    // El ticket lo renderiza js/ticket.js (nvTicket)

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
