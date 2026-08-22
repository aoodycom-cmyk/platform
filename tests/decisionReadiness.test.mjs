import assert from "node:assert/strict";
import { classifyDecisionReadiness } from "../src/financialSafety/decisionReadinessUi.js";

const full = {
  analysisDate: "2026-08-19",
  metadata: { importMethod: "structured_json" },
  fairValueSummary: {
    currentPrice: 100,
    fairValueBase: 125,
    probabilityWeightedFairValue: 123,
    upsideDownsidePercent: 25,
    marginOfSafetyPercent: 20
  },
  scenarios: {
    Bear: { fairValue: 80, probability: 20 },
    Base: { fairValue: 125, probability: 60 },
    Bull: { fairValue: 160, probability: 20 }
  },
  valuationMethodology: { modelWeights: [{ weight: 100 }] }
};
const fullReadiness = classifyDecisionReadiness(full);
assert.equal(fullReadiness.status, "full_analysis_as_of");
assert.equal(fullReadiness.asOfDate, "2026-08-19");

const quarterlyInherited = {
  ...full,
  reportPeriod: "Q2 2026",
  metadata: {
    importMethod: "quarterly_earnings_lite",
    quarterlySourcesProvided: true,
    baseAnalysisDate: "2026-08-19"
  },
  previousRequirementsEvaluation: {
    targetQuarter: "Q3 2026",
    earningsPeriod: "Q2 2026",
    requirements: [{ status: "NOT_REPORTED" }]
  }
};
const inheritedReadiness = classifyDecisionReadiness(quarterlyInherited);
assert.equal(inheritedReadiness.status, "quarterly_inherited");
assert.equal(inheritedReadiness.asOfDate, "2026-08-19");

const missingSources = {
  ...quarterlyInherited,
  metadata: { importMethod: "quarterly_earnings_lite", baseAnalysisDate: "2026-08-19" }
};
const missingSourcesReadiness = classifyDecisionReadiness(missingSources);
assert.equal(missingSourcesReadiness.status, "blocked");
assert.ok(missingSourcesReadiness.reasons.includes("QUARTERLY_SOURCE_PROVENANCE_MISSING"));

const brokenWeightedValue = {
  ...full,
  fairValueSummary: { ...full.fairValueSummary, probabilityWeightedFairValue: 140 }
};
const brokenReadiness = classifyDecisionReadiness(brokenWeightedValue);
assert.equal(brokenReadiness.status, "blocked");
assert.ok(brokenReadiness.reasons.includes("WEIGHTED_FAIR_VALUE_MISMATCH"));

console.log("Decision readiness classification tests passed.");
