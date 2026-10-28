/* =========================================================
   cloud-sync.js — Supabase Auth + offline-first state sync
   Only a publishable key is used in the browser. Database RLS
   and the authenticated session enforce per-user access.
   ========================================================= */

(function () {
  "use strict";

  const PENDING_KEY = "sbt_cloud_sync_pending";
  const SYNC_DEBOUNCE_MS = 900;
  let client = null;
  let currentUser = null;
  let cloudSyncEnabled = false;
  let applyingCloudState = false;
  let syncTimer = null;
  let syncInFlight = null;
  let cloudRevision = 0;
  let initializedUserId = null;
  let authMode = "sign-in";
  let authSubscription = null;

  function isConfigured() {
    const config = window.POCKETPILOT_SUPABASE_CONFIG || {};
    return Boolean(
      window.supabase &&
      typeof window.supabase.createClient === "function" &&
      typeof config.url === "string" &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url) &&
      typeof config.publishableKey === "string" &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)
    );
  }

  function setStatus(message, state) {
    const status = document.getElementById("cloudStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state || "neutral";
  }

  function setButtonState() {
    const accountButton = document.getElementById("cloudAccountBtn");
    const syncButton = document.getElementById("cloudSyncBtn");
    const email = document.getElementById("cloudEmail");
    if (accountButton) accountButton.textContent = currentUser ? "Sign out" : "Connect account";
    if (syncButton) syncButton.hidden = !currentUser;
    if (email) {
      email.textContent = currentUser ? currentUser.email || "Signed in" : "";
      email.hidden = !currentUser;
    }
  }

  function showAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.add("show");
    renderAuthMode();
    const email = document.getElementById("authEmail");
    if (email && currentUser && currentUser.email) email.value = currentUser.email;
  }

  function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.remove("show");
    const form = document.getElementById("authForm");
    if (form) form.reset();
    authMode = "sign-in";
    renderAuthMode();
  }

  function renderAuthMode() {
    const title = document.getElementById("authTitle");
    const submit = document.getElementById("authSubmit");
    const toggle = document.getElementById("authModeToggle");
    const recovery = document.getElementById("authRecovery");
    const passwordGroup = document.getElementById("authPassword");
    const passwordInput = document.getElementById("authPasswordInput");
    const note = document.getElementById("authNote");
    if (!title || !submit || !toggle || !recovery || !passwordGroup || !passwordInput || !note) return;

    const modes = {
      "sign-in": ["Sign in to PocketPilot", "Sign in", "New here? Create an account", "Sign in to sync your budget securely across devices."],
      "sign-up": ["Create your PocketPilot account", "Create account", "Already have an account? Sign in", "Use an email address you can access; email confirmation may be required."],
      recover: ["Reset your password", "Send reset link", "Back to sign in", "We will email a password-reset link if the account exists."],
      "update-password": ["Choose a new password", "Update password", " ", "Use at least 8 characters."],
    };
    const selected = modes[authMode] || modes["sign-in"];
    title.textContent = selected[0];
    submit.textContent = selected[1];
    toggle.textContent = selected[2];
    note.textContent = selected[3];
    passwordGroup.hidden = authMode === "recover";
    passwordInput.required = authMode !== "recover";
    passwordInput.autocomplete = authMode === "update-password" ? "new-password" : "current-password";
    recovery.hidden = authMode !== "sign-in";
    toggle.hidden = authMode === "recover" || authMode === "update-password";
  }

  function setAuthMessage(message, isError) {
    const node = document.getElementById("authMessage");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.state = isError ? "error" : "success";
  }

  function readLocalState() {
    return {
      settings: getSettings(),
      expenses: getExpenses(),
      goals: getGoals(),
    };
  }

  function hasLocalBudgetData(state) {
    const settings = state && state.settings ? state.settings : {};
    return Number(settings.allowance) > 0 ||
      Number(settings.savingsGoal) > 0 ||
      Number(settings.collegeBudget) > 0 ||
      Number(settings.printoutBudget) > 0 ||
      Number(settings.foodBudget) > 0 ||
      Number(settings.emergencyBudget) > 0 ||
      Boolean(state && state.expenses && state.expenses.length) ||
      Boolean(state && state.goals && state.goals.length);
  }

  function validState(state) {
    return state && validateBackup({
      settings: state.settings,
      expenses: state.expenses,
      goals: state.goals,
    });
  }

  function mergeById(remoteItems, localItems, mergeItem) {
    const merged = new Map();
    const keyFor = (item) => item && item.id != null
      ? String(item.id)
      : "legacy:" + JSON.stringify(item);
    (Array.isArray(remoteItems) ? remoteItems : []).forEach((item) => {
      if (item) merged.set(keyFor(item), item);
    });
    (Array.isArray(localItems) ? localItems : []).forEach((item) => {
      if (!item) return;
      const key = keyFor(item);
      const previous = merged.get(key);
      merged.set(key, previous && mergeItem ? mergeItem(previous, item) : item);
    });
    return Array.from(merged.values());
  }

  function mergeGoals(remoteGoals, localGoals) {
    return mergeById(remoteGoals, localGoals, (remote, local) => {
      const contributions = new Map();
      (remote.contributions || []).concat(local.contributions || []).forEach((entry, index) => {
        if (!entry || !entry.date || !Number.isFinite(Number(entry.amount))) return;
        const key = entry.id != null
          ? "id:" + String(entry.id)
          : "legacy:" + String(entry.date) + "|" + Number(entry.amount) + "|" + index;
        if (!contributions.has(key) || !entry.legacy) contributions.set(key, entry);
      });
      return {
        ...remote,
        ...local,
        contributions: Array.from(contributions.values()),
      };
    });
  }

  function mergeStates(remote, local) {
    const safeRemote = validState(remote) ? remote : { settings: getSettings(), expenses: [], goals: [] };
    const safeLocal = validState(local) ? local : { settings: getSettings(), expenses: [], goals: [] };
    return {
      settings: safeLocal.settings,
      expenses: mergeById(safeRemote.expenses, safeLocal.expenses),
      goals: mergeGoals(safeRemote.goals, safeLocal.goals),
    };
  }

  function applyStateToLocal(state) {
    if (!validState(state)) throw new Error("The cloud account contains an invalid or unsupported backup.");
    applyingCloudState = true;
    try {
      // Reuse the backup import's snapshot/rollback logic so a quota error
      // cannot leave settings updated while expenses or goals remain stale.
      importAll({ settings: state.settings, expenses: state.expenses, goals: state.goals });
      if (Number(state.settings.allowance) > 0 || state.expenses.length || state.goals.length) {
        setOnboarded();
      }
    } finally {
      applyingCloudState = false;
    }
    renderLocalApp();
  }

  function renderLocalApp() {
    if (typeof renderDashboard === "function" && isOnboarded()) renderDashboard();
    if (typeof renderExpenseList === "function") renderExpenseList();
    if (typeof renderGoals === "function") renderGoals();
    if (typeof renderAnalytics === "function") renderAnalytics();
    if (typeof loadSettingsForm === "function") loadSettingsForm();
  }

  function setPending(value) {
    try {
      if (value) localStorage.setItem(PENDING_KEY, "1");
      else localStorage.removeItem(PENDING_KEY);
    } catch (error) {
      console.warn("Could not update the cloud-sync marker:", error);
    }
  }

  async function fetchCloudState() {
    if (!client || !currentUser) throw new Error("Sign in before loading cloud data.");
    const { data, error } = await client
      .from("user_state")
      .select("user_id, settings, expenses, goals, schema_version, revision, updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.schema_version !== 1 || !validState(data)) {
      throw new Error("Cloud data is incompatible with this app version. Local data was not replaced.");
    }
    return data;
  }

  async function persistState(state, expectedRevision) {
    if (!client || !currentUser) throw new Error("Sign in before saving cloud data.");
    if (!validState(state)) throw new Error("Local data failed validation; cloud sync was stopped.");
    const { data, error } = await client.rpc("save_pocketpilot_state", {
      p_settings: state.settings,
      p_expenses: state.expenses,
      p_goals: state.goals,
      p_expected_revision: expectedRevision,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || !Number.isFinite(Number(result.revision))) {
      throw new Error("Cloud save returned an unexpected response.");
    }
    cloudRevision = Number(result.revision);
    setPending(false);
    setStatus("Cloud data is up to date", "success");
    return result;
  }

  async function bootstrapUserState() {
    if (!currentUser || !client || !navigator.onLine) {
      setStatus("Offline — changes stay on this device until connected", "pending");
      setPending(true);
      return;
    }
    if (initializedUserId === currentUser.id && cloudSyncEnabled) return;
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      setStatus("Checking cloud data…", "pending");
      const remote = await fetchCloudState();
      const local = readLocalState();
      const hasLocal = hasLocalBudgetData(local);

      if (remote) {
        cloudRevision = Number(remote.revision) || 1;
        if (hasLocal) {
          const merge = window.confirm(
            "This browser already has budget data. Choose OK to merge its records into your signed-in cloud account (local settings take priority), or Cancel to replace this browser's budget data with the cloud copy."
          );
          if (merge) {
            const merged = mergeStates(remote, local);
            applyStateToLocal(merged);
            await persistState(merged, cloudRevision);
          } else {
            applyStateToLocal(remote);
          }
        } else {
          applyStateToLocal(remote);
        }
      } else {
        cloudRevision = 0;
        if (hasLocal) {
          const upload = window.confirm(
            "Upload this browser's existing budget data to your new cloud account? Choose Cancel to keep it local-only for now."
          );
          if (!upload) {
            cloudSyncEnabled = false;
            initializedUserId = null;
            setStatus("Signed in — cloud sync paused until you choose Sync now", "pending");
            setButtonState();
            return;
          }
          await persistState(local, 0);
        } else {
          await persistState(local, 0);
        }
      }

      cloudSyncEnabled = true;
      initializedUserId = currentUser.id;
      setPending(false);
      setStatus(navigator.onLine ? "Cloud data is up to date" : "Offline — changes will sync when online", navigator.onLine ? "success" : "pending");
      setButtonState();
    })();

    try {
      await syncInFlight;
    } catch (error) {
      console.error("PocketPilot cloud bootstrap failed:", error);
      setStatus("Cloud sync unavailable — local data is preserved", "error");
      setPending(true);
      if (typeof showToast === "function") showToast("Cloud sync failed. Your local data is still available.", "warning");
    } finally {
      syncInFlight = null;
    }
  }

  async function flushCloudSync() {
    if (!currentUser || !cloudSyncEnabled || !client || applyingCloudState) return;
    if (!navigator.onLine) {
      setPending(true);
      setStatus("Offline — changes queued on this device", "pending");
      return;
    }
    if (syncInFlight) {
      setPending(true);
      window.setTimeout(() => flushCloudSync(), SYNC_DEBOUNCE_MS);
      return;
    }
    const state = readLocalState();
    try {
      setStatus("Syncing changes…", "pending");
      await persistState(state, cloudRevision);
    } catch (error) {
      console.warn("PocketPilot cloud sync failed:", error);
      if (String(error.code || "") === "40001" || /changed elsewhere|conflict/i.test(error.message || "")) {
        try {
          const remote = await fetchCloudState();
          if (!remote) throw error;
          cloudRevision = Number(remote.revision) || 1;
          const merged = mergeStates(remote, state);
          applyStateToLocal(merged);
          await persistState(merged, cloudRevision);
          setStatus("Cloud changes merged", "success");
          return;
        } catch (mergeError) {
          console.error("Cloud conflict merge failed:", mergeError);
        }
      }
      setPending(true);
      setStatus("Sync pending — local changes are safe on this device", "pending");
    }
  }

  function queueCloudSync() {
    if (applyingCloudState || !currentUser || !cloudSyncEnabled) return;
    setPending(true);
    if (!navigator.onLine) {
      setStatus("Offline — changes queued on this device", "pending");
      return;
    }
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      flushCloudSync();
    }, SYNC_DEBOUNCE_MS);
  }

  function onSessionChanged(event, session) {
    currentUser = session && session.user ? session.user : null;
    if (!currentUser) {
      cloudSyncEnabled = false;
      initializedUserId = null;
      cloudRevision = 0;
      setStatus(isConfigured() ? "Not signed in — using local storage" : "Cloud sync not configured", isConfigured() ? "neutral" : "error");
      setButtonState();
      return;
    }
    setButtonState();
    if (event === "PASSWORD_RECOVERY") {
      authMode = "update-password";
      showAuthModal();
    }
    if (navigator.onLine) bootstrapUserState();
    else {
      setPending(true);
      setStatus("Offline — local mode active; sign in sync will resume online", "pending");
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!client) {
      setAuthMessage("Cloud sync is not configured. Add the Supabase URL and publishable key first.", true);
      return;
    }
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPasswordInput").value;
    const submit = document.getElementById("authSubmit");
    submit.disabled = true;
    setAuthMessage("Working…", false);
    try {
      if (authMode === "sign-up") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.href.split("#")[0],
          },
        });
        if (error) throw error;
        if (data.session) {
          closeAuthModal();
          setAuthMessage("", false);
          if (typeof showToast === "function") showToast("Account created and signed in.", "success");
        } else {
          setAuthMessage("Check your email to confirm the account, then sign in.", false);
        }
      } else if (authMode === "sign-in") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        closeAuthModal();
        if (typeof showToast === "function") showToast("Signed in. Checking cloud data…", "success");
      } else if (authMode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.href.split("#")[0],
        });
        if (error) throw error;
        setAuthMessage("If that account exists, a password-reset email has been sent.", false);
      } else if (authMode === "update-password") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        closeAuthModal();
        if (typeof showToast === "function") showToast("Password updated.", "success");
      }
    } catch (error) {
      setAuthMessage(error && error.message ? error.message : "Authentication failed. Try again.", true);
    } finally {
      submit.disabled = false;
    }
  }

  function setupAuthUi() {
    const form = document.getElementById("authForm");
    const accountButton = document.getElementById("cloudAccountBtn");
    const syncButton = document.getElementById("cloudSyncBtn");
    const closeButton = document.getElementById("authCancel");
    const toggleButton = document.getElementById("authModeToggle");
    const recoveryButton = document.getElementById("authRecovery");
    const modal = document.getElementById("authModal");

    if (form) form.addEventListener("submit", submitAuth);
    if (accountButton) accountButton.addEventListener("click", () => {
      if (currentUser) {
        client.auth.signOut().then(({ error }) => {
          if (error) throw error;
          setStatus("Signed out — local data remains on this device", "neutral");
          if (typeof showToast === "function") showToast("Signed out. Local data was kept.", "success");
        }).catch((error) => {
          console.error("Sign out failed:", error);
          if (typeof showToast === "function") showToast("Could not sign out. Try again.", "danger");
        });
      } else {
        showAuthModal();
      }
    });
    if (syncButton) syncButton.addEventListener("click", () => {
      if (!currentUser) return showAuthModal();
      if (!cloudSyncEnabled) return bootstrapUserState();
      flushCloudSync().then(() => {
        if (typeof showToast === "function") showToast("Sync check completed. See the cloud status for details.", "success");
      });
    });
    if (closeButton) closeButton.addEventListener("click", closeAuthModal);
    if (toggleButton) toggleButton.addEventListener("click", () => {
      authMode = authMode === "sign-up" ? "sign-in" : "sign-up";
      setAuthMessage("", false);
      renderAuthMode();
    });
    if (recoveryButton) recoveryButton.addEventListener("click", () => {
      authMode = "recover";
      setAuthMessage("", false);
      renderAuthMode();
    });
    if (modal) modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAuthModal();
    });
    setButtonState();
  }

  function initializeCloudSync() {
    setupAuthUi();
    if (!isConfigured()) {
      setStatus("Cloud sync not configured — offline/local mode works", "neutral");
      return;
    }
    try {
      const config = window.POCKETPILOT_SUPABASE_CONFIG;
      client = window.supabase.createClient(config.url.replace(/\/$/, ""), config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // Keep the callback synchronous; network work runs after the auth event returns.
        window.setTimeout(() => onSessionChanged(event, session), 0);
      });
      authSubscription = data && data.subscription ? data.subscription : null;
      client.auth.getSession().then(({ data: sessionData, error }) => {
        if (error) throw error;
        onSessionChanged("INITIAL_SESSION", sessionData.session);
      }).catch((error) => {
        console.warn("Could not restore the Supabase session:", error);
        setStatus("Could not restore cloud session — local data is available", "pending");
      });
    } catch (error) {
      console.error("Supabase client initialization failed:", error);
      setStatus("Supabase configuration is invalid — local mode remains available", "error");
    }

    window.addEventListener("online", () => {
      if (!currentUser) return;
      if (!cloudSyncEnabled) bootstrapUserState();
      else flushCloudSync();
    });
    window.addEventListener("offline", () => {
      if (currentUser) {
        setPending(true);
        setStatus("Offline — changes queued on this device", "pending");
      }
    });
  }

  window.initializeCloudSync = initializeCloudSync;
  window.queueCloudSync = queueCloudSync;
  window.PocketPilotCloudInternals = Object.freeze({
    hasLocalBudgetData,
    mergeById,
    mergeGoals,
    mergeStates,
    validState,
  });
})();
