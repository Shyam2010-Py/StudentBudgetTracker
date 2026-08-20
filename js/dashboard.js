/* =========================================================
   dashboard.js — Dashboard rendering, stats, progress, score
   ========================================================= */

function getCurrentMonthExpenses() {
  const cm = currentMonthKey();
  return getExpenses().filter((e) => monthKey(e.date) === cm);
}

function sumExpenses(expenses, category = null) {
  return expenses
    .filter((e) => !category || e.category === category)
    .reduce((s, e) => s + Number(e.amount), 0);
}

function getTodaySpending() {
  const today = currentLocalDate();
  return sumExpenses(getExpenses().filter((e) => e.date === today));
}

function getCurrentMonthBalance(s, monthExp) {
  return s.allowance - sumExpenses(monthExp) - getCurrentMonthSavings();
}

function renderDashboard() {
  if (!isOnboarded()) return;
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const currentSavings = getCurrentMonthSavings();
  const totalSaved = getGoalSavings();
  const rawBalance = getCurrentMonthBalance(s, monthExp);
  const remaining = Math.max(0, rawBalance);
  const today = getTodaySpending();
  const days = daysRemainingInMonth();

  document.getElementById("statAllowance").textContent = formatCurrency(s.allowance);
  document.getElementById("statRemaining").textContent = formatCurrency(remaining);
  document.getElementById("statSavingsGoal").textContent = formatCurrency(s.savingsGoal);
  document.getElementById("statSaved").textContent = formatCurrency(totalSaved);
  document.getElementById("statToday").textContent = formatCurrency(today);
  document.getElementById("statDays").textContent = days;

  renderBudgetProgress(s, monthExp, currentSavings);
  renderHealthScore(s, monthExp, totalSpent, currentSavings, rawBalance);
  renderWarnings(s, monthExp, totalSpent, currentSavings, rawBalance);
  renderRecentTransactions(monthExp);
}

function renderBudgetProgress(s, monthExp, currentSavings = 0) {
  const container = document.getElementById("budgetProgress");
  const allocated = Number(s.collegeBudget) + Number(s.printoutBudget) + Number(s.foodBudget) + Number(s.emergencyBudget);
  const totalBudget = s.allowance > 0 ? s.allowance : allocated;
  const totalUsed = sumExpenses(monthExp) + currentSavings;
  const overallPct = totalBudget > 0 ? Math.min(100, (totalUsed / totalBudget) * 100) : 0;

  const items = [
    { label: "Overall Used", spent: totalUsed, total: totalBudget, color: overallPct >= 90 ? "danger" : overallPct >= 70 ? "warn" : "" },
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

  if (allocated > s.allowance && s.allowance > 0) {
    container.insertAdjacentHTML("afterbegin", `<div class="warning danger">⚠️ Your category budgets total ${formatCurrency(allocated)}, which exceeds your allowance of ${formatCurrency(s.allowance)}.</div>`);
  }
}

function getCategoryBudgetIssues(s, monthExp) {
  const categories = [
    { label: "Food", budget: Number(s.foodBudget), spent: sumExpenses(monthExp, "Food") },
    { label: "College", budget: Number(s.collegeBudget), spent: sumExpenses(monthExp, "College") },
    { label: "Printouts", budget: Number(s.printoutBudget), spent: sumExpenses(monthExp, "Printouts") },
    { label: "Emergency", budget: Number(s.emergencyBudget), spent: sumExpenses(monthExp, "Emergency") },
  ];
  return categories
    .filter((c) => c.budget > 0 && c.spent > c.budget)
    .map((c) => ({ ...c, pct: (c.spent / c.budget) * 100, over: c.spent - c.budget }));
}

function renderHealthScore(s, monthExp, totalSpent, currentSavings, rawBalance) {
  let score = 100;
  const used = totalSpent + currentSavings;

  if (s.allowance > 0) {
    const ratio = used / s.allowance;
    if (ratio > 1) score -= 40;
    else if (ratio > 0.9) score -= 25;
    else if (ratio > 0.8) score -= 15;
  }

  const cravings = monthExp.filter((e) => e.type === "Craving").length;
  score -= Math.min(20, cravings * 2);

  // Penalize category overspending progressively. A category at 225% of
  // budget is materially different from being slightly over budget.
  const categoryIssues = getCategoryBudgetIssues(s, monthExp);
  categoryIssues.forEach((issue) => {
    if (issue.pct > 200) score -= 30;
    else if (issue.pct > 150) score -= 25;
    else if (issue.pct > 125) score -= 15;
    else score -= 10;
  });

  if (currentSavings > 0 && s.allowance > 0 && currentSavings / s.allowance > 0.2) score += 5;
  if (rawBalance < 0) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));
  document.getElementById("healthScore").textContent = score;

  const ring = document.getElementById("healthRing");
  const circumference = 326.7;
  ring.style.strokeDashoffset = circumference - (score / 100) * circumference;
  ring.style.stroke = score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";

  const severeIssue = categoryIssues.find((issue) => issue.pct > 150);
  const moderateIssue = categoryIssues.find((issue) => issue.pct > 100);
  const msgs = {
    high: "Excellent! You're managing your money like a pro 🌟",
    mid: "Not bad! Watch a few categories to improve.",
    low: "Heads up! You're spending close to your limit.",
  };

  let message;
  if (severeIssue) {
    message = `⚠️ ${severeIssue.label} budget exceeded by ${formatCurrency(severeIssue.over)} (${Math.round(severeIssue.pct)}% used). This is significantly affecting your financial health.`;
  } else if (moderateIssue) {
    message = `⚠️ ${moderateIssue.label} budget exceeded by ${formatCurrency(moderateIssue.over)}. Review this category before spending more.`;
  } else {
    message = score >= 75 ? msgs.high : score >= 50 ? msgs.mid : msgs.low;
  }
  document.getElementById("healthMessage").textContent = message;
}

function renderWarnings(s, monthExp, totalSpent, currentSavings, rawBalance) {
  const warnings = [];
  const used = totalSpent + currentSavings;

  if (s.allowance > 0) {
    const pct = (used / s.allowance) * 100;
    if (rawBalance < 0) warnings.push({ type: "danger", msg: `🚨 Your expenses and savings allocations exceed the monthly allowance by ${formatCurrency(Math.abs(rawBalance))}.` });
    else if (pct >= 80) warnings.push({ type: "danger", msg: `⚠️ You have allocated ${pct.toFixed(0)}% of your monthly allowance.` });
  }

  const categoryIssues = getCategoryBudgetIssues(s, monthExp);
  categoryIssues.forEach((issue) => {
    if (issue.pct > 150) {
      warnings.push({ type: "danger", msg: `🚨 ${issue.label} spending is ${Math.round(issue.pct)}% of budget — ${formatCurrency(issue.over)} over your limit.` });
    } else {
      warnings.push({ type: "danger", msg: `⚠️ ${issue.label} budget exceeded by ${formatCurrency(issue.over)} (${Math.round(issue.pct)}% used).` });
    }
  });

  if (s.foodBudget > 0 && !categoryIssues.some((issue) => issue.label === "Food")) {
    const foodPct = (sumExpenses(monthExp, "Food") / s.foodBudget) * 100;
    if (foodPct >= 80) warnings.push({ type: "", msg: `🍔 You are close to reaching your food budget (${foodPct.toFixed(0)}%).` });
  }

  if (s.emergencyBudget > 0) {
    const emPct = (sumExpenses(monthExp, "Emergency") / s.emergencyBudget) * 100;
    if (emPct >= 90 && !categoryIssues.some((issue) => issue.label === "Emergency")) warnings.push({ type: "danger", msg: "🚨 Emergency budget almost exhausted!" });
  }

  const cravingCount = monthExp.filter((e) => e.type === "Craving").length;
  if (cravingCount >= 5) warnings.push({ type: "", msg: `💭 You've had ${cravingCount} cravings this month. Try to cut back!` });

  document.getElementById("warnings").innerHTML = warnings.map((w) => `<div class="warning ${w.type}">${w.msg}</div>`).join("");
}

function renderRecentTransactions(monthExp) {
  const container = document.getElementById("recentTransactions");
  const recent = [...monthExp].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>No expenses yet. Add your first one!</p></div>`;
    return;
  }
  container.innerHTML = recent.map((e) => `
      <div class="expense-row">
        <div class="expense-icon">${CATEGORY_ICONS[e.category] || "📦"}</div>
        <div class="expense-info">
          <div class="expense-name">${escapeHtml(e.name)}</div>
          <div class="expense-meta">
            <span>${e.category}</span><span>•</span>
            <span>${e.type === "Craving" ? "💭 Craving" : "✅ Need"}</span><span>•</span>
            <span>${new Date(`${e.date}T12:00:00`).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="expense-amount">${formatCurrency(e.amount)}</div>
      </div>`).join("");
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
