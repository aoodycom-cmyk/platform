import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDemoExternalAnalysisReport, createDemoExternalAnalysisScenario } from "../src/data/externalDemo.js";
import {
  calculateRequirementsAssessment,
  normalizeCompanySpecificKpis,
  normalizeExternalRecommendation,
  normalizeGuidance,
  normalizePriceTargetRequirements
} from "../src/externalAnalysis/requirements.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import {
  createInvestmentDataBackup,
  mergeInvestmentDataBackup,
  parseInvestmentDataBackup,
  replaceInvestmentDataBackup
} from "../src/externalAnalysis/backup.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";

const now = new Date("2026-08-08T10:00:00.000Z");

const requirementsBlock = normalizePriceTargetRequirements({
  currentJustifiedValue: 60,
  targetValue: 100,
  targetScenario: "bull",
  targetDescription: "Needs strong execution.",
  createdAt: "2026-08-08T10:00:00.000Z",
  earningsPeriod: "Q3 2026",
  requirements: [
    { id: "a", name: "Revenue Growth", requiredValue: 30, weight: 25, status: "PASSED" },
    { id: "b", name: "Gross Margin", requiredValue: 45, weight: 25, status: "FAILED" },
    { id: "c", name: "Guidance", requiredValue: "Raised", weight: 20, status: "EXCEEDED" },
    { id: "d", name: "FCF", requiredValue: "Positive", weight: 10, status: "PARTIALLY_PASSED" },
    { id: "e", name: "Backlog", requiredValue: "Higher", weight: 20, status: "NOT_REPORTED" }
  ]
});
const emptyAssessment = calculateRequirementsAssessment(requirementsBlock);
assert.equal(emptyAssessment.reportedRequirements, null);
assert.equal(emptyAssessment.totalRequirements, null);
assert.equal(emptyAssessment.notReported, null);
assert.equal(emptyAssessment.weightedAchievement, null, "Franklin must not calculate External ChatGPT requirement outcomes.");
const assessment = calculateRequirementsAssessment(requirementsBlock, {
  weightedAchievement: 63,
  reportedRequirements: 4,
  totalRequirements: 5,
  notReported: 1,
  passed: 1,
  failed: 1,
  exceeded: 1,
  partiallyPassed: 1,
  overallStatus: "supplied_by_chatgpt",
  summary: "Supplied assessment must be preserved."
});
assert.equal(assessment.reportedRequirements, 4);
assert.equal(assessment.totalRequirements, 5);
assert.equal(assessment.notReported, 1);
assert.equal(assessment.weightedAchievement, 63, "Supplied External ChatGPT weighted achievement must be preserved.");
assert.equal(assessment.overallStatus, "supplied_by_chatgpt");
assert.equal(assessment.summary, "Supplied assessment must be preserved.");
const aliasAssessment = calculateRequirementsAssessment(requirementsBlock, {
  passedRequirements: 2,
  failedRequirements: 1,
  exceededRequirements: 1,
  partiallyPassedRequirements: 0,
  notReportedRequirements: 1
});
assert.equal(aliasAssessment.passed, 2);
assert.equal(aliasAssessment.notReported, 1);
assert.equal(normalizePriceTargetRequirements({
  requirements: [{ id: "partial", status: "Partially Passed" }],
  requirementsAssessment: { passedRequirements: 3 }
}).requirements[0].status, "NOT_REPORTED");
assert.equal(normalizePriceTargetRequirements({
  requirements: [{ id: "partial", status: "PARTIALLY_PASSED" }]
}).requirements[0].status, "PARTIALLY_PASSED");
assert.equal(normalizePriceTargetRequirements({
  requirements: [{ id: "missing_weight", status: "PASSED" }]
}).requirements[0].weight, null);

const guidance = normalizeGuidance([
  { topic: "Revenue", currentGuidance: "$1B-$1.2B", direction: "raised", type: "range", interpretation: "رفع التوجيهات.", importance: "critical" },
  { topic: "Demand", currentGuidance: "Demand remains healthy.", direction: "maintained", type: "qualitative", interpretation: "تعليق نوعي صالح.", importance: "medium" }
]);
assert.equal(guidance.length, 2);
assert.equal(guidance[0].direction, "raised");
assert.equal(guidance[1].type, "qualitative");

const kpis = normalizeCompanySpecificKpis([
  { name: "HBM Revenue", category: "growth", currentValue: "38%", unit: "%", trend: "improving", importance: "critical", interpretation: "محرك رئيسي." }
]);
assert.equal(kpis[0].trend, "improving");
assert.equal(kpis[0].category, "growth");

for (const action of ["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"]) {
  const report = normalizeExternalAnalysisReport({
    analysisDate: "2026-08-08",
    company: { ticker: `T${action.slice(0, 2)}`, name: `${action} Test` },
    market: { priceAtAnalysis: 50 },
    scores: { quality: 8, growth: 8, valuation: 7, risk: 5 },
    fairValue: { bear: 40, base: 60, bull: 80 },
    thesis: { shortSummary: "تقرير اختبار." },
    risks: [{ title: "Risk" }],
    recommendation: { action, confidence: 75, reason: "External action test." },
    decision: { verdict: action }
  }, "raw", { now });
  assert.equal(normalizeExternalRecommendation({ action }).action, action);
  assert.equal(validateExternalAnalysisReport(report).valid, true, `${action} must be accepted for external reports.`);
}

const demo = createDemoExternalAnalysisReport(now);
assert.equal(demo.company.ticker, "DEMO");
assert.equal(validateExternalAnalysisReport(demo).valid, true);
assert.equal(demo.guidance.length >= 2, true);
assert.equal(demo.companySpecificKpis.length >= 2, true);
assert.equal(demo.priceTargetRequirements.requirements.length >= 5, true);
assert.equal(demo.requirementsAssessment.weightedAchievement, 72);
assert.equal(demo.recommendation.action, "HOLD");
assert.ok(demo.risks[0].whatToMonitor, "Risk items must keep whatToMonitor.");
assert.ok(demo.risks[0].thesisBreaker, "Risk items must keep thesisBreaker.");

const demoScenario = createDemoExternalAnalysisScenario();
assert.equal(demoScenario.length, 2);
assert.equal(demoScenario[0].company.ticker, "DEMO");
assert.equal(demoScenario[0].priceTargetRequirements.earningsPeriod, "Q4 2026");
assert.equal(demoScenario[0].priceTargetRequirements.requirements.every((item) => item.status === "NOT_REPORTED"), true);
assert.equal(demoScenario[1].reportPeriod, "Q4 2026");
assert.equal(demoScenario[1].previousRequirementsEvaluation.requirements.length, 4);
assert.equal(demoScenario[1].priceTargetRequirements.earningsPeriod, "Q1 2027");

const saved = saveExternalAnalysis({}, demo, { now });
assert.equal(saved.collection.DEMO.length, 1);
assert.equal(saved.collection.DEMO[0].priceTargetRequirements.requirements[0].status, "EXCEEDED");
const frozenBefore = JSON.stringify(saved.collection.DEMO[0].priceTargetRequirements);
const later = normalizeExternalAnalysisReport({
  ...demo,
  id: null,
  analysisDate: "2026-11-08",
  reportPeriod: "Q3 2026",
  fairValue: { ...demo.fairValue, bear: 55, base: 75, bull: 115 },
  recommendation: { ...demo.recommendation, action: "ADD" },
  decision: { ...demo.decision, verdict: "ADD" },
  priceTargetRequirements: {
    ...demo.priceTargetRequirements,
    requirements: demo.priceTargetRequirements.requirements.map((item) => ({ ...item, status: "PASSED" }))
  }
}, "later raw", { now: new Date("2026-11-08T10:00:00.000Z") });
const savedLater = saveExternalAnalysis(saved.collection, later, { now: new Date("2026-11-08T10:00:00.000Z"), allowDuplicate: true });
assert.equal(JSON.stringify(savedLater.collection.DEMO.find((item) => item.id === saved.collection.DEMO[0].id).priceTargetRequirements), frozenBefore, "Historical requirements must not be silently mutated.");
assert.equal(savedLater.collection.DEMO.length, 2);

const backup = createInvestmentDataBackup({
  externalAnalyses: savedLater.collection,
  evaluatedCompanies: [],
  history: [],
  watchList: [{ id: "DEMO", ticker: "DEMO" }],
  manualInputs: { averageCost: "58" },
  apiKey: "SECRET",
  nested: { OPENAI_API_KEY: "SECRET" }
}, now);
const backupText = JSON.stringify(backup);
assert.equal(backupText.includes("SECRET"), false, "Backup must scrub obvious secret values.");
const parsedBackup = parseInvestmentDataBackup(backupText);
assert.equal(parsedBackup.valid, true);
assert.equal(parsedBackup.preview.companyCount, 1);
assert.equal(parsedBackup.preview.externalReportCount, 2);
const merged = mergeInvestmentDataBackup({ externalAnalyses: {}, watchList: [] }, parsedBackup.backup);
assert.equal(merged.externalAnalyses.DEMO.length, 2);
assert.equal(merged.watchList.length, 1);
const replaced = replaceInvestmentDataBackup({ externalAnalyses: { OLD: [] } }, parsedBackup.backup);
assert.equal(Boolean(replaced.externalAnalyses.OLD), false);
assert.equal(replaced.externalAnalyses.DEMO.length, 2);

const invalidBackup = parseInvestmentDataBackup(JSON.stringify({
  schemaVersion: "franklin-investment-backup/v1",
  data: { token: "SECRET" }
}));
assert.equal(invalidBackup.valid, false, "Restore must reject backups that contain secret-looking keys.");

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
assert.ok(components.includes("guidanceView"), "Guidance UI must be rendered.");
assert.ok(components.includes("companyKpisView"), "Dynamic KPI UI must be rendered.");
assert.ok(components.includes("priceTargetRequirementsView"), "Price target requirements UI must be rendered.");
assert.ok(components.includes("requirementsAssessmentView"), "Requirements achievement UI must be rendered.");
assert.ok(components.includes("valuationMethodSummaryView"), "Valuation method explanation UI must be rendered.");
assert.ok(components.includes("export-all-investment-data"), "Backup export UI must be wired.");
assert.ok(components.includes("load-external-demo"), "External DEMO report must be available for testing.");
assert.ok(styles.includes(".guidance-grid"), "Guidance mobile grid style must exist.");
assert.ok(styles.includes(".company-kpi-grid"), "KPI mobile grid style must exist.");
assert.ok(styles.includes(".requirements-table"), "Requirements table style must exist.");
assert.ok(styles.includes(".backup-restore-panel"), "Backup/restore style must exist.");

console.log("External investment reference extension tests passed.");
