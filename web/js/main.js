async function cargarFuentes() {
    const fuentes = [
        new FontFace("scaly-sans-caps-bold", 'url("fonts/ScalySansCaps-Bold.otf")'),
        new FontFace("scaly-sans", 'url("fonts/Scaly Sans.otf")'),
        new FontFace("scaly-sans-italic", 'url("fonts/Scaly Sans Italic.otf")'),
        new FontFace("scaly-sans-bold", 'url("fonts/Scaly Sans Bold.otf")'),
        new FontFace("scaly-sans-bold-italic", 'url("fonts/Scaly Sans Bold Italic.otf")')
    ];
    for (let f of fuentes) {
        try { await f.load(); document.fonts.add(f); } catch (e) { }
    }
    await document.fonts.ready;
}

async function inicializarBD(jsonPath, selectorId) {
    try {
        const respuesta = await fetch(jsonPath);
        baseDeDatos = await respuesta.json();

        const selector = document.getElementById(selectorId);
        // Ordenar alfabéticamente para el buscador
        baseDeDatos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        baseDeDatos.forEach((c, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = c.nombre;
            selector.appendChild(opt);
        });

        window.dispatchEvent(new Event('dbReady'));
    } catch (e) {
        console.error("Error cargando el JSON:", e);
    }
}