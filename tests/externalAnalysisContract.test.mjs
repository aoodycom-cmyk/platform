import assert from "node:assert/strict";
import {
  analysisContractRequiredFields,
  buildExternalAnalysisJsonTemplate,
  buildFullAnalysisPrompt,
  buildNewEarningsAnalysisPrompt
} from "../src/externalAnalysis/chatgptContract.js";

const prompt = buildFullAnalysisPrompt({ tickerHint: "aaoi" });
assert.ok(prompt.includes("Fair value"), "Prompt must identify the Fair value ChatGPT system.");
assert.ok(prompt.includes("company.ticker"), "Prompt must name required schema paths.");
assert.ok(prompt.includes("companyProfile"), "Prompt must require the educational company profile object.");
assert.ok(prompt.includes("للمستثمر الذكي"), "Prompt must ask for simple Arabic company-profile explanations.");
assert.ok(prompt.includes("fairValueSummary"), "Prompt must include Fair value summary fields.");
assert.ok(prompt.includes("Conservative"), "Prompt must document Fair value scenarios.");
assert.ok(prompt.includes('"ticker": "AAOI"'), "Prompt template must carry the entered ticker.");
assert.equal(prompt.includes('"ticker": "TICKER"'), false, "Prompt must not use TICKER as a placeholder value.");
assert.equal(prompt.includes("```"), false, "Prompt must not use Markdown fences.");

const template = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "msft" }));
assert.equal(template.schemaVersion, "fair-value-analysis/v2");
assert.equal(template.methodologyVersion, "fair-value-system/v1");
assert.equal(template.company.ticker, "MSFT");
assert.equal(Object.hasOwn(template.company, "currentPrice"), false);
assert.equal(template.fairValueSummary.currentPrice, null);
assert.equal(template.companyProfile.summary, null);
assert.deepEqual(Object.keys(template.companyProfile.activities[0]), ["name", "arabicName", "description", "importance"]);
assert.equal(template.businessQuality.score, null);
assert.equal(template.fairValueSummary.fairValueBase, null);
assert.deepEqual(template.risks, []);
assert.equal(template.decision.action, null);
assert.equal(template.estimateRevisions.overallDirection, "unknown");
assert.equal(Object.hasOwn(template, "dashboardExport"), false);
assert.equal(Object.hasOwn(template, "recommendation"), false);

const blankTemplate = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "TICKER" }));
assert.equal(blankTemplate.company.ticker, null, "Placeholder ticker must normalize to null.");

const earningsPrompt = buildNewEarningsAnalysisPrompt({
  id: "MSFT-2026-08-01",
  analysisDate: "2026-08-01",
  reportPeriod: "Q4 2026",
  company: { ticker: "MSFT", name: "Microsoft", currency: "USD" },
  fairValueSummary: { fairValueLow: 380, fairValueBase: 435, fairValueHigh: 500, currentPrice: 451 },
  decision: { action: "BUY" },
  thesis: { shortSummary: "فرضية عربية محفوظة." },
  risks: [{ title: "مخاطر التقييم" }],
  priceTargetRequirements: {
    requirementSetId: "MSFT_Q4_2026",
    currentJustifiedValue: 435,
    targetValue: 500,
    targetScenario: "bull",
    earningsPeriod: "Q4 2026",
    requirements: [
      { id: "azure_growth", name: "Revenue Growth", arabicName: "نمو Azure", requiredValue: 30, unit: "%", weight: 40, whyItMatters: "يدعم Bull Case." }
    ]
  }
});
assert.ok(earningsPrompt.includes("تحليل إعلان أرباح جديد") || earningsPrompt.includes("إعلان أرباح جديد"), "Earnings prompt must be purpose-specific.");
assert.ok(earningsPrompt.includes("azure_growth"), "Earnings prompt must include saved requirement IDs.");
assert.ok(earningsPrompt.includes("MSFT_Q4_2026"), "Earnings prompt must include the historical requirement set ID.");
assert.ok(earningsPrompt.includes("previousRequirementsEvaluation"), "Earnings prompt must include the importable previousRequirementsEvaluation template.");
assert.ok(earningsPrompt.includes('"ticker": "MSFT"'), "Earnings prompt template must carry the selected ticker.");
assert.equal(/OPENAI_API|api\/|fetch\(/i.test(earningsPrompt), false, "Earnings prompt must not require an API call.");

const requiredFields = analysisContractRequiredFields().map((field) => field.path);
for (const field of [
  "company.ticker",
  "analysisDate",
  "fairValueSummary.currentPrice",
  "fairValueSummary.fairValueLow",
  "fairValueSummary.fairValueBase",
  "fairValueSummary.fairValueHigh",
  "thesis.shortSummary",
  "risks",
  "decision.action"
]) {
  assert.ok(requiredFields.includes(field), `${field} must be documented as required.`);
}

console.log("External analysis ChatGPT contract tests passed.");
