import { connectPrinter, printImage, isPrinterConnected } from './printpro/printer.js';
import { logger, setupLoggerUI } from './printpro/logger.js';

// ─── Estado ───────────────────────────────────────────────────────────────────
let imagenCargada = null;  // HTMLImageElement con la imagen del usuario
let ditherSeleccionado = 'threshold';

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setStatus(msg, tipo = '') {
    const bar = document.getElementById('statusBar');
    const txt = document.getElementById('statusText');
    bar.className = 'status-bar visible' + (tipo ? ' ' + tipo : '');
    txt.textContent = msg;
}

function setProgress(pct) {
    const wrap = document.getElementById('progressWrap');
    const bar = document.getElementById('progressBar');
    if (pct === null) {
        wrap.classList.remove('visible');
        bar.style.width = '0%';
    } else {
        wrap.classList.add('visible');
        bar.style.width = Math.min(100, pct) + '%';
    }
}

// Conectar el logger al progreso
logger.addListener(entry => {
    if (entry.type === 'progress') setProgress(entry.percentage);
});

// ─── Carga de imagen ──────────────────────────────────────────────────────────

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const previewWrap = document.getElementById('previewWrap');
const previewImg = document.getElementById('previewImg');
const previewName = document.getElementById('previewName');

fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) cargarArchivo(file);
});

// Drag & drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) cargarArchivo(file);
});

function cargarArchivo(file) {
    const reader = new FileReader();
    reader.onload = ev => {
        previewImg.src = ev.target.result;
        previewName.textContent = file.name;
        previewWrap.classList.add('visible');

        // Crear HTMLImageElement para usar en el canvas
        const img = new Image();
        img.onload = () => { imagenCargada = img; };
        img.src = ev.target.result;

        // Resetear canvas y botón
        resetCanvas();
    };
    reader.readAsDataURL(file);
}

window.limpiarImagen = function () {
    imagenCargada = null;
    fileInput.value = '';
    previewWrap.classList.remove('visible');
    previewImg.src = '';
    resetCanvas();
};

function resetCanvas() {
    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    canvas.height = 200;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const btn = document.getElementById('btnPrint');
    btn.disabled = true;
    btn.className = '';
    btn.textContent = '🖨️ IMPRIMIR';

    setProgress(null);
    document.getElementById('statusBar').className = 'status-bar';
}

// ─── Selección de dithering ───────────────────────────────────────────────────

window.seleccionarDither = function (el) {
    document.querySelectorAll('#ditherOptions .option-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    ditherSeleccionado = el.dataset.dither;
};

// ─── Pre-visualización en canvas ─────────────────────────────────────────────

window.procesarImagen = function () {
    if (!imagenCargada) {
        setStatus('⚠️ Selecciona una imagen primero.', 'error');
        document.getElementById('statusBar').classList.add('visible');
        return;
    }

    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    const ANCHO = 384;
    const brightness = parseInt(document.getElementById('brightnessSlider').value);

    // Escalar manteniendo proporción
    const ratio = imagenCargada.naturalHeight / imagenCargada.naturalWidth;
    const alto = Math.round(ANCHO * ratio);
    canvas.width = ANCHO;
    canvas.height = alto;

    // Dibujar la imagen escalada
    ctx.drawImage(imagenCargada, 0, 0, ANCHO, alto);

    // Aplicar brillo
    if (brightness !== 128) {
        const imageData = ctx.getImageData(0, 0, ANCHO, alto);
        const d = imageData.data;
        const delta = brightness - 128;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.max(0, Math.min(255, d[i] + delta));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + delta));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + delta));
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Aplicar dithering seleccionado
    aplicarDithering(ctx, ANCHO, alto, ditherSeleccionado);

    // Activar botón
    const btn = document.getElementById('btnPrint');
    btn.disabled = false;
    btn.className = 'ready';

    setStatus('✅ Imagen lista para imprimir', 'success');
    document.getElementById('statusBar').classList.add('visible');
    setProgress(null);
};

// ─── Algoritmos de dithering ──────────────────────────────────────────────────

function aplicarDithering(ctx, w, h, metodo) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    // Convertir a escala de grises primero
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
    }

    switch (metodo) {
        case 'threshold': ditherThreshold(gray, w, h); break;
        case 'steinberg': ditherFloydSteinberg(gray, w, h); break;
        case 'atkinson': ditherAtkinson(gray, w, h); break;
        case 'bayer': ditherBayer(gray, w, h); break;
        default: ditherThreshold(gray, w, h);
    }

    // Escribir resultado (blanco/negro) de vuelta al imageData
    for (let i = 0; i < w * h; i++) {
        const val = gray[i] < 128 ? 0 : 255;
        const idx = i * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

function ditherThreshold(gray, w, h) {
    for (let i = 0; i < w * h; i++) {
        gray[i] = gray[i] < 128 ? 0 : 255;
    }
}

function ditherFloydSteinberg(gray, w, h) {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const old = gray[idx];
            const nuevo = old < 128 ? 0 : 255;
            gray[idx] = nuevo;
            const err = old - nuevo;
            if (x + 1 < w) gray[idx + 1] += err * 7 / 16;
            if (y + 1 < h) {
                if (x - 1 >= 0) gray[idx + w - 1] += err * 3 / 16;
                gray[idx + w] += err * 5 / 16;
                if (x + 1 < w) gray[idx + w + 1] += err * 1 / 16;
            }
        }
    }
}

function ditherAtkinson(gray, w, h) {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const old = gray[idx];
            const nuevo = old < 128 ? 0 : 255;
            gray[idx] = nuevo;
            const err = (old - nuevo) / 8;
            const vecinos = [
                [0, 1], [0, 2],
                [1, -1], [1, 0], [1, 1],
                [2, 0]
            ];
            for (const [dy, dx] of vecinos) {
                const ny = y + dy, nx = x + dx;
                if (nx >= 0 && nx < w && ny < h) gray[ny * w + nx] += err;
            }
        }
    }
}

function ditherBayer(gray, w, h) {
    const matrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];
    const n = 4;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const umbral = (matrix[y % n][x % n] / 16) * 255;
            gray[y * w + x] = gray[y * w + x] > umbral ? 255 : 0;
        }
    }
}

// ─── Impresión vía Bluetooth ──────────────────────────────────────────────────

window.imprimirImagen = async function () {
    const canvas = document.getElementById('ticketCanvas');
    const btn = document.getElementById('btnPrint');

    try {
        // Conectar si no está conectado
        if (!isPrinterConnected()) {
            setStatus('🔵 Conectando con la impresora...', '');
            document.getElementById('statusBar').classList.add('visible');
            btn.textContent = '⏳ CONECTANDO...';
            btn.disabled = true;
            setProgress(0);

            await connectPrinter();
            setStatus('✅ Conectado. Enviando imagen...', '');
        } else {
            setStatus('📄 Enviando imagen a la impresora...', '');
            document.getElementById('statusBar').classList.add('visible');
        }

        btn.textContent = '📄 IMPRIMIENDO...';

        await printImage(canvas);

        btn.textContent = '✅ ¡HECHO!';
        btn.disabled = false;
        btn.className = 'ready';
        setStatus('✅ Impresión completada', 'success');
        setProgress(null);

        setTimeout(() => {
            btn.textContent = '🖨️ IMPRIMIR';
        }, 3000);

    } catch (err) {
        console.error('Error de impresión:', err);
        btn.textContent = '❌ ERROR';
        btn.disabled = false;
        btn.className = 'ready';
        setStatus('❌ ' + (err.message || 'No se pudo conectar con la impresora'), 'error');
        setProgress(null);

        setTimeout(() => {
            btn.textContent = '🖨️ IMPRIMIR';
        }, 4000);
    }
};
