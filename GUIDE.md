# 📖 PocketPilot — Complete Guide

User & developer documentation for **PocketPilot** Student Budget Tracker (PWA v2.0.0).

---

## 🏗️ Architecture Overview

PocketPilot is a **client-side-only** Progressive Web App. It has **no backend** and uses **three browser APIs** to deliver a native-like experience:

| API | Purpose |
|-----|---------|
| **LocalStorage** | Persistent app data (settings, expenses, goals) |
| **Service Worker** | Offline capability + asset caching |
| **Web App Manifest** | Installability + home screen integration |

---

## 📲 Installation

### On Android (Chrome / Edge / Brave)
1. Open the deployed app in Chrome
2. Look for the **⬇️ Install** button in the header — tap it
3. Or: browser menu → "Install app"
4. The app appears on your home screen and launches in **standalone mode** (no browser UI)

### On Desktop (Chrome / Edge)
1. Click the **⬇️ Install** button in the header
2. Or: address bar → install icon (⊕)
3. Launches as a standalone window

### On iOS (Safari)
1. Tap the **Share** button → "Add to Home Screen"
2. The PWA `beforeinstallprompt` event is not supported on iOS, so the in-app install button will show guidance

---

## 💾 Offline Behavior

The **Service Worker** uses a hybrid strategy:

| Resource Type | Strategy | Why |
|---------------|----------|-----|
| App shell (HTML/CSS/JS) | **Cache-first** | Instant load, predictable |
| Navigation requests | **Network-first, fallback to cache, then offline.html** | Always try fresh content |
| CDN assets (Chart.js, jsPDF) | **Stale-while-revalidate** | Speed + freshness |

When fully offline:
- The app shell loads instantly from cache
- The dashboard, history, goals, and analytics all work (data is local)
- Charts/PDF still work because CDN scripts are also cached after first load
- If something is truly unreachable, `offline.html` is shown

---

## 🔄 Updating the App

When you deploy a new version:

1. Increment `CACHE_VERSION` in `service-worker.js`
2. The new SW installs in the background
3. When activated, the **update toast** appears: *"A new version of PocketPilot is available. Refresh to update."*
4. User clicks **Refresh** → the new version takes over
5. Old caches are deleted automatically on activation

---

## 🛠️ PWA Best Practices Implemented

✅ HTTPS-compatible manifest
✅ Service worker scoped to app root (`./`)
✅ Theme color matches brand (`#6366f1`)
✅ Apple touch icons for iOS home screen
✅ Display mode: `standalone` (no browser UI)
✅ Orientation: `portrait` (optimized for mobile)
✅ Maskable icons for adaptive launchers
✅ App shortcuts for quick actions
✅ Offline fallback page
✅ Versioned cache (no stale assets)
✅ Preconnect to CDN origins
✅ Preload critical assets
✅ Defer non-critical scripts
✅ Update notifications
✅ Install prompt detection

---

## 📁 File Roles (Detailed)

| File | Role |
|------|------|
| `index.html` | Single-page app structure, PWA meta tags |
| `manifest.json` | Install metadata, icons, shortcuts |
| `service-worker.js` | Caching + offline behavior |
| `offline.html` | Branded offline fallback |
| `css/styles.css` | Theme variables, layout, gradients, animations |
| `js/storage.js` | Pure data layer — get/save settings, expenses, goals |
| `js/pwa.js` | SW registration, install button, update toast |
| `js/app.js` | Navigation, theme toggle, onboarding, toast |
| `js/dashboard.js` | Stats, progress bars, health score, warnings |
| `js/expenses.js` | CRUD + filters + edit modal |
| `js/analytics.js` | Chart.js setup, monthly trend |
| `js/goals.js` | Savings goals CRUD + contribute |
| `js/settings.js` | Settings form, export/import, resets |
| `js/report.js` | Monthly report + PDF |
| `icons/icon-*.svg` | App icons (vector) |
| `icons/generate-png.html` | One-time PNG generator |

---

## 🔐 Privacy & Security

- ✅ All data stays in **your browser** (LocalStorage)
- ✅ No analytics, no tracking, no external requests (except CDN scripts on first load)
- ✅ Manifest is HTTPS-compatible
- ✅ Service worker uses **safe** cache strategies (no caching of cross-origin responses unless explicitly allowed)
- ✅ No login, no accounts, no personal data shared

---

## 🧪 Testing the PWA

1. **Install** the app (Chrome menu → Install)
2. **Open the installed app** — it should launch without browser UI
3. **Turn off Wi-Fi** — the app should still work
4. **Add some expenses** — they should persist
5. **Re-enable Wi-Fi** — update notification should appear if you've shipped a new version

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Install button doesn't appear | Service Workers require HTTPS or `localhost`. Use a local server. |
| App doesn't work offline | First visit must be online so the SW can cache the shell. |
| Charts not showing | Check internet (CDN). After first load, they're cached. |
| iOS install | Use Safari → Share → Add to Home Screen |
| Update not detected | Hard-reload (Ctrl+Shift+R) to unregister the old SW |

---

## 🛣️ Future Improvements

- 🔔 Web Push notifications for budget alerts
- 📦 Periodic Background Sync for cloud backup
- 🌍 Internationalization (multi-language)
- 🎨 Theme color picker
- 🧾 Receipt photo attachments
- 📊 More chart types (bar, radar)

---

Built with ❤️ for students who want to take control of their money — **offline, private, and always available**.
