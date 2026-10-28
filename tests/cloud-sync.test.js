const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCloudHelpers() {
  const window = { POCKETPILOT_SUPABASE_CONFIG: {}, setTimeout, clearTimeout };
  const context = vm.createContext({
    window,
    document: { getElementById: () => null },
    navigator: { onLine: true },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    setTimeout,
    clearTimeout,
    validateBackup(data) {
      return Boolean(data && data.settings && Array.isArray(data.expenses) && Array.isArray(data.goals));
    },
    getSettings: () => ({}),
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "cloud-sync.js"), "utf8");
  vm.runInContext(source, context);
  return window.PocketPilotCloudInternals;
}

test("merges expenses by stable ID with local records taking priority", () => {
  const api = loadCloudHelpers();
  const result = api.mergeById(
    [{ id: "same", name: "Cloud version" }, { id: "cloud-only" }],
    [{ id: "same", name: "Local version" }, { id: "local-only" }]
  );
  assert.equal(result.length, 3);
  assert.equal(result.find((item) => item.id === "same").name, "Local version");
  assert.ok(result.some((item) => item.id === "cloud-only"));
  assert.ok(result.some((item) => item.id === "local-only"));
});

test("merges goal contributions without duplicating identical dated entries", () => {
  const api = loadCloudHelpers();
  const result = api.mergeGoals(
    [{ id: "goal-1", name: "Cloud", target: 100, contributions: [{ id: "c1", amount: 10, date: "2026-10-01" }] }],
    [{ id: "goal-1", name: "Local", target: 120, contributions: [{ id: "c1", amount: 10, date: "2026-10-01" }, { id: "c2", amount: 5, date: "2026-10-02" }] }]
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Local");
  assert.equal(result[0].target, 120);
  assert.equal(result[0].contributions.length, 2);
});

test("migration enforces per-user RLS and optimistic revision checks", () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261028000100_pocketpilot_cloud_sync.sql"), "utf8");
  assert.match(sql, /alter table public\.user_state enable row level security/i);
  assert.match(sql, /auth\.uid\(\)\) = user_id/i);
  assert.match(sql, /p_expected_revision bigint/i);
  assert.match(sql, /using errcode = '40001'/i);
  assert.match(sql, /revoke all on table public\.user_state from public, anon, authenticated/i);
  assert.match(sql, /security definer/i);
  assert.doesNotMatch(sql, /service_role|supabase_secret_[a-z0-9]+/i);
});

test("browser configuration accepts real public project values but never a server secret", () => {
  const config = fs.readFileSync(path.join(__dirname, "..", "js", "supabase-config.js"), "utf8");
  assert.match(config, /url:\s*"https:\/\/[a-z0-9-]+\.supabase\.co"/i);
  assert.match(config, /publishableKey:\s*"(?:sb_publishable_[A-Za-z0-9_-]+|)"/);
  assert.doesNotMatch(config, /service_role\s*[:=]|sb_secret_[A-Za-z0-9]/i);
});
