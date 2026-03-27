// --- CONFIGURACIÓN Y ESTILOS ---
const basePX = 22.4;
const em = (val) => `${val * basePX}px`;

const STYLE = {
    padding: 16,
    lineHeight: 24,
    paraSpacing: 10,
    borderRadius: 8,
    fonts: {
        title: `${em(1.5)} scaly-sans-caps-bold`,
        subtitle: `${em(0.9)} scaly-sans-italic`,
        label: `bold ${em(0.7)} scaly-sans-bold`,
        body: `${em(0.9)} scaly-sans`,
        boldBody: `${em(0.9)} scaly-sans-bold`,
        italic: `${em(0.85)} scaly-sans-italic`
    }
};

let cacheBasesDatos = {};
let monstruosVisibles = [];

// --- INICIALIZACIÓN Y CARGA DE DATOS ---

async function inicializarMonstruos() {
    const archivos = ["MM2024.json", "PHB2024.json", "FRAIF.json"];
    const promesas = archivos.map(archivo =>
        fetch(`./datos/monstruos/${archivo}`)
            .then(res => res.json())
            .then(data => { cacheBasesDatos[archivo] = data; })
            .catch(e => console.error(`Error cargando ${archivo}:`, e))
    );

    await Promise.all(promesas);
    recargarBuscador();
}

function recargarBuscador() {
    const checks = document.querySelectorAll('.db-check');
    monstruosVisibles = [];

    checks.forEach(check => {
        if (check.checked && cacheBasesDatos[check.value]) {
            const dataConOrigen = cacheBasesDatos[check.value].map(m => ({
                ...m,
                _origen: check.value.replace('.json', '')
            }));
            monstruosVisibles = monstruosVisibles.concat(dataConOrigen);
        }
    });

    monstruosVisibles.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const selector = document.getElementById('monstruoSelector');
    selector.innerHTML = '<option value="">Selecciona un monstruo...</option>';

    monstruosVisibles.forEach((m, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${m.nombre} (${m._origen})`;
        selector.appendChild(opt);
    });

    window.dispatchEvent(new Event('dbReady'));
}

// --- PROCESAMIENTO DEL FORMULARIO ---

function cargarDatosMonstruo() {
    const idx = document.getElementById('monstruoSelector').value;
    if (idx === "") return;
    const m = monstruosVisibles[idx];
    const form = document.getElementById('ticketForm');

    form.nombre.value = m.nombre;
    form.vd.value = m.vd;
    form.iniciativa.value = m.iniciativa;
    form.tipo_size.value = `${m.tipo} ${m.size}, ${m.alineamiento}`;
    form.ca.value = m.ca;
    form.pg.value = m.pg;
    form.velocidad.value = m.velocidad;
    form.fuente.value = m.fuente || "";

    const stats = ['fue', 'des', 'con', 'int', 'sab', 'car'];
    stats.forEach(s => {
        form[`${s}_val`].value = `${m[s].valor} (${m[s].mod})`;
    });

    let fullText = "";

    if (m.habilidades) fullText += `**Habilidades:** ${m.habilidades}\n`;
    if (m.resistencias) fullText += `**Resistencias:** ${m.resistencias}\n`;
    if (m.inmunidades) fullText += `**Inmunidades:** ${m.inmunidades}\n`;
    if (m.sentidos) fullText += `**Sentidos:** ${m.sentidos}\n`;
    fullText += `**Idiomas:** ${m.idiomas}\n\n`;

    if (m.atributos && m.atributos.length > 0) {
        fullText += `**Atributos:**\n`;
        m.atributos.forEach(item => {
            if (item.nombre) {
                fullText += `**${item.nombre}**${item.descripcion}\n\n`;
            }
        });
    }

    const procesarLista = (lista, titulo) => {
        if (!lista || lista.length === 0) return;
        if (titulo) fullText += `**${titulo}**\n`;
        lista.forEach(item => {
            if (item.nombre) {
                fullText += `**${item.nombre}**${item.descripcion}\n\n`;
            }
        });
    };

    procesarLista(m.acciones, "ACCIONES");
    procesarLista(m.reacciones, "REACCIONES");

    if (m.acciones_legendarias && m.acciones_legendarias.length > 0) {
        fullText += `**ACCIONES LEGENDARIAS**\n`;
        if (m.usos_acciones_legendarias) fullText += `Usos: ${m.usos_acciones_legendarias}\n`;
        procesarLista(m.acciones_legendarias);
    }

    form.text.value = fullText.trim();
    generarTicketMonstruo();
}

// --- FUNCIÓN PARA DIVIDIR TEXTO EN LÍNEAS QUE CABEN EN EL CANVAS ---
function wrapText(ctx, text, maxWidth, isBold = false) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    ctx.font = isBold ? STYLE.fonts.boldBody : STYLE.fonts.body;

    for (let word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
}

// --- FUNCIÓN PARA PROCESAR LÍNEAS CON FORMATO Y OBTENER LÍNEAS ENVUELTAS ---
function processFormattedLine(ctx, line, maxWidth) {
    const result = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    let segments = [];

    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ text: line.substring(lastIndex, match.index), bold: false });
        }
        segments.push({ text: match[1], bold: true });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
        segments.push({ text: line.substring(lastIndex), bold: false });
    }

    if (segments.length === 0) {
        segments.push({ text: line, bold: false });
    }

    // Combinar segmentos que sean consecutivos del mismo estilo
    const mergedSegments = [];
    for (let seg of segments) {
        if (mergedSegments.length > 0 && mergedSegments[mergedSegments.length - 1].bold === seg.bold) {
            mergedSegments[mergedSegments.length - 1].text += seg.text;
        } else {
            mergedSegments.push({ ...seg });
        }
    }

    // Dividir cada segmento si es necesario
    let finalLines = [[]]; // cada elemento es un array de segmentos para una línea

    for (let seg of mergedSegments) {
        ctx.font = seg.bold ? STYLE.fonts.boldBody : STYLE.fonts.body;
        const segWords = seg.text.split(' ');

        for (let word of segWords) {
            const currentLineSegments = finalLines[finalLines.length - 1];
            let testLineText = currentLineSegments.map(s => s.text).join(' ') + (currentLineSegments.length ? ' ' : '') + word;
            ctx.font = STYLE.fonts.body; // usar fuente normal para medir
            const testWidth = ctx.measureText(testLineText).width;

            if (testWidth > maxWidth && currentLineSegments.length > 0) {
                finalLines.push([{ text: word, bold: seg.bold }]);
            } else {
                currentLineSegments.push({ text: word, bold: seg.bold });
            }
        }
    }

    return finalLines;
}

// --- CÁLCULO DE ALTURA TOTAL ---
function calculateTotalHeight(ctx, lines, maxWidth) {
    let totalHeight = 240; // altura inicial (header + tabla)

    for (let line of lines) {
        if (line.trim() === "") {
            totalHeight += STYLE.paraSpacing;
            continue;
        }

        if (line.includes("**")) {
            const wrappedSegments = processFormattedLine(ctx, line, maxWidth);
            totalHeight += wrappedSegments.length * STYLE.lineHeight;
        } else {
            const wrappedLines = wrapText(ctx, line, maxWidth, false);
            totalHeight += wrappedLines.length * STYLE.lineHeight;
        }
    }

    return totalHeight + 60; // margen inferior
}

// --- DIBUJO EN CANVAS ---
async function generarTicketMonstruo() {
    await cargarFuentes();
    const form = document.getElementById('ticketForm');
    const data = Object.fromEntries(new FormData(form));
    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    const maxWidth = canvas.width - (STYLE.padding * 2);

    // Obtener líneas originales
    const originalLines = data.text.split("\n");

    // Calcular altura dinámica
    const totalHeight = calculateTotalHeight(ctx, originalLines, maxWidth);
    canvas.height = Math.max(totalHeight, 600); // altura mínima 600px

    // 1. Fondo y Bordes - TODO EN NEGRO
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Línea superior decorativa en negro
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, 6);

    // 2. Header - TODO EN NEGRO
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = STYLE.fonts.title;
    ctx.fillText(data.nombre.toUpperCase(), STYLE.padding, 20);

    ctx.font = STYLE.fonts.label;
    ctx.textAlign = "right";
    ctx.fillText("VD " + data.vd, canvas.width - STYLE.padding, 25);

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.font = STYLE.fonts.subtitle;
    ctx.fillText(data.tipo_size, STYLE.padding, 55);

    ctx.font = STYLE.fonts.boldBody;
    ctx.fillText(`CA: ${data.ca} | PG: ${data.pg}`, STYLE.padding, 80);
    ctx.fillText(`Inic: ${data.iniciativa} | Vel: ${data.velocidad}`, STYLE.padding, 105);

    // 3. Tabla de Características
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(STYLE.padding, 130);
    ctx.lineTo(canvas.width - STYLE.padding, 130);
    ctx.stroke();

    const stats = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
    const statKeys = ["fue_val", "des_val", "con_val", "int_val", "sab_val", "car_val"];
    const colWidth = maxWidth / 6;

    stats.forEach((s, i) => {
        const x = STYLE.padding + (i * colWidth) + (colWidth / 2);
        ctx.textAlign = "center";
        ctx.font = STYLE.fonts.label;
        ctx.fillStyle = "black";
        ctx.fillText(s, x, 140);
        ctx.font = STYLE.fonts.body;
        ctx.fillText(data[statKeys[i]], x, 158);
    });

    ctx.beginPath();
    ctx.moveTo(STYLE.padding, 185);
    ctx.lineTo(canvas.width - STYLE.padding, 185);
    ctx.stroke();

    // 4. Texto Justificado con ajuste de líneas
    ctx.textAlign = "left";
    ctx.fillStyle = "black";
    let drawY = 200;

    for (let line of originalLines) {
        if (line.trim() === "") {
            drawY += STYLE.paraSpacing;
            continue;
        }

        if (line.includes("**")) {
            // Línea con formato (negritas)
            const wrappedSegments = processFormattedLine(ctx, line, maxWidth);

            for (let segments of wrappedSegments) {
                let currentX = STYLE.padding;
                for (let seg of segments) {
                    ctx.font = seg.bold ? STYLE.fonts.boldBody : STYLE.fonts.body;
                    ctx.fillStyle = "black";
                    ctx.fillText(seg.text, currentX, drawY);
                    currentX += ctx.measureText(seg.text).width;
                    // Añadir espacio entre palabras
                    ctx.font = STYLE.fonts.body;
                    const spaceWidth = ctx.measureText(" ").width;
                    if (currentX < STYLE.padding + maxWidth) {
                        ctx.fillText(" ", currentX, drawY);
                        currentX += spaceWidth;
                    }
                }
                drawY += STYLE.lineHeight;
            }
        } else {
            // Línea sin formato - aplicar justificación
            const wrappedLines = wrapText(ctx, line, maxWidth, false);

            for (let i = 0; i < wrappedLines.length; i++) {
                const wrappedLine = wrappedLines[i];
                const words = wrappedLine.split(' ');

                if (i === wrappedLines.length - 1 || words.length === 1) {
                    // Última línea o línea con una sola palabra - alineación izquierda
                    let xPos = STYLE.padding;
                    for (let word of words) {
                        ctx.font = STYLE.fonts.body;
                        ctx.fillStyle = "black";
                        ctx.fillText(word + " ", xPos, drawY);
                        xPos += ctx.measureText(word + " ").width;
                    }
                } else {
                    // Líneas intermedias - justificadas
                    let totalWordsWidth = 0;
                    for (let word of words) {
                        totalWordsWidth += ctx.measureText(word).width;
                    }
                    const spacing = (maxWidth - totalWordsWidth) / (words.length - 1);
                    let xPos = STYLE.padding;
                    for (let j = 0; j < words.length; j++) {
                        ctx.font = STYLE.fonts.body;
                        ctx.fillStyle = "black";
                        ctx.fillText(words[j], xPos, drawY);
                        xPos += ctx.measureText(words[j]).width;
                        if (j < words.length - 1) xPos += spacing;
                    }
                }
                drawY += STYLE.lineHeight;
            }
        }
    }

    // Fuente en la parte inferior (si existe)
    if (data.fuente) {
        ctx.font = STYLE.fonts.italic;
        ctx.textAlign = "right";
        ctx.fillStyle = "black";
        ctx.fillText(data.fuente, canvas.width - STYLE.padding, canvas.height - 25);
    }

    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) { btnPrint.disabled = false; btnPrint.style.background = "var(--accent)"; btnPrint.style.color = "var(--bg-dark)"; }

    actualizarHistorialMonstruo(data.nombre, data.vd);
}

// --- HISTORIAL ---

function actualizarHistorialMonstruo(nombre, vd) {
    let historial = JSON.parse(localStorage.getItem('historial_monstruos') || '[]');
    historial = historial.filter(item => item.nombre !== nombre);
    historial.unshift({ nombre, vd });
    if (historial.length > 5) historial.pop();
    localStorage.setItem('historial_monstruos', JSON.stringify(historial));
    renderizarHistorialMonstruo();
}

function renderizarHistorialMonstruo() {
    const list = document.getElementById('historyList');
    const historial = JSON.parse(localStorage.getItem('historial_monstruos') || '[]');
    list.innerHTML = historial.length === 0 ? '<span class="empty-history">No hay recientes</span>' : '';

    historial.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<span class="h-icon">👾</span> <span class="h-name">${item.nombre} (VD ${item.vd})</span>`;
        div.onclick = () => {
            const selector = document.getElementById('monstruoSelector');
            for (let i = 0; i < selector.options.length; i++) {
                if (selector.options[i].text.startsWith(item.nombre)) {
                    selector.selectedIndex = i;
                    cargarDatosMonstruo();
                    break;
                }
            }
        };
        list.appendChild(div);
    });
}

// --- EVENTOS Y CARGA ---

window.addEventListener('dbReady', () => {
    const historial = JSON.parse(localStorage.getItem('historial_monstruos') || '[]');
    if (historial.length > 0) {
        const selector = document.getElementById('monstruoSelector');
        for (let i = 0; i < selector.options.length; i++) {
            if (selector.options[i].text.startsWith(historial[0].nombre)) {
                selector.selectedIndex = i;
                cargarDatosMonstruo();
                break;
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.db-check').forEach(el => el.onchange = recargarBuscador);
    document.getElementById('monstruoSelector').onchange = cargarDatosMonstruo;
    document.getElementById('btnGenerar').onchange = generarTicketMonstruo;
    document.getElementById('btnPrint').onclick = imprimirTicket;

    renderizarHistorialMonstruo();
    inicializarMonstruos();
});