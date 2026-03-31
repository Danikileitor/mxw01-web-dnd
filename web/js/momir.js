// ============================================================
// Info Panel
// ============================================================
function toggleInfo() {
    document.getElementById('infoPanel').classList.toggle('open');
    document.getElementById('infoOverlay').classList.toggle('open');
}

// ============================================================
// iOS Detection
// ============================================================
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (isIOS) {
    document.getElementById('iosWarning').style.display = 'block';
    document.getElementById('connectBtn').disabled = true;
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
// Scryfall Image URLs (VERSIÓN DEFINITIVA)
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
let printerState = 'disconnected';
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

function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}

function updatePrinterUI() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    dot.className = 'status-dot ' + printerState;
    text.textContent = printerState.charAt(0).toUpperCase() + printerState.slice(1);
    if (currentCard && !isIOS) {
        document.getElementById('printBtn').disabled = (printerState !== 'ready');
    }
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
    showMessage('Rolling...');

    const creature = getRandomCreature(selectedMV, document.getElementById('includeFunny').checked);
    if (!creature) {
        showCard(null);
        showMessage('No creatures at this mana value');
        rollBtn.disabled = false;
        return;
    }

    currentCard = creature;
    if (document.getElementById('hidePreview').checked) {
        document.getElementById('cardArea').innerHTML = '<p style="color:#4ade80; margin-top:100px; font-size:20px; font-weight:bold;">Card rolled! (preview hidden)</p>';
    } else {
        showCard(creature);
    }
    showMessage('');

    if (!isIOS) {
        document.getElementById('printBtn').disabled = (printerState !== 'ready');
    }

    if (document.getElementById('autoPrint').checked && printerState === 'ready') {
        await printCard();
    }
    rollBtn.disabled = false;
}

// ============================================================
// Thermal Renderer (Canvas API)
// ============================================================

// ============================================================
// BLE Printer (Web Bluetooth)
// ============================================================

async function printCard() {
    if (!currentCard || !bleCharacteristic) return;
    if (printerState !== 'ready') return;

    printerState = 'printing';
    updatePrinterUI();
    document.getElementById('printBtn').disabled = true;
    showMessage('Printing...');

    try {
        let artImg = null;
        if (document.getElementById('printArt').checked) {
            try {
                const name = scryfallName(currentCard);

                let artUrl = await fetchScryfallImageUrl(name, 'art_crop', 'es');
                if (!artUrl) {
                    artUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop`;
                }

                const artResp = await fetch(artUrl);
                if (artResp.ok) {
                    const artBlob = await artResp.blob();
                    artImg = await createImageBitmap(artBlob);
                }
            } catch (e) {
                console.warn('Failed to fetch art:', e);
            }
        }

        printerState = 'ready';
        updatePrinterUI();
        showMessage('Printed: ' + currentCard.n);

    } catch (e) {
        printerState = 'disconnected';
        bleCharacteristic = null;
        updatePrinterUI();
        showMessage('Print failed: ' + e.message);
    }
}

// ============================================================
// Init
// ============================================================
loadSettings();
loadCreatures();