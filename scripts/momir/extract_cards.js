#!/usr/bin/env node

/**
 * extract_cards.js
 *
 * Extrae las cartas de AtomicCards.json (MTGJSON) y genera un JSON
 * agrupado por coste de mana total (CMC / manaValue).
 * 
 * Se puede obtener este json desde el siguiente enlace: https://mtgjson.com/api/v5/AtomicCards.json.zip
 * Fuente: https://mtgjson.com/downloads/all-files/#atomiccards
 *
 * Preferencia de idioma: español (es) → inglés (en) como fallback.
 *
 * Campos de salida por carta:
 *   n  → nombre
 *   t  → tipo
 *   p  → poder (solo criaturas)
 *   h  → resistencia (solo criaturas)
 *   x  → texto de la carta
 *   m  → coste de mana (manaCost)
 *   f  → si es carta de formato especial / funny (isAlternative, isPromo, etc.)
 *
 * Uso:
 *   node extract_cards.js <input.json> [output.json] [--type <tipos>]
 *
 * Ejemplos:
 *   node extract_cards.js AtomicCards.json output.json
 *   node extract_cards.js AtomicCards.json output.json --type creature
 *   node extract_cards.js AtomicCards.json output.json --type "instant,sorcery"
 *   node extract_cards.js AtomicCards.json output.json --type "legendary creature"
 *
 * El filtro --type es insensible a mayúsculas y acepta múltiples tipos
 * separados por comas. Una carta se incluye si su línea de tipo contiene
 * AL MENOS UNO de los tipos indicados.
 *
 * Si no se indica output.json, el resultado se imprime por stdout.
 */

const fs = require("fs");
const path = require("path");

// ─── Argumentos ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function printUsage() {
  console.error("  Uso: node extract_cards.js <input.json> [output.json] [--type <tipos>]");
  console.error("  Ejemplos:");
  console.error("    node extract_cards.js AtomicCards.json output.json");
  console.error("    node extract_cards.js AtomicCards.json output.json --type creature");
  console.error('    node extract_cards.js AtomicCards.json output.json --type "instant,sorcery"');
  console.error('    node extract_cards.js AtomicCards.json output.json --type "legendary creature"');
}

// Extraer --type del array de args (puede ir en cualquier posición)
let typeFilter = null;
const typeIdx = args.indexOf("--type");
if (typeIdx !== -1) {
  if (!args[typeIdx + 1]) {
    console.error("❌  --type requiere un valor. Ej: --type creature");
    printUsage();
    process.exit(1);
  }
  // Separar por comas, limpiar espacios y pasar a minúsculas
  typeFilter = args[typeIdx + 1]
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  // Eliminar --type y su valor del array para no confundir posiciones
  args.splice(typeIdx, 2);
}

const inputPath = args[0] || "./AtomicCards.json";
const outputPath = args[1] || null;

if (!fs.existsSync(inputPath)) {
  console.error(`❌  No se encontró el archivo: ${inputPath}`);
  printUsage();
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Dado el array de traducciones de una carta y la clave a buscar,
 * devuelve el valor en español si existe, si no en inglés, si no null.
 *
 * En AtomicCards, cada carta puede tener:
 *   card.foreignData → array de { language, name, type, text, ... }
 */
function getLocalizedField(card, fieldEn, foreignData, fieldForeign) {
  // Buscar traducción en español
  if (Array.isArray(foreignData)) {
    const es = foreignData.find(
      (fd) =>
        fd.language === "Spanish" ||
        fd.language === "es" ||
        fd.language === "Español"
    );
    if (es && es[fieldForeign] != null && es[fieldForeign] !== "") {
      return es[fieldForeign];
    }
  }
  // Fallback a inglés
  return card[fieldEn] ?? null;
}

/**
 * Determina si una carta es "especial/funny" basándose en sus sets o flags.
 * En AtomicCards v5+ existe card.isFunny o card.availability / legalities.
 * Como fallback, miramos si printings sólo incluyen sets de tipo "funny".
 */
function isFunnyCard(card) {
  // MTGJSON >= 5.x
  if (typeof card.isFunny === "boolean") return card.isFunny;

  // Algunos campos legacy
  if (card.borderColor === "silver") return true;

  return false;
}

/**
 * Convierte el manaValue (float) a string de clave entera para agrupar.
 * Las cartas con manaValue nulo o indefinido van al grupo "0".
 */
function cmcKey(card) {
  const val = card.manaValue ?? card.convertedManaCost ?? 0;
  return String(Math.floor(val));
}

/**
 * Convierte un objeto a JSON con caracteres Unicode escapados (formato \uXXXX)
 * sin doble escape de las barras invertidas.
 */
function stringifyWithEscapes(obj, space = 2) {
  // Primero, convertir el objeto a JSON normal
  const normalJson = JSON.stringify(obj, null, space);

  // Luego, escapar los caracteres Unicode en el resultado,
  // pero teniendo cuidado de no escapar caracteres que ya están escapados
  // (por ejemplo, \n, \t, etc.)
  return normalJson.replace(/"([^"\\]|\\.)*"/g, function (match) {
    // Para cada string entre comillas, escapamos los caracteres Unicode
    // Mantenemos las comillas al inicio y final
    const quote = match[0];
    const content = match.slice(1, -1);
    const escapedContent = content.replace(/[^\x00-\x7F]/g, function (c) {
      return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
    });
    return quote + escapedContent + quote;
  });
}

// ─── Lectura del JSON ─────────────────────────────────────────────────────────

console.error(`📖  Leyendo ${inputPath} …`);

let raw;
try {
  // Leer como buffer binario para controlar el encoding manualmente
  const buf = fs.readFileSync(inputPath);
  // Eliminar BOM UTF-8 si existe (EF BB BF)
  const start = (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) ? 3 : 0;
  raw = buf.slice(start).toString("utf8");
} catch (e) {
  console.error(`❌  Error leyendo el archivo: ${e.message}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error(`❌  JSON inválido: ${e.message}`);
  process.exit(1);
}

// AtomicCards tiene estructura: { "data": { "NombreCarta": [facets…] }, "meta": {…} }
const data = parsed.data ?? parsed;

if (typeof data !== "object" || Array.isArray(data)) {
  console.error(
    "❌  Estructura inesperada: se esperaba un objeto en la clave 'data'."
  );
  process.exit(1);
}

// ─── Procesado ───────────────────────────────────────────────────────────────

console.error("⚙️   Procesando cartas …");
if (typeFilter) {
  console.error(`🔍  Filtro de tipo activo: ${typeFilter.map((t) => `"${t}"`).join(", ")}`);
}

const grouped = {};
let total = 0;
let skipped = 0;

for (const [cardName, faces] of Object.entries(data)) {
  // AtomicCards almacena cada carta como un array de "caras" (face).
  // Normalmente faces[0] es la carta principal (o la única cara).
  if (!Array.isArray(faces) || faces.length === 0) {
    skipped++;
    continue;
  }

  const card = faces[0]; // cara principal

  // Datos de traducción
  const foreignData = card.foreignData ?? [];

  // ── Nombre ──
  const name = getLocalizedField(card, "name", foreignData, "name");
  // Nombre en inglés siempre presente (necesario para APIs externas como Scryfall)
  const nameEn = card.name ?? name;

  // ── Tipo ──
  const type = getLocalizedField(card, "type", foreignData, "type");

  // ── Filtro por tipo ──
  // Se compara siempre contra el tipo en inglés (card.type) para mayor fiabilidad,
  // ya que es el campo canónico de MTGJSON.
  if (typeFilter) {
    const typeEn = (card.type ?? "").toLowerCase();
    const matches = typeFilter.some((t) => typeEn.includes(t));
    if (!matches) {
      skipped++;
      continue;
    }
  }

  // ── Texto de la carta ──
  const text = getLocalizedField(card, "text", foreignData, "text") ?? "";

  // ── Poder / Resistencia (solo criaturas) ──
  const power = card.power ?? null;
  const toughness = card.toughness ?? null;

  // ── Coste de mana ──
  const manaCost = card.manaCost ?? "";

  // ── Coste de mana total (para agrupar) ──
  const key = cmcKey(card);

  // ── ¿Es carta especial/funny? ──
  const funny = isFunnyCard(card);

  // ── ID de Scryfall para imagen ──
  // foreignData puede contener un scryfallId de la edición en español.
  // Si no, usamos el scryfallId en inglés del propio card (identifiers.scryfallId).
  const esEntry = foreignData.find(
    (fd) => fd.language === "Spanish" || fd.language === "es" || fd.language === "Español"
  );
  const scryfallIdEs = esEntry?.identifiers?.scryfallId ?? null;
  const scryfallIdEn = card.identifiers?.scryfallId ?? null;

  // ── Construir objeto de salida ──
  const entry = {
    n: name,      // nombre localizado (ES → EN)
    ne: nameEn,   // nombre en inglés canónico (para Scryfall y otras APIs)
    t: type,
    x: text,
    m: manaCost,
    f: funny,
  };

  // IDs de Scryfall: primero español, si no hay entonces inglés
  if (scryfallIdEs) entry.sid = scryfallIdEs;   // id de edición en español
  if (scryfallIdEn) entry.sien = scryfallIdEn;  // id de edición en inglés (fallback)

  // Solo incluir p/h si la carta tiene esos valores
  if (power !== null) entry.p = power;
  if (toughness !== null) entry.h = toughness;

  // Insertar en el grupo correspondiente
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(entry);
  total++;
}

// ─── Ordenar grupos y cartas dentro de cada grupo ────────────────────────────

const sorted = {};
for (const key of Object.keys(grouped).sort((a, b) => Number(a) - Number(b))) {
  sorted[key] = grouped[key].sort((a, b) =>
    (a.n ?? "").localeCompare(b.n ?? "", "es")
  );
}

// ─── Salida ──────────────────────────────────────────────────────────────────

const filterMsg = typeFilter ? ` | filtro: ${typeFilter.join(", ")}` : "";
console.error(
  `✅  ${total} cartas procesadas, ${skipped} entradas omitidas, ${Object.keys(sorted).length
  } grupos de CMC${filterMsg}.`
);

// Usar stringifyWithEscapes para generar JSON con caracteres Unicode escapados
const jsonStringEscaped = stringifyWithEscapes(sorted, 2);
const output = Buffer.from(jsonStringEscaped, "utf8");

if (outputPath) {
  fs.writeFileSync(outputPath, output);
  console.error(`💾  Resultado guardado en: ${outputPath}`);
} else {
  process.stdout.write(output);
}