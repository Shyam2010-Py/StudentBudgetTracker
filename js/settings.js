/* =========================================================
   settings.js — Edit settings, export/import, reset
   ========================================================= */

function loadSettingsForm() {
  const s = getSettings();
  document.getElementById("setAllowance").value = s.allowance;
  document.getElementById("setSavings").value = s.savingsGoal;
  document.getElementById("setCollege").value = s.collegeBudget;
  document.getElementById("setPrintout").value = s.printoutBudget;
  document.getElementById("setFood").value = s.foodBudget;
  document.getElementById("setEmergency").value = s.emergencyBudget;
}

function setupSettings() {
  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const settings = {
      allowance: Math.max(0, +document.getElementById("setAllowance").value),
      savingsGoal: Math.max(0, +document.getElementById("setSavings").value),
      collegeBudget: Math.max(0, +document.getElementById("setCollege").value),
      printoutBudget: Math.max(0, +document.getElementById("setPrintout").value),
      foodBudget: Math.max(0, +document.getElementById("setFood").value),
      emergencyBudget: Math.max(0, +document.getElementById("setEmergency").value),
    };

    const allocated = settings.collegeBudget + settings.printoutBudget + settings.foodBudget + settings.emergencyBudget;
    if (settings.allowance > 0 && allocated > settings.allowance) {
      showToast("⚠️ Category budgets total " + formatCurrency(allocated) + ", above the allowance of " + formatCurrency(settings.allowance) + ".", "warning");
    }

    if (!saveSettings(settings)) {
      showToast("Could not save settings. Check available browser storage.", "danger");
      return;
    }
    showToast("Settings saved.", "success");
    renderDashboard();
  });

  document.getElementById("exportCsv").addEventListener("click", () => exportCSV());
  document.getElementById("exportJson").addEventListener("click", () => exportJSON());
  document.getElementById("importFile").addEventListener("change", importJSON);
  document.getElementById("resetMonth").addEventListener("click", resetMonth);
  document.getElementById("resetAll").addEventListener("click", resetAll);
}

/* ---------- CSV Export ---------- */
function exportCSV() {
  const expenses = getExpenses();
  if (expenses.length === 0) {
    showToast("No expenses to export", "warning");
    return;
  }
  const header = ["Date", "Name", "Category", "Type", "Amount", "Notes"];
  const csvCell = (value) => {
    let text = String(value ?? "");
    // Neutralize spreadsheet formulas before quoting the CSV cell.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const rows = expenses.map((e) => [
    e.date, e.name, e.category, e.type, e.amount, e.notes || "",
  ].map(csvCell));
  const csv = [header.map(csvCell).join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  downloadFile(csv, "expenses.csv", "text/csv");
  showToast("📊 CSV exported!", "success");
}

/* ---------- JSON Export / Import ---------- */
function exportJSON() {
  const data = exportAll();
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, "budget-backup-" + currentMonthKey() + ".json", "application/json");
  showToast("💾 Backup downloaded!", "success");
}

function importJSON(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast("Backup file is too large. Choose a file smaller than 5 MB.", "warning");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!validateBackup(data)) throw new Error("Invalid backup structure");
      if (!confirm("This will replace all current data. Continue?")) return;
      importAll(data);
      showToast("Backup imported successfully.", "success");
      renderDashboard();
      renderExpenseList();
      renderGoals();
      renderAnalytics();
      loadSettingsForm();
    } catch (err) {
      console.error("Backup import error:", err);
      showToast(err.message && err.message.includes("storage") ? "Browser storage is full or unavailable; existing data was restored where possible." : "Invalid or incompatible backup file.", "danger");
    }
  };
  reader.onerror = () => showToast("Could not read the backup file. Try another file.", "danger");
  reader.readAsText(file);
  e.target.value = "";
}

/* ---------- Resets ---------- */
function restoreStorageSnapshot(keys, snapshot) {
  keys.forEach((key) => {
    try {
      if (snapshot[key] === null || snapshot[key] === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, snapshot[key]);
    } catch (error) {
      console.error("Storage rollback error for " + key + ":", error);
    }
  });
}

function snapshotStorage(keys) {
  const snapshot = {};
  keys.forEach((key) => { snapshot[key] = localStorage.getItem(key); });
  return snapshot;
}

function resetMonth() {
  if (!confirm("Reset all expenses and savings allocations for the current month? Goals and settings will be kept.")) return;
  const cm = currentMonthKey();
  const remainingExpenses = getExpenses().filter((e) => monthKey(e.date) !== cm);
  const goals = getGoals().map((goal) => ({
    ...goal,
    contributions: goal.contributions.filter((c) => monthKey(c.date) !== cm),
  }));
  const keys = [STORAGE_KEYS.expenses, STORAGE_KEYS.goals];
  let snapshot;
  try {
    snapshot = snapshotStorage(keys);
    if (!saveExpenses(remainingExpenses)) throw new Error("Expense storage write failed");
    if (!saveGoals(goals)) throw new Error("Goal storage write failed");
  } catch (error) {
    console.error("Monthly reset failed:", error);
    if (snapshot) restoreStorageSnapshot(keys, snapshot);
    showToast("Could not reset monthly data. Existing data was restored where possible.", "danger");
    return;
  }

  showToast("🗓️ Current month data reset", "warning");
  renderDashboard();
  renderExpenseList();
  renderGoals();
}

function resetAll() {
  if (!confirm("⚠️ This will delete ALL data including settings, expenses, goals, and theme. Continue?")) return;
  if (!confirm("Are you absolutely sure? This action cannot be undone.")) return;
  const keys = [STORAGE_KEYS.settings, STORAGE_KEYS.expenses, STORAGE_KEYS.goals, STORAGE_KEYS.theme, STORAGE_KEYS.onboarding];
  let snapshot;
  try {
    snapshot = snapshotStorage(keys);
    keys.forEach((key) => localStorage.removeItem(key));
    showToast("All data cleared. Reloading...", "warning");
    window.setTimeout(() => location.reload(), 1200);
  } catch (error) {
    console.error("Reset failed:", error);
    if (snapshot) restoreStorageSnapshot(keys, snapshot);
    showToast("Could not clear browser storage. Existing data was restored where possible.", "danger");
  }
}

/* ---------- File Download Helper ---------- */
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Keep the object URL alive until the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}