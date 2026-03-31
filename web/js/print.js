import { ThermalPrinterClient, WebBluetoothAdapter } from './print/index.js';

window.imprimirTicket = imprimirTicket;

async function imprimirTicket() {
    const canvas = document.getElementById('ticketCanvas');
    const ctx = canvas.getContext('2d');
    const btnPrint = document.getElementById('btnPrint');

    try {
        btnPrint.innerText = "⏳ CONECTANDO...";

        // 1. Inicializar cliente (Asegúrate de que ThermalPrinterClient esté disponible)
        const adapter = new WebBluetoothAdapter();
        const printer = new ThermalPrinterClient(adapter);

        // 2. Conectar (Abrirá el popup del navegador para elegir dispositivo)
        await printer.connect();

        btnPrint.innerText = "📄 IMPRIMIENDO...";

        // 3. Obtener datos del canvas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 4. Mandar a imprimir
        await printer.print(imageData, {
            dither: 'threshold',
            brightness: 110,
            intensity: 120
        });

        // 5. Desconectar
        await printer.disconnect();

        btnPrint.innerText = "✅ ¡HECHO!";
        setTimeout(() => btnPrint.innerText = "🖨️ IMPRIMIR", 3000);

    } catch (error) {
        console.error("Error de impresión:", error);
        alert("No se pudo conectar con la impresora. Asegúrate de tener el Bluetooth activo.");
        btnPrint.innerText = "❌ ERROR AL IMPRIMIR";
        setTimeout(() => btnPrint.innerText = "🖨️ IMPRIMIR", 3000);
    }
}