import assert from "node:assert/strict";
import {
  applyHistoricalRequirementLifecycle,
  attachRequirementSetIdentityToReport,
  prepareHistoricalRequirementEvaluation
} from "../src/externalAnalysis/historicalRequirements.js";
import { inflateEarningsRevaluationPayload, EARNINGS_REVALUATION_SCHEMA } from "../src/externalAnalysis/earningsRevaluation.js";

const baseline = {
  id: "LOOP-base",
  analysisDate: "2026-05-01",
  reportPeriod: "Q1 2026",
  company: { ticker: "LOOP", name: "Loop Co", currency: "USD" },
  fairValueSummary: { fairValueLow: 80, fairValueBase: 100, fairValueHigh: 130, probabilityWeightedFairValue: 101, currentPrice: 90, upsideDownsidePercent: 11.11, marginOfSafetyPercent: 10, confidenceLevel: "medium" },
  scenarios: { Bear: { fairValue: 80, probability: 30 }, Base: { fairValue: 100, probability: 50 }, Bull: { fairValue: 130, probability: 20 }, Exceptional: null },
  valuationMethodology: { primaryMethod: "P/E", modelWeights: [{ method: "P/E", weight: 100 }] },
  valuationResults: [{ method: "P/E", fairValue: 100, weight: 100 }],
  decision: { action: "WATCH", confidence: 70, investmentScore: 70, rationale: ["Wait for Q2"], whyNot: [], upgradeTriggers: [], downgradeTriggers: [], biggestAssumption: null, mainRisk: null },
  thesis: { shortSummary: "Q2 must validate growth." },
  risks: [{ title: "Execution" }],
  catalysts: [],
  guidance: [],
  companySpecificKpis: [],
  supplements: [],
  financialHighlights: {},
  growthHighlights: {},
  priceTargetRequirements: {
    requirementSetId: "LOOP_Q22026",
    status: "OPEN",
    createdAt: "2026-05-01",
    createdFromAnalysisId: "LOOP-base",
    previousQuarter: "Q1 2026",
    targetQuarter: "Q2 2026",
    earningsPeriod: "Q2 2026",
    currentJustifiedValue: 100,
    targetValue: 130,
    targetScenario: "Bull",
    requirements: [
      { id: "rev", name: "Revenue", metric: "Revenue", type: "minimum", requiredValue: 1000, unit: "USD M", weight: 50, status: "NOT_REPORTED" },
      { id: "margin", name: "Margin", metric: "Margin", type: "minimum", requiredValue: 20, unit: "%", weight: 50, status: "NOT_REPORTED" }
    ]
  },
  metadata: { importMethod: "structured_json", importedAt: "2026-05-01T00:00:00Z" }
};

let sets = applyHistoricalRequirementLifecycle({}, baseline, {}, new Date("2026-05-01T00:00:00Z"));
assert.equal(sets.LOOP.length, 1);
assert.equal(sets.LOOP[0].status, "OPEN");
assert.equal(sets.LOOP[0].targetQuarter, "Q2 2026");

const payload = {
  schemaVersion: EARNINGS_REVALUATION_SCHEMA,
  ticker: "LOOP",
  quarter: "Q2",
  year: 2026,
  reportDate: "2026-08-01",
  previousAnalysisId: "LOOP-base",
  evaluatedRequirementSetId: "LOOP_Q22026",
  summary: "Q2 passed the old requirements.",
  marketPrice: { value: 105, asOf: "2026-08-01", sourceTitle: "Market", sourceUrl: "https://example.com/price" },
  metrics: {},
  companyKpis: [],
  guidance: [],
  forwardOutlook: { growthOutlook: "stable", marginOutlook: "stable", guidanceTrend: "maintained", managementTone: "positive", thesisImpact: "supports", summary: "Stable." },
  previousRequirementsEvaluation: {
    requirementSetId: "LOOP_Q22026",
    requirements: [
      { id: "rev", actualValue: 1200, actualDisplay: "$1.2B", status: "EXCEEDED", evaluationNote: "Above target" },
      { id: "margin", actualValue: 22, actualDisplay: "22%", status: "PASSED", evaluationNote: "Above target" }
    ],
    requirementsAssessment: { weightedAchievement: 100, reportedRequirements: 2, totalRequirements: 2, passed: 1, failed: 0, exceeded: 1, partiallyPassed: 0, notReported: 0, overallStatus: "supported", summary: "Both passed" }
  },
  revaluation: {
    status: "UPDATED",
    fairValue: { bear: 90, base: 120, bull: 150, probabilityWeighted: 120, upsideToBasePct: 14.29, marginOfSafetyPct: 12.5, confidenceLevel: "high" },
    scenarios: { Bear: { fairValue: 90, probability: 20 }, Base: { fairValue: 120, probability: 60 }, Bull: { fairValue: 150, probability: 20 } },
    valuationMethodology: { primaryMethod: "P/E", modelWeights: [{ method: "P/E", weight: 100 }] },
    valuationResults: [{ method: "P/E", fairValue: 120, weight: 100 }],
    decision: { action: "ADD", confidence: 80, investmentScore: 80, rationale: ["Q2 strengthened thesis"], whyNot: [], upgradeTriggers: [], downgradeTriggers: [], biggestAssumption: "Growth holds", mainRisk: "Execution" },
    thesis: { shortSummary: "Q2 strengthened the thesis.", change: "strengthened", changeReason: "Requirements passed." },
    risks: [], catalysts: [], changeDrivers: { positive: ["Q2"], negative: [] }
  },
  nextRequirements: {
    previousQuarter: "Q2 2026", targetQuarter: "Q3 2026", currentJustifiedValue: 120, targetValue: 150, targetScenario: "Bull", targetDescription: "Q3 proof points", summary: "Q3 targets",
    requirements: [
      { id: "q3-rev", name: "Revenue", metric: "Revenue", type: "minimum", previousValue: 1200, requiredValue: 1300, unit: "USD M", weight: 30, importance: "high", whyItMatters: "Growth", status: "NOT_REPORTED" },
      { id: "q3-margin", name: "Margin", metric: "Margin", type: "minimum", previousValue: 22, requiredValue: 23, unit: "%", weight: 25, importance: "high", whyItMatters: "Leverage", status: "NOT_REPORTED" },
      { id: "q3-eps", name: "EPS", metric: "EPS", type: "minimum", previousValue: 2, requiredValue: 2.4, unit: "USD", weight: 25, importance: "high", whyItMatters: "Value", status: "NOT_REPORTED" },
      { id: "q3-guide", name: "Guidance", metric: "Guidance", type: "qualitative", previousValue: "maintained", requiredValue: "maintained_or_raised", unit: "text", weight: 20, importance: "medium", whyItMatters: "Outlook", status: "NOT_REPORTED" }
    ]
  },
  sources: [{ title: "Q2 release", url: "https://example.com/q2", sourceType: "Investor Relations" }]
};

const inflated = inflateEarningsRevaluationPayload(baseline, payload, JSON.stringify(payload), new Date("2026-08-01T00:00:00Z"));
const prepared = prepareHistoricalRequirementEvaluation(inflated, sets);
assert.equal(prepared.match.status, "matched");
assert.equal(prepared.match.matchType, "exact_earnings_period");
assert.equal(prepared.report.previousRequirementsEvaluation.requirementSetId, "LOOP_Q22026");

const withIdentity = attachRequirementSetIdentityToReport({ ...prepared.report, id: "LOOP-Q2-revaluation" }, new Date("2026-08-01T00:00:00Z"));
assert.ok(withIdentity.priceTargetRequirements.requirementSetId);
assert.notEqual(withIdentity.priceTargetRequirements.requirementSetId, "LOOP_Q22026");

sets = applyHistoricalRequirementLifecycle(sets, withIdentity, prepared.match, new Date("2026-08-01T00:00:00Z"));
const oldSet = sets.LOOP.find((set) => set.requirementSetId === "LOOP_Q22026");
const nextSet = sets.LOOP.find((set) => set.requirementSetId === withIdentity.priceTargetRequirements.requirementSetId);

assert.equal(oldSet.status, "EVALUATED", "The previous quarter requirement set must close.");
assert.equal(oldSet.evaluatedByAnalysisId, "LOOP-Q2-revaluation");
assert.equal(oldSet.requirementsAssessment.weightedAchievement, 100);
assert.equal(nextSet.status, "OPEN", "The next-quarter requirement set must open automatically.");
assert.equal(nextSet.targetQuarter, "Q3 2026");
assert.equal(nextSet.currentJustifiedValue, 120);
assert.equal(nextSet.targetValue, 150);
assert.equal(nextSet.requirements.every((item) => item.status === "NOT_REPORTED"), true);

console.log("Earnings revaluation lifecycle rollover tests passed.");
