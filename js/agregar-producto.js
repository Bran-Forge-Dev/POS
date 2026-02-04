const form = document.getElementById("formProducto");

form.addEventListener("submit", function (e) {
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

    let productos = JSON.parse(localStorage.getItem("productos")) || [];

    // validar código duplicado
    const existe = productos.some(p => p.codigo === producto.codigo);
    if (existe) {
        alert("El código del producto ya existe");
        return;
    }

    productos.push(producto);
    localStorage.setItem("productos", JSON.stringify(productos));

    window.location.href = "productos.html";
});
