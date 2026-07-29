/* =========================================================
   analytics.js — Charts & spending analytics
   ========================================================= */

let categoryChart, typeChart, trendChart;

function renderAnalytics() {
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const remaining = Math.max(0, s.allowance - totalSpent);

  // Summary stats
  document.getElementById("anaFood").textContent = formatCurrency(sumExpenses(monthExp, "Food"));
  document.getElementById("anaCollege").textContent = formatCurrency(sumExpenses(monthExp, "College"));
  document.getElementById("anaSavings").textContent = formatCurrency(Math.min(remaining, s.savingsGoal || remaining));
  document.getElementById("anaRemaining").textContent = formatCurrency(remaining);

  // Category chart
  const catData = CATEGORIES.map((c) => sumExpenses(monthExp, c));
  const catColors = ["#f59e0b", "#6366f1", "#3b82f6", "#10b981", "#ec4899", "#ef4444", "#94a3b8"];
  const catTotal = catData.reduce((s, v) => s + v, 0);
  const ctxCat = document.getElementById("categoryChart").getContext("2d");
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctxCat, {
    type: "doughnut",
    data: {
      labels: catTotal > 0 ? CATEGORIES : ["No data"],
      datasets: [{
        data: catTotal > 0 ? catData : [1],
        backgroundColor: catTotal > 0 ? catColors : ["#cbd5e1"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });

  // Need vs Craving chart
  const need = monthExp.filter((e) => e.type === "Need").reduce((s, e) => s + Number(e.amount), 0);
  const craving = monthExp.filter((e) => e.type === "Craving").reduce((s, e) => s + Number(e.amount), 0);
  const typeTotal = need + craving;
  const ctxType = document.getElementById("typeChart").getContext("2d");
  if (typeChart) typeChart.destroy();
  typeChart = new Chart(ctxType, {
    type: "doughnut",
    data: {
      labels: typeTotal > 0 ? ["✅ Needs", "💭 Cravings"] : ["No data"],
      datasets: [{
        data: typeTotal > 0 ? [need, craving] : [1],
        backgroundColor: typeTotal > 0 ? ["#10b981", "#f59e0b"] : ["#cbd5e1"],
        borderWidth: 0,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
  });

  // Monthly trend (last 6 months)
  renderTrendChart();
}

function renderTrendChart() {
  const expenses = getExpenses();
  const months = [];
  const totals = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = expenses.filter((e) => monthKey(e.date) === key).reduce((s, e) => s + Number(e.amount), 0);
    months.push(d.toLocaleString("default", { month: "short" }));
    totals.push(total);
  }
  const ctx = document.getElementById("trendChart").getContext("2d");
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [{
        label: "Spending (₹)",
        data: totals,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#6366f1",
        pointRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}
