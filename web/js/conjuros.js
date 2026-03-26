const escuelaMapInv = { "Abjuración": "A", "Conjuración": "C", "Adivinación": "D", "Encantamiento": "EN", "Evocación": "EV", "Ilusionismo": "I", "Nigromancia": "N", "Transmutación": "T" };

// --- GESTIÓN DE PREFERENCIAS ---

function guardarPreferencias() {
    const unidad = document.getElementById('unidadSelector').value;
    const materiales = document.getElementById('chkMateriales').checked;

    localStorage.setItem('pref_unidad', unidad);
    localStorage.setItem('pref_materiales', materiales);
}

function cargarPreferencias() {
    const unidadGuardada = localStorage.getItem('pref_unidad');
    const materialesGuardados = localStorage.getItem('pref_materiales');

    if (unidadGuardada) {
        document.getElementById('unidadSelector').value = unidadGuardada;
    }
    if (materialesGuardados !== null) {
        document.getElementById('chkMateriales').checked = (materialesGuardados === 'true');
    }
}

// --- GESTIÓN DEL HISTORIAL ---

function actualizarHistorial(nombre) {
    let historial = JSON.parse(localStorage.getItem('historial_conjuros') || '[]');

    // Evitar duplicados y mantener solo los últimos 5
    historial = historial.filter(item => item !== nombre);
    historial.unshift(nombre);
    if (historial.length > 5) historial.pop();

    localStorage.setItem('historial_conjuros', JSON.stringify(historial));
    renderizarHistorial();
}

function renderizarHistorial() {
    const list = document.getElementById('historyList');
    const historial = JSON.parse(localStorage.getItem('historial_conjuros') || '[]');

    if (historial.length === 0) return;

    list.innerHTML = '';
    historial.forEach(nombre => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = nombre;
        // Al hacer clic, buscamos el conjuro en la BD y lo cargamos
        item.onclick = () => {
            const selector = document.getElementById('conjuroSelector');
            // Buscar por nombre en el select
            for (let i = 0; i < selector.options.length; i++) {
                if (selector.options[i].text === nombre) {
                    selector.selectedIndex = i;
                    cargarDatosConjuro();
                    break;
                }
            }
        };
        list.appendChild(item);
    });
}

// Inicializar el historial al cargar la página
document.addEventListener('DOMContentLoaded', renderizarHistorial);

let baseDeDatos = [];

cargarPreferencias();
inicializarBD('./datos/conjuros/PHB2024.json', 'conjuroSelector');
generarTicket();

async function cargarDatosConjuro() {
    const idx = document.getElementById('conjuroSelector').value;
    if (idx === "") return;

    const c = baseDeDatos[idx];
    const unidad = document.getElementById('unidadSelector').value; // 'pies' o 'metros'
    const form = document.getElementById('ticketForm');

    // 1. Datos básicos y Escuela
    form.nombre.value = c.nombre;
    form.nivel.value = c.nivel;
    form.escuela.value = escuelaMapInv[c.escuela] || c.escuela;
    form.tiempo.value = c.tiempo_de_lanzamiento.replace(/\s*\(.*?\)/g, "").trim();
    form.ritual.checked = c.ritual;
    form.componentes.value = c.componentes.join(", ");

    // 2. Lógica de Alcance (Array [pies, metros] o String "Lanzador")
    if (Array.isArray(c.alcance)) {
        form.rango.value = (unidad === 'pies') ? c.alcance[0] : c.alcance[1];
    } else {
        form.rango.value = c.alcance;
    }

    // 3. Duración + Concentración
    let duracionFinal = c.duracion;
    if (c.concentracion) {
        // "Hasta 1 minuto" -> "Concentración, hasta 1 minuto"
        duracionFinal = `Concentración, ${c.duracion.toLowerCase()}`;
    }
    form.duracion.value = duracionFinal;

    // 4. Descripción (Limpieza de <br> e Itálicas para el Canvas)
    let rawDesc = "";
    if (Array.isArray(c.descripcion)) {
        rawDesc = (unidad === 'pies') ? c.descripcion[0] : c.descripcion[1];
    } else {
        rawDesc = c.descripcion;
    }

    // Convertimos <br> en saltos de línea y quitamos etiquetas <i>
    // El Canvas no entiende HTML, así que lo limpiamos para el textarea
    form.text.value = rawDesc
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+(>|$)/g, "");

    // --- LÓGICA CONDICIONAL DE MATERIALES ---
    const mostrarMat = document.getElementById('chkMateriales').checked;

    if (mostrarMat && c.materiales) {
        form.text.value = `${c.materiales}\n\n${form.text.value}`;
    }

    // 5. Autogenerar el ticket
    generarTicket();
}

const basePX = 22.4;
const em = (val) => `${val * basePX}px`;

const STYLE = {
    padding: 12,
    lineHeight: 30,
    paraSpacing: 12,
    borderRadius: 8,
    fonts: {
        title: `${em(1.5)} scaly-sans-caps-bold`,
        nivel: `bold 20.8px scaly-sans`,
        subtitle: `${em(1)} scaly-sans-italic`,
        label: `bold ${em(1)} scaly-sans-bold`,
        body: `${em(1)} scaly-sans`,
        italic: `${em(1)} scaly-sans-italic`,
        boldItalic: `${em(1)} scaly-sans-bold-italic`
    }
};

function schoolText(s) {
    const schools = { "EV": "Evocación", "A": "Abjuración", "C": "Conjuración", "N": "Nigromancia", "T": "Transmutación", "EN": "Encantamiento", "D": "Adivinación", "I": "Ilusionismo" };
    return schools[s] || s;
}

async function generarTicket() {
    await cargarFuentes();
    const form = document.getElementById("ticketForm");
    const data = Object.fromEntries(new FormData(form));
    const textLines = data.text.split("\n").map(l => l.trim()).filter(l => l !== "");

    const canvas = document.getElementById("ticketCanvas");
    const ctx = canvas.getContext("2d");
    const maxWidth = canvas.width - (STYLE.padding * 2);

    // --- LÓGICA DEL NOMBRE (CORREGIDA) ---
    const nivelTxt = "NIVEL " + data.nivel;
    ctx.font = STYLE.fonts.nivel;
    const nw = ctx.measureText(nivelTxt).width;
    // Espacio real: ancho total - padding izquierdo - ancho del cuadro nivel - padding derecho nivel
    const nombreMaxWidth = canvas.width - STYLE.padding - (nw + 11);

    ctx.font = STYLE.fonts.title;
    const wordsNombre = data.nombre.split(' ');
    let line1 = "";
    let line2 = "";
    let offsetY = 0;
    const nombreLineHeight = 28;

    for (let i = 0; i < wordsNombre.length; i++) {
        let word = wordsNombre[i];
        // Probamos si la palabra cabe en la línea 1
        let testLine = line1 + word + " ";

        // Medimos en Mayúsculas para asegurar el peor de los casos
        if (ctx.measureText(testLine).width <= nombreMaxWidth) {
            line1 = testLine;
        } else {
            // Si NO cabe, esta palabra y las siguientes van a la línea 2
            line2 = wordsNombre.slice(i).join(" ");
            offsetY = nombreLineHeight;
            break;
        }
    }

    // --- FASE 1: CÁLCULO DE ALTURA DINÁMICA ---
    let calcY = 220 + offsetY;
    textLines.forEach((line, index) => {
        let currentX = STYLE.padding;
        let boldPhase = line.startsWith("Mejora") || line.startsWith("Con un espacio");
        line.split(' ').forEach(p => {
            ctx.font = line.startsWith("Fuente:") ? STYLE.fonts.italic : (boldPhase ? STYLE.fonts.boldItalic : STYLE.fonts.body);
            let m = ctx.measureText(p + " ");
            if (currentX + m.width > STYLE.padding + maxWidth) {
                currentX = STYLE.padding;
                calcY += STYLE.lineHeight;
            }
            currentX += m.width;
            if (boldPhase && p.includes('.')) boldPhase = false;
        });
        calcY += index < textLines.length - 1 ? STYLE.lineHeight + STYLE.paraSpacing : STYLE.lineHeight;
    });
    canvas.height = calcY + STYLE.padding;

    // --- FASE 2: DIBUJO ---
    ctx.fillStyle = "white"; ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, STYLE.borderRadius); ctx.fill();
    ctx.strokeStyle = "black"; ctx.lineWidth = 5; ctx.stroke();
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(canvas.width, 0); ctx.stroke();

    ctx.fillStyle = "black"; ctx.textAlign = "left"; ctx.textBaseline = "top";

    // Dibujar Nombre (Original, no Mayúsculas)
    ctx.font = (line2 === "") ? STYLE.fonts.title : `bold ${em(1.3)} scaly-sans-caps-bold`;
    ctx.fillText(line1, STYLE.padding, 15);
    if (line2 !== "") {
        ctx.fillText(line2, STYLE.padding, 15 + nombreLineHeight);
    }

    // Dibujar Nivel
    ctx.font = STYLE.fonts.nivel;
    const nivelX = canvas.width - nw - STYLE.padding;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(nivelX - 5, 12, nw + 10, 35);
    ctx.fillText(nivelTxt, nivelX, 18);

    // Escuela y Divisores con OFFSET
    ctx.font = STYLE.fonts.subtitle;
    ctx.fillText(schoolText(data.escuela), STYLE.padding, 60 + offsetY);

    const drawDivider = (y) => {
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(STYLE.padding, y); ctx.lineTo(canvas.width - STYLE.padding, y); ctx.stroke();
    };
    drawDivider(95 + offsetY);

    const drawData = (l, v, x, y, a = "left") => {
        ctx.textAlign = a; ctx.font = STYLE.fonts.label; ctx.fillText(l, x, y);
        ctx.font = STYLE.fonts.body; ctx.fillText(v, x, y + 22);
    };
    drawData("TIEMPO", data.tiempo + (form.ritual.checked ? " (Ritual)" : ""), STYLE.padding, 110 + offsetY);
    drawData("ALCANCE", data.rango, canvas.width - STYLE.padding, 110 + offsetY, "right");
    drawData("DURACIÓN", data.duracion, STYLE.padding, 165 + offsetY);
    drawData("COMP.", data.componentes, canvas.width - STYLE.padding, 165 + offsetY, "right");

    ctx.textAlign = "left"; drawDivider(215 + offsetY);

    // --- FASE 4: TEXTO PRINCIPAL (JUSTIFICADO) ---
    let drawY = 230 + offsetY;
    textLines.forEach(line => {
        const palabrasOriginales = line.split(' ');
        let lineaActual = [];
        let anchoActual = 0;
        let boldPhase = line.startsWith("Mejora") || line.startsWith("Con un espacio");
        let isFuente = line.startsWith("Fuente:");

        palabrasOriginales.forEach((palabra) => {
            ctx.font = isFuente ? STYLE.fonts.italic : (boldPhase ? STYLE.fonts.boldItalic : STYLE.fonts.body);
            let metrics = ctx.measureText(palabra + " ");

            if (anchoActual + metrics.width > maxWidth) {
                let xParaEstaLinea = STYLE.padding;
                let anchoSinEspacios = 0;
                lineaActual.forEach(p => { ctx.font = p.font; anchoSinEspacios += ctx.measureText(p.txt).width; });
                let espacioExtra = (lineaActual.length > 1) ? (maxWidth - anchoSinEspacios) / (lineaActual.length - 1) : 0;

                lineaActual.forEach(p => {
                    ctx.font = p.font;
                    ctx.fillText(p.txt, xParaEstaLinea, drawY);
                    xParaEstaLinea += ctx.measureText(p.txt).width + espacioExtra;
                });
                drawY += STYLE.lineHeight; lineaActual = []; anchoActual = 0;
            }
            ctx.font = isFuente ? STYLE.fonts.italic : (boldPhase ? STYLE.fonts.boldItalic : STYLE.fonts.body);
            lineaActual.push({ txt: palabra, font: ctx.font });
            anchoActual += metrics.width;
            if (boldPhase && palabra.includes('.')) boldPhase = false;
        });

        let xFinal = STYLE.padding;
        lineaActual.forEach(p => {
            ctx.font = p.font; ctx.fillText(p.txt + " ", xFinal, drawY);
            xFinal += ctx.measureText(p.txt + " ").width;
        });
        drawY += STYLE.lineHeight + STYLE.paraSpacing;
    });

    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) { btnPrint.disabled = false; btnPrint.style.background = "var(--accent)"; btnPrint.style.color = "var(--bg-dark)"; }

    actualizarHistorial(data.nombre);
}