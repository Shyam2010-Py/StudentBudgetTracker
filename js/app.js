/* =========================================================
   app.js — Core app: navigation, theme, onboarding, init
   ========================================================= */

const CATEGORIES = ["Food", "College", "Printouts", "Transport", "Shopping", "Emergency", "Other"];
const CATEGORY_ICONS = {
  Food: "🍔", College: "🎓", Printouts: "📄", Transport: "🚌",
  Shopping: "🛍️", Emergency: "🚨", Other: "📦",
};

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show " + type;
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function navigateTo(sectionId) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  const section = document.getElementById(sectionId);
  if (section) section.classList.add("active");
  const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (navItem) navItem.classList.add("active");

  if (sectionId === "dashboard") renderDashboard();
  if (sectionId === "history") renderExpenseList();
  if (sectionId === "analytics") renderAnalytics();
  if (sectionId === "goals") renderGoals();
  if (sectionId === "report") renderReport();
  if (sectionId === "settings") loadSettingsForm();

  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");
}

function setupSidebar() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });
}

function setupTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.addEventListener("click", () => {
    const current = getTheme();
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    btn.textContent = next === "dark" ? "☀️" : "🌙";
    showToast(`${next === "dark" ? "🌙 Dark" : "☀️ Light"} mode enabled`, "success");
  });
}

function setupOnboarding() {
  const modal = document.getElementById("onboardingModal");
  if (!isOnboarded()) modal.classList.add("show");

  document.getElementById("onboardingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const settings = {
      allowance: Math.max(0, +document.getElementById("setupAllowance").value),
      savingsGoal: Math.max(0, +document.getElementById("setupSavings").value),
      collegeBudget: Math.max(0, +document.getElementById("setupCollege").value),
      printoutBudget: Math.max(0, +document.getElementById("setupPrintout").value),
      foodBudget: Math.max(0, +document.getElementById("setupFood").value),
      emergencyBudget: Math.max(0, +document.getElementById("setupEmergency").value || 0),
    };
    const allocated = settings.collegeBudget + settings.printoutBudget + settings.foodBudget + settings.emergencyBudget;
    saveSettings(settings);
    setOnboarded();
    modal.classList.remove("show");
    if (allocated > settings.allowance && settings.allowance > 0) {
      showToast(`⚠️ Category budgets exceed allowance by ${formatCurrency(allocated - settings.allowance)}.`, "warning");
    } else {
      showToast("Welcome! Your tracker is ready 🎉", "success");
    }
    renderDashboard();
  });
}

function updateGreeting() {
  const hour = new Date().getHours();
  let g = "Welcome";
  if (hour < 12) g = "Good morning";
  else if (hour < 18) g = "Good afternoon";
  else g = "Good evening";
  document.getElementById("dashGreeting").textContent = `${g}! Here's your money overview.`;
}

function updateProductIdentity() {
  const brand = document.querySelector(".brand-name");
  const footer = document.querySelector(".sidebar-footer p");
  if (brand) brand.textContent = "PocketPilot";
  if (footer) footer.textContent = `v${APP_VERSION}`;
}

function init() {
  updateProductIdentity();
  setupTheme();
  setupSidebar();
  setupOnboarding();
  updateGreeting();
  setupExpenseForm();
  setupHistoryFilters();
  setupGoalForm();
  setupSettings();
  setupReportExport();
  if (isOnboarded()) renderDashboard();
}

document.addEventListener("DOMContentLoaded", init);
