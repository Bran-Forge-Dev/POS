document.addEventListener("DOMContentLoaded", function () {
    requerirSesion();

    // Catálogo real desde localStorage (el mismo que alimenta AgregarProductos)
    const PRODUCTOS_SEMILLA = [
        { codigo: "1001", descripcion: "Coca-Cola 600ml", costo: 10.00, venta: 18.00, mayoreo: 16.00, cantidad: 25, minimo: 5 },
        { codigo: "1002", descripcion: "Galletas Oreo", costo: 8.00, venta: 14.50, mayoreo: 13.00, cantidad: 10, minimo: 3 },
        { codigo: "1003", descripcion: "Sabritas 45g", costo: 7.00, venta: 12.00, mayoreo: 10.50, cantidad: 15, minimo: 5 },
        { codigo: "1004", descripcion: "Agua Bonafont 1L", costo: 8.00, venta: 13.00, mayoreo: 11.50, cantidad: 20, minimo: 6 },
        { codigo: "1005", descripcion: "Pan Bimbo Grande", costo: 30.00, venta: 42.00, mayoreo: 38.00, cantidad: 8, minimo: 2 }
    ];

    let productos = JSON.parse(localStorage.getItem("productos")) || [];
    if (productos.length === 0) {
        productos = PRODUCTOS_SEMILLA;
        localStorage.setItem("productos", JSON.stringify(productos));
    }

    const guardarCatalogo = () => localStorage.setItem("productos", JSON.stringify(productos));

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
    botonCobrar.addEventListener("click", function (e) {
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

        // Descontar existencias y armar detalle de la venta
        const items = [...tbody.rows].map(row => {
            const codigo = row.cells[0].textContent;
            const cantidad = parseInt(row.cells[3].textContent, 10);
            const producto = productos.find(p => p.codigo === codigo);
            if (producto) producto.cantidad -= cantidad;
            return {
                codigo,
                descripcion: row.cells[1].textContent,
                precio: producto ? producto.venta : 0,
                cantidad
            };
        });
        guardarCatalogo();

        // Registrar la venta (folio, cajero, detalle, totales)
        const ventas = JSON.parse(localStorage.getItem("ventas")) || [];
        const sesion = getSesion();
        ventas.push({
            folio: ventas.length + 1,
            fecha: new Date().toISOString(),
            cajero: sesion ? sesion.cuenta : "desconocido",
            items,
            total: totalActual,
            pago: pagoVal,
            cambio: cambioTotal
        });
        localStorage.setItem("ventas", JSON.stringify(ventas));

        setTimeout(() => {
            alert("Compra realizada");
            limpiarTicket();
        }, 100);
    });

    // Enter para agregar desde campo código
    inputCodigo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            btnAgregar.click();
        }
    });

    // Inicializar
    recalcularTotalesYUI();
    actualizarContadorProductos();
});
