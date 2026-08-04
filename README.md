# 💰 PocketPilot — Student Budget Tracker (PWA)

A modern, responsive, **fully offline** Progressive Web App designed specifically for students to track their monthly allowance, expenses, savings, and financial goals.

![Version](https://img.shields.io/badge/version-2.0.0-blueviolet)
![PWA](https://img.shields.io/badge/PWA-Ready-success)
![Offline](https://img.shields.io/badge/Works-Offline-success)
![HTML5](https://img.shields.io/badge/HTML5-orange)
![CSS3](https://img.shields.io/badge/CSS3-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow)

## ✨ Features

### Core
- 📊 **Dashboard** — Allowance, balance, today's spending, days remaining, animated health score (0–100)
- ➕ **Add Expense** — 7 categories, Need vs Craving, notes
- 📜 **History** — search, filter, edit, delete
- 📈 **Analytics** — category doughnut, need-vs-craving, 6-month trend
- 🎯 **Goals** — add, contribute, progress
- 📋 **Monthly Report** — auto summary + suggestions + PDF
- ⚙️ **Settings** — edit budgets, export/import, reset
- 🌗 **Light & Dark mode**

### PWA (v2.0.0)
- 📲 **Installable** on Android, Chrome, Edge
- 📴 **Works fully offline** via Service Worker
- 🏠 **Standalone mode** (no browser UI)
- 🔄 **Update notifications** when new versions are available
- 🎨 **App icons** in 8 sizes (72 → 512)
- ⚡ **Preloaded assets** for fast startup
- 🔌 **Offline fallback page** (`offline.html`)

## 🛠️ Tech Stack

- HTML5 / CSS3 / Vanilla JavaScript
- LocalStorage API
- **Service Worker API** — offline + caching
- **Web App Manifest** — installability
- [Chart.js](https://www.chartjs.org/) (CDN) — analytics
- [jsPDF](https://github.com/parallax/jsPDF) (CDN) — PDF export

## 📂 Project Structure

```
StudentBudgetTracker/
├── index.html              # Main app
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker (caching + offline)
├── offline.html            # Offline fallback page
├── css/
│   └── styles.css
├── js/
│   ├── storage.js          # LocalStorage layer
│   ├── pwa.js              # SW registration, install prompt
│   ├── app.js              # Core navigation + theme
│   ├── dashboard.js
│   ├── expenses.js
│   ├── analytics.js
│   ├── goals.js
│   ├── settings.js
│   └── report.js
├── icons/                  # App icons (SVG + generator)
│   ├── icon.svg
│   ├── icon-72.svg ... icon-512.svg
│   └── generate-png.html   # One-time PNG generator
├── README.md
├── CHANGELOG.md
└── GUIDE.md
```

## 🚀 Getting Started

1. Open `index.html` in any modern browser
2. Complete the onboarding form
3. Add your expenses
4. **To install as an app** — click the **⬇️ Install** button in the header (Chrome/Edge on desktop & Android)

> 💡 Service Workers require **HTTPS** or `localhost`. For local testing, use a tiny server: `python3 -m http.server` from the project folder.


## 📖 Documentation

See [GUIDE.md](./GUIDE.md) for full developer & user documentation.
See [CHANGELOG.md](./CHANGELOG.md) for version history.

## 📝 License

Free to use for personal & educational purposes.
