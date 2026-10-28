/* =========================================================
   PocketPilot — Service Worker
   App-scoped caches, safe offline fallback, controlled updates.
   ========================================================= */

const CACHE_PREFIX = "pocketpilot-studentbudgettracker-";
const CACHE_VERSION = CACHE_PREFIX + "v2.3.0";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";
const OFFLINE_URL = "offline.html";
const LEGACY_CACHE_NAMES = [
  "pocketpilot-v2.0.0-static", "pocketpilot-v2.0.0-runtime",
  "pocketpilot-v2.1.0-static", "pocketpilot-v2.1.0-runtime",
  "pocketpilot-v2.2.0-static", "pocketpilot-v2.2.0-runtime",
];

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
      // A CDN or optional asset failure must not prevent installation.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      // Do not skip waiting automatically: the page can offer a safe update prompt.
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Cache Storage is shared by every app on an origin (including GitHub Pages).
    // Delete only older caches owned by this application.
    await Promise.all(
      keys
        .filter((key) => (key.startsWith(CACHE_PREFIX) && !key.startsWith(CACHE_VERSION)) || LEGACY_CACHE_NAMES.includes(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const offlineUrl = new URL(OFFLINE_URL, self.registration.scope).href;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          try { await runtimeCache.put(request, response.clone()); } catch (error) {
            console.warn("Navigation cache write failed:", error);
          }
        }
        return response;
      } catch (error) {
        const cachedPage = await runtimeCache.match(request);
        if (cachedPage) return cachedPage;
        const staticCache = await caches.open(STATIC_CACHE);
        const offlinePage = await staticCache.match(offlineUrl);
        if (offlinePage) return offlinePage;
        throw error;
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const cached = await staticCache.match(request) || await runtimeCache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response && response.ok) {
        try { await runtimeCache.put(request, response.clone()); } catch (error) {
          console.warn("Asset cache write failed:", error);
        }
      }
      return response;
    })());
    return;
  }

  // CDN assets: return a scoped cached copy immediately, then refresh it in the background.
  event.respondWith((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const cached = await staticCache.match(request) || await runtimeCache.match(request);
    const refresh = fetch(request).then(async (response) => {
      if (response && response.ok) {
        try { await runtimeCache.put(request, response.clone()); } catch (error) {
          console.warn("CDN cache write failed:", error);
        }
      }
      return response;
    });

    if (cached) {
      event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
      return cached;
    }
    return refresh;
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
