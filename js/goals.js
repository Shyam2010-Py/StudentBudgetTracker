/* =========================================================
   goals.js — Savings goals
   ========================================================= */

function setupGoalForm() {
  document.getElementById("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("goalName").value.trim();
    const target = +document.getElementById("goalTarget").value;
    if (!name || !target) return;
    const goal = addGoal({ name, target });
    if (!goal) {
      showToast("Could not save this goal. Check available browser storage.", "danger");
      return;
    }
    e.target.reset();
    showToast("Savings goal added.", "success");
    renderGoals();
  });
  const goalList = document.getElementById("goalList");
  goalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-goal-delete]");
    if (button) removeGoal(button.dataset.goalDelete);
  });
  goalList.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-goal-contribute]");
    if (!form) return;
    contributeToGoal(event, form.dataset.goalContribute);
  });
}

function renderGoals() {
  const container = document.getElementById("goalList");
  const goals = getGoals();
  if (goals.length === 0) {
    container.innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="empty-icon">🎯</div><p>No goals yet. Add one to get started!</p></div>`;
    return;
  }
  container.innerHTML = goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
    const colorClass = pct >= 100 ? "" : pct >= 60 ? "warn" : "";
    return `
      <div class="card goal-card">
        <div class="goal-header">
          <div class="goal-name">${escapeHtml(g.name)}</div>
          <button class="action-btn delete" type="button" data-goal-delete="${escapeHtml(g.id)}" aria-label="Delete goal ${escapeHtml(g.name)}">🗑️</button>
        </div>
        <div class="progress-bar"><div class="progress-fill ${colorClass}" style="width:${pct}%"></div></div>
        <div class="goal-amounts">
          <span>${formatCurrency(g.saved)} / ${formatCurrency(g.target)}</span>
          <span class="goal-percent">${pct.toFixed(0)}%</span>
        </div>
        ${pct >= 100 ? `<div class="goal-complete">🎉 Goal reached!</div>` : `
        <form class="contribute-form" data-goal-contribute="${escapeHtml(g.id)}">
          <input type="number" min="1" step="0.01" max="${Math.max(0.01, g.target - g.saved).toFixed(2)}" placeholder="Add amount" required />
          <button type="submit" class="btn-primary">+ Add</button>
        </form>`}
      </div>`;
  }).join("");
}

function contributeToGoal(e, id) {
  e.preventDefault();
  const amount = Number(e.target.querySelector("input").value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const goal = getGoals().find((g) => g.id === id);
  if (!goal) return;

  const s = getSettings();
  const available = s.allowance - sumExpenses(getCurrentMonthExpenses()) - getCurrentMonthSavings();
  if (amount > available) {
    showToast(`⚠️ Only ${formatCurrency(Math.max(0, available))} is available this month.`, "warning");
    return;
  }

  const remainingTarget = Math.max(0, Number(goal.target) - Number(goal.saved));
  if (amount > remainingTarget) {
    showToast(`⚠️ This goal needs only ${formatCurrency(remainingTarget)} more.`, "warning");
    return;
  }

  const contributions = Array.isArray(goal.contributions) ? [...goal.contributions] : [];
  contributions.push({ amount, date: currentLocalDate() });
  const updated = updateGoal(id, { contributions });
  if (!updated) {
    showToast("Could not save this contribution. Your previous savings were kept.", "danger");
    return;
  }
  showToast("Savings contribution added.", "success");
  renderGoals();
  renderDashboard();
}

function removeGoal(id) {
  const goal = getGoals().find((g) => g.id === id);
  if (!goal) return;
  const saved = Number(goal.saved || 0);
  const message = saved > 0
    ? `Delete this goal and release ${formatCurrency(saved)} back to your available balance?`
    : "Delete this goal?";
  if (confirm(message)) {
    if (!deleteGoal(id)) {
      showToast("Could not remove this goal. Your data was kept.", "danger");
      return;
    }
    showToast("Goal removed and its saved amount released.", "warning");
    renderGoals();
    renderDashboard();
  }
}
