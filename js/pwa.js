/* =========================================================
   pwa.js — Service worker registration, install prompt,
            update notifications, install button logic
   ========================================================= */

let deferredInstallPrompt = null;
let swRegistration = null;
let reloadAfterControllerChange = false;

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
  toast.replaceChildren(document.createTextNode("A new version of PocketPilot is available. "));
  const refreshButton = document.createElement("button");
  refreshButton.id = "refreshApp";
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh";
  refreshButton.className = "update-refresh-btn";
  toast.appendChild(refreshButton);
  toast.className = "toast show warning";
  refreshButton.addEventListener("click", () => {
    if (!swRegistration || !swRegistration.waiting) {
      window.location.reload();
      return;
    }
    reloadAfterControllerChange = true;
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
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

/* Reload only after the new worker controls the page. */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadAfterControllerChange) return;
    reloadAfterControllerChange = false;
    window.location.reload();
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  setupInstallPrompt();
});
