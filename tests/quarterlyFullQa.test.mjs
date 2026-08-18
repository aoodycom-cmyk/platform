import assert from "node:assert/strict";
import { createDemoExternalAnalysisScenario } from "../src/data/externalDemo.js";
import {
  QUARTERLY_EARNINGS_LITE_SCHEMA,
  buildQuarterlyEarningsLitePrompt
} from "../src/externalAnalysis/quarterlyEarningsLite.js";
import {
  parseExternalAnalysisInput,
  setQuarterlyEarningsLiteReportResolver
} from "../src/externalAnalysis/parser.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import {
  applyHistoricalRequirementLifecycle,
  normalizeHistoricalRequirementSets,
  prepareHistoricalRequirementEvaluation
} from "../src/externalAnalysis/historicalRequirements.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";
import { buildQuarterlyScorecard } from "../src/externalAnalysis/quarterlyScorecard.js";
import { QUARTERLY_FORWARD_OUTLOOK_KIND } from "../src/externalAnalysis/quarterlyForwardOutlook.js";
import { QUARTERLY_EARNINGS_DIGEST_KIND } from "../src/externalAnalysis/quarterlyEarningsDigest.js";

const [baseReport] = createDemoExternalAnalysisScenario();
const originalCore = {
  fairValueSummary: structuredClone(baseReport.fairValueSummary),
  thesis: structuredClone(baseReport.thesis),
  decision: structuredClone(baseReport.decision),
  risks: structuredClone(baseReport.risks),
  catalysts: structuredClone(baseReport.catalysts)
};

// 1) Prompt must stay quarterly-only and compact.
const prompt = buildQuarterlyEarningsLitePrompt(baseReport, {
  quarter: 4,
  year: 2026,
  earningsText: "Revenue $1.1B; EPS $3.20; gross margin 43%; guidance raised."
});
assert.ok(prompt.includes("Q4 2026"));
assert.ok(prompt.includes("لا تعمل تحليل سهم كامل"));
assert.ok(prompt.includes("لا تحسب Fair Value جديدًا"));
assert.ok(prompt.includes("لا تصدر BUY/ADD/HOLD/WATCH/REDUCE/SELL جديدة"));
assert.ok(prompt.includes("Forward Outlook"));
assert.ok(prompt.length < 12000, `Prompt unexpectedly large: ${prompt.length}`);

const ids = (baseReport.priceTargetRequirements?.requirements || []).map((item) => item.id);
assert.ok(ids.length >= 3, "Demo report must contain quarterly requirements for QA.");

const statusFor = (id) => {
  if (String(id).includes("gross_margin")) return "FAILED";
  if (String(id).includes("revenue")) return "EXCEEDED";
  return "PASSED";
};

const actualFor = (id) => {
  if (String(id).includes("revenue")) return 34;
  if (String(id).includes("gross_margin")) return 43;
  if (String(id).includes("eps")) return 3.2;
  return "Raised";
};

const litePayload = {
  schemaVersion: QUARTERLY_EARNINGS_LITE_SCHEMA,
  ticker: baseReport.company.ticker,
  quarter: "Q4",
  year: 2026,
  reportDate: "2026-11-08",
  requirementSetId: baseReport.priceTargetRequirements.requirementSetId || null,
  summary: "الربع قوي في الإيرادات وEPS وGuidance، مع بقاء الهامش دون العتبة.",
  metrics: {
    revenue: { value: 1100, display: "$1.1B", consensusDisplay: "$1.05B", result: "BEAT" },
    revenueGrowthPct: { value: 34, display: "34%", consensusDisplay: "30%", result: "BEAT" },
    eps: { value: 3.2, display: "$3.20", consensusDisplay: "$3.00", result: "BEAT" },
    grossMarginPct: { value: 43, display: "43%", consensusDisplay: "45%", result: "MISS" },
    operatingMarginPct: { value: 18, display: "18%", consensusDisplay: null, result: "NA" },
    freeCashFlow: { value: 120, display: "$120M", consensusDisplay: null, result: "NA" },
    cash: { value: 900, display: "$900M", consensusDisplay: null, result: "NA" },
    debt: { value: 500, display: "$500M", consensusDisplay: null, result: "NA" }
  },
  companyKpis: [
    { name: "KPI 1", actualDisplay: "10", result: "BEAT" },
    { name: "KPI 2", actualDisplay: "20", result: "INLINE" },
    { name: "KPI 3", actualDisplay: "30", result: "NA" },
    { name: "KPI 4", actualDisplay: "40", result: "BEAT" },
    { name: "KPI 5 SHOULD BE DROPPED", actualDisplay: "50", result: "BEAT" }
  ],
  guidance: [
    { topic: "Revenue", currentGuidance: "$1.2B-$1.3B", direction: "raised", interpretation: "رفع التوجيهات." },
    { topic: "Margin", currentGuidance: "44%-45%", direction: "new", interpretation: "تحسن متوقع." },
    { topic: "Capacity", currentGuidance: "Higher", direction: "raised", interpretation: "توسع إضافي." },
    { topic: "Extra SHOULD BE DROPPED", currentGuidance: "x", direction: "new", interpretation: "x" }
  ],
  forwardOutlook: {
    growthOutlook: "accelerating",
    marginOutlook: "pressured",
    guidanceTrend: "raised",
    managementTone: "positive",
    thesisImpact: "supports",
    summary: "النمو والتوجيهات أقوى، مع ضغط هامش مؤقت."
  },
  requirements: ids.map((id) => ({
    id,
    actualValue: actualFor(id),
    actualDisplay: String(actualFor(id)),
    status: statusFor(id),
    evaluationNote: "QA result"
  })),
  highlights: ["H1", "H2", "H3", "H4 SHOULD BE DROPPED"],
  concerns: ["C1", "C2", "C3 SHOULD BE DROPPED"]
};

// Output contract itself is intentionally small enough for mobile copy/paste.
assert.ok(JSON.stringify(litePayload).length < 9000, "Representative Lite JSON should remain small.");

// 2) Lite JSON must inflate against the already saved report, not become a full re-analysis.
setQuarterlyEarningsLiteReportResolver(() => baseReport);
const parsed = await parseExternalAnalysisInput(JSON.stringify(litePayload), {
  now: new Date("2026-11-08T12:00:00.000Z")
});
assert.equal(parsed.parserSource, "Quarterly Earnings Lite Parser");
assert.equal(parsed.usedAi, false);
assert.equal(parsed.report.reportPeriod, "Q4 2026");
assert.equal(parsed.report.analysisDate, "2026-11-08");
assert.equal(parsed.report.financialHighlights.revenue, 1100);
assert.equal(parsed.report.financialHighlights.epsReported, 3.2);
assert.equal(parsed.report.metadata.importMethod, "quarterly_earnings_lite");

// 3) Core investment analysis is protected exactly.
assert.deepEqual(parsed.report.fairValueSummary, originalCore.fairValueSummary);
assert.deepEqual(parsed.report.thesis, originalCore.thesis);
assert.deepEqual(parsed.report.decision, originalCore.decision);
assert.deepEqual(parsed.report.risks, originalCore.risks);
assert.deepEqual(parsed.report.catalysts, originalCore.catalysts);

// 4) Quarterly-only data is stored as bounded supplements.
const outlook = parsed.report.supplements.find((item) => item.kind === QUARTERLY_FORWARD_OUTLOOK_KIND && item.period === "Q4 2026");
const digest = parsed.report.supplements.find((item) => item.kind === QUARTERLY_EARNINGS_DIGEST_KIND && item.period === "Q4 2026");
assert.ok(outlook, "Forward Outlook supplement missing.");
assert.ok(digest, "Quarterly earnings digest missing.");
assert.equal(outlook.thesisImpact, "supports");
assert.equal(digest.companyKpis.length, 4, "Company KPIs must be capped at four.");
assert.equal(digest.guidance.length, 3, "Guidance must be capped at three.");
assert.equal(digest.highlights.length, 3, "Highlights must be capped at three.");
assert.equal(digest.concerns.length, 2, "Concerns must be capped at two.");

// 5) Inflated report must remain valid for the existing save pipeline.
const validation = validateExternalAnalysisReport(parsed.report);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));

// 6) Historical requirement lifecycle: OPEN -> matched -> EVALUATED.
let historicalRequirementSets = normalizeHistoricalRequirementSets({}, {
  [baseReport.company.ticker]: [baseReport]
});
const openSet = historicalRequirementSets[baseReport.company.ticker].find((set) => set.earningsPeriod === "Q4 2026");
assert.ok(openSet, "Q4 requirement set missing.");
assert.equal(openSet.status, "OPEN");

const prepared = prepareHistoricalRequirementEvaluation(parsed.report, historicalRequirementSets);
assert.equal(prepared.match.status, "matched");
assert.equal(prepared.match.set.requirementSetId, openSet.requirementSetId);

const firstSave = saveExternalAnalysis({}, baseReport, {
  allowDuplicate: true,
  now: new Date("2026-08-08T10:00:00.000Z")
});
const updateSave = saveExternalAnalysis(firstSave.collection, prepared.report, {
  allowDuplicate: true,
  now: new Date("2026-11-08T12:00:00.000Z")
});
historicalRequirementSets = applyHistoricalRequirementLifecycle(
  historicalRequirementSets,
  updateSave.report,
  prepared.match,
  new Date("2026-11-08T12:00:00.000Z")
);
const evaluatedSet = historicalRequirementSets[baseReport.company.ticker].find((set) => set.requirementSetId === openSet.requirementSetId);
assert.equal(evaluatedSet.status, "EVALUATED");
assert.equal(evaluatedSet.requirements.some((item) => item.status === "FAILED"), true);
assert.equal(evaluatedSet.requirements.some((item) => item.status === "PASSED" || item.status === "EXCEEDED"), true);

// 7) Scorecard consumes the saved quarter without fabricating other quarters.
const scorecard = buildQuarterlyScorecard({
  historicalRequirementSets,
  externalAnalyses: updateSave.collection,
  ticker: baseReport.company.ticker,
  year: 2026
});
assert.equal(scorecard.year, 2026);
assert.equal(scorecard.quarters.length, 4);
assert.equal(scorecard.quarters[3].evaluated, true, "Q4 should be reported.");
assert.equal(scorecard.quarters[3].outlook.thesisImpact, "supports");
for (const quarter of [0, 1, 2]) {
  assert.equal(scorecard.quarters[quarter].evaluated, false, `Q${quarter + 1} must remain neutral in this QA scenario.`);
}

// 8) Wrong ticker and missing base report fail safely instead of contaminating another stock.
await assert.rejects(
  () => parseExternalAnalysisInput(JSON.stringify({ ...litePayload, ticker: "WRONG" }), { currentReport: baseReport }),
  /Ticker mismatch/
);
setQuarterlyEarningsLiteReportResolver(null);
await assert.rejects(
  () => parseExternalAnalysisInput(JSON.stringify(litePayload)),
  /requires an existing saved report/
);

console.log("Full quarterly technical QA passed.");
