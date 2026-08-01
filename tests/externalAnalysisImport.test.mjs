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
  scores: { ...validReport.scores, quality: 12 }
}, rawJson, { now }));
assert.equal(invalidScore.valid, false);
assert.ok(invalidScore.errors.some((error) => error.field === "scores.quality"));

const valid = validateExternalAnalysisReport(parsedJson.report);
assert.equal(valid.valid, true);

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
