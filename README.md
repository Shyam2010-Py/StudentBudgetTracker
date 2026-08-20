# 💰 PocketPilot — Student Budget Tracker (PWA)

A modern, responsive Progressive Web App designed for students to track monthly allowance, expenses, savings, and financial goals.

![Version](https://img.shields.io/badge/version-2.1.0-blueviolet)
![PWA](https://img.shields.io/badge/PWA-Ready-success)
![Offline](https://img.shields.io/badge/Works-Offline-success)
![HTML5](https://img.shields.io/badge/HTML5-orange)
![CSS3](https://img.shields.io/badge/CSS3-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow)

## ✨ Features

### Core
- 📊 **Dashboard** — Allowance, remaining balance, actual goal savings, today's spending, days remaining, and financial health score
- ➕ **Add Expense** — 7 categories, Need vs Craving, notes
- 📜 **History** — search, filter, edit, delete
- 📈 **Analytics** — category doughnut, need-vs-craving, 6-month trend
- 🎯 **Goals** — add goals, make savings allocations, progress tracking
- 📋 **Monthly Report** — monthly expenses, goal savings, suggestions, PDF/CSV export
- ⚙️ **Settings** — budgets, validated backup import/export, monthly reset, full reset
- 🌗 **Light & Dark mode**

### PWA
- 📲 Installable on supported Android/desktop browsers
- 📴 Offline operation after the application shell and CDN dependencies have been cached
- 🏠 Standalone mode
- 🔄 Service-worker update notifications
- 🎨 App icons in 8 SVG sizes (72 → 512)
- 🔌 Offline fallback page

## 🧮 Money model

PocketPilot distinguishes three things that were previously mixed together:

**Monthly allowance − current-month expenses − current-month savings allocations = remaining spendable balance**

Savings-goal contributions are stored with dates, so historical savings remain separate from the current month's allowance. Deleting a goal explicitly releases its allocated savings back into the available balance.

## 🛠️ Tech Stack

- HTML5 / CSS3 / Vanilla JavaScript
- LocalStorage API
- Service Worker API
- Web App Manifest
- Chart.js (CDN, precached by the service worker after first online installation)
- jsPDF (CDN, precached by the service worker after first online installation)

## 📂 Project Structure

```text
StudentBudgetTracker/
├── index.html
├── manifest.json
├── service-worker.js
├── offline.html
├── css/
│   └── styles.css
├── js/
│   ├── storage.js
│   ├── pwa.js
│   ├── app.js
│   ├── dashboard.js
│   ├── expenses.js
│   ├── analytics.js
│   ├── goals.js
│   ├── settings.js
│   └── report.js
├── icons/
│   ├── icon.svg
│   ├── icon-72.svg ... icon-512.svg
│   └── generate-png.html
├── README.md
├── CHANGELOG.md
└── GUIDE.md
```

## 🚀 Getting Started

1. Open the deployed app or serve the project from `localhost`.
2. Complete the onboarding form.
3. Add expenses and create savings goals.
4. Use **Settings → Export Backup** regularly to keep a copy of your LocalStorage data.
5. Install the PWA from the browser's install prompt when supported.

> 💡 Service Workers require **HTTPS** or `localhost`.

> ℹ️ The first online visit is required before offline operation can work. After the service worker has cached the application shell and CDN dependencies, the main app remains usable offline.

## 📖 Documentation

See [GUIDE.md](./GUIDE.md) for full developer & user documentation.
See [CHANGELOG.md](./CHANGELOG.md) for version history.

## 📝 License

Free to use for personal & educational purposes.
