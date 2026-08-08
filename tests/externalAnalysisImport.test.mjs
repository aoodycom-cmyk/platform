import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import {
  findDuplicateExternalAnalysis,
  getExternalAnalysis,
  saveExternalAnalysis
} from "../src/externalAnalysis/storage.js";

const now = new Date("2026-07-31T10:00:00.000Z");

const validReport = {
  source: "ChatGPT",
  sourceModel: "gpt-5",
  analysisDate: "2026-07-31",
  reportPeriod: "Q2 2026",
  company: { ticker: "AMZN", name: "Amazon.com, Inc.", sector: "Consumer Discretionary", industry: "Internet Retail", currency: "USD" },
  market: { priceAtAnalysis: 264, userAverageCost: null },
  scores: { quality: 9.3, growth: 9.5, valuation: 7.5, risk: 5, overall: 8.7, moat: null, management: null },
  fairValue: { bear: 215, base: 290, bull: 350, weightedFairValue: null, analystFairValue: 290, upsideToBasePct: 9.8, downsideToBearPct: -18.6, upsideToBullPct: 32.6 },
  valuationMethods: { dcf: { fairValue: 300 }, pe: { fairValue: 280 }, evEbitda: null, ps: null, peg: null, sotp: null, other: null },
  thesis: { shortSummary: "AWS and advertising support long-term compounding.", fullSummary: null },
  risks: [{ title: "Margin compression", severity: "Medium", explanation: "Retail margins could weaken." }],
  catalysts: [{ title: "AWS acceleration", explanation: "Cloud growth improves." }],
  watchItems: ["AWS revenue growth", "Operating Margin"],
  decision: { verdict: "HOLD / ACCUMULATE ON WEAKNESS", rationale: "Upside exists but valuation is not deeply discounted.", buyZone: null, fairZone: null, expensiveZone: null }
};

const rawJson = JSON.stringify(validReport);
const parsedJson = await parseExternalAnalysisInput(rawJson, { now });
assert.equal(parsedJson.usedAi, false);
assert.equal(parsedJson.report.company.ticker, "AMZN");
assert.equal(parsedJson.report.analysisOrigin, "external_chatgpt");
assert.equal(parsedJson.report.fairValue.base, 290);
assert.equal(parsedJson.report.decision.verdict, "HOLD / ACCUMULATE ON WEAKNESS");

let structuredJsonFallbackCalled = false;
const parsedJsonWithFallback = await parseExternalAnalysisInput(rawJson, {
  now,
  parseUnstructured: async () => {
    structuredJsonFallbackCalled = true;
    throw new Error("Structured JSON import must not call the backend parser.");
  }
});
assert.equal(parsedJsonWithFallback.usedAi, false);
assert.equal(structuredJsonFallbackCalled, false);

const parsedText = await parseExternalAnalysisInput("تحليل نصي غير منظم", {
  now,
  parseUnstructured: async () => ({ source: "OpenAI", report: validReport })
});
assert.equal(parsedText.usedAi, true);
assert.equal(parsedText.report.source, "ChatGPT");
assert.equal(parsedText.report.fairValue.bear, 215);

const missingOptional = normalizeExternalAnalysisReport({
  ...validReport,
  valuationMethods: {},
  scores: { quality: 8, growth: 8, valuation: 8, risk: 3 },
  fairValue: { bear: 100, base: 130, bull: 160 }
}, rawJson, { now });
assert.equal(missingOptional.scores.overall, null);
assert.equal(missingOptional.valuationMethods.dcf, null);
assert.equal(missingOptional.market.userAverageCost, null);

const invalidRequired = validateExternalAnalysisReport(normalizeExternalAnalysisReport({ ...validReport, company: { ticker: "" } }, rawJson, { now }));
assert.equal(invalidRequired.valid, false);
assert.ok(invalidRequired.errors.some((error) => error.field === "company.ticker"));

const invalidScore = validateExternalAnalysisReport(normalizeExternalAnalysisReport({
  ...validReport,
  scores: { ...validReport.scores, quality: -1 }
}, rawJson, { now }));
assert.equal(invalidScore.valid, false);
assert.ok(invalidScore.errors.some((error) => error.field === "scores.quality"));

const valid = validateExternalAnalysisReport(parsedJson.report);
assert.equal(valid.valid, true);

const fairValueJson = JSON.stringify({
  schemaVersion: "fair-value-analysis/v1",
  methodologyVersion: "fair-value-system/v1",
  language: "ar",
  analysisDate: "2026-08-01",
  company: {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology",
    industry: "Software",
    currency: "USD",
    currentPrice: 451,
    priceTimestamp: "2026-08-01"
  },
  dataQuality: {
    score: 92,
    confidence: 88,
    missingCriticalFields: [],
    reportedDataThrough: "FY2026 Q2",
    notes: []
  },
  classification: {
    companyType: "شركة نمو مربحة",
    businessStage: "ناضجة",
    cyclicality: "منخفضة",
    capitalIntensity: "متوسطة",
    evidence: ["Azure growth"],
    confidence: 90
  },
  executiveDecision: {
    recommendation: "BUY",
    confidence: 91,
    investmentScore: 95,
    currentPrice: 451,
    fairValue: 435,
    fairValueLow: 380,
    fairValueHigh: 500,
    upsideDownsidePercent: -4,
    marginOfSafetyPercent: -4,
    why: ["جودة Microsoft عالية ونمو Azure والذكاء الاصطناعي يدعم الفرضية."]
  },
  businessQuality: {
    score: 99,
    rating: "High",
    confidence: 90,
    components: {
      growth: 98,
      profitability: 97,
      cashFlow: 85,
      balanceSheet: 90,
      capitalAllocation: 88,
      competitiveAdvantage: 95,
      management: 90
    },
    explanation: "الشركة تتمتع بجودة تشغيلية عالية."
  },
  strengths: [{ title: "Azure", explanation: "نمو قوي.", evidence: ["Cloud revenue"], importance: 5, durability: "مرتفعة", valuationImpact: "يرفع القيمة العادلة", confidence: 90 }],
  weaknesses: [{ title: "التقييم", explanation: "السهم ليس رخيصًا.", evidence: ["Multiple elevated"], severity: 3, persistence: "متوسطة", valuationImpact: "يحد من الصعود", monitoringIndicator: "Forward P/E", confidence: 85 }],
  valuationMethodology: {
    primaryMethod: "DCF",
    secondaryMethods: ["P/E"],
    excludedMethods: ["Price to Book"],
    selectionReason: "FCF قابل للتوقع.",
    methodExplanations: [],
    exclusionReasons: [],
    modelWeights: [{ method: "DCF", weight: 70 }, { method: "P/E", weight: 30 }],
    weightReasoning: "DCF أكثر ملاءمة.",
    limitations: ["حساسية WACC"]
  },
  valuationResults: [
    { method: "DCF", role: "primary", whySuitable: "FCF مستقر.", assumptions: {}, inputs: {}, fairValue: 440, weight: 70, confidence: 88, source: "Analyst", explanation: "DCF رئيسي.", limitation: "WACC" },
    { method: "P/E", role: "secondary", whySuitable: "الأرباح موجبة.", assumptions: {}, inputs: {}, fairValue: 425, weight: 30, confidence: 80, source: "Analyst", explanation: "Cross-check.", limitation: "Multiple sensitivity" }
  ],
  forecastAssumptions: { sourcePriority: [], yearlyForecast: [], wacc: { value: 9, reason: "مخاطر معتدلة.", rangeLow: 8, rangeHigh: 10 }, terminalGrowth: { value: 3, reason: "نمو ناضج." }, sensitivity: [], confidence: 86 },
  scenarios: {
    Conservative: { enabled: true, probability: 25, fairValue: 380, upsideDownsidePercent: -16, assumptions: {}, requiredOutcomes: [], thesis: "تباطؤ النمو.", keyRisks: ["تباطؤ Azure"] },
    Base: { enabled: true, probability: 50, fairValue: 435, upsideDownsidePercent: -4, assumptions: {}, requiredOutcomes: [], thesis: "نمو مستقر.", keyRisks: ["CapEx"] },
    Optimistic: { enabled: true, probability: 25, fairValue: 500, upsideDownsidePercent: 11, assumptions: {}, requiredOutcomes: [], thesis: "تسارع AI.", keyRisks: [] },
    Exceptional: { enabled: false, probability: 0, fairValue: null, upsideDownsidePercent: null, assumptions: {}, requiredOutcomes: [], thesis: null, keyRisks: [] }
  },
  fairValueSummary: {
    fairValueLow: 380,
    fairValueBase: 435,
    fairValueHigh: 500,
    probabilityWeightedFairValue: 438,
    currentPrice: 451,
    upsideDownsidePercent: -4,
    marginOfSafetyPercent: -4,
    confidenceLevel: 88
  },
  catalysts: ["نمو Azure", "تبني Copilot"],
  risks: ["ارتفاع التقييم", "تباطؤ Azure"],
  whatChangesMyMind: { items: [], biggestAssumption: "استمرار نمو Azure", upgradeTrigger: "هبوط السعر", downgradeTrigger: "ضغط الهوامش", thesisBreak: "تباطؤ جوهري", revaluationRequired: [] },
  finalDecision: { decision: "BUY", why: ["جودة عالية ونمو قوي."], whyNot: ["التقييم مرتفع."], biggestAssumption: "Azure", mainRisk: "التقييم", whatChangesTheDecision: [], policyGates: [] },
  monitoringChecklist: [{ metric: "Azure Growth", currentValue: "High", expectedRange: "Healthy", upgradeTrigger: "Acceleration", downgradeTrigger: "Slowdown", thesisBreak: "Sharp slowdown", revaluationEvent: "Earnings" }],
  sources: [{ name: "Microsoft Investor Relations", type: "official", date: "2026-08-01", url: "https://www.microsoft.com/en-us/investor/", usedFor: ["earnings"] }],
  dashboardExport: { approvedOnly: false, exported: false, ticker: "MSFT", recommendation: "BUY", currentPrice: 451, fairValue: 435, fairValueLow: 380, fairValueHigh: 500, upsideDownsidePercent: -4, investmentScore: 95, confidence: 91, primaryValuationMethod: "DCF", strengthsCount: 1, weaknessesCount: 1 }
});
const parsedFairValue = await parseExternalAnalysisInput(fairValueJson, { now });
assert.equal(parsedFairValue.usedAi, false);
assert.equal(parsedFairValue.parserSource, "Local JSON Parser");
assert.equal(parsedFairValue.report.schemaVersion, "external-analysis-report/v1");
assert.equal(parsedFairValue.report.metadata.nativeSchemaVersion, "fair-value-analysis/v1");
assert.equal(parsedFairValue.report.metadata.nativeMethodologyVersion, "fair-value-system/v1");
assert.equal(parsedFairValue.report.company.ticker, "MSFT");
assert.equal(parsedFairValue.report.market.priceAtAnalysis, 451);
assert.equal(parsedFairValue.report.scores.quality, 9.9);
assert.equal(parsedFairValue.report.scores.growth, 9.8);
assert.equal(parsedFairValue.report.scores.overall, 9.5);
assert.equal(parsedFairValue.report.fairValue.bear, 380);
assert.equal(parsedFairValue.report.fairValue.base, 435);
assert.equal(parsedFairValue.report.fairValue.bull, 500);
assert.equal(parsedFairValue.report.valuationMethods.dcf.fairValue, 440);
assert.equal(parsedFairValue.report.decision.verdict, "BUY");
assert.equal(validateExternalAnalysisReport(parsedFairValue.report).valid, true);

let saved = saveExternalAnalysis({}, parsedJson.report, { now });
assert.equal(saved.duplicate, null);
assert.equal(saved.report.fairValue.base, 290);
assert.equal(saved.report.decision.verdict, "HOLD / ACCUMULATE ON WEAKNESS");
assert.equal(saved.report.rawAnalysisOriginal, rawJson);

const duplicate = findDuplicateExternalAnalysis(saved.collection, parsedJson.report);
assert.equal(duplicate.id, saved.report.id);
const rejectedDuplicate = saveExternalAnalysis(saved.collection, parsedJson.report, { now });
assert.equal(Boolean(rejectedDuplicate.duplicate), true);
assert.equal(rejectedDuplicate.collection.AMZN.length, 1);

const laterReport = normalizeExternalAnalysisReport({
  ...validReport,
  analysisDate: "2026-10-30",
  reportPeriod: "Q3 2026",
  market: { priceAtAnalysis: 281 },
  fairValue: { ...validReport.fairValue, base: 310 },
  decision: { ...validReport.decision, verdict: "HOLD" }
}, "later AMZN report", { now: new Date("2026-10-30T10:00:00.000Z"), importMethod: "structured_json" });
saved = saveExternalAnalysis(saved.collection, laterReport, { now: new Date("2026-10-30T10:00:00.000Z") });
assert.equal(saved.collection.AMZN.length, 2);
assert.equal(getExternalAnalysis(saved.collection, "AMZN", "latest").fairValue.base, 310);
assert.equal(getExternalAnalysis(saved.collection, "AMZN", duplicate.id).fairValue.base, 290);

const externalFiles = [
  "../src/externalAnalysis/schema.js",
  "../src/externalAnalysis/parser.js",
  "../src/externalAnalysis/externalAnalysisSchemaValidator.js",
  "../src/externalAnalysis/storage.js",
  "../src/externalAnalysis/reportAdapter.js"
].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
for (const forbidden of ["valuationEngine", "decisionEngine", "scoringEngines", "runInvestmentAnalystBrainValuation", "runFixedMethodologyValuation"]) {
  assert.equal(externalFiles.includes(forbidden), false, `External import must not call ${forbidden}`);
}

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
assert.ok(components.includes("externalAnalysisReportView"));
assert.ok(components.includes("Import Analysis"));
assert.ok(components.includes("Raw Analysis"));

console.log("External ChatGPT analysis import tests passed.");
