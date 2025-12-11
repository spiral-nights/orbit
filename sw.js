// VERSION: 1766038356
const CACHE_NAME = 'orbit-v1766038356';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/storage.js',
    './assets/css/material-icons.css',
    './assets/fonts/MaterialIcons-Regular.ttf',
    './assets/icons.json',
    './manifest.json'
];

// IndexedDB constants (must match storage.js)
const DB_NAME = 'OrbitDB';
const DB_VERSION = 1;
const STORE_NAME = 'apps';

const DARK_MODE_CSS = `
html { 
    filter: invert(1) hue-rotate(180deg); 
    transition: filter 0.3s ease;
}
img, video, picture, canvas, svg { 
    filter: invert(1) hue-rotate(180deg); 
}
body {
    background-color: white; 
    min-height: 100vh;
}`;

const INJECTED_SCRIPT = `
<script>
(function() {
    const DARK_CSS = \`${DARK_MODE_CSS}\`;
    
    window.__ORBIT_SET_THEME__ = function(theme) {
        const styleId = 'orbit-force-dark';
        let styleEl = document.getElementById(styleId);
        
        if (theme === 'dark') {
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                styleEl.textContent = DARK_CSS;
                document.head.appendChild(styleEl);
            }
        } else {
            if (styleEl) {
                styleEl.remove();
            }
        }
    };
})();
</script>`;

self.addEventListener('install', (event) => {
    // Force this SW to become the active one immediately
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    // Take control of all open clients immediately
    event.waitUntil(clients.claim());

    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Open IndexedDB connection (SW has its own connection, separate from main thread)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// Get app by ID from IndexedDB
function getAppById(id) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Inject necessary modifications into app HTML content
function prepareAppContent(content, isDarkMode) {
    let safeContent = content;

    // Inject base target to force links to open in new tab/window
    if (!safeContent.includes('<base')) {
        if (safeContent.includes('<head>')) {
            safeContent = safeContent.replace('<head>', '<head><base target="_blank">');
        } else if (safeContent.includes('<html>')) {
            safeContent = safeContent.replace('<html>', '<html><head><base target="_blank"></head>');
        } else {
            safeContent = '<base target="_blank">' + safeContent;
        }
    }

    // Inject the theme switcher script (always)
    if (safeContent.includes('</head>')) {
        safeContent = safeContent.replace('</head>', INJECTED_SCRIPT + '</head>');
    } else {
        safeContent += INJECTED_SCRIPT;
    }

    // Inject initial dark mode styles if needed
    if (isDarkMode) {
        const darkStyleTag = `<style id="orbit-force-dark">${DARK_MODE_CSS}</style>`;

        if (safeContent.includes('</head>')) {
            safeContent = safeContent.replace('</head>', darkStyleTag + '</head>');
        } else {
            safeContent += darkStyleTag;
        }
    }

    return safeContent;
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle virtual app routes: */apps/{slug}.html
    // Use includes() to handle subdirectory deployments (e.g., GitHub Pages: /repo-name/apps/...)
    if (url.pathname.includes('/apps/') && url.pathname.endsWith('.html')) {
        event.respondWith(handleAppRequest(url));
        return;
    }

    // Default: Network First, Fallback to Cache Strategy
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// Handle requests for app content from IndexedDB
async function handleAppRequest(url) {
    try {
        // Extract app ID from URL: /apps/my-app-1234567890.html -> 1234567890
        const filename = url.pathname.split('/').pop(); // my-app-1234567890.html
        const nameWithoutExt = filename.replace('.html', ''); // my-app-1234567890

        // ID is the last segment after the final dash (it's a timestamp, always numeric)
        const parts = nameWithoutExt.split('-');
        const id = parts[parts.length - 1]; // 1234567890

        // Check for dark mode via query param (set by main app)
        const isDarkMode = url.searchParams.get('dark') === '1';

        const app = await getAppById(id);

        if (!app) {
            return new Response('App not found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        const preparedContent = prepareAppContent(app.content, isDarkMode);

        return new Response(preparedContent, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    } catch (error) {
        console.error('Error handling app request:', error);
        return new Response('Error loading app', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}