import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { mergeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementMerge.js";
import { createStore } from "../src/state/store.js";

test("supplement persistence failure rolls storage and in-memory analysis back atomically", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const storage = fakeStorage();
  globalThis.localStorage = storage;
  globalThis.window = { sessionStorage: fakeStorage(), location: { reload() {} } };
  try {
    const raw = readFileSync(new URL("./fixtures/franklin-import-valid.json", import.meta.url), "utf8");
    const parsed = await parseExternalAnalysisInput(raw, { now: new Date("2026-08-28T12:00:00.000Z") });
    const report = { ...parsed.report, id: "TEST-SAVED", scores: { ...parsed.report.scores, risk: null } };
    const supplement = {
      schemaVersion: "external-analysis-supplement/v1",
      ticker: "TEST",
      targetAnalysisId: "TEST-SAVED",
      fields: { "scores.risk": 0 },
      notes: [],
      sources: []
    };
    const mergePreview = mergeExternalAnalysisSupplement(report, supplement, { now: new Date("2026-08-28T12:01:00.000Z") });
    assert.equal(mergePreview.report.scores.risk, 0);

    const store = createStore();
    store.set({
      externalAnalyses: { TEST: [report] },
      externalReportSelection: { ticker: "TEST", reportId: "TEST-SAVED" },
      externalImport: {
        draftReport: report,
        draftJson: JSON.stringify(report),
        editing: true,
        requirementMatch: { status: "none", candidates: [] },
        supplement: {
          open: true,
          parsedSupplement: supplement,
          validation: { valid: true, errors: [], warnings: [] },
          mergePreview,
          conflicts: [],
          stage: "preview"
        }
      }
    });
    const persistedBefore = storage.getItem("equityResearchV4State");
    storage.failNextWriteTo("equityResearchV4State");

    store.applyExternalSupplement();

    assert.equal(store.state.externalAnalyses.TEST[0].scores.risk, null);
    assert.equal(storage.getItem("equityResearchV4State"), persistedBefore);
    assert.equal(store.state.externalImport.supplement.stage, "persistence-error");
    assert.match(store.state.notice, /فشل التخزين الدائم/u);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  let failingKey = null;
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] || null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (key === failingKey) {
        failingKey = null;
        throw new Error("simulated quota failure");
      }
      data.set(key, String(value));
    },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); },
    failNextWriteTo(key) { failingKey = key; }
  };
}
