import assert from "node:assert/strict";
import {
  EARNINGS_REVALUATION_SCHEMA,
  buildEarningsRevaluationPrompt,
  inflateEarningsRevaluationPayload,
  isEarningsRevaluationPayload
} from "../src/externalAnalysis/earningsRevaluation.js";

const baseline = {
  id: "TEST-2026-05-01-base",
  analysisDate: "2026-05-01",
  reportPeriod: "Q1 2026",
  company: { ticker: "TEST", name: "Test Company", currency: "USD" },
  fairValueSummary: {
    fairValueLow: 80,
    fairValueBase: 100,
    fairValueHigh: 130,
    probabilityWeightedFairValue: 101,
    currentPrice: 90,
    upsideDownsidePercent: 11.11,
    marginOfSafetyPercent: 10,
    confidenceLevel: "medium"
  },
  scenarios: {
    Bear: { fairValue: 80, probability: 30 },
    Base: { fairValue: 100, probability: 50 },
    Bull: { fairValue: 130, probability: 20 },
    Exceptional: null
  },
  valuationMethodology: { primaryMethod: "P/E", modelWeights: [{ method: "P/E", weight: 100 }] },
  valuationResults: [{ method: "P/E", fairValue: 100, weight: 100 }],
  decision: {
    action: "WATCH",
    confidence: 70,
    investmentScore: 70,
    rationale: ["Wait for Q2."],
    whyNot: [],
    upgradeTriggers: [],
    downgradeTriggers: [],
    biggestAssumption: null,
    mainRisk: null
  },
  thesis: { shortSummary: "Q2 must confirm revenue and margin execution.", fullSummary: null },
  risks: [{ title: "Execution risk" }],
  catalysts: [{ title: "Q2 earnings" }],
  guidance: [],
  companySpecificKpis: [],
  supplements: [],
  priceTargetRequirements: {
    requirementSetId: "TEST_Q22026_BASE",
    status: "OPEN",
    createdAt: "2026-05-01",
    createdFromAnalysisId: "TEST-2026-05-01-base",
    previousQuarter: "Q1 2026",
    targetQuarter: "Q2 2026",
    earningsPeriod: "Q2 2026",
    currentJustifiedValue: 100,
    targetValue: 130,
    targetScenario: "Bull",
    targetDescription: "Q2 execution needed for Bull case.",
    requirements: [
      { id: "rev", name: "Revenue", metric: "Revenue", type: "minimum", requiredValue: 1000, unit: "USD M", weight: 50, status: "NOT_REPORTED" },
      { id: "margin", name: "Operating Margin", metric: "Operating Margin", type: "minimum", requiredValue: 20, unit: "%", weight: 50, status: "NOT_REPORTED" }
    ]
  },
  requirementsAssessment: null,
  financialHighlights: {},
  growthHighlights: {},
  metadata: { importMethod: "structured_json", importedAt: "2026-05-01T12:00:00Z" }
};

const prompt = buildEarningsRevaluationPrompt(baseline, { quarter: 2, year: 2026, earningsText: "Q2 revenue was 1.2B." });
assert.ok(prompt.includes(EARNINGS_REVALUATION_SCHEMA));
assert.ok(prompt.includes("إعادة تقييم Bear / Base / Bull"));
assert.ok(prompt.includes("Q3 2026"));
assert.ok(prompt.includes("لا تورّث Bear/Base/Bull أو decision ميكانيكيًا"));

const payload = {
  schemaVersion: EARNINGS_REVALUATION_SCHEMA,
  ticker: "TEST",
  quarter: "Q2",
  year: 2026,
  reportDate: "2026-08-01",
  previousAnalysisId: baseline.id,
  evaluatedRequirementSetId: "TEST_Q22026_BASE",
  summary: "Q2 exceeded the prior operating requirements and supports a higher base value.",
  marketPrice: {
    value: 105,
    asOf: "2026-08-01",
    sourceTitle: "Market Data",
    sourceUrl: "https://example.com/price"
  },
  metrics: {
    revenue: { value: 1200, display: "$1.2B", consensusDisplay: "$1.1B", result: "BEAT" },
    revenueGrowthPct: { value: 30, display: "30%", consensusDisplay: null, result: "NA" },
    eps: { value: 2.5, display: "$2.50", consensusDisplay: "$2.20", result: "BEAT" },
    grossMarginPct: { value: 50, display: "50%", consensusDisplay: null, result: "NA" },
    operatingMarginPct: { value: 22, display: "22%", consensusDisplay: null, result: "BEAT" },
    freeCashFlow: { value: 180, display: "$180M", consensusDisplay: null, result: "NA" },
    cash: { value: 500, display: "$500M", consensusDisplay: null, result: "NA" },
    debt: { value: 100, display: "$100M", consensusDisplay: null, result: "NA" }
  },
  companyKpis: [],
  guidance: [{ topic: "Revenue", currentGuidance: "$1.3B-$1.4B", direction: "raised", interpretation: "Guidance was raised." }],
  forwardOutlook: {
    growthOutlook: "accelerating",
    marginOutlook: "improving",
    guidanceTrend: "raised",
    managementTone: "positive",
    thesisImpact: "supports",
    summary: "Higher guidance supports the earnings trajectory."
  },
  previousRequirementsEvaluation: {
    requirementSetId: "TEST_Q22026_BASE",
    requirements: [
      { id: "rev", actualValue: 1200, actualDisplay: "$1.2B", status: "EXCEEDED", evaluationNote: "Above requirement." },
      { id: "margin", actualValue: 22, actualDisplay: "22%", status: "PASSED", evaluationNote: "Above 20%." }
    ],
    requirementsAssessment: {
      weightedAchievement: 100,
      reportedRequirements: 2,
      totalRequirements: 2,
      passed: 1,
      failed: 0,
      exceeded: 1,
      partiallyPassed: 0,
      notReported: 0,
      overallStatus: "bull_case_supported",
      summary: "Both Q2 requirements were met."
    }
  },
  revaluation: {
    status: "UPDATED",
    fairValue: {
      bear: 90,
      base: 120,
      bull: 150,
      probabilityWeighted: 120,
      upsideToBasePct: 14.29,
      marginOfSafetyPct: 12.5,
      confidenceLevel: "high"
    },
    scenarios: {
      Bear: { fairValue: 90, probability: 20, valuationMethod: "P/E", assumptions: {}, thesis: "Bear" },
      Base: { fairValue: 120, probability: 60, valuationMethod: "P/E", assumptions: {}, thesis: "Base" },
      Bull: { fairValue: 150, probability: 20, valuationMethod: "P/E", assumptions: {}, thesis: "Bull" }
    },
    valuationMethodology: {
      primaryMethod: "P/E",
      selectionReason: "Profitable company with visible EPS.",
      modelWeights: [{ method: "P/E", weight: 100 }]
    },
    valuationResults: [{ method: "P/E", fairValue: 120, weight: 100, confidence: "high", rationale: "Higher EPS path." }],
    decision: {
      action: "ADD",
      confidence: 82,
      investmentScore: 82,
      rationale: ["Q2 execution and guidance improved."],
      whyNot: [],
      upgradeTriggers: ["Q3 revenue above target"],
      downgradeTriggers: ["Margin below target"],
      biggestAssumption: "Growth remains durable.",
      mainRisk: "Execution slows."
    },
    thesis: {
      shortSummary: "Q2 strengthened the thesis and raised the earnings path.",
      change: "strengthened",
      changeReason: "Revenue, margin and guidance improved."
    },
    risks: [{ title: "Execution risk", explanation: "Growth could slow." }],
    catalysts: [{ title: "Q3 earnings", explanation: "Next validation point." }],
    changeDrivers: { positive: ["Revenue beat", "Raised guidance"], negative: [] }
  },
  nextRequirements: {
    previousQuarter: "Q2 2026",
    targetQuarter: "Q3 2026",
    currentJustifiedValue: 120,
    targetValue: 150,
    targetScenario: "Bull",
    targetDescription: "Q3 must confirm the higher earnings path.",
    summary: "Next-quarter proof points.",
    requirements: [
      { id: "q3-rev", name: "Revenue", metric: "Revenue", type: "minimum", previousValue: 1200, previousDisplay: "$1.2B", requiredValue: 1300, requiredDisplay: ">= $1.3B", unit: "USD M", importance: "high", weight: 30, whyItMatters: "Confirms growth.", status: "NOT_REPORTED" },
      { id: "q3-margin", name: "Operating Margin", metric: "Operating Margin", type: "minimum", previousValue: 22, previousDisplay: "22%", requiredValue: 23, requiredDisplay: ">= 23%", unit: "%", importance: "high", weight: 25, whyItMatters: "Confirms operating leverage.", status: "NOT_REPORTED" },
      { id: "q3-eps", name: "EPS", metric: "EPS", type: "minimum", previousValue: 2.5, previousDisplay: "$2.50", requiredValue: 2.8, requiredDisplay: ">= $2.80", unit: "USD", importance: "high", weight: 25, whyItMatters: "Supports valuation.", status: "NOT_REPORTED" },
      { id: "q3-guide", name: "Revenue Guidance", metric: "Revenue Guidance", type: "qualitative", previousValue: "raised", previousDisplay: "Raised", requiredValue: "maintained_or_raised", requiredDisplay: "Maintained or raised", unit: "text", importance: "medium", weight: 20, whyItMatters: "Supports forward outlook.", status: "NOT_REPORTED" }
    ]
  },
  sources: [
    { title: "Q2 Earnings Release", url: "https://example.com/q2", sourceType: "Investor Relations" },
    { title: "Market Data", url: "https://example.com/price", sourceType: "Market Data" }
  ]
};

assert.equal(isEarningsRevaluationPayload(payload), true);
const inflated = inflateEarningsRevaluationPayload(baseline, payload, JSON.stringify(payload), new Date("2026-08-01T12:00:00Z"));

assert.equal(inflated.metadata.importMethod, "earnings_revaluation");
assert.equal(inflated.metadata.previousAnalysisId, baseline.id);
assert.equal(inflated.metadata.evaluatedRequirementSetId, "TEST_Q22026_BASE");
assert.equal(inflated.fairValueSummary.fairValueBase, 120, "Base must update after earnings when revaluation says so.");
assert.equal(inflated.decision.action, "ADD", "Decision must be the post-earnings decision.");
assert.equal(inflated.thesis.shortSummary, "Q2 strengthened the thesis and raised the earnings path.");
assert.equal(inflated.previousRequirementsEvaluation.requirements[0].status, "EXCEEDED");
assert.equal(inflated.previousRequirementsEvaluation.requirementsAssessment.weightedAchievement, 100);
assert.equal(inflated.priceTargetRequirements.targetQuarter, "Q3 2026");
assert.equal(inflated.priceTargetRequirements.currentJustifiedValue, 120);
assert.equal(inflated.priceTargetRequirements.targetValue, 150);
assert.equal(inflated.priceTargetRequirements.requirements.length, 4);
assert.equal(inflated.priceTargetRequirements.requirements.every((item) => item.status === "NOT_REPORTED"), true);
assert.equal(inflated.priceTargetRequirements.requirements.reduce((sum, item) => sum + item.weight, 0), 100);
assert.equal(inflated.sources[0].title, "Q2 Earnings Release");
assert.equal(inflated.fairValueSummary.currentPrice, 105);

assert.throws(() => inflateEarningsRevaluationPayload(
  baseline,
  { ...payload, previousAnalysisId: "WRONG" },
  JSON.stringify(payload)
), /previousAnalysisId/);

assert.throws(() => inflateEarningsRevaluationPayload(
  baseline,
  { ...payload, nextRequirements: { ...payload.nextRequirements, targetQuarter: "Q4 2026" } },
  JSON.stringify(payload)
), /targetQuarter must be Q3 2026/);

console.log("Earnings revaluation closed-loop tests passed.");
