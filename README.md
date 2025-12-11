# Orbit

Orbit is a minimalist, local-first **PWA Shell** designed to run single-page HTML applications. It essentially turns your locally generated HTML/JS files into "native-like" apps on your phone.

## Purpose

With the rise of AI coding tools, it's easier than ever to generate small, functional web apps (calculators, games, utilities) contained in a single HTML file. **Orbit** bridges the gap between these files and your mobile device.

Instead of hosting every small tool on a web server, you can simply:
1.  Generate an HTML file (e.g., "My AI Calculator.html").
2.  Open **Orbit** on your phone.
3.  Import the file.
4.  Launch it anytime, offline, from a beautiful radial menu.

## Features

*   **Zero Backend:** Runs entirely in the browser using Service Workers and IndexedDB.
*   **Offline Ready:** Works without an internet connection once installed.
*   **Radial Menu:** A fluid, animated interface for quick access to your apps.
*   **Customization:** Organize your apps with custom names and neon-style color coding.
*   **Secure:** Apps run in a sandboxed iframe to ensure safety.
*   **Themeable:** Supports Dark and Light modes with a modern glass/neon aesthetic.

## Installation (User)

1.  Visit the hosted Orbit URL (or host it yourself).
2.  Tap "Share" (iOS) or the Menu (Android) -> **"Add to Home Screen"**.
3.  Launch Orbit from your home screen.

## Installation (Developer)

To host Orbit yourself or contribute:

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/orbit.git
    ```
2.  No build step is required! It is pure Vanilla JS/HTML/CSS.
3.  Serve the directory using any static file server:
    ```bash
    npx http-server .
    # OR
    python3 -m http.server 8000
    ```

## Project Structure

*   `index.html` - Main entry point and UI shell.
*   `js/app.js` - Core logic for the radial menu, modals, and app launching.
*   `js/storage.js` - IndexedDB wrapper for saving HTML content.
*   `css/styles.css` - All styling (Neon/Glassmorphism theme).
*   `sw.js` - Service Worker for offline caching.
*   `manifest.json` - PWA configuration.

## Automatic Updates (PWA)

To ensure the PWA updates automatically on user devices whenever you deploy new code, you must enable the git hook. This hook automatically increments the version in `sw.js` every time you commit changes.

**Setup:**
1.  Open your terminal in the project root.
2.  Run the installation script:
    ```bash
    ./scripts/install-hooks.sh
    ```

Now, every time you run `git commit`, the service worker version will be updated, ensuring users get the latest version upon their next visit.

## License

MIT