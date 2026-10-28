const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createAppContext() {
  const values = new Map();
  let failKey = null;
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === failKey) throw new Error("Simulated storage quota failure");
      values.set(String(key), String(value));
    },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
    setFailKey(key) { failKey = key; },
    raw(key) { return values.has(key) ? values.get(key) : null; },
  };
  const document = { documentElement: { setAttribute() {} } };
  const context = vm.createContext({ localStorage, document, console });
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "storage.js"), "utf8");
  vm.runInContext(source + `
    globalThis.__test = {
      addExpense, getExpenses, saveSettings, getSettings, validateBackup,
      importAll, isOnboarded, setOnboarded, getTheme, setTheme
    };
  `, context);
  return { api: context.__test, localStorage };
}

const validSettings = {
  allowance: 1000, savingsGoal: 200, collegeBudget: 200,
  printoutBudget: 100, foodBudget: 250, emergencyBudget: 50
};

test("adds valid expenses and persists normalized values", () => {
  const { api } = createAppContext();
  const expense = api.addExpense({
    name: "  Lunch  ", amount: "45.5", category: "Food",
    type: "Need", date: "2026-10-28", notes: "  Canteen  "
  });
  assert.ok(expense);
  assert.equal(expense.name, "Lunch");
  assert.equal(expense.amount, 45.5);
  assert.equal(expense.notes, "Canteen");
  assert.equal(api.getExpenses().length, 1);
});

test("rejects invalid amounts, categories, types, and dates", () => {
  const { api } = createAppContext();
  const base = { name: "Test", amount: 10, category: "Food", type: "Need", date: "2026-10-28" };
  assert.equal(api.addExpense({ ...base, amount: -1 }), null);
  assert.equal(api.addExpense({ ...base, category: "Unknown" }), null);
  assert.equal(api.addExpense({ ...base, type: "Unknown" }), null);
  assert.equal(api.addExpense({ ...base, date: "2026-02-31" }), null);
  assert.equal(api.getExpenses().length, 0);
});

test("validates backup structure and rejects invalid records", () => {
  const { api } = createAppContext();
  const backup = { settings: validSettings, expenses: [], goals: [] };
  assert.equal(api.validateBackup(backup), true);
  assert.equal(api.validateBackup({ ...backup, expenses: [{ name: "Bad", amount: -4, date: "2026-10-28" }] }), false);
  assert.equal(api.validateBackup({ ...backup, goals: [{ name: "Goal", target: 50, contributions: [{ amount: 5, date: "2026-02-31" }] }] }), false);
});

test("preserves old settings when backup restoration hits a storage failure", () => {
  const { api, localStorage } = createAppContext();
  api.saveSettings(validSettings);
  const before = JSON.stringify(api.getSettings());
  localStorage.setFailKey("sbt_expenses");
  const backup = {
    settings: { ...validSettings, allowance: 5000 },
    expenses: [],
    goals: []
  };
  assert.throws(() => api.importAll(backup), /storage/i);
  assert.equal(JSON.stringify(api.getSettings()), before);
});

test("keeps the legacy plain-string onboarding and theme format", () => {
  const { api, localStorage } = createAppContext();
  localStorage.setItem("sbt_onboarded", "1");
  localStorage.setItem("sbt_theme", "dark");
  assert.equal(api.isOnboarded(), true);
  assert.equal(api.getTheme(), "dark");
  assert.equal(api.setOnboarded(), true);
});
