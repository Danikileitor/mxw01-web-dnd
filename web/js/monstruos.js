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

    // Avisar que la base de datos está lista para cargar el reciente
    window.dispatchEvent(new Event('dbReady'));
}

// --- PROCESAMIENTO DEL FORMULARIO ---

function cargarDatosMonstruo() {
    const idx = document.getElementById('monstruoSelector').value;
    if (idx === "") return;
    const m = monstruosVisibles[idx];
    const form = document.getElementById('monstruoForm');

    // Datos básicos
    form.nombre.value = m.nombre;
    form.vd.value = m.vd;
    form.iniciativa.value = m.iniciativa;
    form.tipo_size.value = `${m.size} ${m.tipo}, ${m.alineamiento}`;
    form.ca.value = m.ca;
    form.pg.value = m.pg;
    form.velocidad.value = m.velocidad;
    form.fuente.value = m.fuente || "";

    // Características
    const stats = ['fue', 'des', 'con', 'int', 'sab', 'car'];
    stats.forEach(s => {
        form[`${s}_val`].value = `${m[s].valor} (${m[s].mod})`;
    });

    // Procesar texto largo (Atributos + Acciones)
    let fullText = "";
    if (m.habilidades) fullText += `Habilidades: ${m.habilidades}\n`;
    if (m.resistencias) fullText += `Resistencias: ${m.resistencias}\n`;
    if (m.inmunidades) fullText += `Inmunidades: ${m.inmunidades}\n`;
    if (m.sentidos) fullText += `Sentidos: ${m.sentidos}\n`;
    fullText += `Idiomas: ${m.idiomas}\n\n`;

    const procesarLista = (lista, titulo) => {
        if (!lista || lista.length === 0) return;
        if (titulo) fullText += `Mejora: ${titulo}\n`;
        lista.forEach(item => {
            if (item.nombre) fullText += `Mejora: ${item.nombre}${item.descripcion}\n\n`;
        });
    };

    procesarLista(m.atributos);
    procesarLista(m.acciones, "ACCIONES");
    procesarLista(m.reacciones, "REACCIONES");
    if (m.acciones_legendarias && m.acciones_legendarias.length > 0) {
        fullText += `Mejora: ACCIONES LEGENDARIAS\nUsos: ${m.usos_acciones_legendarias}\n`;
        procesarLista(m.acciones_legendarias);
    }

    form.text.value = fullText.trim();
    generarTicketMonstruo();
}

// --- DIBUJO EN CANVAS ---

async function generarTicketMonstruo() {
    await cargarFuentes();
    const form = document.getElementById('monstruoForm');
    const data = Object.fromEntries(new FormData(form));
    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    const maxWidth = canvas.width - (STYLE.padding * 2);

    // 1. Cálculo de Altura Dinámica
    const textLines = data.text.split("\n").filter(l => l.trim() !== "");
    let calcY = 240;

    textLines.forEach(line => {
        let currentX = STYLE.padding;
        let isBold = line.startsWith("Mejora:");
        line.replace("Mejora:", "").split(' ').forEach(p => {
            ctx.font = isBold ? STYLE.fonts.boldBody : STYLE.fonts.body;
            let m = ctx.measureText(p + " ");
            if (currentX + m.width > STYLE.padding + maxWidth) { currentX = STYLE.padding; calcY += STYLE.lineHeight; }
            currentX += m.width;
        });
        calcY += STYLE.lineHeight + 5;
    });
    canvas.height = calcY + 60;

    // 2. Fondo y Bordes
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black"; ctx.lineWidth = 4; ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#822000"; ctx.fillRect(0, 0, canvas.width, 6);

    // 3. Header
    ctx.fillStyle = "#822000"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = STYLE.fonts.title;
    ctx.fillText(data.nombre.toUpperCase(), STYLE.padding, 20);

    ctx.font = STYLE.fonts.label;
    ctx.textAlign = "right";
    ctx.fillText("VD " + data.vd, canvas.width - STYLE.padding, 25);

    ctx.fillStyle = "black"; ctx.textAlign = "left";
    ctx.font = STYLE.fonts.subtitle;
    ctx.fillText(data.tipo_size, STYLE.padding, 55);

    ctx.font = STYLE.fonts.boldBody;
    ctx.fillText(`CA: ${data.ca} | PG: ${data.pg}`, STYLE.padding, 80);
    ctx.fillText(`Inic: ${data.iniciativa} | Vel: ${data.velocidad}`, STYLE.padding, 105);

    // 4. Tabla de Características
    ctx.strokeStyle = "#822000"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(STYLE.padding, 130); ctx.lineTo(canvas.width - STYLE.padding, 130); ctx.stroke();

    const stats = ["FUE", "DES", "CON", "INT", "SAB", "CAR"];
    const statKeys = ["fue_val", "des_val", "con_val", "int_val", "sab_val", "car_val"];
    const colWidth = maxWidth / 6;

    stats.forEach((s, i) => {
        const x = STYLE.padding + (i * colWidth) + (colWidth / 2);
        ctx.textAlign = "center";
        ctx.font = STYLE.fonts.label;
        ctx.fillText(s, x, 140);
        ctx.font = STYLE.fonts.body;
        ctx.fillText(data[statKeys[i]], x, 158);
    });

    ctx.beginPath(); ctx.moveTo(STYLE.padding, 185); ctx.lineTo(canvas.width - STYLE.padding, 185); ctx.stroke();

    // 5. Texto Justificado
    ctx.textAlign = "left";
    let drawY = 200;
    textLines.forEach(line => {
        let drawX = STYLE.padding;
        let isBold = line.startsWith("Mejora:");
        const content = line.replace("Mejora:", "").trim();
        const words = content.split(' ');
        let currentLine = [], currentW = 0;

        words.forEach(palabra => {
            ctx.font = isBold ? STYLE.fonts.boldBody : STYLE.fonts.body;
            let m = ctx.measureText(palabra + " ");
            if (drawX + currentW + m.width > STYLE.padding + maxWidth) {
                let xPos = STYLE.padding;
                let noSpaceW = 0;
                currentLine.forEach(w => noSpaceW += ctx.measureText(w).width);
                let spacing = (currentLine.length > 1) ? (maxWidth - noSpaceW) / (currentLine.length - 1) : 0;
                currentLine.forEach(w => {
                    ctx.fillText(w, xPos, drawY);
                    xPos += ctx.measureText(w).width + spacing;
                });
                drawY += STYLE.lineHeight; currentLine = []; currentW = 0;
            }
            currentLine.push(palabra);
            currentW += ctx.measureText(palabra + " ").width;
        });
        let xFinal = STYLE.padding;
        currentLine.forEach(w => {
            ctx.fillText(w + " ", xFinal, drawY);
            xFinal += ctx.measureText(w + " ").width;
        });
        drawY += STYLE.lineHeight + 5;
    });

    if (data.fuente) {
        ctx.font = STYLE.fonts.italic; ctx.textAlign = "right";
        ctx.fillText(data.fuente, canvas.width - STYLE.padding, canvas.height - 25);
    }

    actualizarHistorialMonstruo(data.nombre, data.vd);
    document.getElementById('btnPrint').disabled = false;
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
    // Configurar botones y selects
    document.querySelectorAll('.db-check').forEach(el => el.onchange = recargarBuscador);
    document.getElementById('monstruoSelector').onchange = cargarDatosMonstruo;
    document.getElementById('btnGenerar').onclick = generarTicketMonstruo;
    document.getElementById('btnPrint').onclick = imprimirTicket;

    renderizarHistorialMonstruo();
    inicializarMonstruos();
});
