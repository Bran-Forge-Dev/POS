const form = document.getElementById("formProveedor");

form.addEventListener("submit", async e => {
    e.preventDefault();

    const proveedor = {
        codigo: document.getElementById("codigo").value.trim(),
        nombre: document.getElementById("nombre").value.trim(),
        razon: document.getElementById("razon").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        direccion: document.getElementById("direccion").value.trim(),
        correo: document.getElementById("correo").value.trim()
    };

    const { error } = await _supabase
        .from("pos_proveedores")
        .insert(proveedor);

    if (error) {
        if (error.code === "23505") {
            alert("El código del proveedor ya existe");
        } else {
            alert("No se pudo guardar: " + error.message);
        }
        return;
    }

    window.location.href = "proveedores.html";
});
