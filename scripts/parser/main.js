function parseMonstruosPRO(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

    const monstruos = [];

    const limpiar = (txt) => txt?.replace(/\s+/g, " ").trim() || "";

    function extraerTipo(linea) {
        let tipo = "", size = "", alineamiento = "";

        if (!linea) return { tipo, size, alineamiento };

        const partes = linea.split(",");
        const left = partes[0].trim().split(" ");

        if (left.length >= 2) {
            size = left[left.length - 1];
            tipo = left.slice(0, -1).join(" ");
        } else {
            tipo = partes[0].trim();
        }

        if (partes[1]) alineamiento = partes[1].trim();

        return { tipo, size, alineamiento };
    }

    function getValor(red, label) {
        const strongs = red.querySelectorAll("strong");
        for (let s of strongs) {
            if (s.textContent.trim() === label) {
                return limpiar(s.nextSibling?.textContent);
            }
        }
        return "";
    }

    function parseStats(red) {
        const stats = {};
        const nombres = ["fue", "des", "con", "int", "sab", "car"];

        // Seleccionamos todos los divs de stats
        const divs = red.querySelectorAll("div[class^='car']");

        let i = 0;
        while (i < divs.length) {
            const nombreDiv = divs[i];
            const valorDiv = divs[i + 1];
            const modDiv = divs[i + 2];
            const salvDiv = divs[i + 3];

            if (
                nombreDiv &&
                valorDiv &&
                modDiv &&
                salvDiv &&
                nombres.includes(nombreDiv.textContent.trim().toLowerCase())
            ) {
                const key = nombreDiv.textContent.trim().toLowerCase();
                stats[key] = {
                    valor: parseInt(valorDiv.textContent.trim()),
                    mod: modDiv.textContent.trim(),
                    salv: salvDiv.textContent.trim()
                };
                i += 4; // pasamos a la siguiente estadística
            } else {
                i++;
            }
        }

        return stats;
    }

    function parseVD(texto) {
        let vd = "", px = null, px_guarida = null, bc = "";

        if (!texto) return { vd, px, px_guarida, bc };

        // Extraemos VD principal antes del paréntesis
        const vdMatch = texto.match(/^([^(]+)/);
        if (vdMatch) vd = vdMatch[1].trim();

        // Extraemos contenido dentro de paréntesis
        const parenMatch = texto.match(/\(([^)]+)\)/);
        if (parenMatch) {
            const dentro = parenMatch[1];

            // PX normal
            const pxMatch = dentro.match(/PX\s*(\d+)/i);
            if (pxMatch) px = parseInt(pxMatch[1], 10);

            // PX extra en guarida (opcional)
            const pxGuaridaMatch = dentro.match(/o\s*(\d+)\s*en la guarida/i);
            if (pxGuaridaMatch) px_guarida = parseInt(pxGuaridaMatch[1], 10);

            // BC
            const bcMatch = dentro.match(/BC\s*([+-]?\d+)/i);
            if (bcMatch) bc = bcMatch[1];
        }

        return { vd, px, px_guarida, bc };
    }

    function parseSeccion(bloc, titulo) {
        const resultado = [];

        const headers = bloc.querySelectorAll("h2");

        headers.forEach(h => {
            if (h.textContent.toLowerCase().includes(titulo)) {
                let nodo = h.nextElementSibling;

                while (nodo && nodo.tagName !== "H2") {
                    if (nodo.tagName === "P") {
                        const strong = nodo.querySelector("strong");

                        if (strong) {
                            const nombre = limpiar(strong.textContent.replace(/\./g, ""));
                            const descripcion = limpiar(
                                nodo.textContent.replace(strong.textContent, "")
                            );

                            resultado.push({ nombre, descripcion });
                        }
                    } else {
                        const texto = limpiar(nodo.textContent);
                        if (texto) {
                            resultado.push({
                                nombre: texto.replace(/\./g, ""),
                                descripcion: ""
                            });
                        }
                    }

                    nodo = nodo.nextElementSibling;
                }
            }
        });

        return resultado;
    }

    function extraerUsosLegendarios(bloc) {
        const legendDiv = bloc.querySelector(".legend");
        if (!legendDiv) return "";

        const texto = legendDiv.textContent.trim();

        // Buscamos el patrón: "Usos de acciones legendarias: 3" o "Usos de acciones legendarias: 3 (4 en la guarida)"
        const match = texto.match(/Usos de acciones legendarias:\s*(\d+)(\s*\([^)]+\))?/i);

        if (match) {
            // Devuelve todo, por ejemplo: "3 (4 en la guarida)" o solo "3"
            return match[1] + (match[2] ? " " + match[2].trim() : "");
        }

        return "";
    }

    // ---------- MAIN ----------

    doc.querySelectorAll(".bloc").forEach(bloc => {
        const nombre = limpiar(bloc.querySelector("h1")?.textContent);
        const red = bloc.querySelector(".red");

        if (!nombre || !red) return;

        const tipoRaw = red.querySelector(".type")?.textContent;
        const { tipo, size, alineamiento } = extraerTipo(tipoRaw);

        const stats = parseStats(red);

        const vdRaw = getValor(red, "VD");
        const { vd, px, px_guarida, bc } = parseVD(vdRaw);

        const monstruo = {
            nombre,
            tipo,
            size,
            alineamiento,

            ca: getValor(red, "CA"),
            pg: getValor(red, "PG"),
            velocidad: getValor(red, "Velocidad"),
            iniciativa: limpiar(
                red.querySelector(".init")?.textContent.replace("Iniciativa", "")
            ),

            ...stats,

            habilidades: getValor(red, "Habilidades"),
            resistencias: getValor(red, "Resistencias"),
            inmunidades: getValor(red, "Inmunidades"),
            sentidos: getValor(red, "Sentidos"),
            idiomas: getValor(red, "Idiomas"),

            vd,
            px,
            px_guarida,
            bc,

            atributos: parseSeccion(bloc, "atributos"),
            acciones: parseSeccion(bloc, "acciones"),
            reacciones: parseSeccion(bloc, "reacciones"),
            acciones_legendarias: parseSeccion(bloc, "acciones legendarias"),

            // ✅ NUEVOS CAMPOS
            usos_acciones_legendarias: extraerUsosLegendarios(bloc),
            fuente: "Libro X p. 201"
        };

        monstruos.push(monstruo);
    });

    return monstruos;
}

// === FUNCIÓN DESCARGA JSON ===
function descargarJSON(data, nombreArchivo = "monstruos.json") {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();

    URL.revokeObjectURL(url);
}

const resultado = parseMonstruosPRO(document.documentElement.outerHTML);