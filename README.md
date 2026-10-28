# 💰 PocketPilot — Student Budget Tracker (PWA)

A modern, responsive Progressive Web App designed for students to track monthly allowance, expenses, savings, and financial goals.

![Version](https://img.shields.io/badge/version-3.0.0-blueviolet)
![PWA](https://img.shields.io/badge/PWA-Ready-success)
![Offline](https://img.shields.io/badge/Works-Offline-success)
![HTML5](https://img.shields.io/badge/HTML5-orange)
![CSS3](https://img.shields.io/badge/CSS3-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow)

## ✨ Features

**Current release: 3.0.0** — Supabase email/password authentication, per-user cloud state with RLS, revision-checked sync, offline-first local storage, and cloud-sync regression tests.

### Core
- 📊 **Dashboard** — Allowance, remaining balance, actual goal savings, today's spending, days remaining, suggested daily budget, and financial health score
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
- LocalStorage API (offline-first local copy)
- Supabase Auth + PostgreSQL cloud state API protected by Row Level Security
- Revision-checked sync with local/cloud merge on reconnect
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
├── supabase/
│   └── migrations/20261028000100_pocketpilot_cloud_sync.sql
├── offline.html
├── css/
│   └── styles.css
├── js/
│   ├── supabase-config.js
│   ├── cloud-sync.js
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

## ☁️ Supabase full-stack setup

PocketPilot keeps LocalStorage as its offline-first local copy and syncs a validated snapshot to Supabase after sign-in. The `user_state` row is protected by Row Level Security and keyed to `auth.uid()`. A revision-checked RPC prevents silent overwrites; conflicting device changes are merged by stable record ID. Password reset and email confirmation use Supabase Auth.

1. Create or select a **dedicated Supabase project** for PocketPilot.
2. Apply `supabase/migrations/20261028000100_pocketpilot_cloud_sync.sql` using the Supabase SQL Editor or Supabase CLI.
3. Copy the Project URL and **publishable key** from Project Settings → API Keys into `js/supabase-config.js`.
4. In Authentication → URL Configuration, set the deployed GitHub Pages URL as Site URL and add it to allowed redirect URLs. Enable email/password sign-in and configure email confirmation/reset templates.
5. Commit the public project URL and publishable key in the frontend config. These are intended for browser use; **never put a service-role/secret key in the frontend or GitHub Pages**.
6. Deploy the static app. Sign in and choose whether to upload/merge existing local data or download cloud data.

The migration is committed but has **not** been applied to any Supabase project from this branch. Do not run it against a project containing unrelated application data without reviewing it first.

## 🚀 Getting Started

1. Open the deployed app or serve the project from `localhost`.
2. Complete the onboarding form.
3. Add expenses and create savings goals.
4. Use **Settings → Export Backup** regularly to keep a copy of your LocalStorage data.
5. Install the PWA from the browser's install prompt when supported.

> 💡 Service Workers require **HTTPS** or `localhost`.

> ℹ️ The first online visit is required before offline operation can work. After the service worker has cached the application shell and CDN dependencies, the main app remains usable offline.

## 🛡️ Production-readiness notes

- Service-worker cache cleanup is isolated to PocketPilot's own cache namespace, so it does not delete other apps' caches on a shared origin.
- The app remains a **client-side-only PWA**: data lives in this browser's LocalStorage and does not sync across devices. Export backups before clearing browser data.
- True full-stack features such as accounts, server-side storage, and multi-device sync require a separately configured backend and database; they are not claimed by this release.

## 🧪 Quality checks

Run the storage and backup regression tests with Node.js 18 or later:

```bash
node --test tests/storage.test.js
```

The tests cover valid/invalid expense records, backup validation, rollback after a simulated storage failure, and compatibility with existing theme/onboarding values.

## 📖 Documentation

See [GUIDE.md](./GUIDE.md) for full developer & user documentation.
See [CHANGELOG.md](./CHANGELOG.md) for version history.

## 📝 License

Free to use for personal & educational purposes.
