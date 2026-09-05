import assert from "node:assert/strict";
import { createDemoExternalAnalysisScenario } from "../src/data/externalDemo.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import {
  QUARTERLY_EARNINGS_LITE_SCHEMA,
  buildQuarterlyEarningsLitePrompt,
  inflateQuarterlyEarningsLitePayload,
  isQuarterlyEarningsLitePayload,
  validateQuarterlyEarningsLitePayload
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
    revenue: metric(1100, "$1.1B", 1050, "$1.05B", "USD millions", "REPORTED", "BEAT"),
    revenueGrowthPct: metric(34, "34%", 30, "30%", "%", "REPORTED", "BEAT"),
    eps: metric(3.2, "$3.20", 3, "$3.00", "USD per share", "NON_GAAP", "BEAT"),
    grossMarginPct: metric(43, "43%", 45, "45%", "%", "NON_GAAP", "MISS"),
    operatingMarginPct: metric(),
    freeCashFlow: metric(),
    cash: metric(),
    debt: metric()
  },
  companyKpis: [],
  guidance: [{ topic: "Revenue", currentGuidance: "$1.2B-$1.3B", direction: "raised", interpretation: "تم رفع التوجيهات.", sourceId: "S1" }],
  forwardOutlook: {
    growthOutlook: "accelerating",
    marginOutlook: "pressured",
    guidanceTrend: "raised",
    managementTone: "positive",
    thesisImpact: "supports",
    summary: "الإدارة ترى طلبًا أقوى رغم ضغط استثماري مؤقت على الهوامش."
  },
  requirements: [
    requirement("revenue_growth", 34, "34%", "EXCEEDED", "تجاوز المطلوب."),
    requirement("gross_margin", 43, "43%", "FAILED", "أقل من 45%."),
    requirement("eps", 3.2, "$3.20", "PASSED", "حقق المطلوب."),
    requirement("guidance", "Raised", "Raised", "PASSED", "تم رفع Guidance.")
  ],
  requirementsAssessment: {
    weightedAchievement: 70,
    reportedRequirements: 4,
    totalRequirements: 4,
    passed: 2,
    failed: 1,
    exceeded: 1,
    partiallyPassed: 0,
    notReported: 0,
    overallStatus: "MIXED",
    summary: "ثلاثة متطلبات نجحت وGross Margin بقي دون المطلوب."
  },
  highlights: ["نمو الإيرادات قوي", "EPS أعلى من المطلوب"],
  concerns: ["Gross Margin دون العتبة"],
  sources: [
    {
      id: "S1",
      title: "Company Q4 earnings release",
      url: "https://example.com/investors/q4-2026",
      sourceType: "Investor Relations",
      date: "2026-11-08",
      usedFor: ["metrics", "guidance", "requirements"]
    },
    {
      id: "S2",
      title: "Q4 consensus snapshot",
      url: "https://example.com/consensus/q4-2026",
      sourceType: "Consensus Data",
      date: "2026-11-07",
      usedFor: ["revenue", "revenueGrowthPct", "eps", "grossMarginPct"]
    }
  ]
};

assert.equal(isQuarterlyEarningsLitePayload(payload), true);
assert.equal(validateQuarterlyEarningsLitePayload(payload, current).valid, true);
const inflated = inflateQuarterlyEarningsLitePayload(current, payload, JSON.stringify(payload), new Date("2026-11-08T12:00:00Z"));
const parsed = await parseExternalAnalysisInput(JSON.stringify(payload), {
  currentReport: current,
  now: new Date("2026-11-08T12:00:00Z")
});
assert.equal(parsed.schemaVersion, QUARTERLY_EARNINGS_LITE_SCHEMA);
assert.equal(parsed.report.sources[0].id, "S1");
assert.equal(inflated.id, null);
assert.equal(inflated.reportPeriod, "Q4 2026");
assert.equal(inflated.financialHighlights.revenue, 1100);
assert.equal(inflated.financialHighlights.epsReported, 3.2);
assert.equal(inflated.previousRequirementsEvaluation.requirements.length, 4);
assert.equal(inflated.previousRequirementsEvaluation.requirements[0].status, "EXCEEDED");
assert.equal(inflated.previousRequirementsEvaluation.requirements[0].name, current.priceTargetRequirements.requirements[0].name);
assert.equal(inflated.previousRequirementsEvaluation.requirements[0].requiredValue, current.priceTargetRequirements.requirements[0].requiredValue);
assert.equal(inflated.previousRequirementsEvaluation.requirements[0].weight, current.priceTargetRequirements.requirements[0].weight);
assert.equal(inflated.previousRequirementsEvaluation.requirementsAssessment.weightedAchievement, 70);
assert.equal(inflated.requirementsAssessment.passed, 2);
assert.equal(inflated.previousRequirementsEvaluation.targetQuarter, current.priceTargetRequirements.targetQuarter || current.priceTargetRequirements.earningsPeriod);
assert.equal(inflated.metadata.importMethod, "quarterly_earnings_lite");
assert.equal(inflated.metadata.quarterlySourcesProvided, true);
assert.equal(inflated.sources.length, 2);
assert.equal(inflated.sources[0].id, "S1");

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

expectInvalid((item) => { item.sources = []; }, /requires 1 to 5 sources/);
expectInvalid((item) => { item.metrics.revenue.result = "MISS"; }, /contradicts value/);
expectInvalid((item) => { item.reportDate = "2026-02-30"; }, /Report date is invalid/);
expectInvalid((item) => { item.sources[1].id = "S1"; }, /duplicate value S1/);
expectInvalid((item) => { item.requirementSetId = "WRONG_SET"; }, /frozen requirement set/);
expectInvalid((item) => {
  item.requirements.push(requirement("invented_metric", 1, "1", "PASSED", "Invented."));
}, /Unknown requirement id invented_metric/);
expectInvalid((item) => { item.requirementsAssessment.weightedAchievement = 71; }, /does not match frozen weights and statuses/);
expectInvalid((item) => { item.requirementsAssessment.overallStatus = "bull_case_strengthened"; }, /overallStatus is invalid/);
expectInvalid((item) => { item.requirements[0].unit = "basis points"; }, /preserve its frozen unit/);
expectInvalid((item) => { item.requirements[1].status = "PASSED"; }, /numeric threshold is not met/);
expectInvalid((item) => { item.requirements[0].actualValue = 30; }, /marked EXCEEDED without exceeding/);
expectInvalid((item) => { item.metrics.eps.consensusValue = null; }, /consensusDisplay cannot be populated|requires comparable/);
expectInvalid((item) => { item.temporaryOverride = true; }, /Unknown property temporaryOverride/);

console.log("Quarterly earnings lite tests passed.");

function metric(value = null, display = null, consensusValue = null, consensusDisplay = null, unit = null, accountingBasis = null, result = "NA") {
  return {
    value,
    display,
    consensusValue,
    consensusDisplay,
    unit,
    accountingBasis,
    result,
    sourceId: Number.isFinite(value) ? "S1" : null,
    consensusSourceId: Number.isFinite(consensusValue) ? "S2" : null
  };
}

function requirement(id, actualValue, actualDisplay, status, evaluationNote) {
  const units = { revenue_growth: "%", gross_margin: "%", eps: "USD", guidance: "text", invented_metric: "count" };
  return { id, actualValue, actualDisplay, unit: units[id] || null, status, partialCreditPct: null, evaluationNote, sourceId: actualValue === null ? null : "S1" };
}

function expectInvalid(mutator, pattern) {
  const value = JSON.parse(JSON.stringify(payload));
  mutator(value);
  const validation = validateQuarterlyEarningsLitePayload(value, current);
  assert.equal(validation.valid, false, `Expected invalid quarterly payload: ${validation.errors.map((item) => item.message).join(" | ")}`);
  assert.match(validation.errors.map((item) => item.message).join("\n"), pattern);
}
