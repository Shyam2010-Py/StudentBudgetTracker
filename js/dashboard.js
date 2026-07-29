/* =========================================================
   dashboard.js — Dashboard rendering, stats, progress, score
   ========================================================= */

/* Get expenses for the current month */
function getCurrentMonthExpenses() {
  const cm = currentMonthKey();
  return getExpenses().filter((e) => monthKey(e.date) === cm);
}

/* Sum of expenses for a given list, optional category filter */
function sumExpenses(expenses, category = null) {
  return expenses
    .filter((e) => !category || e.category === category)
    .reduce((s, e) => s + Number(e.amount), 0);
}

/* Today's spending */
function getTodaySpending() {
  const today = new Date().toISOString().slice(0, 10);
  return sumExpenses(getExpenses().filter((e) => e.date === today));
}

/* Render dashboard */
function renderDashboard() {
  if (!isOnboarded()) return;
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const remaining = Math.max(0, s.allowance - totalSpent);
  const saved = Math.max(0, remaining);
  const today = getTodaySpending();
  const days = daysRemainingInMonth();

  // Stat cards
  document.getElementById("statAllowance").textContent = formatCurrency(s.allowance);
  document.getElementById("statRemaining").textContent = formatCurrency(remaining);
  document.getElementById("statSavingsGoal").textContent = formatCurrency(s.savingsGoal);
  document.getElementById("statSaved").textContent = formatCurrency(Math.min(saved, s.savingsGoal || saved));
  document.getElementById("statToday").textContent = formatCurrency(today);
  document.getElementById("statDays").textContent = days;

  // Budget progress bars
  renderBudgetProgress(s, monthExp);

  // Health score
  renderHealthScore(s, monthExp, totalSpent, remaining);

  // Warnings
  renderWarnings(s, monthExp, totalSpent);

  // Recent transactions
  renderRecentTransactions(monthExp);
}

/* Budget progress bars */
function renderBudgetProgress(s, monthExp) {
  const container = document.getElementById("budgetProgress");
  const totalBudget = (s.collegeBudget + s.printoutBudget + s.foodBudget + s.emergencyBudget) || s.allowance;
  const totalSpent = sumExpenses(monthExp);
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const items = [
    { label: "Overall Spending", spent: totalSpent, total: totalBudget, color: overallPct >= 90 ? "danger" : overallPct >= 70 ? "warn" : "" },
    { label: "🍔 Food", spent: sumExpenses(monthExp, "Food"), total: s.foodBudget },
    { label: "🎓 College", spent: sumExpenses(monthExp, "College"), total: s.collegeBudget },
    { label: "📄 Printouts", spent: sumExpenses(monthExp, "Printouts"), total: s.printoutBudget },
    { label: "🚨 Emergency", spent: sumExpenses(monthExp, "Emergency"), total: s.emergencyBudget },
  ];

  container.innerHTML = items.map((it) => {
    const pct = it.total > 0 ? Math.min(100, (it.spent / it.total) * 100) : 0;
    const colorClass = it.color || (pct >= 90 ? "danger" : pct >= 70 ? "warn" : "");
    return `
      <div class="progress-item">
        <div class="progress-header">
          <span>${it.label}</span>
          <span>${formatCurrency(it.spent)} / ${formatCurrency(it.total)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${colorClass}" style="width:${pct}%"></div></div>
      </div>`;
  }).join("");
}

/* Financial health score (0-100) */
function renderHealthScore(s, monthExp, totalSpent, remaining) {
  let score = 100;

  // Penalize overspending
  if (s.allowance > 0) {
    const ratio = totalSpent / s.allowance;
    if (ratio > 1) score -= 40;
    else if (ratio > 0.9) score -= 25;
    else if (ratio > 0.8) score -= 15;
  }

  // Penalize cravings
  const cravings = monthExp.filter((e) => e.type === "Craving").length;
  score -= Math.min(20, cravings * 2);

  // Penalize overspending in food
  if (s.foodBudget > 0) {
    const foodSpent = sumExpenses(monthExp, "Food");
    if (foodSpent > s.foodBudget) score -= 15;
  }

  // Reward saving
  if (remaining > 0 && s.allowance > 0) {
    const saveRatio = remaining / s.allowance;
    if (saveRatio > 0.3) score += 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  document.getElementById("healthScore").textContent = score;

  const ring = document.getElementById("healthRing");
  const circumference = 326.7;
  ring.style.strokeDashoffset = circumference - (score / 100) * circumference;
  ring.style.stroke = score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";

  const msgs = {
    high: "Excellent! You're managing your money like a pro 🌟",
    mid: "Not bad! Watch a few categories to improve.",
    low: "Heads up! You're spending close to your limit.",
  };
  document.getElementById("healthMessage").textContent =
    score >= 75 ? msgs.high : score >= 50 ? msgs.mid : msgs.low;
}

/* Smart warnings */
function renderWarnings(s, monthExp, totalSpent) {
  const warnings = [];
  if (s.allowance > 0) {
    const pct = (totalSpent / s.allowance) * 100;
    if (pct >= 100) warnings.push({ type: "danger", msg: "🚨 You have exceeded your monthly allowance!" });
    else if (pct >= 80) warnings.push({ type: "danger", msg: `⚠️ You have spent ${pct.toFixed(0)}% of your monthly budget.` });
  }
  if (s.foodBudget > 0) {
    const foodPct = (sumExpenses(monthExp, "Food") / s.foodBudget) * 100;
    if (foodPct >= 80) warnings.push({ type: "", msg: `🍔 You are close to reaching your food budget (${foodPct.toFixed(0)}%).` });
  }
  if (s.emergencyBudget > 0) {
    const emPct = (sumExpenses(monthExp, "Emergency") / s.emergencyBudget) * 100;
    if (emPct >= 90) warnings.push({ type: "danger", msg: "🚨 Emergency budget almost exhausted!" });
  }
  const cravingCount = monthExp.filter((e) => e.type === "Craving").length;
  if (cravingCount >= 5) warnings.push({ type: "", msg: `💭 You've had ${cravingCount} cravings this month. Try to cut back!` });

  document.getElementById("warnings").innerHTML = warnings
    .map((w) => `<div class="warning ${w.type}">${w.msg}</div>`)
    .join("");
}

/* Recent transactions (last 5) */
function renderRecentTransactions(monthExp) {
  const container = document.getElementById("recentTransactions");
  const recent = [...monthExp].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>No expenses yet. Add your first one!</p></div>`;
    return;
  }
  container.innerHTML = recent
    .map(
      (e) => `
      <div class="expense-row">
        <div class="expense-icon">${CATEGORY_ICONS[e.category] || "📦"}</div>
        <div class="expense-info">
          <div class="expense-name">${escapeHtml(e.name)}</div>
          <div class="expense-meta">
            <span>${e.category}</span><span>•</span>
            <span>${e.type === "Craving" ? "💭 Craving" : "✅ Need"}</span><span>•</span>
            <span>${new Date(e.date).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="expense-amount">${formatCurrency(e.amount)}</div>
      </div>`
    )
    .join("");
}

/* HTML escape helper */
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
