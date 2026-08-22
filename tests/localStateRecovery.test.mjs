import assert from "node:assert/strict";
import { createStore } from "../src/state/store.js";

const cases = [
  "not an object",
  [],
  {
    company: "bad",
    manualInputs: "bad",
    evaluatedCompanies: "bad",
    externalAnalyses: "bad",
    historicalRequirementSets: "bad",
    compareSelectedTickers: "bad",
    history: "bad",
    watchList: "bad",
    watchDraft: "bad"
  },
  {
    company: { ticker: null, quote: null, dataPlatform: { providers: "bad" } },
    evaluatedCompanies: { AAPL: true },
    externalReportSelection: "bad",
    valuationWorkspace: "bad"
  }
];

for (const saved of cases) {
  const storage = new Map([
    ["equityResearchV4State", JSON.stringify(saved)],
    ["equityResearchLanguage", "ar"]
  ]);
  globalThis.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };

  const store = createStore();
  assert.equal(store.state.activePanel, "home");
  assert.ok(Array.isArray(store.state.evaluatedCompanies));
  assert.ok(Array.isArray(store.state.compareSelectedTickers));
  assert.ok(Array.isArray(store.state.history));
  assert.ok(Array.isArray(store.state.watchList));
}

console.log("Local state recovery tests passed.");
