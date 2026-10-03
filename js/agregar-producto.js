const form = document.getElementById("formProducto");

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
        alert("Completa todos los campos obligatorios");
        return;
    }

    const { error } = await _supabase
        .from("pos_productos")
        .insert(producto);

    if (error) {
        // 23505 = violación de llave única (código duplicado)
        if (error.code === "23505") {
            alert("El código del producto ya existe");
        } else {
            alert("No se pudo guardar: " + error.message);
        }
        return;
    }

    window.location.href = "productos.html";
});
