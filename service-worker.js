/* =========================================================
   PocketPilot — Service Worker
   - Cache-first for app shell (HTML, CSS, JS, icons)
   - Stale-while-revalidate for CDN assets
   - Offline fallback page
   - Auto cleanup of old caches on activation
   ========================================================= */

const CACHE_VERSION = "pocketpilot-v2.0.0";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL    = "offline.html";

/* Files that make up the app shell (precached on install) */
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/storage.js",
  "./js/app.js",
  "./js/dashboard.js",
  "./js/expenses.js",
  "./js/analytics.js",
  "./js/goals.js",
  "./js/settings.js",
  "./js/report.js",
  "./js/pwa.js",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
];

/* ============== INSTALL ============== */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Best-effort precache — if a single icon fails, still install
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      return self.skipWaiting();
    })
  );
});

/* ============== ACTIVATE ============== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* ============== FETCH ============== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ---- Navigation requests → network-first, offline fallback ----
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // ---- Same-origin static assets → cache-first ----
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            if (res.ok) {
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }).catch(() => caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  // ---- Cross-origin (CDN) → stale-while-revalidate ----
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ============== MESSAGE ============== */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
