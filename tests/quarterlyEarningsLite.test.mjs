import assert from "node:assert/strict";
import { createDemoExternalAnalysisScenario } from "../src/data/externalDemo.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import {
  QUARTERLY_EARNINGS_LITE_SCHEMA,
  buildQuarterlyEarningsLitePrompt,
  inflateQuarterlyEarningsLitePayload,
  isQuarterlyEarningsLitePayload
} from "../src/externalAnalysis/quarterlyEarningsLite.js";
import { QUARTERLY_FORWARD_OUTLOOK_KIND } from "../src/externalAnalysis/quarterlyForwardOutlook.js";

const current = createDemoExternalAnalysisScenario()[0];
const prompt = buildQuarterlyEarningsLitePrompt(current, {
  quarter: 4,
  year: 2026,
  earningsText: "Revenue was $1.1B and EPS was $3.20."
});

assert.ok(prompt.includes(QUARTERLY_EARNINGS_LITE_SCHEMA));
assert.ok(prompt.includes("لا تعمل DCF"));
assert.ok(prompt.includes("لا تحسب Fair Value جديدًا"));
assert.ok(prompt.includes("Forward Outlook"));
assert.ok(prompt.includes("thesisImpact"));
assert.ok(prompt.includes("فرضية الاستثمار الحالية للمقارنة فقط"));
assert.ok(prompt.includes("Observation للتقدم وليس حكمًا نهائيًا"));
assert.ok(prompt.includes("الربع المستهدف للمتطلبات الحالية"));
assert.ok(prompt.includes("حد أقصى 3"));
assert.ok(prompt.length < 12000, "Lite prompt should remain compact.");

const payload = {
  schemaVersion: QUARTERLY_EARNINGS_LITE_SCHEMA,
  ticker: current.company.ticker,
  quarter: "Q4",
  year: 2026,
  reportDate: "2026-11-08",
  requirementSetId: current.priceTargetRequirements.requirementSetId,
  summary: "الإيرادات وEPS كانا قويين، بينما الهامش بقي دون العتبة المطلوبة.",
  metrics: {
    revenue: { value: 1100, display: "$1.1B", consensusDisplay: "$1.05B", result: "BEAT" },
    revenueGrowthPct: { value: 34, display: "34%", consensusDisplay: "30%", result: "BEAT" },
    eps: { value: 3.2, display: "$3.20", consensusDisplay: "$3.00", result: "BEAT" },
    grossMarginPct: { value: 43, display: "43%", consensusDisplay: "45%", result: "MISS" },
    operatingMarginPct: { value: null, display: null, consensusDisplay: null, result: "NA" },
    freeCashFlow: { value: null, display: null, consensusDisplay: null, result: "NA" },
    cash: { value: null, display: null, consensusDisplay: null, result: "NA" },
    debt: { value: null, display: null, consensusDisplay: null, result: "NA" }
  },
  companyKpis: [],
  guidance: [{ topic: "Revenue", currentGuidance: "$1.2B-$1.3B", direction: "raised", interpretation: "تم رفع التوجيهات." }],
  forwardOutlook: {
    growthOutlook: "accelerating",
    marginOutlook: "pressured",
    guidanceTrend: "raised",
    managementTone: "positive",
    thesisImpact: "supports",
    summary: "الإدارة ترى طلبًا أقوى رغم ضغط استثماري مؤقت على الهوامش."
  },
  requirements: [
    { id: "revenue_growth", actualValue: 34, actualDisplay: "34%", status: "EXCEEDED", evaluationNote: "تجاوز المطلوب." },
    { id: "gross_margin", actualValue: 43, actualDisplay: "43%", status: "FAILED", evaluationNote: "أقل من 45%." },
    { id: "eps", actualValue: 3.2, actualDisplay: "$3.20", status: "PASSED", evaluationNote: "حقق المطلوب." },
    { id: "guidance", actualValue: "Raised", actualDisplay: "Raised", status: "PASSED", evaluationNote: "تم رفع Guidance." }
  ],
  highlights: ["نمو الإيرادات قوي", "EPS أعلى من المطلوب"],
  concerns: ["Gross Margin دون العتبة"]
};

assert.equal(isQuarterlyEarningsLitePayload(payload), true);
const inflated = inflateQuarterlyEarningsLitePayload(current, payload, JSON.stringify(payload), new Date("2026-11-08T12:00:00Z"));
assert.equal(inflated.id, null);
assert.equal(inflated.reportPeriod, "Q4 2026");
assert.equal(inflated.financialHighlights.revenue, 1100);
assert.equal(inflated.financialHighlights.epsReported, 3.2);
assert.equal(inflated.previousRequirementsEvaluation.requirements.length, 4);
assert.equal(inflated.previousRequirementsEvaluation.requirements[0].status, "EXCEEDED");
assert.equal(inflated.previousRequirementsEvaluation.targetQuarter, current.priceTargetRequirements.targetQuarter || current.priceTargetRequirements.earningsPeriod);
assert.equal(inflated.metadata.importMethod, "quarterly_earnings_lite");

// Quarterly updates must not overwrite the long-term investment analysis.
assert.deepEqual(inflated.fairValueSummary, current.fairValueSummary);
assert.deepEqual(inflated.thesis, current.thesis);
assert.deepEqual(inflated.decision, current.decision);
assert.deepEqual(inflated.risks, current.risks);
assert.deepEqual(inflated.catalysts, current.catalysts);

const outlook = inflated.supplements.find((item) => item.kind === QUARTERLY_FORWARD_OUTLOOK_KIND && item.period === "Q4 2026");
assert.ok(outlook, "Forward outlook should be stored as a quarterly supplement.");
assert.equal(outlook.growthOutlook, "accelerating");
assert.equal(outlook.marginOutlook, "pressured");
assert.equal(outlook.thesisImpact, "supports");
assert.equal(validateExternalAnalysisReport(inflated).valid, true);

console.log("Quarterly earnings lite tests passed.");
