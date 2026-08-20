/* =========================================================
   PocketPilot — Service Worker
   - Cache-first for app shell (HTML, CSS, JS, icons)
   - Precache CDN dependencies for offline use after first install
   - Offline fallback page
   - Auto cleanup of old caches on activation
   ========================================================= */

const CACHE_VERSION = "pocketpilot-v2.1.0";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "offline.html";

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
  "./icons/icon.svg",
  "./icons/icon-72.svg",
  "./icons/icon-96.svg",
  "./icons/icon-128.svg",
  "./icons/icon-144.svg",
  "./icons/icon-152.svg",
  "./icons/icon-192.svg",
  "./icons/icon-384.svg",
  "./icons/icon-512.svg",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Best-effort precache. A CDN failure must not prevent the SW installing.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(OFFLINE_URL)))
    );
    return;
  }

  // CDN assets: cache-first once installed, then refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) caches.open(RUNTIME_CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
