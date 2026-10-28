/* =========================================================
   storage.js — Safe LocalStorage abstraction layer
   Centralized data access, validation and backup restoration.
   ========================================================= */

const APP_VERSION = "2.2.0";

const STORAGE_KEYS = {
  settings: "sbt_settings",
  expenses: "sbt_expenses",
  goals: "sbt_goals",
  theme: "sbt_theme",
  onboarding: "sbt_onboarded",
};

const VALID_CATEGORIES = ["Food", "College", "Printouts", "Transport", "Shopping", "Emergency", "Other"];
const VALID_EXPENSE_TYPES = ["Need", "Craving"];

/* ---------- Generic helpers ---------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Storage write error:", error);
    return false;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00");
  return !Number.isNaN(date.getTime()) && currentLocalDate(date) === value;
}

function normalizeAmount(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
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
  const saved = read(STORAGE_KEYS.settings, {});
  return { ...defaultSettings, ...(isPlainObject(saved) ? saved : {}) };
}

function saveSettings(settings) {
  if (!isPlainObject(settings)) return false;
  const normalized = {};
  for (const key of Object.keys(defaultSettings)) {
    const value = Number(settings[key] ?? defaultSettings[key]);
    if (!Number.isFinite(value) || value < 0) return false;
    normalized[key] = value;
  }
  return write(STORAGE_KEYS.settings, normalized);
}

/* ---------- Expenses ---------- */
function getExpenses() {
  const expenses = read(STORAGE_KEYS.expenses, []);
  return Array.isArray(expenses) ? expenses.filter(isPlainObject) : [];
}

function saveExpenses(expenses) {
  if (!Array.isArray(expenses) || !expenses.every(isPlainObject)) return false;
  return write(STORAGE_KEYS.expenses, expenses);
}

function addExpense(expense) {
  if (!isPlainObject(expense)) return null;
  const amount = Number(expense.amount);
  if (!String(expense.name || "").trim() || !Number.isFinite(amount) || amount <= 0) return null;
  if (!VALID_CATEGORIES.includes(expense.category) || !VALID_EXPENSE_TYPES.includes(expense.type)) return null;
  if (!isValidLocalDate(expense.date)) return null;

  const expenses = getExpenses();
  const nextExpense = {
    ...expense,
    name: String(expense.name).trim(),
    notes: String(expense.notes || "").trim(),
    amount,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
    createdAt: new Date().toISOString(),
  };
  if (!saveExpenses([...expenses, nextExpense])) return null;
  return nextExpense;
}

function updateExpense(id, updates) {
  if (!isPlainObject(updates)) return null;
  const expenses = getExpenses();
  const index = expenses.findIndex((expense) => expense.id === id);
  if (index === -1) return null;

  const next = { ...expenses[index], ...updates };
  const amount = Number(next.amount);
  if (!String(next.name || "").trim() || !Number.isFinite(amount) || amount <= 0) return null;
  if (!VALID_CATEGORIES.includes(next.category) || !VALID_EXPENSE_TYPES.includes(next.type)) return null;
  if (!isValidLocalDate(next.date)) return null;

  next.name = String(next.name).trim();
  next.notes = String(next.notes || "").trim();
  next.amount = amount;
  const updated = [...expenses];
  updated[index] = next;
  return saveExpenses(updated) ? next : null;
}

function deleteExpense(id) {
  const expenses = getExpenses();
  const next = expenses.filter((expense) => expense.id !== id);
  return next.length !== expenses.length && saveExpenses(next);
}

/* ---------- Goals ---------- */
function normalizeGoal(goal) {
  const contributions = Array.isArray(goal.contributions)
    ? goal.contributions
        .filter((contribution) => isPlainObject(contribution))
        .map((contribution) => ({
          amount: Number(contribution.amount) || 0,
          date: isValidLocalDate(contribution.date) ? contribution.date : currentLocalDate(),
          ...(contribution.legacy ? { legacy: true } : {}),
        }))
        .filter((contribution) => Number.isFinite(contribution.amount) && contribution.amount > 0)
    : [];

  // Backward compatibility for goals created before contribution history existed.
  if (!contributions.length && Number(goal.saved) > 0) {
    contributions.push({
      amount: Number(goal.saved),
      date: goal.createdAt && isValidLocalDate(String(goal.createdAt).slice(0, 10))
        ? String(goal.createdAt).slice(0, 10)
        : currentLocalDate(),
      legacy: true,
    });
  }

  return {
    ...goal,
    target: normalizeAmount(goal.target),
    contributions,
    saved: contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
  };
}

function getGoals() {
  const goals = read(STORAGE_KEYS.goals, []);
  return Array.isArray(goals) ? goals.filter(isPlainObject).map(normalizeGoal) : [];
}

function saveGoals(goals) {
  if (!Array.isArray(goals) || !goals.every(isPlainObject)) return false;
  return write(STORAGE_KEYS.goals, goals.map(normalizeGoal));
}

function addGoal(goal) {
  if (!isPlainObject(goal) || !String(goal.name || "").trim()) return null;
  const target = Number(goal.target);
  if (!Number.isFinite(target) || target <= 0) return null;
  const goals = getGoals();
  const nextGoal = {
    ...goal,
    name: String(goal.name).trim(),
    target,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    saved: 0,
    contributions: [],
    createdAt: new Date().toISOString(),
  };
  return saveGoals([...goals, nextGoal]) ? nextGoal : null;
}

function updateGoal(id, updates) {
  if (!isPlainObject(updates)) return null;
  const goals = getGoals();
  const index = goals.findIndex((goal) => goal.id === id);
  if (index === -1) return null;
  const updatedGoal = normalizeGoal({ ...goals[index], ...updates });
  if (!updatedGoal.name || !Number.isFinite(updatedGoal.target) || updatedGoal.target <= 0) return null;
  const next = [...goals];
  next[index] = updatedGoal;
  return saveGoals(next) ? updatedGoal : null;
}

function deleteGoal(id) {
  const goals = getGoals();
  const next = goals.filter((goal) => goal.id !== id);
  return next.length !== goals.length && saveGoals(next);
}

/* ---------- Savings helpers ---------- */
function getGoalSavings() {
  return getGoals().reduce((sum, goal) => sum + Number(goal.saved || 0), 0);
}

function getCurrentMonthSavings() {
  const month = currentMonthKey();
  return getGoals().reduce((sum, goal) => sum + goal.contributions
    .filter((contribution) => monthKey(contribution.date) === month)
    .reduce((subtotal, contribution) => subtotal + Number(contribution.amount), 0), 0);
}

function getTodaySavings() {
  const today = currentLocalDate();
  return getGoals().reduce((sum, goal) => sum + goal.contributions
    .filter((contribution) => contribution.date === today)
    .reduce((subtotal, contribution) => subtotal + Number(contribution.amount), 0), 0);
}

/* ---------- Theme ---------- */
function getTheme() {
  const theme = read(STORAGE_KEYS.theme, "light");
  return theme === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  const saved = write(STORAGE_KEYS.theme, safeTheme);
  document.documentElement.setAttribute("data-theme", safeTheme);
  return saved;
}

/* ---------- Onboarding ---------- */
function isOnboarded() {
  return read(STORAGE_KEYS.onboarding, "0") === "1";
}

function setOnboarded() {
  return write(STORAGE_KEYS.onboarding, "1");
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
  if (!isPlainObject(data) || !isPlainObject(data.settings)) return false;
  if (!Array.isArray(data.expenses) || !Array.isArray(data.goals)) return false;

  for (const key of Object.keys(defaultSettings)) {
    const value = Number(data.settings[key]);
    if (!Number.isFinite(value) || value < 0) return false;
  }

  for (const expense of data.expenses) {
    if (!isPlainObject(expense) || !String(expense.name || "").trim()) return false;
    if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) <= 0) return false;
    if (!isValidLocalDate(expense.date)) return false;
    if (expense.category != null && !VALID_CATEGORIES.includes(expense.category)) return false;
    if (expense.type != null && !VALID_EXPENSE_TYPES.includes(expense.type)) return false;
    if (expense.notes != null && typeof expense.notes !== "string") return false;
  }

  for (const goal of data.goals) {
    if (!isPlainObject(goal) || !String(goal.name || "").trim()) return false;
    if (!Number.isFinite(Number(goal.target)) || Number(goal.target) <= 0) return false;
    if (goal.contributions != null && !Array.isArray(goal.contributions)) return false;
    for (const contribution of goal.contributions || []) {
      if (!isPlainObject(contribution) || !Number.isFinite(Number(contribution.amount)) || Number(contribution.amount) <= 0) return false;
      if (!isValidLocalDate(contribution.date)) return false;
    }
  }
  return true;
}

function importAll(data) {
  if (!validateBackup(data)) throw new Error("Invalid backup structure");

  const keys = [STORAGE_KEYS.settings, STORAGE_KEYS.expenses, STORAGE_KEYS.goals];
  const previous = {};
  try {
    keys.forEach((key) => { previous[key] = localStorage.getItem(key); });
    const normalizedExpenses = data.expenses.map((expense) => ({
      ...expense,
      category: VALID_CATEGORIES.includes(expense.category) ? expense.category : "Other",
      type: VALID_EXPENSE_TYPES.includes(expense.type) ? expense.type : "Need",
      notes: String(expense.notes || ""),
    }));
    const normalizedGoals = data.goals.map(normalizeGoal);

    const success =
      saveSettings(data.settings) &&
      saveExpenses(normalizedExpenses) &&
      saveGoals(normalizedGoals);
    if (!success) throw new Error("Browser storage could not save the restored data");
  } catch (error) {
    keys.forEach((key) => {
      try {
        if (previous[key] === null || previous[key] === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, previous[key]);
      } catch (rollbackError) {
        console.error("Backup rollback error:", rollbackError);
      }
    });
    throw error;
  }
}

/* ---------- Utility ---------- */
function currentLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  const amount = Number(value);
  return "₹" + (Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function monthKey(dateStr) {
  const date = typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(dateStr + "T12:00:00")
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  return monthKey(currentLocalDate());
}

function daysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - now.getDate());
}
