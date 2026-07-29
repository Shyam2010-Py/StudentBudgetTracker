/* =========================================================
   report.js — Monthly report with suggestions + PDF export
   ========================================================= */

function renderReport() {
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const remaining = Math.max(0, s.allowance - totalSpent);
  const savings = Math.min(remaining, s.savingsGoal || remaining);
  const biggest = [...monthExp].sort((a, b) => b.amount - a.amount)[0];

  // Category totals
  const catTotals = {};
  CATEGORIES.forEach((c) => (catTotals[c] = sumExpenses(monthExp, c)));
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const needCount = monthExp.filter((e) => e.type === "Need").length;
  const cravingCount = monthExp.filter((e) => e.type === "Craving").length;
  const savingsPct = s.allowance > 0 ? (savings / s.allowance) * 100 : 0;

  // Health score (reuse logic)
  let score = 100;
  if (s.allowance > 0) {
    const ratio = totalSpent / s.allowance;
    if (ratio > 1) score -= 40;
    else if (ratio > 0.9) score -= 25;
    else if (ratio > 0.8) score -= 15;
  }
  score -= Math.min(20, cravingCount * 2);
  if (s.foodBudget > 0 && sumExpenses(monthExp, "Food") > s.foodBudget) score -= 15;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Suggestions
  const suggestions = [];
  if (totalSpent > s.allowance) suggestions.push("You've overspent this month. Try to plan a stricter budget next month.");
  if (savingsPct < 10 && s.allowance > 0) suggestions.push("Your savings rate is low. Aim to save at least 20% of your allowance.");
  if (cravingCount > needCount && monthExp.length > 0) suggestions.push("You spent more on cravings than needs. Consider cutting back on impulse buys.");
  if (s.foodBudget > 0 && catTotals.Food > s.foodBudget) suggestions.push("Food spending exceeded the budget. Cooking at home can help reduce costs.");
  if (topCategory && topCategory[1] > 0) suggestions.push(`Your top spending category is ${topCategory[0]} (${formatCurrency(topCategory[1])}). Track it closely.`);
  if (score >= 80) suggestions.push("Great job! Keep maintaining this disciplined spending habit. 💪");
  if (savingsPct >= 30) suggestions.push("Excellent savings rate! Consider putting extra money into a goal.");
  if (suggestions.length === 0) suggestions.push("Keep tracking every expense to build a strong financial habit!");

  const monthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });
  document.getElementById("reportMonth").textContent = monthName;

  const html = `
    <div class="report-section">
      <h3>💼 Summary</h3>
      <div class="report-row"><span>Total Allowance</span><strong>${formatCurrency(s.allowance)}</strong></div>
      <div class="report-row"><span>Total Expenses</span><strong>${formatCurrency(totalSpent)}</strong></div>
      <div class="report-row"><span>Total Savings</span><strong>${formatCurrency(savings)}</strong></div>
      <div class="report-row"><span>Remaining Balance</span><strong>${formatCurrency(remaining)}</strong></div>
      <div class="report-row"><span>Savings Percentage</span><strong>${savingsPct.toFixed(1)}%</strong></div>
      <div class="report-row"><span>Financial Health Score</span><strong>${score}/100</strong></div>
    </div>
    <div class="report-section">
      <h3>📊 Spending Breakdown</h3>
      <div class="report-row"><span>Need Purchases</span><strong>${needCount}</strong></div>
      <div class="report-row"><span>Craving Purchases</span><strong>${cravingCount}</strong></div>
      <div class="report-row"><span>Biggest Expense</span><strong>${biggest ? escapeHtml(biggest.name) + " (" + formatCurrency(biggest.amount) + ")" : "—"}</strong></div>
      <div class="report-row"><span>Top Category</span><strong>${topCategory && topCategory[1] > 0 ? topCategory[0] + " (" + formatCurrency(topCategory[1]) + ")" : "—"}</strong></div>
    </div>
    <div class="report-section">
      <h3>📁 Category Totals</h3>
      ${CATEGORIES.map((c) => `<div class="report-row"><span>${CATEGORY_ICONS[c]} ${c}</span><strong>${formatCurrency(catTotals[c])}</strong></div>`).join("")}
    </div>
    <div class="report-section">
      <h3>💡 Suggestions for Improvement</h3>
      ${suggestions.map((s) => `<div class="suggestion">${s}</div>`).join("")}
    </div>
  `;
  document.getElementById("reportContent").innerHTML = html;
}

/* ---------- PDF Export ---------- */
function setupReportExport() {
  document.getElementById("downloadPdf").addEventListener("click", downloadPDF);
  document.getElementById("downloadCsv").addEventListener("click", exportCSV);
}

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const remaining = Math.max(0, s.allowance - totalSpent);
  const monthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  doc.setFontSize(18);
  doc.setTextColor(99, 102, 241);
  doc.text("Student Budget Tracker", 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Monthly Report — ${monthName}`, 14, 26);

  doc.setFontSize(11);
  doc.setTextColor(30);
  let y = 38;
  const lines = [
    `Total Allowance: ${formatCurrency(s.allowance)}`,
    `Total Expenses: ${formatCurrency(totalSpent)}`,
    `Remaining Balance: ${formatCurrency(remaining)}`,
    `Number of Expenses: ${monthExp.length}`,
  ];
  lines.forEach((l) => {
    doc.text(l, 14, y);
    y += 7;
  });

  y += 5;
  doc.setFontSize(13);
  doc.setTextColor(99, 102, 241);
  doc.text("Category Totals", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(30);
  CATEGORIES.forEach((c) => {
    doc.text(`${c}: ${formatCurrency(sumExpenses(monthExp, c))}`, 14, y);
    y += 6;
  });

  y += 5;
  doc.setFontSize(13);
  doc.setTextColor(99, 102, 241);
  doc.text("Recent Transactions", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(30);
  const recent = [...monthExp].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
  if (recent.length === 0) doc.text("No transactions this month.", 14, y);
  recent.forEach((e) => {
    const line = `${e.date} • ${e.name} • ${e.category} • ${formatCurrency(e.amount)}`;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += 5.5;
  });

  doc.save(`budget-report-${currentMonthKey()}.pdf`);
  showToast("📄 PDF exported!", "success");
}
