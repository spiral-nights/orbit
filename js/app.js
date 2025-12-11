// Main Application Logic
import * as Storage from './storage.js';

// DOM Elements
const appEl = document.getElementById('app');
const orbitContainer = document.getElementById('orbit-container');
const orbitBtn = document.getElementById('orbit-btn');
const orbitIcon = document.getElementById('orbit-icon');
const appViewer = document.getElementById('app-viewer');
const appFrame = document.getElementById('app-frame');
const themeToggle = document.getElementById('theme-toggle');
const coronaContainer = document.querySelector('.corona-container');

// Radial Menu Elements
const radialMenuContainer = document.getElementById('radial-menu-container');
const radialMenuSvg = document.getElementById('radial-menu-svg');
const radialIcons = document.getElementById('radial-icons');

// Modals
const appModal = document.getElementById('app-modal');
const modalTitle = document.getElementById('modal-title');
const contextMenu = document.getElementById('context-menu');

// State
let isRadialOpen = false;
let isAppActive = false;
let currentAppId = null; // Track current app for theme reloading
let apps = [];
let contextMenuTargetId = null;
let editingAppId = null;

// Init
async function init() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.className = savedTheme;
    updateThemeIcon(savedTheme);

    await Storage.init();
    apps = await Storage.getAllApps();

    // Ensure we have a home state in history
    if (!history.state || !history.state.home) {
        history.replaceState({ home: true }, '', location.pathname);
    }

    setupEventListeners();
}

function setupEventListeners() {
    orbitBtn.addEventListener('click', handleOrbitClick);

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';
        document.body.className = newTheme;
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        
        // Update app theme if active
        if (isAppActive) {
            // Try to toggle via injected script first to avoid reload/reset
            if (appFrame.contentWindow && typeof appFrame.contentWindow.__ORBIT_SET_THEME__ === 'function') {
                appFrame.contentWindow.__ORBIT_SET_THEME__(newTheme);
            } else {
                reloadCurrentApp();
            }
        }
    });

    document.getElementById('add-app-btn').addEventListener('click', () => openAppModal());
    document.getElementById('cancel-modal-btn').addEventListener('click', () => appModal.classList.add('hidden'));
    document.getElementById('app-form').addEventListener('submit', handleAppSubmit);

    // Handle browser back button - close app and return to home
    window.addEventListener('popstate', (event) => {
        if (isAppActive) {
            // User pressed back while in app - close it and show home
            appFrame.srcdoc = '';
            currentAppId = null;
            showHomeUI();
            // Open the radial menu after a short delay
            setTimeout(() => {
                if (!isRadialOpen) toggleRadialMenu();
            }, 300);
        }
    });

    // Listen for iframe navigation to detect when app loads or closes
    appFrame.addEventListener('load', handleIframeLoad);

    // Close modal when clicking on the backdrop (outside content)
    appModal.addEventListener('click', (e) => {
        if (e.target === appModal) {
            appModal.classList.add('hidden');
        }
    });

    document.getElementById('app-file').addEventListener('change', (e) => {
        const fileName = e.target.files[0] ? e.target.files[0].name : "Select File...";
        document.getElementById('file-name-display').textContent = fileName;
    });

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            e.target.classList.add('selected');
            document.getElementById('app-color').value = e.target.dataset.color;
        });
    });

    document.getElementById('ctx-edit').addEventListener('click', () => {
        if (contextMenuTargetId) openAppModal(contextMenuTargetId);
        hideContextMenu();
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
        const idToDelete = contextMenuTargetId;
        if (idToDelete) {
            showConfirm('Delete this app?', () => deleteApp(idToDelete));
        }
        hideContextMenu();
    });

    document.addEventListener('click', (e) => {
        // Close context menu if clicked outside
        if (contextMenu.classList.contains('visible') && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }

        // Close radial menu if open and clicked outside of it or the orbit button
        if (isRadialOpen && !radialMenuContainer.contains(e.target) && !orbitBtn.contains(e.target)) {
            toggleRadialMenu();
        }
    });
}

function updateThemeIcon(theme) {
    const icon = theme === 'dark' ? 'light_mode' : 'dark_mode';
    themeToggle.querySelector('.material-icons').textContent = icon;
}

// Handle iframe load event to detect app navigation
function handleIframeLoad() {
    try {
        const iframeSrc = appFrame.contentWindow?.location?.href || '';

        // Check if we're on an app page (served by SW)
        if (iframeSrc.includes('/apps/') && iframeSrc.endsWith('.html')) {
            // App is active
            if (!isAppActive) {
                showAppUI();
            }
        } else if (iframeSrc === 'about:blank' || iframeSrc === '') {
            // Back to home
            if (isAppActive) {
                showHomeUI();
            }
        }
    } catch (e) {
        // Cross-origin access blocked - this is fine, means we're on about:blank or similar
    }
}

// Reload current app (used when theme changes) - no history impact
async function reloadCurrentApp() {
    if (!currentAppId) return;

    const app = apps.find(a => a.id === currentAppId);
    if (!app) return;

    const isDark = document.body.classList.contains('dark');
    const appUrl = Storage.getAppUrl(app, isDark);

    try {
        const response = await fetch(appUrl);
        if (response.ok) {
            const content = await response.text();
            appFrame.srcdoc = content;
        }
    } catch (e) {
        console.error('Error reloading app:', e);
    }
}

// Show UI in "app active" state
function showAppUI() {
    isAppActive = true;
    isRadialOpen = false;
    radialMenuContainer.classList.remove('open');
    orbitContainer.classList.add('docked');
    if (coronaContainer) coronaContainer.classList.add('docked');
    orbitIcon.textContent = 'grid_view';
    appViewer.classList.add('active');
    appEl.classList.add('app-active');
}

// Show UI in "home" state
function showHomeUI() {
    isAppActive = false;
    appViewer.classList.remove('active');
    appEl.classList.remove('app-active');
    orbitContainer.classList.remove('docked');
    if (coronaContainer) coronaContainer.classList.remove('docked');
    orbitIcon.textContent = 'public';
}

// --- Radial Menu Logic ---

function handleOrbitClick() {
    if (isAppActive) {
        // Go back in history to remove the app entry, then close app
        // This triggers popstate which handles the UI update
        history.back();
    } else {
        toggleRadialMenu();
    }
}

function toggleRadialMenu() {
    isRadialOpen = !isRadialOpen;

    if (isRadialOpen) {
        renderRadialSVG();
        radialMenuContainer.classList.add('open');
        orbitIcon.textContent = 'close';
    } else {
        radialMenuContainer.classList.remove('open');
        orbitIcon.textContent = 'public';
    }
}

// --- SVG Math (Constant Gap + Alignment) ---

function renderRadialSVG() {
    radialMenuSvg.innerHTML = '';
    radialIcons.innerHTML = '';

    if (apps.length === 0) return;

    const centerX = 200;
    const centerY = 200;
    const innerRadius = 70;
    const outerRadius = 180;

    // Constant Gap (px)
    const gapPx = apps.length > 1 ? 4 : 0;

    // Calculate gap in degrees for inner and outer arcs
    const innerGapDeg = (gapPx / (2 * Math.PI * innerRadius)) * 360;
    const outerGapDeg = (gapPx / (2 * Math.PI * outerRadius)) * 360;

    const anglePerItem = 360 / apps.length;
    const startOffset = -anglePerItem / 2;

    apps.forEach((app, index) => {
        const nominalStart = startOffset + (index * anglePerItem);
        const nominalEnd = startOffset + ((index + 1) * anglePerItem);

        let pathData;

        if (apps.length === 1) {
            pathData = describeAnnulus(centerX, centerY, innerRadius, outerRadius);
        } else {
            const sInner = nominalStart + (innerGapDeg / 2);
            const eInner = nominalEnd - (innerGapDeg / 2);
            const sOuter = nominalStart + (outerGapDeg / 2);
            const eOuter = nominalEnd - (outerGapDeg / 2);

            pathData = describeSector(centerX, centerY, innerRadius, outerRadius, sInner, eInner, sOuter, eOuter);
        }

        const color = app.color || '#ffffff';

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("class", "menu-segment");
        path.style.stroke = color;

        // Click to launch app
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            launchApp(app.id);
        });

        // Right Click (Desktop)
        path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, app.id);
        });

        // Long Press (Touch)
        let pressTimer;
        path.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                const touch = e.touches[0];
                showContextMenu(touch.clientX, touch.clientY, app.id);
            }, 500);
        });

        path.addEventListener('touchend', () => clearTimeout(pressTimer));
        path.addEventListener('touchmove', () => clearTimeout(pressTimer));
        path.addEventListener('touchcancel', () => clearTimeout(pressTimer));

        radialMenuSvg.appendChild(path);

        // Text Placement
        const midAngle = nominalStart + (anglePerItem / 2);
        const textRadius = (innerRadius + outerRadius) / 2;

        const rad = (midAngle - 90) * (Math.PI / 180);
        const textX = centerX + textRadius * Math.cos(rad);
        const textY = centerY + textRadius * Math.sin(rad);

        const textEl = document.createElement('div');
        textEl.className = 'segment-text';
        textEl.style.left = `${textX}px`;
        textEl.style.top = `${textY}px`;

        textEl.innerHTML = `
            <span class="app-label-text" style="color: ${color}; text-shadow: 0 0 10px ${color}80;">${app.name}</span>
        `;

        radialIcons.appendChild(textEl);
    });
}

function describeAnnulus(x, y, innerRadius, outerRadius) {
    return [
        "M", x, y - outerRadius,
        "A", outerRadius, outerRadius, 0, 1, 1, x, y + outerRadius,
        "A", outerRadius, outerRadius, 0, 1, 1, x, y - outerRadius,
        "Z",
        "M", x, y - innerRadius,
        "A", innerRadius, innerRadius, 0, 1, 0, x, y + innerRadius,
        "A", innerRadius, innerRadius, 0, 1, 0, x, y - innerRadius,
        "Z"
    ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function describeSector(x, y, rInner, rOuter, startInner, endInner, startOuter, endOuter) {
    const startOuterPt = polarToCartesian(x, y, rOuter, endOuter);
    const endOuterPt = polarToCartesian(x, y, rOuter, startOuter);
    const startInnerPt = polarToCartesian(x, y, rInner, endInner);
    const endInnerPt = polarToCartesian(x, y, rInner, startInner);

    const largeArcOuter = (endOuter - startOuter) <= 180 ? "0" : "1";
    const largeArcInner = (endInner - startInner) <= 180 ? "0" : "1";

    return [
        "M", startOuterPt.x, startOuterPt.y,
        "A", rOuter, rOuter, 0, largeArcOuter, 0, endOuterPt.x, endOuterPt.y,
        "L", endInnerPt.x, endInnerPt.y,
        "A", rInner, rInner, 0, largeArcInner, 1, startInnerPt.x, startInnerPt.y,
        "L", startOuterPt.x, startOuterPt.y,
        "Z"
    ].join(" ");
}

// --- App Navigation ---

// Launch app by fetching content from SW and loading via srcdoc (no history entries)
async function launchApp(id) {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    // Push a state so back button returns to home instead of going past it
    history.pushState({ inApp: true, appId: id }, '', location.pathname);

    // Close radial menu and show app UI immediately
    isRadialOpen = false;
    radialMenuContainer.classList.remove('open');
    showAppUI();
    currentAppId = id;

    // Fetch content from SW and load via srcdoc (doesn't create history entries)
    const isDark = document.body.classList.contains('dark');
    const appUrl = Storage.getAppUrl(app, isDark);

    console.log('[DEBUG] Fetching app URL:', appUrl);

    try {
        const response = await fetch(appUrl);
        if (response.ok) {
            const content = await response.text();
            appFrame.srcdoc = content;
        } else {
            console.error('Failed to load app:', response.status, 'URL:', appUrl);
        }
    } catch (e) {
        console.error('Error loading app:', e);
    }
}

function closeApp(openMenu = false) {
    // Clear iframe content (srcdoc doesn't create history entries)
    appFrame.srcdoc = '';
    currentAppId = null;

    // Update UI immediately
    showHomeUI();

    if (openMenu) {
        setTimeout(() => {
            if (!isRadialOpen) toggleRadialMenu();
        }, 300);
    }
}

// --- Context Menu ---

function showContextMenu(x, y, appId) {
    contextMenuTargetId = appId;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.add('visible');
    contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    contextMenu.classList.remove('visible');
    contextMenu.classList.add('hidden');
    contextMenuTargetId = null;
}

// --- App CRUD ---

async function handleAppSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('app-name').value;
    const color = document.getElementById('app-color').value;
    const fileInput = document.getElementById('app-file');

    let content = null;
    if (editingAppId) {
        const existing = apps.find(a => a.id === editingAppId);
        content = existing.content;
        if (fileInput.files.length) content = await readFileAsText(fileInput.files[0]);
        const updated = { ...existing, name, color, content };
        await Storage.saveApp(updated);
        apps = apps.map(a => a.id === editingAppId ? updated : a);
    } else {
        if (!fileInput.files.length) return alert("File required");
        content = await readFileAsText(fileInput.files[0]);
        const newApp = { id: Date.now().toString(), name, color, content };
        await Storage.saveApp(newApp);
        apps.push(newApp);
    }

    appModal.classList.add('hidden');
    resetModal();
    if (isRadialOpen) renderRadialSVG();
}

function resetModal() {
    document.getElementById('app-form').reset();
    document.getElementById('app-color').value = '#ffffff';
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    document.querySelector('.color-option[data-color="#ffffff"]').classList.add('selected');
    document.getElementById('file-name-display').textContent = 'Select File...';
    editingAppId = null;
}

function openAppModal(editId = null) {
    resetModal();
    appModal.classList.remove('hidden');
    if (editId) {
        editingAppId = editId;
        const app = apps.find(a => a.id === editId);
        modalTitle.textContent = "Edit App";
        document.getElementById('app-name').value = app.name;
        document.getElementById('app-color').value = app.color || '#ffffff';
        document.querySelectorAll('.color-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.color === app.color);
        });
    } else {
        modalTitle.textContent = "Add App";
    }
}

async function deleteApp(id) {
    await Storage.deleteApp(id);
    apps = apps.filter(a => a.id !== id);
    if (isRadialOpen) renderRadialSVG();
}

function readFileAsText(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsText(file);
    });
}

// --- Confirm Modal ---

const confirmModal = document.getElementById('confirm-modal');
let confirmCallback = null;

function showConfirm(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.remove('hidden');
}

document.getElementById('confirm-yes').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    confirmModal.classList.add('hidden');
    confirmCallback = null;
});

document.getElementById('confirm-no').addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
});

init();