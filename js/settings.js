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
      showToast(`⚠️ Category budgets total ${formatCurrency(allocated)}, above the allowance of ${formatCurrency(settings.allowance)}.`, "warning");
    }

    saveSettings(settings);
    showToast("⚙️ Settings saved!", "success");
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
  const rows = expenses.map((e) => [
    e.date,
    `"${(e.name || "").replace(/"/g, '""')}"`,
    e.category,
    e.type,
    e.amount,
    `"${(e.notes || "").replace(/"/g, '""')}"`,
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, "expenses.csv", "text/csv");
  showToast("📊 CSV exported!", "success");
}

/* ---------- JSON Export / Import ---------- */
function exportJSON() {
  const data = exportAll();
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `budget-backup-${currentMonthKey()}.json`, "application/json");
  showToast("💾 Backup downloaded!", "success");
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!validateBackup(data)) throw new Error("Invalid backup structure");
      if (!confirm("This will replace all current data. Continue?")) return;
      importAll(data);
      showToast("📥 Backup imported successfully!", "success");
      renderDashboard();
      loadSettingsForm();
    } catch (err) {
      console.error("Backup import error:", err);
      showToast("❌ Invalid or incompatible backup file", "danger");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

/* ---------- Resets ---------- */
function resetMonth() {
  if (!confirm("Reset all expenses and savings allocations for the current month? Goals and settings will be kept.")) return;
  const cm = currentMonthKey();
  const remainingExpenses = getExpenses().filter((e) => monthKey(e.date) !== cm);
  saveExpenses(remainingExpenses);

  // Remove only this month's goal contributions and preserve historical savings.
  const goals = getGoals().map((goal) => ({
    ...goal,
    contributions: goal.contributions.filter((c) => monthKey(c.date) !== cm),
  }));
  saveGoals(goals);

  showToast("🗓️ Current month data reset", "warning");
  renderDashboard();
  renderExpenseList();
  renderGoals();
}

function resetAll() {
  if (!confirm("⚠️ This will delete ALL data including settings, expenses, and goals. Continue?")) return;
  if (!confirm("Are you absolutely sure? This action cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEYS.settings);
  localStorage.removeItem(STORAGE_KEYS.expenses);
  localStorage.removeItem(STORAGE_KEYS.goals);
  localStorage.removeItem(STORAGE_KEYS.onboarding);
  showToast("⚠️ All data cleared. Reloading...", "warning");
  setTimeout(() => location.reload(), 1200);
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
  URL.revokeObjectURL(url);
}
