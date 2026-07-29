# 📝 Changelog

## [2.0.0] — 2026-07-29
### 🚀 Major Release — PWA Transformation

#### ✨ Added
- **`manifest.json`** — full PWA manifest (name "PocketPilot", standalone, portrait, theme color, 8 icon sizes, shortcuts)
- **`service-worker.js`** — caching strategy with versioned cache, auto-cleanup of old caches, offline fallback
- **`offline.html`** — branded, animated offline page with retry button
- **`js/pwa.js`** — service worker registration, `beforeinstallprompt` handling, install button logic, update toast
- **Install PocketPilot button** in the app header (auto-hides when installed)
- **Update notification toast** when a new SW version is available, with "Refresh" action
- **App icons** in 8 sizes (72, 96, 128, 144, 152, 192, 384, 512) + base `icon.svg`
- **PNG icon generator** (`icons/generate-png.html`) — one-time tool to produce PNGs from SVG source
- **App shortcuts** in manifest (Add Expense, Dashboard)
- **PWA meta tags** — `apple-mobile-web-app-*`, `mobile-web-app-capable`, `application-name`, theme-color light/dark
- **Preload hints** for CSS, JS, and CDN preconnect
- **`defer` attribute** on CDN scripts for non-blocking load

#### 🐛 Improved
- Charts now properly destroy/recreate on render
- All canvases wrapped in `.chart-wrap` for proper responsive sizing
- Updated README, GUIDE, and project structure to reflect PWA status

#### 🔒 Security
- HTTPS-compatible manifest
- Service worker scoped to app root
- Safe cache-first + network-first strategies
- No external data leakage

---

## [1.0.1] — 2026-07-29
### 🐛 Bug Fixes
- **Analytics — Need vs Craving chart** was always empty. Replaced incorrect `sumExpenses(filteredArray)` call with direct `.reduce()`.
- Empty-state guards added to both charts.

---

## [1.0.0] — 2026-07-29
### 🎉 Initial Release
- Dashboard, Add Expense, History, Analytics, Goals, Monthly Report, Settings
- Light/Dark mode, LocalStorage persistence, CSV/PDF/JSON export
- Mobile-first responsive design
