const basePX = 22.4;
const em = (val) => `${val * basePX}px`;

const STYLE = {
    padding: 12,
    lineHeight: 30,
    paraSpacing: 12,
    borderRadius: 8,
    fonts: {
        title: `${em(1.5)} scaly-sans-caps-bold`,
        tipo: `bold 18px scaly-sans`,
        subtitle: `${em(1)} scaly-sans-italic`,
        label: `bold ${em(0.7)} scaly-sans-bold`,
        body: `${em(1)} scaly-sans`,
        italic: `${em(1)} scaly-sans-italic`,
        boldItalic: `${em(1)} scaly-sans-bold-italic`
    },
    // Colores de borde según rareza D&D 2024
    coloresRareza: {
        "Común": "#94a3b8",       // Gris
        "Infrecuente": "#10b981", // Verde
        "Raro": "#38bdf8",        // Azul
        "Muy raro": "#a855f7",    // Púrpura
        "Legendario": "#f59e0b",  // Dorado
        "Artefacto": "#ef4444"    // Rojo
    }
};

const ICONOS_TIPO = {
    "Arma": "⚔️",
    "Armadura": "🛡️",
    "Anillo": "💍",
    "Vara": "🪄",
    "Bastón": "🦯",
    "Cetro": "🔱",
    "Objeto maravilloso": "✨",
    "Poción": "🧪",
    "Pergamino": "📜",
    "Munición": "🏹",
    "Gema": "💎"
};

let baseDeDatos = [];

inicializarBD('./datos/objetos/DMG2024.json', 'objetoSelector');
//generarTicket();

// --- LÓGICA DE CARGA ---
function cargarDatosObjeto() {
    const idx = document.getElementById('objetoSelector').value;
    if (idx === "") return;
    const obj = baseDeDatos[idx];
    const form = document.getElementById('ticketForm');

    form.nombre.value = obj.nombre;
    form.tipo.value = obj.tipo;
    form.rareza.value = obj.rareza;
    form.sintonizacion.checked = obj.sintonizacion;
    form.restriccion.value = obj.restriccion_sintonizacion || "";
    form.descripcion.value = obj.descripcion;
    form.fuente.value = obj.fuente || "";

    generarTicket();
}

// --- GENERACIÓN DEL TICKET ---
async function generarTicket() {
    await cargarFuentes();
    const form = document.getElementById('ticketForm');
    const data = Object.fromEntries(new FormData(form));

    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    const maxWidth = canvas.width - (STYLE.padding * 2);

    // 1. Construir Subtítulo (Tipo + Rareza + Sintonización)
    let subtitulo = `${data.tipo}, ${data.rareza}`;
    if (form.sintonizacion.checked) {
        subtitulo += ` (requiere sintonización${data.restriccion ? ' por ' + data.restriccion : ''})`;
    }

    // 2. Pre-cálculo de Nombre y Offset (2 líneas si es largo)
    ctx.font = STYLE.fonts.title;
    const wordsNombre = data.nombre.split(' ');
    let line1 = "", line2 = "", currentTest = "", offsetY = 0;
    const nombreLineHeight = 28;

    for (let i = 0; i < wordsNombre.length; i++) {
        let testLine = (currentTest === "") ? wordsNombre[i] : currentTest + " " + wordsNombre[i];
        if (ctx.measureText(testLine.toUpperCase()).width <= maxWidth) {
            currentTest = testLine;
            line1 = currentTest;
        } else {
            line2 = wordsNombre.slice(i).join(" ");
            offsetY = nombreLineHeight;
            break;
        }
    }

    // 3. Fase de cálculo de altura
    const textLines = data.descripcion.split("\n").filter(l => l.trim() !== "");
    let calcY = 100 + offsetY; // Margen inicial para header y subtítulo
    textLines.forEach((line, index) => {
        let currentX = STYLE.padding;
        line.split(' ').forEach(p => {
            ctx.font = STYLE.fonts.body;
            let m = ctx.measureText(p + " ");
            if (currentX + m.width > STYLE.padding + maxWidth) { currentX = STYLE.padding; calcY += STYLE.lineHeight; }
            currentX += m.width;
        });
        calcY += index < textLines.length - 1 ? STYLE.lineHeight + STYLE.paraSpacing : STYLE.lineHeight;
    });
    // Añadimos espacio para la fuente al final
    if (data.fuente) calcY += STYLE.lineHeight + 10;
    canvas.height = calcY + STYLE.padding;

    // 4. Dibujo de Fondo y Bordes
    ctx.fillStyle = "white"; ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, STYLE.borderRadius); ctx.fill();
    ctx.strokeStyle = "black"; ctx.lineWidth = 5; ctx.stroke();

    // Borde de Rareza
    //ctx.strokeStyle = STYLE.coloresRareza[data.rareza] || "black";
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(canvas.width, 0); ctx.stroke();

    // 5. Dibujo de Textos
    ctx.fillStyle = "black"; ctx.textAlign = "left"; ctx.textBaseline = "top";

    // Nombre
    ctx.font = (line2 === "") ? STYLE.fonts.title : `bold ${em(1.15)} scaly-sans-caps-bold`;
    ctx.fillText(line1, STYLE.padding, 15);
    if (line2 !== "") ctx.fillText(line2, STYLE.padding, 15 + nombreLineHeight);

    // Subtítulo
    ctx.font = STYLE.fonts.subtitle;
    // Función de wrap simple para el subtítulo por si es muy largo
    const wordsSub = subtitulo.split(' ');
    let subLine1 = "", subLine2 = "", subY = 60 + offsetY;
    wordsSub.forEach(w => {
        if (ctx.measureText(subLine1 + w).width < maxWidth) subLine1 += w + " ";
        else subLine2 += w + " ";
    });
    ctx.fillText(subLine1, STYLE.padding, subY);
    if (subLine2 !== "") {
        subY += 20;
        ctx.fillText(subLine2, STYLE.padding, subY);
        offsetY += 20; // Empujar descripción si el subtítulo rompe
    }

    // Divisor
    ctx.strokeStyle = "black"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(STYLE.padding, subY + 30); ctx.lineTo(canvas.width - STYLE.padding, subY + 30); ctx.stroke();

    // Descripción (Justificada)
    let drawY = subY + 45;
    textLines.forEach(line => {
        const words = line.split(' ');
        let curLine = [], curW = 0;
        words.forEach(palabra => {
            ctx.font = STYLE.fonts.body;
            let m = ctx.measureText(palabra + " ");
            if (curW + m.width > maxWidth) {
                let x = STYLE.padding;
                let noSpaceW = 0;
                curLine.forEach(p => noSpaceW += ctx.measureText(p).width);
                let extra = (curLine.length > 1) ? (maxWidth - noSpaceW) / (curLine.length - 1) : 0;
                curLine.forEach(p => { ctx.fillText(p, x, drawY); x += ctx.measureText(p).width + extra; });
                drawY += STYLE.lineHeight; curLine = []; curW = 0;
            }
            curLine.push(palabra); curW += m.width;
        });
        let xF = STYLE.padding;
        curLine.forEach(p => { ctx.fillText(p + " ", xF, drawY); xF += ctx.measureText(p + " ").width; });
        drawY += STYLE.lineHeight + STYLE.paraSpacing;
    });

    // Fuente al final
    if (data.fuente) {
        ctx.font = STYLE.fonts.italic;
        ctx.textAlign = "right";
        ctx.fillText("Fuente: " + data.fuente, canvas.width - STYLE.padding, canvas.height - 30);
    }

    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) { btnPrint.disabled = false; btnPrint.style.background = "var(--accent)"; btnPrint.style.color = "var(--bg-dark)"; }
}