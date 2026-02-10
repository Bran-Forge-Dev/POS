const form = document.getElementById("formProveedor");

form.addEventListener("submit", e => {
    e.preventDefault();

    const proveedor = {
        codigo: document.getElementById("codigo").value,
        nombre: document.getElementById("nombre").value,
        razon: document.getElementById("razon").value,
        telefono: document.getElementById("telefono").value,
        direccion: document.getElementById("direccion").value,
        correo: document.getElementById("correo").value
    };

    let proveedores = JSON.parse(localStorage.getItem("proveedores")) || [];
    proveedores.push(proveedor);
    localStorage.setItem("proveedores", JSON.stringify(proveedores));

    window.location.href = "proveedores.html";
});