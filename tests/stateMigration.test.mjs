import assert from "node:assert/strict";
import test from "node:test";
import {
  findLocalFranklinBackups,
  migrateFranklinState,
  readLocalFranklinBackup,
  shouldBlockCloudPush,
  summarizeFranklinState,
  validateRestoredCandidate
} from "../src/state/migration.js";
import { parseInvestmentDataBackup } from "../src/externalAnalysis/backup.js";

const baseReport = {
  id: "DEMO-2026-01",
  analysisOrigin: "external_chatgpt",
  analysisDate: "2026-08-20",
  reportPeriod: "Q2 2026",
  company: { ticker: "DEMO", name: "Demo Corp", currency: "USD" },
  fairValueSummary: {
    fairValueLow: 10,
    fairValueBase: 15,
    fairValueHigh: 20,
    probabilityWeightedFairValue: 16,
    currentPrice: 12
  },
  decision: { action: "BUY" },
  thesis: { shortSummary: "Synthetic thesis" },
  priceTargetRequirements: {
    requirementSetId: "REQ-1",
    requirements: [
      { id: "revenue", requiredValue: 100, actualValue: 110, status: "PASSED", weight: 0.5 },
      { id: "margin", requiredValue: 20, actualValue: 18, status: "PARTIALLY_PASSED", weight: 0.5 }
    ]
  },
  requirementsAssessment: { overallStatus: "PARTIALLY_PASSED", passed: 1 },
  guidance: [{ topic: "Revenue", currentGuidance: "up" }],
  sources: [{ title: "Synthetic source", url: "https://example.invalid" }],
  rawAnalysis: "RAW_SYNTHETIC",
  rawAnalysisOriginal: "RAW_SYNTHETIC_ORIGINAL",
  supplements: [{ type: "unknown_future_type", payload: { preserved: true } }]
};

const legacyState = {
  language: "ar",
  libraryFilter: "all",
  librarySort: "latest",
  evaluatedCompanies: null,
  compareSelectedTickers: null,
  history: null,
  watchList: null,
  externalReportSelection: { ticker: "DEMO", reportId: "missing-report-id" },
  externalAnalyses: {
    DEMO: [
      baseReport,
      { ...baseReport, id: "DEMO-2026-02", analysisDate: "2026-08-21", reportPeriod: "Q3 2026" }
    ],
    NULLS: null,
    SINGLE: { ...baseReport, id: "SINGLE-2026-01", company: { ticker: "SINGLE" } }
  },
  historicalRequirementSets: [
    { requirementSetId: "REQ-1", ticker: "DEMO", requirements: baseReport.priceTargetRequirements.requirements }
  ]
};

function criticalSnapshot(state) {
  return state.externalAnalyses.DEMO.map((report) => ({
    id: report.id,
    analysisDate: report.analysisDate,
    reportPeriod: report.reportPeriod,
    action: report.decision.action,
    fairValue: report.fairValueSummary,
    thesis: report.thesis.shortSummary,
    requirementSetId: report.priceTargetRequirements.requirementSetId,
    requirements: report.priceTargetRequirements.requirements,
    requirementsAssessment: report.requirementsAssessment,
    guidance: report.guidance,
    sources: report.sources,
    rawAnalysis: report.rawAnalysis,
    rawAnalysisOriginal: report.rawAnalysisOriginal
  }));
}

test("legacy user state migrates without changing financial fields", () => {
  const before = criticalSnapshot(legacyState);
  const { state, diagnostics } = migrateFranklinState(legacyState);
  const summary = summarizeFranklinState(state);
  assert.equal(summary.tickerCount, 2);
  assert.equal(summary.reportCount, 3);
  assert.equal(summary.historicalRequirementSetCount, 1);
  assert.deepEqual(criticalSnapshot(state), before);
  assert.equal(state.evaluatedCompanies.length, 0);
  assert.equal(state.compareSelectedTickers.length, 0);
  assert.equal(state.history.length, 0);
  assert.equal(state.watchList.length, 0);
  assert.equal(state.externalAnalyses.NULLS.length, 0);
  assert.ok(diagnostics.warnings.some((item) => item.issue === "stale-report-reference"));
});

test("migration is idempotent and malformed reports do not crash other reports", () => {
  const malformed = {
    ...legacyState,
    externalAnalyses: { DEMO: [baseReport, null, "bad-report"] }
  };
  const first = migrateFranklinState(malformed);
  const second = migrateFranklinState(first.state);
  assert.deepEqual(summarizeFranklinState(second.state), summarizeFranklinState(first.state));
  assert.equal(summarizeFranklinState(first.state).reportCount, 1);
  assert.equal(first.diagnostics.quarantinedReports.length, 2);
});

test("raw legacy state is accepted as an investment backup", () => {
  const result = parseInvestmentDataBackup(JSON.stringify(legacyState));
  assert.equal(result.valid, true);
  assert.equal(result.preview.externalReportCount, 3);
  assert.equal(result.preview.historicalRequirementSets, 1);
});

test("local recovery backup registry finds populated hidden backups", () => {
  const storage = fakeStorage({
    equityResearchV4State: JSON.stringify({ externalAnalyses: {} }),
    "franklinManualResetBackup:2026-01-01T00:00:00.000Z": JSON.stringify(legacyState)
  });
  const backups = findLocalFranklinBackups(storage);
  assert.equal(backups.length, 1);
  assert.equal(backups[0].reportCount, 3);
  const restore = readLocalFranklinBackup(storage, backups[0].key);
  assert.equal(restore.valid, true);
  assert.equal(restore.preview.reportCount, 3);
});

test("cloud push guard blocks empty or suspiciously reduced local state", () => {
  const remote = migrateFranklinState(legacyState).state;
  const emptyLocal = migrateFranklinState({ externalAnalyses: {} }).state;
  const blockedEmpty = shouldBlockCloudPush(emptyLocal, remote);
  assert.equal(blockedEmpty.blocked, true);
  assert.equal(blockedEmpty.reason, "EMPTY_LOCAL_WOULD_OVERWRITE_POPULATED_CLOUD");

  const reducedLocal = migrateFranklinState({ externalAnalyses: { DEMO: [baseReport] } }).state;
  const blockedReduced = shouldBlockCloudPush(reducedLocal, remote, { suspiciousReductionRatio: 0.5 });
  assert.equal(blockedReduced.blocked, true);
  assert.equal(blockedReduced.reason, "SUSPICIOUS_LOCAL_REDUCTION_REQUIRES_CONFIRMATION");
});

test("restore validation rejects candidates that drop reports or requirement sets", () => {
  const original = migrateFranklinState(legacyState).state;
  const candidate = migrateFranklinState({ externalAnalyses: { DEMO: [baseReport] }, historicalRequirementSets: {} }).state;
  const result = validateRestoredCandidate(original, candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("RESTORE_DROPPED_REPORTS"));
  assert.ok(result.errors.includes("RESTORE_DROPPED_REQUIREMENT_SETS"));
});

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] || null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}
