/* =========================================================
   expenses.js — Add, edit, delete, search, filter expenses
   ========================================================= */

/* ----- Add Expense Form ----- */
function setupExpenseForm() {
  const dateInput = document.getElementById("expDate");
  dateInput.value = new Date().toISOString().slice(0, 10);

  document.getElementById("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const expense = {
      name: document.getElementById("expName").value.trim(),
      amount: +document.getElementById("expAmount").value,
      category: document.getElementById("expCategory").value,
      type: document.getElementById("expType").value,
      date: document.getElementById("expDate").value,
      notes: document.getElementById("expNotes").value.trim(),
    };
    if (!expense.name || !expense.amount) return;

    // Smart warning for craving
    if (expense.type === "Craving") {
      const ok = confirm(`💭 This expense is marked as a craving. Are you sure you want to continue?`);
      if (!ok) return;
    }

    addExpense(expense);
    e.target.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    showToast("✅ Expense added successfully!", "success");
    renderDashboard();
  });
}

/* ----- History Filters ----- */
function setupHistoryFilters() {
  document.getElementById("searchExp").addEventListener("input", renderExpenseList);
  document.getElementById("filterCategory").addEventListener("change", renderExpenseList);
  document.getElementById("filterMonth").addEventListener("change", renderExpenseList);
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("searchExp").value = "";
    document.getElementById("filterCategory").value = "all";
    document.getElementById("filterMonth").value = "";
    renderExpenseList();
  });
}

/* ----- Render Filtered Expense List ----- */
function renderExpenseList() {
  const container = document.getElementById("expenseList");
  const search = document.getElementById("searchExp").value.toLowerCase();
  const category = document.getElementById("filterCategory").value;
  const month = document.getElementById("filterMonth").value;

  let expenses = getExpenses();
  if (search) expenses = expenses.filter((e) => e.name.toLowerCase().includes(search) || (e.notes || "").toLowerCase().includes(search));
  if (category !== "all") expenses = expenses.filter((e) => e.category === category);
  if (month) expenses = expenses.filter((e) => monthKey(e.date) === month);

  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (expenses.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p>No expenses found.</p></div>`;
    return;
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  container.innerHTML =
    `<div style="padding:0.6rem 0.9rem;background:var(--bg-elev);border-radius:10px;margin-bottom:0.6rem;font-weight:600;">
      ${expenses.length} expense(s) • Total: ${formatCurrency(total)}
    </div>` +
    expenses
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
            ${e.notes ? `<span>• 📝 ${escapeHtml(e.notes)}</span>` : ""}
          </div>
        </div>
        <div class="expense-amount">${formatCurrency(e.amount)}</div>
        <div class="expense-actions">
          <button class="action-btn" onclick="openEditModal('${e.id}')">✏️</button>
          <button class="action-btn delete" onclick="confirmDelete('${e.id}')">🗑️</button>
        </div>
      </div>`
      )
      .join("");
}

/* ----- Delete ----- */
function confirmDelete(id) {
  if (confirm("Delete this expense? This cannot be undone.")) {
    deleteExpense(id);
    showToast("🗑️ Expense deleted", "warning");
    renderExpenseList();
    renderDashboard();
  }
}

/* ----- Edit Modal ----- */
function openEditModal(id) {
  const exp = getExpenses().find((e) => e.id === id);
  if (!exp) return;
  document.getElementById("editId").value = exp.id;
  document.getElementById("editName").value = exp.name;
  document.getElementById("editAmount").value = exp.amount;
  document.getElementById("editCategory").value = exp.category;
  document.getElementById("editType").value = exp.type;
  document.getElementById("editDate").value = exp.date;
  document.getElementById("editNotes").value = exp.notes || "";
  document.getElementById("editModal").classList.add("show");
}

function setupEditForm() {
  document.getElementById("cancelEdit").addEventListener("click", () => {
    document.getElementById("editModal").classList.remove("show");
  });
  document.getElementById("editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    updateExpense(id, {
      name: document.getElementById("editName").value.trim(),
      amount: +document.getElementById("editAmount").value,
      category: document.getElementById("editCategory").value,
      type: document.getElementById("editType").value,
      date: document.getElementById("editDate").value,
      notes: document.getElementById("editNotes").value.trim(),
    });
    document.getElementById("editModal").classList.remove("show");
    showToast("✅ Expense updated", "success");
    renderExpenseList();
    renderDashboard();
  });
}

document.addEventListener("DOMContentLoaded", setupEditForm);
