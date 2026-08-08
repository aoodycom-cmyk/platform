import assert from "node:assert/strict";
import { createInvestmentDataBackup, mergeInvestmentDataBackup, parseInvestmentDataBackup } from "../src/externalAnalysis/backup.js";
import {
  applyHistoricalRequirementLifecycle,
  findRequirementSetMatch,
  normalizeHistoricalRequirementSets,
  prepareHistoricalRequirementEvaluation
} from "../src/externalAnalysis/historicalRequirements.js";
import { calculateRequirementsAssessment } from "../src/externalAnalysis/requirements.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";

const analysis1 = normalizeExternalAnalysisReport({
  id: "DEMO-analysis-1",
  source: "ChatGPT",
  analysisDate: "2026-08-08",
  reportPeriod: "Q3 2026",
  company: { ticker: "DEMO", name: "Demo Company", currency: "USD" },
  market: { priceAtAnalysis: 65 },
  scores: { quality: 8, growth: 8, valuation: 6, risk: 5 },
  fairValue: { bear: 45, base: 60, bull: 100 },
  thesis: { shortSummary: "تحليل تجريبي." },
  risks: [{ title: "Execution risk" }],
  recommendation: { action: "HOLD", confidence: 75, reason: "انتظار نتائج Q4." },
  decision: { verdict: "HOLD" },
  priceTargetRequirements: {
    currentJustifiedValue: 60,
    targetValue: 100,
    targetScenario: "bull",
    targetDescription: "Q4 results required to justify the $100 Bull Case.",
    createdAt: "2026-08-08T10:00:00.000Z",
    earningsPeriod: "Q4 2026",
    requirements: [
      { id: "revenue_growth", name: "Revenue Growth", type: "minimum", requiredValue: 30, unit: "%", weight: 25 },
      { id: "gross_margin", name: "Gross Margin", type: "minimum", requiredValue: 45, unit: "%", weight: 30 },
      { id: "eps", name: "EPS", type: "minimum", requiredValue: 3, unit: "USD", weight: 20 },
      { id: "guidance", name: "Guidance Raised", type: "qualitative", requiredValue: "Raised", unit: "text", weight: 25 }
    ]
  }
}, "analysis 1", { now: new Date("2026-08-08T10:00:00.000Z") });

const saved1 = saveExternalAnalysis({}, analysis1, { now: new Date("2026-08-08T10:00:00.000Z") });
let historicalRequirementSets = applyHistoricalRequirementLifecycle({}, saved1.report, {}, new Date("2026-08-08T10:00:00.000Z"));
const q4Set = historicalRequirementSets.DEMO[0];
assert.equal(q4Set.status, "OPEN");
assert.equal(q4Set.createdFromAnalysisId, "DEMO-analysis-1");
assert.equal(q4Set.earningsPeriod, "Q4 2026");
assert.equal(q4Set.requirements.find((item) => item.id === "gross_margin").requiredValue, 45);
assert.equal(q4Set.requirements.every((item) => item.status === "NOT_REPORTED"), true);

const analysis2 = normalizeExternalAnalysisReport({
  id: "DEMO-analysis-2",
  source: "ChatGPT",
  analysisDate: "2026-11-08",
  reportPeriod: "Q4 2026",
  company: { ticker: "DEMO", name: "Demo Company", currency: "USD" },
  market: { priceAtAnalysis: 78 },
  scores: { quality: 8.2, growth: 8.4, valuation: 6.6, risk: 4.8 },
  fairValue: { bear: 55, base: 75, bull: 115 },
  thesis: { shortSummary: "Q4 أظهر تحسنًا لكن Gross Margin لم يصل إلى العتبة." },
  risks: [{ title: "Margin risk" }],
  recommendation: { action: "ADD", confidence: 79, reason: "أغلب متطلبات Bull Case تحققت." },
  decision: { verdict: "ADD" },
  previousRequirementsEvaluation: {
    requirements: [
      { id: "revenue_growth", actualValue: 34 },
      { id: "gross_margin", actualValue: 43 },
      { id: "eps", actualValue: 3.2 },
      { id: "guidance", actualValue: "Raised" }
    ],
    requirementsAssessment: {
      overallStatus: "bull_case_strengthened",
      summary: "Revenue Growth وEPS وGuidance نجحت، لكن Gross Margin فشل."
    }
  },
  priceTargetRequirements: {
    currentJustifiedValue: 75,
    targetValue: 115,
    targetScenario: "bull",
    createdAt: "2026-11-08T10:00:00.000Z",
    earningsPeriod: "Q1 2027",
    requirements: [
      { id: "revenue_growth_q1", name: "Revenue Growth", type: "minimum", requiredValue: 28, unit: "%", weight: 35 },
      { id: "gross_margin_q1", name: "Gross Margin", type: "minimum", requiredValue: 46, unit: "%", weight: 35 },
      { id: "guidance_q1", name: "Guidance Raised", type: "qualitative", requiredValue: "Raised", unit: "text", weight: 30 }
    ]
  }
}, "analysis 2", { now: new Date("2026-11-08T10:00:00.000Z") });

const prepared2 = prepareHistoricalRequirementEvaluation(analysis2, historicalRequirementSets);
assert.equal(prepared2.match.status, "matched");
assert.equal(prepared2.match.matchType, "exact_earnings_period");
assert.equal(prepared2.report.previousRequirementsEvaluation.requirementSetId, q4Set.requirementSetId);
assert.deepEqual(
  prepared2.report.previousRequirementsEvaluation.requirements.map((item) => [item.id, item.requiredValue, item.actualValue, item.status]),
  [
    ["revenue_growth", 30, 34, "EXCEEDED"],
    ["gross_margin", 45, 43, "FAILED"],
    ["eps", 3, 3.2, "PASSED"],
    ["guidance", "Raised", "Raised", "PASSED"]
  ]
);
assert.equal(prepared2.report.requirementsAssessment.weightedAchievement, 70);

const saved2 = saveExternalAnalysis(saved1.collection, prepared2.report, { now: new Date("2026-11-08T10:00:00.000Z"), allowDuplicate: true });
historicalRequirementSets = applyHistoricalRequirementLifecycle(historicalRequirementSets, saved2.report, prepared2.match, new Date("2026-11-08T10:00:00.000Z"));
const evaluatedQ4 = historicalRequirementSets.DEMO.find((set) => set.requirementSetId === q4Set.requirementSetId);
const q1Set = historicalRequirementSets.DEMO.find((set) => set.earningsPeriod === "Q1 2027");
assert.equal(evaluatedQ4.status, "EVALUATED");
assert.equal(evaluatedQ4.evaluatedByAnalysisId, "DEMO-analysis-2");
assert.equal(evaluatedQ4.requirements.find((item) => item.id === "gross_margin").requiredValue, 45);
assert.equal(evaluatedQ4.requirements.find((item) => item.id === "gross_margin").actualValue, 43);
assert.equal(evaluatedQ4.requirements.find((item) => item.id === "gross_margin").status, "FAILED");
assert.equal(q1Set.status, "OPEN");
assert.notEqual(q1Set.requirementSetId, evaluatedQ4.requirementSetId);

const otherTicker = normalizeExternalAnalysisReport({
  ...analysis2,
  id: "OTHER-analysis",
  company: { ticker: "OTHER", name: "Other Company" },
  reportPeriod: "Q4 2026"
}, "other", { now: new Date("2026-11-08T10:00:00.000Z") });
assert.equal(findRequirementSetMatch(otherTicker, historicalRequirementSets).status, "none");

const ambiguousSets = normalizeHistoricalRequirementSets({
  DEMO: [
    { ...q4Set, requirementSetId: "DEMO_Q1_A", earningsPeriod: "Q1 2027", status: "OPEN" },
    { ...q4Set, requirementSetId: "DEMO_Q2_A", earningsPeriod: "Q2 2027", status: "OPEN" }
  ]
});
const ambiguousReport = normalizeExternalAnalysisReport({
  ...analysis2,
  id: "DEMO-ambiguous",
  reportPeriod: "FY 2027"
}, "ambiguous", { now: new Date("2026-11-08T10:00:00.000Z") });
const ambiguous = findRequirementSetMatch(ambiguousReport, ambiguousSets);
assert.equal(ambiguous.status, "ambiguous");
assert.equal(ambiguous.candidates.length, 2);

const explicitReport = normalizeExternalAnalysisReport({
  ...ambiguousReport,
  previousRequirementsEvaluation: { requirementSetId: "DEMO_Q2_A", requirements: [] }
}, "explicit", { now: new Date("2026-11-08T10:00:00.000Z") });
assert.equal(findRequirementSetMatch(explicitReport, ambiguousSets).set.requirementSetId, "DEMO_Q2_A");

const oldReport = normalizeExternalAnalysisReport({
  ...analysis1,
  id: "old-without-set-id",
  priceTargetRequirements: {
    ...analysis1.priceTargetRequirements,
    requirementSetId: undefined
  }
}, "old", { now: new Date("2026-08-08T10:00:00.000Z") });
const migrated = normalizeHistoricalRequirementSets({}, { DEMO: [oldReport] });
assert.equal(Boolean(migrated.DEMO[0].requirementSetId), true);
assert.equal(migrated.DEMO[0].createdFromAnalysisId, "old-without-set-id");

const backup = createInvestmentDataBackup({
  externalAnalyses: saved2.collection,
  historicalRequirementSets,
  evaluatedCompanies: [],
  history: [],
  watchList: []
}, new Date("2026-11-08T10:00:00.000Z"));
const parsedBackup = parseInvestmentDataBackup(JSON.stringify(backup));
assert.equal(parsedBackup.valid, true);
assert.equal(parsedBackup.preview.historicalRequirementSets, 2);
const restored = mergeInvestmentDataBackup({ externalAnalyses: {}, historicalRequirementSets: {} }, parsedBackup.backup);
assert.equal(restored.historicalRequirementSets.DEMO.length, 2);
assert.equal(restored.historicalRequirementSets.DEMO.some((set) => set.status === "EVALUATED"), true);
assert.equal(restored.historicalRequirementSets.DEMO.some((set) => set.status === "OPEN"), true);

const denominatorCheck = calculateRequirementsAssessment({
  requirements: [
    { id: "a", weight: 50, status: "PASSED" },
    { id: "b", weight: 50, status: "NOT_REPORTED" }
  ]
});
assert.equal(denominatorCheck.weightedAchievement, 100);

console.log("Historical requirements workflow tests passed.");
