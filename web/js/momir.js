// ============================================================
// Info Panel
// ============================================================
function toggleInfo() {
    document.getElementById('infoPanel').classList.toggle('open');
    document.getElementById('infoOverlay').classList.toggle('open');
}

// ============================================================
// Card Store
// ============================================================
let creaturesDB = null;

async function loadCreatures() {
    try {
        const resp = await fetch('datos/momir/creatures.json');
        creaturesDB = await resp.json();
        document.getElementById('loading').style.display = 'none';
        const total = Object.values(creaturesDB).reduce((s, arr) => s + arr.length, 0);
        console.log(`Loaded ${total} creatures`);
    } catch (e) {
        document.getElementById('loading').textContent = 'Failed to load card database.';
        console.error('Failed to load creatures.json:', e);
    }
}

function getRandomCreature(mv, includeFunny) {
    if (!creaturesDB) return null;
    const bucket = creaturesDB[String(mv)] || [];
    const filtered = includeFunny ? bucket : bucket.filter(c => !c.f);
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
}

// ============================================================
// Scryfall Image URLs
// ============================================================
function scryfallName(card) {
    return card.ne || card.n;
}

async function isValidImage(url) {
    try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        return await new Promise((resolve) => {
            img.onload = () => {
                if (img.width < 50 || img.height < 50) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            };
            img.onerror = () => resolve(false);
            img.src = url;
        });
    } catch {
        return false;
    }
}

async function tryFetchForLang(cardNameEn, version, lang) {
    // 1. Intento con SEARCH (encuentra cualquier print en ese idioma)
    try {
        const q = encodeURIComponent(`!"${cardNameEn}" lang:${lang}`);
        const resp = await fetch(`https://api.scryfall.com/cards/search?q=${q}&unique=prints`);

        if (resp.ok) {
            const data = await resp.json();

            if (data.data?.length) {
                for (const card of data.data) {
                    if (card.image_status === 'placeholder') continue;
                    if (card.card_faces?.some(f => f.image_status === 'placeholder')) continue;

                    const uris = card.image_uris
                        || card.card_faces?.find(f => f.image_uris)?.image_uris;

                    const url = uris?.[version];

                    if (url) {
                        const valid = await isValidImage(url);
                        if (valid) return url;
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Search fallback failed:', e);
    }

    // 2. Fallback con NAMED (más rápido pero menos completo)
    try {
        const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardNameEn)}&lang=${lang}`;
        const resp = await fetch(url);

        if (resp.ok) {
            const card = await resp.json();

            if (card.image_status === 'placeholder') {
                return null;
            }
            if (card.card_faces?.some(f => f.image_status === 'placeholder')) {
                return null;
            }

            const uris = card.image_uris
                || card.card_faces?.find(f => f.image_uris)?.image_uris;

            const imgUrl = uris?.[version];

            if (imgUrl) {
                const valid = await isValidImage(imgUrl);
                if (valid) return imgUrl;
            }
        }
    } catch (e) {
        console.warn('Named fallback failed:', e);
    }

    return null;
}

async function fetchScryfallImageUrl(cardNameEn, version = 'normal', lang = 'es') {
    // Intenta con el idioma preferido
    let url = await tryFetchForLang(cardNameEn, version, lang);
    if (url) return url;

    // Si no es inglés y falló, intenta con inglés
    if (lang !== 'en') {
        url = await tryFetchForLang(cardNameEn, version, 'en');
        if (url) return url;
    }

    return null;
}

async function createCardImage(card, version = 'normal') {
    const img = document.createElement('img');
    img.className = 'card-img';
    img.alt = card.n;
    img.crossOrigin = 'anonymous';

    const name = scryfallName(card);

    let url = await fetchScryfallImageUrl(name, version, 'es');

    if (url) {
        img.src = url;
    } else {
        img.src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${version}`;
        img.onerror = () => { img.style.display = 'none'; };
    }

    return img;
}

// ============================================================
// Settings (persisted in localStorage)
// ============================================================
function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('momirSettings') || '{}');
        document.getElementById('autoPrint').checked = saved.autoPrint || false;
        document.getElementById('includeFunny').checked = saved.includeFunny || false;
        document.getElementById('printArt').checked = saved.printArt !== false;
        document.getElementById('hidePreview').checked = saved.hidePreview || false;
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    localStorage.setItem('momirSettings', JSON.stringify({
        autoPrint: document.getElementById('autoPrint').checked,
        includeFunny: document.getElementById('includeFunny').checked,
        printArt: document.getElementById('printArt').checked,
        hidePreview: document.getElementById('hidePreview').checked,
    }));
}

// ============================================================
// UI State
// ============================================================
let selectedMV = null;
let currentCard = null;

const picker = document.getElementById('mvPicker');
for (let i = 0; i <= 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'mv-btn';
    btn.textContent = i;
    btn.onclick = () => selectMV(i, btn);
    picker.appendChild(btn);
}

function selectMV(mv, btn) {
    selectedMV = mv;
    document.querySelectorAll('.mv-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('rollBtn').disabled = !creaturesDB;
}

async function showCard(card) {
    const area = document.getElementById('cardArea');
    if (!card) {
        area.innerHTML = '<p style="color:#666; margin-top:100px;">No creatures at this mana value</p>';
        return;
    }
    const pt = (card.p && card.h) ? `${card.p} / ${card.h}` : '';
    area.innerHTML = `
    <div class="card-name">${card.n}</div>
    <div class="card-type">${card.t}</div>
    ${card.x ? `<div class="card-text">${card.x}</div>` : ''}
    ${pt ? `<div class="card-pt">${pt}</div>` : ''}
  `;
    const img = await createCardImage(card);
    area.insertBefore(img, area.firstChild);
}

async function roll() {
    if (selectedMV === null || !creaturesDB) return;
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = true;

    const creature = getRandomCreature(selectedMV, document.getElementById('includeFunny').checked);
    if (!creature) {
        showCard(null);
        rollBtn.disabled = false;
        return;
    }

    currentCard = creature;

    // Generate art if needed
    let artImg = null;
    if (document.getElementById('printArt').checked) {
        try {
            const name = scryfallName(currentCard);
            const artUrl = await fetchScryfallImageUrl(name, 'art_crop', 'es');
            if (artUrl) {
                const artResp = await fetch(artUrl);
                if (artResp.ok) {
                    const artBlob = await artResp.blob();
                    artImg = await createImageBitmap(artBlob);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch art:', e);
        }
    }

    // Generate canvas
    const canvas = renderCardToCanvas(currentCard, artImg);

    // Display canvas or hidden message
    if (document.getElementById('hidePreview').checked) {
        document.getElementById('cardArea').innerHTML = '<p style="color:#4ade80; margin-top:100px; text-align: center; font-size:20px; font-weight:bold;">¡Carta generada!<br>(previsualización oculta)</p>';
    } else {
        document.getElementById('cardArea').innerHTML = '';
        document.getElementById('cardArea').appendChild(canvas);
    }

    document.getElementById('btnPrint').disabled = false;

    if (document.getElementById('autoPrint').checked) {
        await printCard();
    }
    rollBtn.disabled = false;
}

// ============================================================
// Card Rendering
// ============================================================

function renderCardToCanvas(card, artImg) {
    const RENDER_WIDTH = 384; // always render at this readable size
    const RENDER_CONTENT = RENDER_WIDTH - 12 * 2;
    const measure = document.createElement('canvas');
    const mctx = measure.getContext('2d');

    // Función auxiliar para ajustar tamaño de fuente
    function getAdjustedFont(text, baseFontSize, baseFontWeight, maxWidth) {
        let fontSize = baseFontSize;
        let font = `${baseFontWeight} ${fontSize}px sans-serif`;
        mctx.font = font;

        while (mctx.measureText(text).width > maxWidth && fontSize > 12) {
            fontSize -= 1;
            font = `${baseFontWeight} ${fontSize}px sans-serif`;
            mctx.font = font;
        }

        return font;
    }

    // Detectar si es carta doble (contiene //)
    const isDoubleCard = card.n.includes('//');
    let nameParts = [];
    let mainName = card.n;

    if (isDoubleCard) {
        // Separar los nombres por //
        nameParts = card.n.split('//').map(part => part.trim());
        mainName = nameParts[0]; // Usamos el primer nombre para ajustes iniciales
    }

    // Calcular tamaños de fuente ajustados
    const mana = card.m || '';
    let nameMaxWidth = RENDER_CONTENT;
    if (mana) {
        mctx.font = 'bold 36px sans-serif';
        const manaW = mctx.measureText(mana).width;
        nameMaxWidth = RENDER_CONTENT - manaW - 12;
    }

    let nameFontStr;
    let nameFontSize;

    if (isDoubleCard) {
        // Para cartas dobles, usar tamaño más pequeño para que quepan dos líneas
        nameFontStr = getAdjustedFont(mainName, 28, 'bold', nameMaxWidth);
        nameFontSize = parseInt(nameFontStr.match(/(\d+)px/)[1]);
        // Asegurar que no sea demasiado pequeño
        nameFontSize = Math.max(nameFontSize, 14);
        nameFontStr = `bold ${nameFontSize}px sans-serif`;
    } else {
        nameFontStr = getAdjustedFont(card.n, 36, 'bold', nameMaxWidth);
        nameFontSize = parseInt(nameFontStr.match(/(\d+)px/)[1]);
    }

    const typeFontStr = getAdjustedFont(card.t, 26, 'normal', RENDER_CONTENT);
    const typeFontSize = parseInt(typeFontStr.match(/(\d+)px/)[1]);

    const nameFont = nameFontStr;
    const typeFont = typeFontStr;
    const textFont = '24px sans-serif';
    const ptFont = 'bold 34px sans-serif';

    // Calcular altura del nombre (puede ser 1 o 2 líneas)
    mctx.font = nameFont;
    const nameLineHeight = nameFontSize + 4;
    const nameH = isDoubleCard ? (nameLineHeight * 2 + 4) : (nameFontSize + 8);

    let artH = 0;
    if (artImg) {
        const ratio = artImg.height / artImg.width;
        artH = Math.round(RENDER_WIDTH * ratio);
    }

    mctx.font = typeFont;
    const typeH = typeFontSize + 6;

    mctx.font = textFont;
    let rulesH = 0;
    let rulesLines = [];
    if (card.x) {
        const paragraphs = card.x.split('\n');
        for (const para of paragraphs) {
            rulesLines.push(...measureTextLines(mctx, para, RENDER_CONTENT));
        }
        rulesH = (24 + 4) * rulesLines.length + 6 + 1 + 6;
    }

    let ptH = 0;
    if (card.p && card.h) {
        ptH = 34 + 8;
    }

    const totalHeight = nameH + 1 + 6
        + (artH ? artH + 6 + 1 + 6 : 0)
        + typeH + 1 + 6
        + rulesH
        + ptH
        + 4;

    const canvas = document.createElement('canvas');
    canvas.id = 'ticketCanvas';
    canvas.width = RENDER_WIDTH;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, RENDER_WIDTH, totalHeight);
    ctx.fillStyle = '#000';

    let y = 0;

    // Name + mana cost
    ctx.font = nameFont;

    if (mana) {
        const manaW = ctx.measureText(mana).width;
        ctx.fillText(mana, RENDER_WIDTH - 12 - manaW, y + nameFontSize);

        if (isDoubleCard) {
            // Para carta doble: mostrar dos líneas de nombre
            const availableWidth = RENDER_CONTENT - manaW - 12;

            // Primera línea: primer nombre + " //"
            let firstName = nameParts[0];
            let firstNameWithSlash = firstName + ' //';
            while (ctx.measureText(firstNameWithSlash).width > availableWidth && firstNameWithSlash.length > 3) {
                firstName = firstName.slice(0, -1);
                firstNameWithSlash = firstName + ' //';
            }
            ctx.fillText(firstNameWithSlash, 12, y + nameFontSize);

            // Segunda línea: segundo nombre
            let secondName = nameParts[1] || '';
            let displaySecondName = secondName;
            while (ctx.measureText(displaySecondName).width > availableWidth && displaySecondName.length > 1) {
                displaySecondName = displaySecondName.slice(0, -1);
            }
            ctx.fillText(displaySecondName, 12, y + nameFontSize + nameLineHeight);
        } else {
            // Carta normal
            let displayName = card.n;
            while (ctx.measureText(displayName).width > (RENDER_CONTENT - manaW - 12) && displayName.length > 1) {
                displayName = displayName.slice(0, -1);
            }
            ctx.fillText(displayName, 12, y + nameFontSize);
        }
    } else {
        if (isDoubleCard) {
            // Para carta doble sin maná
            const availableWidth = RENDER_CONTENT;

            // Primera línea: primer nombre + " //"
            let firstName = nameParts[0];
            let firstNameWithSlash = firstName + ' //';
            while (ctx.measureText(firstNameWithSlash).width > availableWidth && firstNameWithSlash.length > 3) {
                firstName = firstName.slice(0, -1);
                firstNameWithSlash = firstName + ' //';
            }
            ctx.fillText(firstNameWithSlash, 12, y + nameFontSize);

            // Segunda línea: segundo nombre
            let secondName = nameParts[1] || '';
            let displaySecondName = secondName;
            while (ctx.measureText(displaySecondName).width > availableWidth && displaySecondName.length > 1) {
                displaySecondName = displaySecondName.slice(0, -1);
            }
            ctx.fillText(displaySecondName, 12, y + nameFontSize + nameLineHeight);
        } else {
            // Carta normal sin maná
            let displayName = card.n;
            while (ctx.measureText(displayName).width > RENDER_CONTENT && displayName.length > 1) {
                displayName = displayName.slice(0, -1);
            }
            ctx.fillText(displayName, 12, y + nameFontSize);
        }
    }
    y += nameH;

    // Rule
    ctx.fillRect(12, y, RENDER_CONTENT, 1);
    y += 1 + 6;

    // Art
    if (artImg) {
        const ratio = artImg.height / artImg.width;
        const ah = Math.round(RENDER_WIDTH * ratio);
        ctx.drawImage(artImg, 0, y, RENDER_WIDTH, ah);
        y += ah + 6;
        ctx.fillRect(12, y, RENDER_CONTENT, 1);
        y += 1 + 6;
    }

    // Type line - con ajuste de fuente
    ctx.font = typeFont;
    let displayType = card.t;
    while (ctx.measureText(displayType).width > RENDER_CONTENT && displayType.length > 1) {
        displayType = displayType.slice(0, -1);
    }
    ctx.fillText(displayType, 12, y + typeFontSize);
    y += typeH;

    ctx.fillRect(12, y, RENDER_CONTENT, 1);
    y += 1 + 6;

    // Rules text
    if (rulesLines.length > 0 && card.x) {
        ctx.font = textFont;
        for (const line of rulesLines) {
            ctx.fillText(line, 12, y + 24);
            y += 24 + 4;
        }
        y += 6;
        ctx.fillRect(12, y, RENDER_CONTENT, 1);
        y += 1 + 6;
    }

    // P/T
    if (card.p && card.h) {
        ctx.font = ptFont;
        const ptStr = `${card.p} / ${card.h}`;
        const ptW = ctx.measureText(ptStr).width;
        ctx.fillText(ptStr, RENDER_WIDTH - 12 - ptW, y + 34);
    }

    return canvas;
}

function measureTextLines(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        const test = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(test).width <= maxWidth) {
            currentLine = test;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [''];
}

async function printCard() {
    const canvas = document.querySelector('#cardArea canvas');
    if (!canvas) {
        return;
    }

    try {
        await window.imprimirTicket();
    } catch (e) {
        console.error('Print failed:', e);
    }
}

// ============================================================
// Init
// ============================================================
loadSettings();
loadCreatures();