const DB_NAME = 'OrbitDB';
const DB_VERSION = 1;
const STORE_NAME = 'apps';

let db = null;

export function init() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

export function getAllApps() {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export function getAppById(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function saveApp(app) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(app);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function deleteApp(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Generate a URL-safe slug from app name + id
 * e.g., "My Cool App" + "1765669989093" -> "my-cool-app-1765669989093"
 */
export function generateSlug(name, id) {
    const nameSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/[\s_]+/g, '-')       // Replace spaces/underscores with dashes
        .replace(/-+/g, '-')           // Collapse multiple dashes
        .replace(/^-|-$/g, '');        // Trim dashes from ends

    return `${nameSlug}-${id}`;
}

/**
 * Get the app URL path for use in iframe src
 * Uses relative path to work on subdirectory deployments (e.g., GitHub Pages)
 */
export function getAppUrl(app, isDarkMode = false) {
    const slug = generateSlug(app.name, app.id);
    const darkParam = isDarkMode ? '?dark=1' : '';
    return `./apps/${slug}.html${darkParam}`;
}
