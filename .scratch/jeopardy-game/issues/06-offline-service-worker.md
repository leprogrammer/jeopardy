# 06: Offline & Service Worker

**What to build:** A versioned Service Worker caches the app shell, styles, scripts, default question data, and the DOMPurify CDN script with a cache-first strategy. After the first visit, the entire game is playable with no network connection. Updating any cached asset invalidates the old cache via a versioned cache name.

**Blocked by:** 03 (JSON validation & error modal)

**Status:** ready-for-agent

- [ ] A `sw.js` Service Worker file exists and is registered in `index.html`
- [ ] The Service Worker uses a versioned cache name (e.g. `jeopardy-v1`) so cache busting is a one-line change
- [ ] Cached assets include: `index.html`, `css/style.css`, all `js/*.js` files, `data/questions.json`, and the DOMPurify CDN script URL
- [ ] Cache strategy is cache-first: serve from cache if present, fall back to network, then update the cache
- [ ] On the first visit (cold cache), all assets are fetched from the network and written to the cache
- [ ] On subsequent visits with no network, the full game loads and is playable — setup, board, clue modal, Daily Double, Final Jeopardy, game over
- [ ] The Service Worker does not interfere with the file upload flow (uploaded JSON is not cached)
- [ ] `sw.js` is excluded from itself being a cache target (no circular reference)
