/* =========================================================
   expenses.js — Add, edit, delete, search, filter expenses
   ========================================================= */

function setupExpenseForm() {
  const dateInput = document.getElementById("expDate");
  dateInput.value = currentLocalDate();

  document.getElementById("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const expense = {
      name: document.getElementById("expName").value.trim(),
      amount: Number(document.getElementById("expAmount").value),
      category: document.getElementById("expCategory").value,
      type: document.getElementById("expType").value,
      date: document.getElementById("expDate").value,
      notes: document.getElementById("expNotes").value.trim(),
    };
    if (!expense.name || !Number.isFinite(expense.amount) || expense.amount <= 0 || !isValidLocalDate(expense.date)) {
      showToast("Enter a name, a positive amount, and a valid date.", "warning");
      return;
    }
    if (!VALID_CATEGORIES.includes(expense.category) || !VALID_EXPENSE_TYPES.includes(expense.type)) {
      showToast("Choose a valid category and expense type.", "warning");
      return;
    }

    if (expense.type === "Craving") {
      const ok = confirm("💭 This expense is marked as a craving. Are you sure you want to continue?");
      if (!ok) return;
    }

    const savedExpense = addExpense(expense);
    if (!savedExpense) {
      showToast("Could not save this expense. Check available browser storage and export a backup.", "danger");
      return;
    }
    e.target.reset();
    dateInput.value = currentLocalDate();
    showToast("Expense added successfully.", "success");
    renderDashboard();
  });
}

function setupHistoryFilters() {
  document.getElementById("searchExp").addEventListener("input", renderExpenseList);
  document.getElementById("filterCategory").addEventListener("change", renderExpenseList);
  document.getElementById("filterMonth").addEventListener("change", renderExpenseList);
  document.getElementById("expenseList").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-expense-edit]");
    const deleteButton = event.target.closest("[data-expense-delete]");
    if (editButton) openEditModal(editButton.dataset.expenseEdit);
    if (deleteButton) confirmDelete(deleteButton.dataset.expenseDelete);
  });
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("searchExp").value = "";
    document.getElementById("filterCategory").value = "all";
    document.getElementById("filterMonth").value = "";
    renderExpenseList();
  });
}

function renderExpenseList() {
  const container = document.getElementById("expenseList");
  const search = document.getElementById("searchExp").value.toLowerCase();
  const category = document.getElementById("filterCategory").value;
  const month = document.getElementById("filterMonth").value;

  let expenses = getExpenses();
  if (search) expenses = expenses.filter((e) => String(e.name || "").toLowerCase().includes(search) || String(e.notes || "").toLowerCase().includes(search));
  if (category !== "all") expenses = expenses.filter((e) => e.category === category);
  if (month) expenses = expenses.filter((e) => monthKey(e.date) === month);

  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (expenses.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p>No expenses found.</p></div>`;
    return;
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  container.innerHTML = `<div style="padding:0.6rem 0.9rem;background:var(--bg-elev);border-radius:10px;margin-bottom:0.6rem;font-weight:600;">${expenses.length} expense(s) • Total: ${formatCurrency(total)}</div>` +
    expenses.map((e) => `
      <div class="expense-row">
        <div class="expense-icon">${CATEGORY_ICONS[e.category] || "📦"}</div>
        <div class="expense-info">
          <div class="expense-name">${escapeHtml(e.name)}</div>
          <div class="expense-meta">
            <span>${escapeHtml(e.category)}</span><span>•</span>
            <span>${e.type === "Craving" ? "💭 Craving" : "✅ Need"}</span><span>•</span>
            <span>${new Date(`${e.date}T12:00:00`).toLocaleDateString()}</span>
            ${e.notes ? `<span>• 📝 ${escapeHtml(e.notes)}</span>` : ""}
          </div>
        </div>
        <div class="expense-amount">${formatCurrency(e.amount)}</div>
        <div class="expense-actions">
          <button class="action-btn" type="button" data-expense-edit="${escapeHtml(e.id)}" aria-label="Edit ${escapeHtml(e.name)}">✏️</button>
          <button class="action-btn delete" type="button" data-expense-delete="${escapeHtml(e.id)}" aria-label="Delete ${escapeHtml(e.name)}">🗑️</button>
        </div>
      </div>`).join("");
}

function confirmDelete(id) {
  if (confirm("Delete this expense? This cannot be undone.")) {
    deleteExpense(id);
    showToast("🗑️ Expense deleted", "warning");
    renderExpenseList();
    renderDashboard();
  }
}

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
    const amount = Number(document.getElementById("editAmount").value);
    const name = document.getElementById("editName").value.trim();
    const date = document.getElementById("editDate").value;
    const category = document.getElementById("editCategory").value;
    const type = document.getElementById("editType").value;
    if (!name || !Number.isFinite(amount) || amount <= 0 || !isValidLocalDate(date)) {
      showToast("Enter a name, a positive amount, and a valid date.", "warning");
      return;
    }
    if (!VALID_CATEGORIES.includes(category) || !VALID_EXPENSE_TYPES.includes(type)) {
      showToast("Choose a valid category and expense type.", "warning");
      return;
    }

    const id = document.getElementById("editId").value;
    const updated = updateExpense(id, {
      name, amount, category, type, date,
      notes: document.getElementById("editNotes").value.trim(),
    });
    if (!updated) {
      showToast("Could not save the changes. Your previous record was kept.", "danger");
      return;
    }
    document.getElementById("editModal").classList.remove("show");
    showToast("Expense updated.", "success");
    renderExpenseList();
    renderDashboard();
  });
}

document.addEventListener("DOMContentLoaded", setupEditForm);
