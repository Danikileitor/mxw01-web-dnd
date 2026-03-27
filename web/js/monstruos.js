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

    // Cargar los valores separados para cada estadística
    const statsMap = {
        'fue_valor': m.fue.valor,
        'fue_mod': m.fue.mod,
        'fue_salv': m.fue.salv ? m.fue.salv : m.fue.mod,
        'des_valor': m.des.valor,
        'des_mod': m.des.mod,
        'des_salv': m.des.salv ? m.des.salv : m.des.mod,
        'con_valor': m.con.valor,
        'con_mod': m.con.mod,
        'con_salv': m.con.salv ? m.con.salv : m.con.mod,
        'int_valor': m.int.valor,
        'int_mod': m.int.mod,
        'int_salv': m.int.salv ? m.int.salv : m.int.mod,
        'sab_valor': m.sab.valor,
        'sab_mod': m.sab.mod,
        'sab_salv': m.sab.salv ? m.sab.salv : m.sab.mod,
        'car_valor': m.car.valor,
        'car_mod': m.car.mod,
        'car_salv': m.car.salv ? m.car.salv : m.car.mod
    };

    for (const [key, value] of Object.entries(statsMap)) {
        if (form[key]) form[key].value = value;
    }

    let fullText = "";

    if (m.habilidades) fullText += `**Habilidades:** ${m.habilidades}\n`;
    if (m.resistencias) fullText += `**Resistencias:** ${m.resistencias}\n`;
    if (m.inmunidades) fullText += `**Inmunidades:** ${m.inmunidades}\n`;
    if (m.sentidos) fullText += `**Sentidos:** ${m.sentidos}\n`;
    fullText += `**Idiomas:** ${m.idiomas}\n\n`;

    if (m.atributos && m.atributos.length > 0) {
        fullText += `**ATRIBUTOS**\n`;
        m.atributos.forEach(item => {
            if (item.nombre) {
                fullText += `**${item.nombre}:**${item.descripcion}\n\n`;
            }
        });
    }

    const procesarLista = (lista, titulo) => {
        if (!lista || lista.length === 0) return;
        if (titulo) fullText += `**${titulo}**\n`;
        lista.forEach(item => {
            if (item.nombre) {
                if (!item.nombre.includes("Usos de acciones legendarias")) {
                    let nombreLimpio = item.nombre.replace(/\.+$/, '');
                    fullText += `**${nombreLimpio}.**${item.descripcion}\n\n`;
                }
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

function processFormattedLine(ctx, line, maxWidth) {
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

    const mergedSegments = [];
    for (let seg of segments) {
        if (mergedSegments.length > 0 && mergedSegments[mergedSegments.length - 1].bold === seg.bold) {
            mergedSegments[mergedSegments.length - 1].text += seg.text;
        } else {
            mergedSegments.push({ ...seg });
        }
    }

    let finalLines = [[]];

    for (let seg of mergedSegments) {
        ctx.font = seg.bold ? STYLE.fonts.boldBody : STYLE.fonts.body;
        const segWords = seg.text.split(' ');

        for (let word of segWords) {
            const currentLineSegments = finalLines[finalLines.length - 1];
            let testLineText = currentLineSegments.map(s => s.text).join(' ') + (currentLineSegments.length ? ' ' : '') + word;
            ctx.font = STYLE.fonts.body;
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

function calculateTotalHeight(ctx, lines, maxWidth) {
    let totalHeight = 290; // Aumentado para dar más espacio

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

    return totalHeight + 60;
}

// --- DIBUJO EN CANVAS ---
async function generarTicketMonstruo() {
    await cargarFuentes();
    const form = document.getElementById('ticketForm');
    const data = Object.fromEntries(new FormData(form));
    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    const maxWidth = canvas.width - (STYLE.padding * 2);

    const originalLines = data.text.split("\n");

    const totalHeight = calculateTotalHeight(ctx, originalLines, maxWidth);
    canvas.height = Math.max(totalHeight, 740);

    // 1. Fondo y Bordes
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, STYLE.borderRadius);
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.stroke();

    // 2. Header
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = STYLE.fonts.title;
    ctx.fillText(data.nombre, STYLE.padding, 15);

    ctx.font = STYLE.fonts.label;
    ctx.textAlign = "right";
    ctx.fillText("VD " + data.vd, canvas.width - STYLE.padding, 20);

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.font = STYLE.fonts.subtitle;
    ctx.fillText(data.tipo_size, STYLE.padding, 50);

    ctx.font = STYLE.fonts.boldBody;
    ctx.fillText(`CA: ${data.ca} | PG: ${data.pg}`, STYLE.padding, 75);
    ctx.fillText(`Inic: ${data.iniciativa} | Vel: ${data.velocidad}`, STYLE.padding, 100);

    // 3. Tabla de Características
    const tableStartY = 130;
    const cellWidth = (canvas.width - STYLE.padding * 2) / 3;
    const cellHeight = 70;
    const borderWidth = 1;

    const stats = [
        { label: "FUE", valorKey: "fue_valor", modKey: "fue_mod", salvKey: "fue_salv" },
        { label: "DES", valorKey: "des_valor", modKey: "des_mod", salvKey: "des_salv" },
        { label: "CON", valorKey: "con_valor", modKey: "con_mod", salvKey: "con_salv" },
        { label: "INT", valorKey: "int_valor", modKey: "int_mod", salvKey: "int_salv" },
        { label: "SAB", valorKey: "sab_valor", modKey: "sab_mod", salvKey: "sab_salv" },
        { label: "CAR", valorKey: "car_valor", modKey: "car_mod", salvKey: "car_salv" }
    ];

    ctx.save();
    ctx.strokeStyle = "black";
    ctx.lineWidth = borderWidth;

    for (let idx = 0; idx < 6; idx++) {
        const stat = stats[idx];
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const x = STYLE.padding + (col * cellWidth);
        const y = tableStartY + (row * cellHeight);

        // Obtener valores directamente del formulario
        const valorNum = form[stat.valorKey]?.value || '';
        const modValue = form[stat.modKey]?.value || '';
        const salvValue = form[stat.salvKey]?.value || '';

        // Dibujar el borde exterior de la celda
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Dibujar línea horizontal para separar el nombre de los valores
        ctx.beginPath();
        ctx.moveTo(x, y + 28);
        ctx.lineTo(x + cellWidth, y + 28);
        ctx.stroke();

        // Dibujar las 2 líneas verticales para crear 3 columnas en la parte inferior
        const thirdWidth = cellWidth / 3;
        for (let v = 1; v < 3; v++) {
            ctx.beginPath();
            ctx.moveTo(x + (v * thirdWidth), y + 28);
            ctx.lineTo(x + (v * thirdWidth), y + cellHeight);
            ctx.stroke();
        }

        // Nombre del atributo - USAR textBaseline "middle" para consistencia
        ctx.textAlign = "center";
        ctx.fillStyle = "black";
        ctx.font = STYLE.fonts.label;
        ctx.textBaseline = "middle";
        // Posición Y centrada en la sección superior (entre y y y+28)
        ctx.fillText(stat.label, x + cellWidth / 2, y + 14);

        // Valores en las 3 columnas inferiores
        ctx.font = STYLE.fonts.boldBody;
        ctx.fillStyle = "black";

        // Calcular la posición Y central en la parte inferior de la celda
        const lowerSectionY = y + 28;
        const lowerSectionHeight = cellHeight - 28;
        const centerY = lowerSectionY + (lowerSectionHeight / 2);

        // Columna 1: Valor
        ctx.fillText(valorNum.toString(), x + thirdWidth / 2, centerY);

        // Columna 2: Modificador
        ctx.fillText(modValue.toString(), x + thirdWidth + thirdWidth / 2, centerY);

        // Columna 3: Salvación
        ctx.fillText(salvValue.toString(), x + (thirdWidth * 2) + thirdWidth / 2, centerY);
    }

    // Restaurar textBaseline a "top" para el resto del texto
    ctx.textBaseline = "top";
    ctx.restore();

    // El texto comienza después de la tabla
    const tableBottomY = tableStartY + (cellHeight * 2);
    let drawY = tableBottomY + 12;

    // 4. Texto Justificado
    ctx.textAlign = "left";
    ctx.fillStyle = "black";

    for (let line of originalLines) {
        if (line.trim() === "") {
            drawY += STYLE.paraSpacing;
            continue;
        }

        if (line.includes("**")) {
            const wrappedSegments = processFormattedLine(ctx, line, maxWidth);

            for (let segments of wrappedSegments) {
                let currentX = STYLE.padding;
                for (let seg of segments) {
                    ctx.font = seg.bold ? STYLE.fonts.boldBody : STYLE.fonts.body;
                    ctx.fillStyle = "black";
                    ctx.fillText(seg.text, currentX, drawY);
                    currentX += ctx.measureText(seg.text).width;
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
            const wrappedLines = wrapText(ctx, line, maxWidth, false);

            for (let i = 0; i < wrappedLines.length; i++) {
                const wrappedLine = wrappedLines[i];
                const words = wrappedLine.split(' ');

                if (i === wrappedLines.length - 1 || words.length === 1) {
                    let xPos = STYLE.padding;
                    for (let word of words) {
                        ctx.font = STYLE.fonts.body;
                        ctx.fillStyle = "black";
                        ctx.fillText(word + " ", xPos, drawY);
                        xPos += ctx.measureText(word + " ").width;
                    }
                } else {
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

    // Fuente en la parte inferior
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