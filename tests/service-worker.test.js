const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadServiceWorker(cacheNames) {
  const handlers = {};
  const deleted = [];
  const cacheStore = new Map();
  let skipWaitingCalls = 0;
  const caches = {
    async keys() { return [...cacheNames]; },
    async delete(name) { deleted.push(name); return true; },
    async open(name) {
      if (!cacheStore.has(name)) {
        cacheStore.set(name, {
          async add() {},
          async match() { return undefined; },
          async put() {},
        });
      }
      return cacheStore.get(name);
    },
  };
  const self = {
    addEventListener(type, callback) { handlers[type] = callback; },
    skipWaiting() { skipWaitingCalls += 1; return Promise.resolve(); },
    clients: { claim: () => Promise.resolve() },
    location: { origin: "https://example.github.io" },
    registration: { scope: "https://example.github.io/StudentBudgetTracker/" },
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
  vm.runInNewContext(source, { self, caches, URL, fetch: async () => ({ ok: true, clone() { return this; } }), Promise, console });
  return { handlers, deleted, getSkipWaitingCalls: () => skipWaitingCalls };
}

test("service worker activation deletes only this app's old caches", async () => {
  const { handlers, deleted } = loadServiceWorker([
    "pocketpilot-studentbudgettracker-v2.2.0-static",
    "pocketpilot-studentbudgettracker-v2.2.0-runtime",
    "pocketpilot-studentbudgettracker-v2.3.0-static",
    "pocketpilot-studentbudgettracker-v2.3.0-runtime",
    "another-app-static",
    "other-pwa-runtime",
  ]);

  let activation;
  handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;

  assert.deepEqual(deleted.sort(), [
    "pocketpilot-studentbudgettracker-v2.2.0-runtime",
    "pocketpilot-studentbudgettracker-v2.2.0-static",
  ]);
});

test("service worker does not force-activate an update before user approval", async () => {
  const { handlers, getSkipWaitingCalls } = loadServiceWorker([]);
  let installPromise;
  handlers.install({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;
  assert.equal(getSkipWaitingCalls(), 0);
});
