/* =========================================================
   storage.js — LocalStorage abstraction layer
   Centralized data access for the entire app.
   ========================================================= */

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
function getGoals() {
  return read(STORAGE_KEYS.goals, []);
}

function saveGoals(goals) {
  return write(STORAGE_KEYS.goals, goals);
}

function addGoal(goal) {
  const goals = getGoals();
  goal.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  goal.saved = 0;
  goal.createdAt = new Date().toISOString();
  goals.push(goal);
  saveGoals(goals);
  return goal;
}

function updateGoal(id, updates) {
  const goals = getGoals();
  const idx = goals.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  goals[idx] = { ...goals[idx], ...updates };
  saveGoals(goals);
  return goals[idx];
}

function deleteGoal(id) {
  const goals = getGoals().filter((g) => g.id !== id);
  saveGoals(goals);
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
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    expenses: getExpenses(),
    goals: getGoals(),
  };
}

function importAll(data) {
  if (data.settings) saveSettings(data.settings);
  if (data.expenses) saveExpenses(data.expenses);
  if (data.goals) saveGoals(data.goals);
}

/* ---------- Utility ---------- */
function formatCurrency(n) {
  return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysRemainingInMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate();
}
