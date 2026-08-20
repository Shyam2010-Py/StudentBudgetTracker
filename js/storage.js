/* =========================================================
   storage.js — LocalStorage abstraction layer
   Centralized data access for the entire app.
   ========================================================= */

const APP_VERSION = "2.1.0";

const STORAGE_KEYS = {
  settings: "sbt_settings",
  expenses: "sbt_expenses",
  goals: "sbt_goals",
  theme: "sbt_theme",
  onboarding: "sbt_onboarded",
};

/* ---------- Generic helpers ---------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Storage read error:", e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Storage write error:", e);
    return false;
  }
}

/* ---------- Settings (allowance + budgets) ---------- */
const defaultSettings = {
  allowance: 0,
  savingsGoal: 0,
  collegeBudget: 0,
  printoutBudget: 0,
  foodBudget: 0,
  emergencyBudget: 0,
};

function getSettings() {
  return { ...defaultSettings, ...read(STORAGE_KEYS.settings, {}) };
}

function saveSettings(settings) {
  return write(STORAGE_KEYS.settings, settings);
}

/* ---------- Expenses ---------- */
function getExpenses() {
  return read(STORAGE_KEYS.expenses, []);
}

function saveExpenses(expenses) {
  return write(STORAGE_KEYS.expenses, expenses);
}

function addExpense(expense) {
  const expenses = getExpenses();
  expense.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  expense.createdAt = new Date().toISOString();
  expenses.push(expense);
  saveExpenses(expenses);
  return expense;
}

function updateExpense(id, updates) {
  const expenses = getExpenses();
  const idx = expenses.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  expenses[idx] = { ...expenses[idx], ...updates };
  saveExpenses(expenses);
  return expenses[idx];
}

function deleteExpense(id) {
  const expenses = getExpenses().filter((e) => e.id !== id);
  saveExpenses(expenses);
}

/* ---------- Goals ---------- */
function normalizeGoal(goal) {
  const contributions = Array.isArray(goal.contributions)
    ? goal.contributions
        .map((c) => ({ amount: Number(c.amount) || 0, date: c.date || currentLocalDate() }))
        .filter((c) => c.amount > 0)
    : [];

  // Backward compatibility for goals created before contribution history existed.
  if (!contributions.length && Number(goal.saved) > 0) {
    contributions.push({
      amount: Number(goal.saved),
      date: goal.createdAt ? String(goal.createdAt).slice(0, 10) : currentLocalDate(),
      legacy: true,
    });
  }

  return {
    ...goal,
    target: Number(goal.target) || 0,
    contributions,
    saved: contributions.reduce((sum, c) => sum + Number(c.amount), 0),
  };
}

function getGoals() {
  return read(STORAGE_KEYS.goals, []).map(normalizeGoal);
}

function saveGoals(goals) {
  return write(STORAGE_KEYS.goals, goals.map(normalizeGoal));
}

function addGoal(goal) {
  const goals = getGoals();
  goal.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  goal.saved = 0;
  goal.contributions = [];
  goal.createdAt = new Date().toISOString();
  goals.push(goal);
  saveGoals(goals);
  return goal;
}

function updateGoal(id, updates) {
  const goals = getGoals();
  const idx = goals.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  goals[idx] = normalizeGoal({ ...goals[idx], ...updates });
  saveGoals(goals);
  return goals[idx];
}

function deleteGoal(id) {
  const goals = getGoals().filter((g) => g.id !== id);
  saveGoals(goals);
}

/* ---------- Savings helpers ---------- */
function getGoalSavings() {
  return getGoals().reduce((sum, goal) => sum + Number(goal.saved || 0), 0);
}

function getCurrentMonthSavings() {
  const cm = currentMonthKey();
  return getGoals().reduce(
    (sum, goal) => sum + goal.contributions
      .filter((c) => monthKey(c.date) === cm)
      .reduce((s, c) => s + Number(c.amount), 0),
    0
  );
}

function getTodaySavings() {
  const today = currentLocalDate();
  return getGoals().reduce(
    (sum, goal) => sum + goal.contributions
      .filter((c) => c.date === today)
      .reduce((s, c) => s + Number(c.amount), 0),
    0
  );
}

/* ---------- Theme ---------- */
function getTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || "light";
}

function setTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

/* ---------- Onboarding ---------- */
function isOnboarded() {
  return localStorage.getItem(STORAGE_KEYS.onboarding) === "1";
}

function setOnboarded() {
  localStorage.setItem(STORAGE_KEYS.onboarding, "1");
}

/* ---------- Backup / Restore ---------- */
function exportAll() {
  return {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    expenses: getExpenses(),
    goals: getGoals(),
  };
}

function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.settings && (typeof data.settings !== "object" || Array.isArray(data.settings))) return false;
  if (data.expenses && !Array.isArray(data.expenses)) return false;
  if (data.goals && !Array.isArray(data.goals)) return false;

  if (Array.isArray(data.expenses)) {
    for (const e of data.expenses) {
      if (!e || typeof e !== "object" || !String(e.name || "").trim()) return false;
      if (!Number.isFinite(Number(e.amount)) || Number(e.amount) < 0) return false;
      if (!e.date || Number.isNaN(new Date(e.date).getTime())) return false;
    }
  }

  if (Array.isArray(data.goals)) {
    for (const g of data.goals) {
      if (!g || typeof g !== "object" || !String(g.name || "").trim()) return false;
      if (!Number.isFinite(Number(g.target)) || Number(g.target) <= 0) return false;
      if (g.contributions && !Array.isArray(g.contributions)) return false;
    }
  }
  return true;
}

function importAll(data) {
  if (!validateBackup(data)) throw new Error("Invalid backup structure");
  if (data.settings) saveSettings({ ...defaultSettings, ...data.settings });
  if (data.expenses) saveExpenses(data.expenses);
  if (data.goals) saveGoals(data.goals);
}

/* ---------- Utility ---------- */
function currentLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCurrency(n) {
  return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function monthKey(dateStr) {
  const d = typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(`${dateStr}T12:00:00`)
    : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  return monthKey(currentLocalDate());
}

function daysRemainingInMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, last - now.getDate());
}
