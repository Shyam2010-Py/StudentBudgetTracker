/* =========================================================
   report.js — Monthly report with suggestions + PDF export
   ========================================================= */

function renderReport() {
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const savings = getCurrentMonthSavings();
  const rawBalance = s.allowance - totalSpent - savings;
  const remaining = Math.max(0, rawBalance);
  const biggest = [...monthExp].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  const catTotals = {};
  CATEGORIES.forEach((c) => (catTotals[c] = sumExpenses(monthExp, c)));
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const needCount = monthExp.filter((e) => e.type === "Need").length;
  const cravingCount = monthExp.filter((e) => e.type === "Craving").length;
  const savingsPct = s.allowance > 0 ? (savings / s.allowance) * 100 : 0;

  let score = 100;
  const used = totalSpent + savings;
  if (s.allowance > 0) {
    const ratio = used / s.allowance;
    if (ratio > 1) score -= 40;
    else if (ratio > 0.9) score -= 25;
    else if (ratio > 0.8) score -= 15;
  }
  score -= Math.min(20, cravingCount * 2);
  if (s.foodBudget > 0 && sumExpenses(monthExp, "Food") > s.foodBudget) score -= 15;
  if (savings > 0 && s.allowance > 0 && savings / s.allowance > 0.2) score += 5;
  if (rawBalance < 0) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const suggestions = [];
  if (rawBalance < 0) suggestions.push(`Your expenses and savings allocations exceed the allowance by ${formatCurrency(Math.abs(rawBalance))}. Reduce spending or savings allocations.`);
  if (savingsPct < 10 && s.allowance > 0) suggestions.push("Your savings rate is low. Aim to save at least 20% of your allowance when practical.");
  if (cravingCount > needCount && monthExp.length > 0) suggestions.push("You made more craving purchases than need purchases. Consider cutting back on impulse buys.");
  if (s.foodBudget > 0 && catTotals.Food > s.foodBudget) suggestions.push("Food spending exceeded the budget. Review canteen and snack purchases.");
  if (topCategory && topCategory[1] > 0) suggestions.push(`Your top spending category is ${topCategory[0]} (${formatCurrency(topCategory[1])}). Track it closely.`);
  if (score >= 80) suggestions.push("Great job! Keep maintaining this disciplined spending habit. 💪");
  if (savingsPct >= 30) suggestions.push("Excellent savings rate! Keep contributing to your goals consistently.");
  if (suggestions.length === 0) suggestions.push("Keep tracking every expense to build a strong financial habit!");

  const monthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });
  document.getElementById("reportMonth").textContent = monthName;

  document.getElementById("reportContent").innerHTML = `
    <div class="report-section">
      <h3>💼 Summary</h3>
      <div class="report-row"><span>Total Allowance</span><strong>${formatCurrency(s.allowance)}</strong></div>
      <div class="report-row"><span>Total Expenses</span><strong>${formatCurrency(totalSpent)}</strong></div>
      <div class="report-row"><span>Saved to Goals This Month</span><strong>${formatCurrency(savings)}</strong></div>
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
      ${suggestions.map((text) => `<div class="suggestion">${escapeHtml(text)}</div>`).join("")}
    </div>
  `;
}

function setupReportExport() {
  document.getElementById("downloadPdf").addEventListener("click", downloadPDF);
  document.getElementById("downloadCsv").addEventListener("click", exportCSV);
}

function downloadPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast("📄 PDF export needs jsPDF to be loaded once while online.", "warning");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const s = getSettings();
  const monthExp = getCurrentMonthExpenses();
  const totalSpent = sumExpenses(monthExp);
  const savings = getCurrentMonthSavings();
  const remaining = Math.max(0, s.allowance - totalSpent - savings);
  const monthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  doc.setFontSize(18);
  doc.setTextColor(99, 102, 241);
  doc.text("PocketPilot — Student Budget Tracker", 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Monthly Report — ${monthName}`, 14, 26);

  doc.setFontSize(11);
  doc.setTextColor(30);
  let y = 38;
  const lines = [
    `Total Allowance: ${formatCurrency(s.allowance)}`,
    `Total Expenses: ${formatCurrency(totalSpent)}`,
    `Saved to Goals This Month: ${formatCurrency(savings)}`,
    `Remaining Balance: ${formatCurrency(remaining)}`,
    `Number of Expenses: ${monthExp.length}`,
  ];
  lines.forEach((l) => { doc.text(l, 14, y); y += 7; });

  y += 5;
  doc.setFontSize(13);
  doc.setTextColor(99, 102, 241);
  doc.text("Category Totals", 14, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(30);
  CATEGORIES.forEach((c) => { doc.text(`${c}: ${formatCurrency(sumExpenses(monthExp, c))}`, 14, y); y += 6; });

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
