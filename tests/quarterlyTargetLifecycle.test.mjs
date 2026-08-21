import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyHistoricalRequirementLifecycle,
  prepareHistoricalRequirementEvaluation
} from "../src/externalAnalysis/historicalRequirements.js";
import { inflateQuarterlyEarningsLitePayload, QUARTERLY_EARNINGS_LITE_SCHEMA } from "../src/externalAnalysis/quarterlyEarningsLite.js";
import { buildQuarterlyScorecard } from "../src/externalAnalysis/quarterlyScorecard.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";

const requirementSetId = "TSLA_Q2_2025_BASE";
const baseline = normalizeExternalAnalysisReport({
  id: "TSLA-baseline",
  source: "ChatGPT",
  analysisDate: "2025-01-30",
  reportPeriod: "Q4 2024",
  company: { ticker: "TSLA", name: "Tesla, Inc.", currency: "USD" },
  market: { priceAtAnalysis: 400 },
  scores: { quality: 8, growth: 7, valuation: 4, risk: 6 },
  fairValue: { bear: 250, base: 325, bull: 500 },
  thesis: { shortSummary: "متابعة تنفيذ النمو والهوامش خلال 2025." },
  risks: [{ title: "Execution risk" }],
  recommendation: { action: "WATCH", confidence: 70, reason: "انتظار التنفيذ." },
  decision: { verdict: "WATCH" },
  priceTargetRequirements: {
    requirementSetId,
    status: "OPEN",
    currentJustifiedValue: 325,
    targetValue: 500,
    targetScenario: "bull",
    previousQuarter: "Q4 2024",
    targetQuarter: "Q2 2025",
    earningsPeriod: "Q2 2025",
    createdAt: "2025-01-30T00:00:00.000Z",
    requirements: [
      requirement("deliveries", "Vehicle Deliveries", "تسليمات السيارات", 380000, "vehicles", 25),
      requirement("energy", "Energy Storage Deployments", "نشر أنظمة الطاقة", 10, "GWh", 20),
      requirement("revenue", "Revenue", "الإيرادات", 22000, "USD M", 30),
      requirement("gross_margin", "Gross Margin", "الهامش الإجمالي", 18, "%", 25)
    ]
  }
}, "baseline", { now: new Date("2025-01-30T00:00:00.000Z") });

let sets = applyHistoricalRequirementLifecycle({}, baseline, {}, new Date("2025-01-30T00:00:00.000Z"));
assert.equal(sets.TSLA[0].status, "OPEN");

const q1Inflated = inflateQuarterlyEarningsLitePayload(baseline, litePayload({
  quarter: "Q1",
  reportDate: "2025-04-22",
  metrics: { revenue: metric(19335, "$19.335B"), grossMarginPct: metric(16.3, "16.3%") },
  requirements: [
    result("deliveries", 336681, "336,681", "NOT_REPORTED"),
    result("energy", 10.4, "10.4 GWh", "NOT_REPORTED"),
    result("revenue", 19335, "$19.335B", "NOT_REPORTED"),
    result("gross_margin", 16.3, "16.3%", "NOT_REPORTED")
  ],
  requirementsAssessment: null
}), "q1", new Date("2025-04-22T00:00:00.000Z"));
const q1PreparedResult = prepareHistoricalRequirementEvaluation(q1Inflated, sets);
const q1Prepared = { ...q1PreparedResult.report, id: "TSLA-Q1-2025" };
assert.equal(q1Prepared.previousRequirementsEvaluation.earningsPeriod, "Q1 2025");
assert.equal(q1Prepared.previousRequirementsEvaluation.targetQuarter, "Q2 2025");
assert.equal(q1Prepared.previousRequirementsEvaluation.requirements[0].name, "Vehicle Deliveries");
assert.equal(q1Prepared.previousRequirementsEvaluation.requirements[0].weight, 25);
sets = applyHistoricalRequirementLifecycle(sets, q1Prepared, q1PreparedResult.match, new Date("2025-04-22T00:00:00.000Z"));
assert.equal(sets.TSLA.find((set) => set.requirementSetId === requirementSetId).status, "OPEN", "Q1 observation must not close a Q2 target set.");
assert.equal(sets.TSLA.find((set) => set.requirementSetId === requirementSetId).evaluatedByAnalysisId, null);

const q2Inflated = inflateQuarterlyEarningsLitePayload(q1Prepared, litePayload({
  quarter: "Q2",
  reportDate: "2025-07-23",
  metrics: { revenue: metric(22496, "$22.496B"), grossMarginPct: metric(17.2, "17.2%") },
  requirements: [
    result("deliveries", 384122, "384,122", "PASSED"),
    result("energy", 9.6, "9.6 GWh", "FAILED"),
    result("revenue", 22496, "$22.496B", "EXCEEDED"),
    result("gross_margin", 17.2, "17.2%", "FAILED")
  ],
  requirementsAssessment: {
    weightedAchievement: 55,
    reportedRequirements: 4,
    totalRequirements: 4,
    passed: 1,
    failed: 2,
    exceeded: 1,
    partiallyPassed: 0,
    notReported: 0,
    overallStatus: "mixed",
    summary: "التسليمات والإيرادات نجحتا، بينما الطاقة والهامش لم يحققا المطلوب."
  }
}), "q2", new Date("2025-07-23T00:00:00.000Z"));
const q2PreparedResult = prepareHistoricalRequirementEvaluation(q2Inflated, sets);
const q2Prepared = { ...q2PreparedResult.report, id: "TSLA-Q2-2025" };
assert.equal(q2PreparedResult.match.matchType, "exact_earnings_period");
assert.equal(q2Prepared.previousRequirementsEvaluation.earningsPeriod, "Q2 2025");
assert.equal(q2Prepared.previousRequirementsEvaluation.requirementsAssessment.weightedAchievement, 55);
assert.deepEqual(
  q2Prepared.previousRequirementsEvaluation.requirements.map((item) => [item.id, item.name, item.requiredValue, item.weight, item.status]),
  [
    ["deliveries", "Vehicle Deliveries", 380000, 25, "PASSED"],
    ["energy", "Energy Storage Deployments", 10, 20, "FAILED"],
    ["revenue", "Revenue", 22000, 30, "EXCEEDED"],
    ["gross_margin", "Gross Margin", 18, 25, "FAILED"]
  ]
);

sets = applyHistoricalRequirementLifecycle(sets, q2Prepared, q2PreparedResult.match, new Date("2025-07-23T00:00:00.000Z"));
const evaluated = sets.TSLA.find((set) => set.requirementSetId === requirementSetId);
assert.equal(evaluated.status, "EVALUATED");
assert.equal(evaluated.evaluatedByAnalysisId, "TSLA-Q2-2025");
assert.equal(evaluated.requirementsAssessment.weightedAchievement, 55);

const scorecard = buildQuarterlyScorecard({
  historicalRequirementSets: sets,
  externalAnalyses: { TSLA: [q2Prepared, q1Prepared, baseline] },
  ticker: "TSLA",
  year: 2025
});
const deliveries = scorecard.rows.find((row) => row.key === "id:deliveries");
assert.equal(deliveries.cells[1].actualValue, 336681);
assert.equal(deliveries.cells[1].status, "NOT_REPORTED");
assert.equal(deliveries.cells[2].actualValue, 384122);
assert.equal(deliveries.cells[2].status, "PASSED");
assert.equal(scorecard.quarters[1].weightedAchievement, 55);

const componentsSource = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
assert.ok(componentsSource.includes("Base implies expected downside"), "Valuation relation copy must describe the supplied return denominator accurately.");
assert.ok(componentsSource.includes('mixed: isArabicUi() ? "مختلط" : "Mixed"'), "Mixed assessment status must be Arabic-first.");
assert.ok(componentsSource.includes('NOT_REPORTED: isArabicUi() ? "بانتظار الإعلان"'), "Pending requirements must not expose the raw NOT_REPORTED enum.");
assert.ok(componentsSource.includes("هذه أهداف مستقبلية وليست نتيجة إنجاز"), "The tracker must distinguish future ambition from measured achievement.");
assert.ok(componentsSource.includes("compactRequirementObservationText"), "Requirement cards must remove duplicated quarter prose from their value line.");
assert.ok(componentsSource.includes("المبرر الآن"), "The tracker must show the current justified value before the next target.");
assert.ok(componentsSource.includes('querySelectorAll("[data-action=\'close-earnings-update\']")'), "Every earnings success/cancel action must close the workflow.");
assert.equal(componentsSource.includes("function reportSavedBanner"), false, "The report must not render a second persistent save banner.");

console.log("Quarterly target lifecycle tests passed.");

function litePayload({ quarter, reportDate, metrics, requirements, requirementsAssessment }) {
  return {
    schemaVersion: QUARTERLY_EARNINGS_LITE_SCHEMA,
    ticker: "TSLA",
    quarter,
    year: 2025,
    reportDate,
    requirementSetId,
    summary: `${quarter} earnings update`,
    metrics,
    companyKpis: [],
    guidance: [],
    forwardOutlook: {},
    requirements,
    requirementsAssessment,
    highlights: [],
    concerns: []
  };
}

function requirement(id, name, arabicName, requiredValue, unit, weight) {
  return { id, name, arabicName, metric: name, type: "minimum", requiredValue, unit, weight };
}

function result(id, actualValue, actualDisplay, status) {
  return { id, actualValue, actualDisplay, status, evaluationNote: `${id} ${status}` };
}

function metric(value, display) {
  return { value, display, consensusDisplay: null, result: "NA" };
}
