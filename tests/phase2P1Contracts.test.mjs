import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { money } from "../src/domain/financialMetrics.js";
import { mergeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementMerge.js";
import { normalizeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementSchema.js";
import { reconcileDeletedReportHistory } from "../src/state/store.js";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

function canonicalReport() {
  return {
    analysisOrigin: "external_chatgpt",
    source: "ChatGPT",
    analysisDate: "2026-09-06",
    company: { ticker: "TEST", name: "Test Co" },
    fairValueSummary: { currentPrice: 100, fairValueLow: 90, fairValueBase: 120, fairValueHigh: 150 },
    thesis: { shortSummary: "A sourced thesis." },
    risks: [{ title: "Execution", sourceIds: ["S1"] }],
    decision: { action: "HOLD" },
    sources: [{ id: "S1", title: "Filing", type: "SEC", date: "2026-08-01", url: "https://www.sec.gov/example" }]
  };
}

test("P1 money formatting honors explicit currencies", () => {
  assert.match(money(1234.5, 2, "EUR"), /€|EUR/);
  assert.match(money(1234.5, 2, "SAR"), /SAR|ر\.س/);
  assert.doesNotMatch(money(1234.5, 2, "EUR"), /\$/);
});

test("P1 supplement sources merge atomically and remain in the audit record", () => {
  const existing = canonicalReport();
  existing.id = "report-1";
  existing.scores = { quality: null };
  const supplement = normalizeExternalAnalysisSupplement({
    schemaVersion: "external-analysis-supplement/v1",
    ticker: "TEST",
    targetAnalysisId: "report-1",
    fields: { "scores.quality": 8 },
    sources: [{ id: "S2", title: "Earnings release", type: "Investor Relations", date: "2026-09-01", url: "https://example.com/release", usedFor: ["scores.quality"] }]
  }, "raw", { now: new Date("2026-09-06T00:00:00.000Z") });
  const result = mergeExternalAnalysisSupplement(existing, supplement, { now: new Date("2026-09-06T00:00:00.000Z") });
  assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors));
  assert.equal(result.report.sources.some((item) => item.id === "S2"), true);
  assert.equal(result.report.supplements[0].sources.some((item) => item.id === "S2"), true);
});

test("P1 report deletion tombstones every retained historical reference", () => {
  const result = reconcileDeletedReportHistory({
    historicalRequirementSets: { TEST: [{ requirementSetId: "req-1", createdFromAnalysisId: "report-1" }] },
    quarterlyEarningsHistory: { TEST: [{ quarterKey: "2026-Q2", analysisId: "report-1", sourceAnalysisIds: ["report-1", "report-2"] }] }
  }, "TEST", ["report-1"], new Date("2026-09-06T00:00:00.000Z"));
  assert.equal(result.historicalRequirementSets.TEST[0].sourceAnalysisDeletedAt, "2026-09-06T00:00:00.000Z");
  assert.equal(result.quarterlyEarningsHistory.TEST[0].analysisId, null);
  assert.deepEqual(result.quarterlyEarningsHistory.TEST[0].sourceAnalysisIds, ["report-2"]);
  assert.deepEqual(result.quarterlyEarningsHistory.TEST[0].deletedSourceAnalysisIds, ["report-1"]);
});

test("P1 cloud autosync publishes every failure as visible state", async () => {
  const text = await source("src/cloud/franklinCloud.js");
  assert.match(text, /export function cloudSyncFailureState/);
  assert.match(text, /franklin:cloud-sync-error/);
  assert.doesNotMatch(text, /catch \(error\) \{\s*if \(error\?\.message === "REVISION_CONFLICT"\)[\s\S]*?\n\s*\}/);
});
