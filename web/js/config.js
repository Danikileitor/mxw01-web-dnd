// Configuration state
const defaultConfig = {
    deviceName: '',
    deviceMAC: '',
    dither: 'steinberg',
    rotate: '0',
    flip: 'none',
    brightness: 128,
    intensity: 93
};

// Load config from localStorage or use default
let config = loadConfig();

// DOM elements
let deviceNameInput, deviceMACInput, ditherSelect, rotateSelect, flipSelect, brightnessInput, intensityInput;
let brightnessValue, intensityValue;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    deviceNameInput = document.getElementById('deviceName');
    deviceMACInput = document.getElementById('deviceMAC');
    ditherSelect = document.getElementById('ditherSelect');
    rotateSelect = document.getElementById('rotateSelect');
    flipSelect = document.getElementById('flipSelect');
    brightnessInput = document.getElementById('brightnessInput');
    intensityInput = document.getElementById('intensityInput');
    brightnessValue = document.getElementById('brightnessValue');
    intensityValue = document.getElementById('intensityValue');

    // Load saved values into UI
    loadConfigToUI();

    // Add event listeners for real-time updates
    deviceNameInput.addEventListener('input', saveConfig);
    deviceMACInput.addEventListener('input', saveConfig);
    ditherSelect.addEventListener('change', saveConfig);
    rotateSelect.addEventListener('change', saveConfig);
    flipSelect.addEventListener('change', saveConfig);
    brightnessInput.addEventListener('input', () => {
        brightnessValue.textContent = brightnessInput.value;
        saveConfig();
    });
    intensityInput.addEventListener('input', () => {
        intensityValue.textContent = intensityInput.value;
        saveConfig();
    });

    // Add preset button listeners
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            applyPreset(preset);
        });
    });
});

// Load configuration from localStorage
function loadConfig() {
    const saved = localStorage.getItem('printerConfig');
    if (saved) {
        try {
            return { ...defaultConfig, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Error loading config:', e);
            return { ...defaultConfig };
        }
    }
    return { ...defaultConfig };
}

// Save current config to localStorage
function saveConfig() {
    config = {
        deviceName: deviceNameInput.value,
        deviceMAC: deviceMACInput.value,
        dither: ditherSelect.value,
        rotate: rotateSelect.value,
        flip: flipSelect.value,
        brightness: parseInt(brightnessInput.value, 10),
        intensity: parseInt(intensityInput.value, 10)
    };
    localStorage.setItem('printerConfig', JSON.stringify(config));
}

// Load config values into UI elements
function loadConfigToUI() {
    deviceNameInput.value = config.deviceName;
    deviceMACInput.value = config.deviceMAC;
    ditherSelect.value = config.dither;
    rotateSelect.value = config.rotate;
    flipSelect.value = config.flip;
    brightnessInput.value = config.brightness;
    intensityInput.value = config.intensity;
    brightnessValue.textContent = config.brightness;
    intensityValue.textContent = config.intensity;
}

// Apply preset configuration
function applyPreset(preset) {
    const presets = {
        text: { dither: 'threshold', brightness: 128, intensity: 93, description: 'Balanced, readable' },
        photos: { dither: 'steinberg', brightness: 140, intensity: 100, description: 'Good contrast' },
        qr: { dither: 'threshold', brightness: 128, intensity: 110, description: 'High contrast' },
        light: { dither: 'steinberg', brightness: 150, intensity: 70, description: 'Saves heat' },
        dark: { dither: 'threshold', brightness: 110, intensity: 120, description: 'Maximum darkness' }
    };

    const presetConfig = presets[preset];
    if (presetConfig) {
        ditherSelect.value = presetConfig.dither;
        brightnessInput.value = presetConfig.brightness;
        intensityInput.value = presetConfig.intensity;
        brightnessValue.textContent = presetConfig.brightness;
        intensityValue.textContent = presetConfig.intensity;
        saveConfig();

        // Optional: Show feedback
        showPresetFeedback(presetConfig.description);
    }
}

// Show temporary feedback when preset is applied
function showPresetFeedback(message) {
    // Remove existing feedback if any
    const existingFeedback = document.querySelector('.preset-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'preset-feedback';
    popup.textContent = `✓ ${message}`;

    // Style the popup
    popup.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        text-align: center;
        white-space: nowrap;
        animation: popupSlideUp 0.3s ease;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    document.body.appendChild(popup);

    // Auto-remove after 2 seconds
    setTimeout(() => {
        popup.style.animation = 'popupFadeOut 0.3s ease';
        setTimeout(() => {
            if (popup && popup.remove) {
                popup.remove();
            }
        }, 300);
    }, 2000);
}

// Toggle config panel (existing function)
function toggleConfig() {
    document.getElementById('configPanel').classList.toggle('open');
    document.getElementById('configOverlay').classList.toggle('open');
}

// Export config for use in other modules
function getConfig() {
    return { ...config };
}

// Update config from external source (if needed)
function updateConfig(newConfig) {
    config = { ...config, ...newConfig };
    saveConfig();
    loadConfigToUI();
}