import assert from "node:assert/strict";
import test from "node:test";

const STORAGE_KEY = "equityResearchV4State";

class SharedStorage {
  constructor() {
    this.values = new Map();
  }

  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const storage = new SharedStorage();
globalThis.localStorage = storage;
const { createStore } = await import("../src/state/store.js");
const { migrateFranklinState, migrateStoredFranklinState } = await import("../src/state/migration.js");

function resetStorage() {
  storage.clear();
  storage.setItem(STORAGE_KEY, JSON.stringify({ stateSchemaVersion: 2, stateRevision: 0 }));
}

function watchItem(ticker, notes = "") {
  return { id: ticker, ticker, notes };
}

function assertConflict(action, expectedRevision, actualRevision) {
  assert.throws(action, (error) => {
    assert.equal(error.code, "FRANKLIN_STORAGE_CONFLICT");
    assert.equal(error.expectedRevision, expectedRevision);
    assert.equal(error.actualRevision, actualRevision);
    return true;
  });
}

test("Phase 6B: A then B stale save is rejected without overwriting A", () => {
  resetStorage();
  const tabA = createStore();
  const tabB = createStore();
  tabA.set({ watchList: [watchItem("AAPL", "A")] });
  const afterA = storage.getItem(STORAGE_KEY);
  assertConflict(() => tabB.set({ watchList: [watchItem("MSFT", "B")] }), 0, 1);
  assert.equal(storage.getItem(STORAGE_KEY), afterA);
  assert.equal(tabB.state.storageConflict.actualRevision, 1);
});

test("Phase 6B: B then A stale save is rejected without overwriting B", () => {
  resetStorage();
  const tabA = createStore();
  const tabB = createStore();
  tabB.set({ watchList: [watchItem("MSFT", "B")] });
  const afterB = storage.getItem(STORAGE_KEY);
  assertConflict(() => tabA.set({ watchList: [watchItem("AAPL", "A")] }), 0, 1);
  assert.equal(storage.getItem(STORAGE_KEY), afterB);
});

test("Phase 6B: same-ticker stale edits cannot silently overwrite", () => {
  resetStorage();
  const tabA = createStore();
  const tabB = createStore();
  tabA.set({ watchList: [watchItem("NVDA", "first edit")] });
  assertConflict(() => tabB.set({ watchList: [watchItem("NVDA", "stale edit")] }), 0, 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).watchList[0].notes, "first edit");
});

test("Phase 6B: different-ticker concurrent writes require refresh and retry", () => {
  resetStorage();
  const tabA = createStore();
  const tabB = createStore();
  tabA.set({ watchList: [watchItem("AAPL")] });
  assertConflict(() => tabB.set({ watchList: [watchItem("MSFT")] }), 0, 1);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)).watchList.map((item) => item.ticker), ["AAPL"]);
});

test("Phase 6B: refreshed tab loads the external write and current revision", () => {
  resetStorage();
  const tabA = createStore();
  tabA.set({ watchList: [watchItem("AAPL")] });
  const refreshedTab = createStore();
  assert.equal(refreshedTab.state.stateRevision, 1);
  assert.equal(refreshedTab.state.watchList[0].ticker, "AAPL");
  refreshedTab.set({ watchList: [watchItem("MSFT"), ...refreshedTab.state.watchList] });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).stateRevision, 2);
});

test("Phase 6C-R: normal saves retain migration identity and do not create boot backups", () => {
  storage.clear();
  const migrated = migrateFranklinState({ stateSchemaVersion: 2, stateRevision: 0 }).state;
  storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  const store = createStore();
  store.set({ watchList: [watchItem("NVDA")] });

  const beforeKeys = [...storage.values.keys()];
  const reboot = migrateStoredFranklinState(storage, STORAGE_KEY, { now: new Date("2026-09-06T00:00:00.000Z") });
  const afterKeys = [...storage.values.keys()];

  assert.equal(reboot.changed, false);
  assert.equal(reboot.backupKey, null);
  assert.deepEqual(afterKeys, beforeKeys);
});
