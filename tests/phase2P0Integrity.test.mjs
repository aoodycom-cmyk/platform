import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateAnalystBrainOutput } from "../src/analystBrain/schemaValidator.js";
import { buildEvaluatedCompany } from "../src/domain/evaluatedCompanies.js";
import { CAGR } from "../src/domain/financialMetrics.js";
import { mergeInvestmentDataBackup } from "../src/externalAnalysis/backup.js";
import { createStore } from "../src/state/store.js";
import { migrateStoredFranklinState, shouldBlockCloudPush } from "../src/state/migration.js";
import { createValuationWorkspace, runInvestmentAnalystBrainValuation } from "../src/valuationWorkflow/workflow.js";

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
    entries() { return [...values.entries()]; }
  };
}

function report(id, ticker = "TEST") {
  return { id, company: { ticker }, analysisDate: "2026-09-06" };
}

function profitableAnalystReport() {
  const workspace = createValuationWorkspace({
    ticker: "P0DCF",
    name: "P0 DCF Test",
    quote: { price: 100 }
  });
  const result = runInvestmentAnalystBrainValuation(workspace, { text: `
Ticker: P0DCF
Company Name: P0 DCF Test
Current Price: 100
Market Capitalization: 10000000000
Cash: 1000000000
Total Debt: 400000000
Revenue: 1200000000
Operating Income: 260000000
EBITDA: 310000000
Net Income: 210000000
EPS: 2.1
Free Cash Flow: 200000000
Diluted Shares Outstanding: 100000000
Business Model: subscription software
` });
  assert.equal(result.error, undefined);
  return result.report;
}

test("P0 corrupt local state is preserved before migration aborts", () => {
  const raw = '{"externalAnalyses":';
  const storage = fakeStorage({ equityResearchV4State: raw });
  assert.throws(
    () => migrateStoredFranklinState(storage, "equityResearchV4State", { now: new Date("2026-09-06T00:00:00.000Z") }),
    /invalid/i
  );
  assert.equal(storage.getItem("equityResearchV4State"), raw);
  const corruptBackups = storage.entries().filter(([key]) => key.startsWith("franklinCorruptStateBackupV1:"));
  assert.deepEqual(corruptBackups, [["franklinCorruptStateBackupV1:2026-09-06T00:00:00.000Z", raw]]);
});

test("P0 CAGR rejects incomplete and nonpositive periods instead of compressing time", () => {
  assert.ok(Math.abs(CAGR([121, 110, 100]) - 0.1) < 1e-12);
  for (const values of [[121, null, 100], [121, undefined, 100], [121, 0, 100], [121, -1, 100], [121, Number.NaN, 100]]) {
    assert.equal(CAGR(values), null, `Expected invalid CAGR for ${String(values)}`);
  }
});

test("P0 cloud push guard blocks reductions in every durable dataset", () => {
  const local = { externalAnalyses: { TEST: [report("r1")] } };
  const remote = {
    externalAnalyses: { TEST: [report("r1", "TEST")] },
    historicalRequirementSets: { TEST: [{ id: "req-1" }] },
    quarterlyEarningsHistory: { TEST: [{ quarterKey: "2026-Q2", status: "REPORTED", sources: [{ url: "https://example.com/q2" }] }] },
    evaluatedCompanies: [{ id: "TEST", ticker: "TEST" }]
  };
  const result = shouldBlockCloudPush(local, remote);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "REMOTE_DATASET_REDUCTION_REQUIRES_CONFIRMATION");
  assert.deepEqual(result.reducedDatasets.sort(), [
    "evaluatedCompanyCount",
    "historicalRequirementSetCount",
    "quarterlyHistoryCount",
    "quarterlySourceCount"
  ]);
});

test("P0 backup merge rejects same-key conflicts while deduplicating identical data", () => {
  const current = {
    externalAnalyses: { TEST: [{ ...report("r1"), thesis: "original" }] },
    quarterlyEarningsHistory: { TEST: [{ quarterKey: "2026-Q2", revenue: 10 }] }
  };
  const identical = mergeInvestmentDataBackup(current, { data: structuredClone(current) });
  assert.equal(identical.externalAnalyses.TEST.length, 1);
  assert.equal(identical.quarterlyEarningsHistory.TEST.length, 1);

  for (const incoming of [
    { externalAnalyses: { TEST: [{ ...report("r1"), thesis: "conflict" }] } },
    { quarterlyEarningsHistory: { TEST: [{ quarterKey: "2026-Q2", revenue: 99 }] } }
  ]) {
    assert.throws(
      () => mergeInvestmentDataBackup(current, { data: incoming }),
      (error) => error?.code === "BACKUP_CONFLICT" && Array.isArray(error.conflicts) && error.conflicts.length > 0
    );
  }
});

test("P0 DCF validation rejects incomplete or unsafe assumptions", () => {
  const valid = profitableAnalystReport();
  const dcfIndex = valid.modelSelection.selectedModels.findIndex((model) => model.method === "DCF");
  assert.ok(dcfIndex >= 0);
  const mutations = [
    (a) => { a.forecast = []; },
    (a) => { a.forecast[0].freeCashFlow = null; },
    (a) => { a.forecast[0].year = 0; },
    (a) => { a.wacc = a.terminalGrowth; },
    (a) => { a.shares = 0; },
    (a) => { a.cash = Number.NaN; },
    (a) => { a.debt = -1; }
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(valid);
    mutate(candidate.modelSelection.selectedModels[dcfIndex].assumptions);
    assert.equal(validateAnalystBrainOutput(candidate).valid, false);
  }
});

test("P0 audit snapshots remain isolated and read-only", () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const raw = JSON.stringify({ language: "en", history: [{ id: "owner-history" }] });
  const local = fakeStorage({ equityResearchV4State: raw, equityResearchLanguage: "en" });
  globalThis.localStorage = local;
  globalThis.sessionStorage = fakeStorage();
  try {
    const store = createStore({ initialState: { language: "en", history: [{ id: "audit-history" }] }, readOnly: true });
    assert.equal(store.state.history[0].id, "audit-history");
    assert.throws(() => store.set({ notice: "mutation" }), (error) => error?.code === "FRANKLIN_READ_ONLY");
    assert.equal(local.getItem("equityResearchV4State"), raw);
  } finally {
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test("P0 persisted user histories are never silently capped", async () => {
  const previous = {
    ticker: "HIST",
    history: Array.from({ length: 45 }, (_, index) => ({ id: `history-${index}` }))
  };
  const next = buildEvaluatedCompany({
    company: { ticker: "HIST", name: "History Co", quote: { price: 10 } },
    research: {
      scenarios: [
        { name: "Bear", fairValue: 8, probability: 0.25 },
        { name: "Base", fairValue: 12, probability: 0.5 },
        { name: "Bull", fairValue: 16, probability: 0.25 }
      ],
      decision: { label: "Hold", status: "HOLD", confidence: 50, compositeScore: 50 }
    },
    previous
  });
  assert.equal(next.history.length, 46);
  const storeSource = await readFile(new URL("../src/state/store.js", import.meta.url), "utf8");
  assert.doesNotMatch(storeSource, /(?:history|valuationVersions):[^\n]+\.slice\(0,\s*40\)/);
});
