import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { analyzeExternalAnalysisCompletion, attachCompletionStatus, buildMissingRequirementsPrompt } from "../src/externalAnalysis/missingFields.js";
import { parseExternalAnalysisSupplement } from "../src/externalAnalysis/supplementParser.js";
import { validateExternalAnalysisSupplement } from "../src/externalAnalysis/supplementValidator.js";
import { mergeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementMerge.js";
import { copyableExternalAnalysisJson, externalAnalysisToHomeCard } from "../src/externalAnalysis/reportAdapter.js";

const now = new Date("2026-07-31T10:00:00.000Z");

function report(input, raw = "ORIGINAL RAW") {
  return normalizeExternalAnalysisReport(input, raw, { now });
}

const incomplete = report({
  id: "external-AMZN-2026-07-31-abc123",
  analysisDate: "2026-07-31",
  reportPeriod: "Q2 2026",
  company: { ticker: "AMZN", name: "Amazon" },
  market: { priceAtAnalysis: 264 },
  scores: { quality: 9.3, growth: null, valuation: null, risk: 5 },
  fairValue: { bear: null, base: null, bull: null },
  thesis: { shortSummary: null },
  risks: [],
  decision: { verdict: null }
});

const validation = validateExternalAnalysisReport(incomplete);
const completion = analyzeExternalAnalysisCompletion(incomplete, validation, { now });
assert.equal(completion.status, "incomplete");
assert.ok(completion.missingRequiredPaths.includes("fairValue.base"));
assert.ok(completion.missingRequiredPaths.includes("scores.growth"));
assert.ok(completion.missingRequiredPaths.includes("risks"));
assert.ok(completion.missingRequiredPaths.includes("decision.verdict"));
assert.ok(completion.missingRecommendedPaths.includes("sources"));
assert.ok(completion.missingOptionalPaths.includes("company.sector"));
assert.equal(completion.requiredComplete < completion.requiredTotal, true);

const prompt = buildMissingRequirementsPrompt(incomplete, completion);
assert.ok(prompt.text.includes("fairValue.base"));
assert.ok(prompt.text.includes("decision.verdict"));
assert.ok(prompt.text.includes('"schemaVersion": "external-analysis-supplement/v1"'));
assert.equal(prompt.text.includes("company.sector"), false, "Optional fields must not be included in the default missing prompt.");

const noTickerReport = report({
  id: null,
  analysisDate: "2026-08-01",
  company: { ticker: null, name: null },
  market: { priceAtAnalysis: 451 },
  scores: { quality: 8, growth: 7, valuation: 6, risk: 4 },
  fairValue: { bear: 360, base: 475, bull: 560 },
  thesis: { shortSummary: "Ticker missing only." },
  risks: [{ title: "Competition" }],
  decision: { verdict: "HOLD" }
});
const noTickerValidation = validateExternalAnalysisReport(noTickerReport);
const noTickerCompletion = analyzeExternalAnalysisCompletion(noTickerReport, noTickerValidation, { now });
assert.ok(noTickerCompletion.missingRequiredPaths.includes("company.ticker"));
const noTickerPrompt = buildMissingRequirementsPrompt(noTickerReport, noTickerCompletion);
assert.equal(noTickerPrompt.text.includes("TICKER TICKER"), false, "Missing ticker prompt must not say TICKER TICKER.");
assert.ok(noTickerPrompt.text.includes('"ticker": null'), "Missing ticker prompt should leave top-level supplement ticker null.");

const tickerFieldSupplement = (await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AAOI",
  targetAnalysisId: null,
  analysisDate: "2026-08-01",
  fields: { "company.ticker": "AAOI" },
  notes: []
}), { existingReport: noTickerReport, now })).supplement;
assert.equal(validateExternalAnalysisSupplement(tickerFieldSupplement, noTickerReport).valid, true, "Supplement may fill company.ticker when the report has no ticker.");
const tickerFieldMerge = mergeExternalAnalysisSupplement(attachCompletionStatus(noTickerReport, noTickerValidation), tickerFieldSupplement, { now });
assert.equal(tickerFieldMerge.report.company.ticker, "AAOI");
assert.equal(tickerFieldMerge.report.completionStatus.missingRequiredPaths.includes("company.ticker"), false);

const topLevelTickerSupplement = (await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AAOI",
  targetAnalysisId: null,
  analysisDate: "2026-08-01",
  fields: { "company.ticker": null },
  notes: []
}), { existingReport: noTickerReport, now })).supplement;
const topLevelTickerMerge = mergeExternalAnalysisSupplement(noTickerReport, topLevelTickerSupplement, { now });
assert.equal(topLevelTickerMerge.report.company.ticker, "AAOI", "Top-level supplement ticker should fill missing company.ticker.");
assert.equal(validateExternalAnalysisReport({ ...noTickerReport, company: { ticker: "TICKER" } }).valid, false, "Placeholder TICKER must not satisfy ticker validation.");

const placeholderTickerReport = report({
  ...noTickerReport,
  company: { ticker: "TICKER", name: null }
});
const placeholderTickerValidation = validateExternalAnalysisReport(placeholderTickerReport);
const placeholderTickerCompletion = analyzeExternalAnalysisCompletion(placeholderTickerReport, placeholderTickerValidation, { now });
assert.ok(placeholderTickerCompletion.missingRequiredPaths.includes("company.ticker"), "Placeholder TICKER must remain a missing completion field.");
const realTickerSupplement = (await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "MSFT",
  targetAnalysisId: null,
  analysisDate: "2026-08-01",
  fields: { "company.ticker": null },
  notes: []
}), { existingReport: placeholderTickerReport, now })).supplement;
assert.equal(validateExternalAnalysisSupplement(realTickerSupplement, placeholderTickerReport).valid, true, "Real supplement ticker may replace a placeholder report ticker.");
const realTickerMerge = mergeExternalAnalysisSupplement(attachCompletionStatus(placeholderTickerReport, placeholderTickerValidation), realTickerSupplement, { now });
assert.equal(realTickerMerge.report.company.ticker, "MSFT");

const supplementJson = JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AMZN",
  targetAnalysisId: "external-AMZN-2026-07-31-abc123",
  analysisDate: "2026-07-31",
  fields: {
    "scores.growth": 9.5,
    "scores.valuation": 7.5,
    "fairValue.bear": 215,
    "fairValue.base": 290,
    "fairValue.bull": 350,
    "thesis.shortSummary": "AWS and advertising support long-term compounding.",
    "risks": [{ title: "Margin compression", severity: "Medium", explanation: "Retail margins could weaken." }],
    "decision.verdict": "HOLD / ACCUMULATE ON WEAKNESS",
    "decision.rationale": "Upside exists but valuation is not deeply discounted."
  },
  notes: ["EPS المعلن يحتاج normalization."]
});

const parsedLocal = await parseExternalAnalysisSupplement(supplementJson, { existingReport: incomplete, now });
assert.equal(parsedLocal.usedAi, false);
assert.equal(parsedLocal.supplement.fields["fairValue.base"], 290);

const smartQuoteSupplementText = JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AMZN",
  targetAnalysisId: "external-AMZN-2026-07-31-abc123",
  analysisDate: "2026-07-31",
  fields: {
    "scores.growth": 9.5,
    "scores.valuation": 7.5,
    "fairValue.bear": 215,
    "fairValue.base": 290,
    "fairValue.bull": 350,
    "thesis.shortSummary": "AWS and advertising support long-term compounding.",
    "risks": ["Margin compression", "Cloud competition"],
    "decision.verdict": "HOLD",
    "sources": [{ name: "Amazon Investor Relations", type: "official", url: "https://ir.aboutamazon.com" }]
  },
  notes: []
}).replace(/"/g, "\u201c");
const parsedSmartQuote = await parseExternalAnalysisSupplement(smartQuoteSupplementText, { existingReport: incomplete, now });
assert.equal(parsedSmartQuote.usedAi, false, "Smart-quote JSON must parse locally without AI fallback.");
assert.equal(parsedSmartQuote.supplement.fields["fairValue.base"], 290);
assert.equal(parsedSmartQuote.supplement.fields.risks[0].title, "Margin compression");
assert.equal(parsedSmartQuote.supplement.fields.sources[0].title, "Amazon Investor Relations");
assert.equal(parsedSmartQuote.supplement.fields.sources[0].sourceType, "official");
const smartQuoteValidation = validateExternalAnalysisSupplement(parsedSmartQuote.supplement, incomplete);
assert.equal(smartQuoteValidation.valid, true);
const smartQuoteMerge = mergeExternalAnalysisSupplement(attachCompletionStatus(incomplete, validation), parsedSmartQuote.supplement, { now });
assert.equal(smartQuoteMerge.report.risks[0].title, "Margin compression");
assert.equal(smartQuoteMerge.report.sources[0].sourceType, "official");
assert.equal(smartQuoteMerge.report.completionStatus.missingRequiredPaths.includes("risks"), false);

const parsedNatural = await parseExternalAnalysisSupplement("نص طبيعي من ChatGPT", {
  existingReport: incomplete,
  now,
  parseUnstructured: async () => ({
    source: "OpenAI",
    supplement: JSON.parse(supplementJson)
  })
});
assert.equal(parsedNatural.usedAi, true);
assert.equal(parsedNatural.supplement.fields["decision.verdict"], "HOLD / ACCUMULATE ON WEAKNESS");

const supplementValidation = validateExternalAnalysisSupplement(parsedLocal.supplement, incomplete);
assert.equal(supplementValidation.valid, true);

const merged = mergeExternalAnalysisSupplement(attachCompletionStatus(incomplete, validation), parsedLocal.supplement, { now });
assert.equal(merged.conflicts.length, 0);
assert.equal(merged.report.fairValue.base, 290);
assert.equal(merged.report.decision.verdict, "HOLD / ACCUMULATE ON WEAKNESS");
assert.equal(merged.report.rawAnalysisOriginal, "ORIGINAL RAW");
assert.equal(merged.report.supplements.length, 1);
assert.equal(merged.report.supplements[0].rawSupplement, supplementJson);
assert.ok(merged.report.supplements[0].appliedFields.some((item) => item.path === "fairValue.base"));
assert.equal(merged.validation.valid, true);
assert.equal(merged.report.completionStatus.status, "complete");
const homeCardWithCompletion = externalAnalysisToHomeCard(merged.report);
assert.equal(homeCardWithCompletion.completionStatus.status, "complete");
assert.equal(homeCardWithCompletion.completionStatus.completionPct, 100);
const exportedWithoutStoredCompletion = JSON.parse(copyableExternalAnalysisJson({ ...merged.report, completionStatus: undefined }));
assert.equal(exportedWithoutStoredCompletion.completionStatus.status, "complete");
assert.equal(exportedWithoutStoredCompletion.completionStatus.requiredComplete, exportedWithoutStoredCompletion.completionStatus.requiredTotal);

const conflictingSupplement = (await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AMZN",
  targetAnalysisId: "external-AMZN-2026-07-31-abc123",
  fields: { "fairValue.base": 305, "decision.verdict": "BUY" }
}), { existingReport: merged.report, now })).supplement;
const conflictPreview = mergeExternalAnalysisSupplement(merged.report, conflictingSupplement, { now });
assert.equal(conflictPreview.conflicts.length, 2);
assert.equal(conflictPreview.report.fairValue.base, 290, "Existing value must not be replaced without approval.");

const resolved = mergeExternalAnalysisSupplement(merged.report, conflictingSupplement, {
  now,
  resolutions: { "fairValue.base": "use-new", "decision.verdict": "keep-current" }
});
assert.equal(resolved.report.fairValue.base, 305);
assert.equal(resolved.report.decision.verdict, "HOLD / ACCUMULATE ON WEAKNESS");

const wrongTicker = await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AAPL",
  targetAnalysisId: "external-AMZN-2026-07-31-abc123",
  fields: { "fairValue.base": 290 }
}), { existingReport: incomplete, now });
assert.equal(validateExternalAnalysisSupplement(wrongTicker.supplement, incomplete).valid, false);

const placeholderTickerReply = await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "TICKER",
  targetAnalysisId: null,
  analysisDate: null,
  fields: {
    "analysisDate": null,
    "market.priceAtAnalysis": null,
    "scores.quality": null,
    "fairValue.base": null,
    "decision.verdict": null
  },
  notes: []
}), { existingReport: { ...incomplete, company: { ...incomplete.company, ticker: "MSFT" } }, now });
const placeholderValidation = validateExternalAnalysisSupplement(placeholderTickerReply.supplement, { ...incomplete, company: { ...incomplete.company, ticker: "MSFT" } });
assert.equal(placeholderValidation.valid, false, "Placeholder TICKER supplement must be rejected.");
assert.ok(placeholderValidation.errors.some((item) => item.field === "ticker"));
assert.ok(placeholderValidation.errors.some((item) => item.field === "fields"), "All-null supplement must be rejected as non-useful.");

const allNullReply = await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "MSFT",
  targetAnalysisId: null,
  analysisDate: null,
  fields: {
    "analysisDate": null,
    "market.priceAtAnalysis": null,
    "scores.quality": null
  },
  notes: []
}), { existingReport: { ...incomplete, company: { ...incomplete.company, ticker: "MSFT" } }, now });
assert.equal(validateExternalAnalysisSupplement(allNullReply.supplement, { ...incomplete, company: { ...incomplete.company, ticker: "MSFT" } }).valid, false, "All-null supplement with correct ticker must still be rejected.");

const wrongId = await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AMZN",
  targetAnalysisId: "wrong-id",
  fields: { "fairValue.base": 290 }
}), { existingReport: incomplete, now });
assert.equal(validateExternalAnalysisSupplement(wrongId.supplement, incomplete).valid, false);

const badOrdering = report({
  analysisDate: "2026-07-31",
  company: { ticker: "BAD", name: "Bad Ordering" },
  market: { priceAtAnalysis: 100 },
  scores: { quality: 7, growth: 7, valuation: 7, risk: 5 },
  fairValue: { bear: 120, base: 100, bull: 90 },
  thesis: { shortSummary: "Bad order." },
  risks: [{ title: "Risk" }],
  decision: { verdict: "HOLD" }
});
assert.equal(validateExternalAnalysisReport(badOrdering).valid, false, "Bear/Base/Bull ordering must be validated.");

const stillIncomplete = mergeExternalAnalysisSupplement(incomplete, (await parseExternalAnalysisSupplement(JSON.stringify({
  schemaVersion: "external-analysis-supplement/v1",
  ticker: "AMZN",
  targetAnalysisId: "external-AMZN-2026-07-31-abc123",
  fields: { "fairValue.base": 290 }
}), { existingReport: incomplete, now })).supplement, { now });
assert.equal(stillIncomplete.report.completionStatus.status, "incomplete");
const remainingPrompt = buildMissingRequirementsPrompt(stillIncomplete.report, stillIncomplete.report.completionStatus);
assert.ok(remainingPrompt.text.includes("fairValue.bear"));
assert.equal(remainingPrompt.text.includes("fairValue.base"), false);

const supplementFiles = [
  "../src/externalAnalysis/missingFields.js",
  "../src/externalAnalysis/supplementSchema.js",
  "../src/externalAnalysis/supplementParser.js",
  "../src/externalAnalysis/supplementValidator.js",
  "../src/externalAnalysis/supplementMerge.js"
].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
for (const forbidden of ["runFixedMethodologyValuation", "runInvestmentAnalystBrainValuation", "valuationEngine", "decisionEngine", "scoringEngines"]) {
  assert.equal(supplementFiles.includes(forbidden), false, `Completion workflow must not call ${forbidden}.`);
}

const oldReport = normalizeExternalAnalysisReport({
  analysisDate: "2026-07-31",
  company: { ticker: "OLD", name: "Old Stored Report" },
  market: { priceAtAnalysis: 10 },
  scores: { quality: 8, growth: 8, valuation: 8, risk: 4 },
  fairValue: { bear: 8, base: 12, bull: 16 },
  thesis: { shortSummary: "Old report." },
  risks: [{ title: "Risk" }],
  decision: { verdict: "HOLD" }
}, "old raw", { now });
assert.deepEqual(oldReport.supplements, [], "Old reports must normalize with an empty supplement audit trail.");

console.log("External analysis completion workflow tests passed.");
