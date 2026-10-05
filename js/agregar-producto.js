const form = document.getElementById("formProducto");

// Escáner de códigos: el sufijo Enter que mandan los lectores
// debe avanzar a Descripción, no enviar el formulario vacío.
document.getElementById("codigo").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("descripcion").focus();
    }
});

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const producto = {
        codigo: document.getElementById("codigo").value.trim(),
        descripcion: document.getElementById("descripcion").value.trim(),
        costo: Number(document.getElementById("costo").value),
        venta: Number(document.getElementById("venta").value),
        mayoreo: Number(document.getElementById("mayoreo").value),
        cantidad: Number(document.getElementById("cantidad").value),
        minimo: Number(document.getElementById("minimo").value)
    };

    if (!producto.codigo || !producto.descripcion) {
        toast("Completa todos los campos obligatorios", "error");
        return;
    }

    const { error } = await _supabase
        .from("pos_productos")
        .insert(producto);

    if (error) {
        // 23505 = violación de llave única (código duplicado)
        if (error.code === "23505") {
            toast("El código del producto ya existe", "error");
        } else {
            toast("No se pudo guardar: " + error.message, "error");
        }
        return;
    }

    toast("Producto guardado.", "ok");
    setTimeout(() => { window.location.href = "productos.html"; }, 800);
});
