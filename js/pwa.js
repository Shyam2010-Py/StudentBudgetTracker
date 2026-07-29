/* =========================================================
   pwa.js — Service worker registration, install prompt,
            update notifications, install button logic
   ========================================================= */

let deferredInstallPrompt = null;
let swRegistration = null;

/* ---------- Register Service Worker ---------- */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser.");
    return;
  }
  window.addEventListener("load", async () => {
    try {
      swRegistration = await navigator.serviceWorker.register("./service-worker.js");
      console.log("✅ Service Worker registered:", swRegistration.scope);

      // Listen for new SW waiting → show update toast
      swRegistration.addEventListener("updatefound", () => {
        const newWorker = swRegistration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });

      // Also check on every page load
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) showUpdateToast();
      });
    } catch (err) {
      console.error("SW registration failed:", err);
    }
  });
}

/* ---------- Update Toast ---------- */
function showUpdateToast() {
  // Use the existing toast element but with a "Refresh" action
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerHTML = `🔄 A new version of PocketPilot is available.
    <button id="refreshApp" style="margin-left:0.5rem;background:#fff;color:#6366f1;border:none;padding:0.3rem 0.7rem;border-radius:6px;font-weight:600;cursor:pointer;">Refresh</button>`;
  toast.className = "toast show warning";
  document.getElementById("refreshApp").addEventListener("click", () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  });
}

/* ---------- Install Prompt ---------- */
function setupInstallPrompt() {
  // Detect already-installed (standalone display mode)
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const installBtn = document.getElementById("installBtn");
  if (!installBtn) return;

  if (isStandalone) {
    installBtn.style.display = "none";
    return;
  }

  // Capture the install prompt event
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.style.display = "inline-flex";
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      // Browser didn't fire the event → guide user manually
      showManualInstallHelp();
      return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      showToast("🎉 Installing PocketPilot...", "success");
    }
    deferredInstallPrompt = null;
    installBtn.style.display = "none";
  });

  // Hide button once installed
  window.addEventListener("appinstalled", () => {
    installBtn.style.display = "none";
    deferredInstallPrompt = null;
    showToast("✅ PocketPilot installed successfully!", "success");
  });
}

function showManualInstallHelp() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const msg = isIOS
    ? "To install: tap the Share button, then 'Add to Home Screen'."
    : "To install: click the browser menu (⋮) → 'Install PocketPilot'.";
  showToast(msg, "warning");
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  setupInstallPrompt();
});
