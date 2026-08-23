import assert from "node:assert/strict";
import {
  analysisContractRequiredFields,
  buildExternalAnalysisJsonTemplate,
  buildFullAnalysisPrompt,
  buildNewEarningsAnalysisPrompt
} from "../src/externalAnalysis/chatgptContract.js";

const prompt = buildFullAnalysisPrompt({ tickerHint: "aaoi" });
assert.ok(prompt.includes("Fair value"), "Prompt must identify the Fair value ChatGPT system.");
assert.ok(prompt.includes("reportIdentity"), "Prompt must name v3 report identity paths.");
assert.ok(prompt.includes("companyProfile"), "Prompt must require the educational company profile object.");
assert.ok(prompt.includes("للمستثمر الذكي"), "Prompt must ask for simple Arabic company-profile explanations.");
assert.ok(prompt.includes("valuation.current"), "Prompt must include canonical valuation fields.");
assert.ok(prompt.includes("Bear وBase وBull"), "Prompt must document the three canonical scenarios.");
assert.ok(prompt.includes("nextRequirements.currentJustifiedValue"), "Prompt must enforce currentJustifiedValue = Base.");
assert.ok(prompt.includes("كل status في nextRequirements.requirements يجب أن يكون NOT_REPORTED"), "Future targets must not carry premature statuses.");
assert.ok(prompt.includes('"ticker": "AAOI"'), "Prompt template must carry the entered ticker.");
assert.equal(prompt.includes('"ticker": "TICKER"'), false, "Prompt must not use TICKER as a placeholder value.");
assertPromptOutputSafety(prompt, "Initial prompt");

const template = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "msft" }));
assert.equal(template.schemaVersion, "franklin-fair-value/v3");
assert.equal(template.methodologyVersion, "fair-value-methodology/v2");
assert.equal(template.analysisType, "INITIAL");
assert.equal(template.reportIdentity.ticker, "MSFT");
assert.equal(template.marketPrice.value, null);
assert.equal(template.companyProfile.summary, null);
assert.deepEqual(Object.keys(template.companyProfile.activities[0]), ["name", "arabicName", "description", "importance"]);
assert.equal(template.businessQuality.score, null);
assert.equal(template.valuation.current.base, null);
assert.equal(Array.isArray(template.risks), true);
assert.equal(template.risks[0].title, null);
assert.equal(template.decision.action, null);
assert.equal(template.nextRequirements.requirementSetId, null);
assert.equal(template.nextRequirements.currentJustifiedValue, null);
assert.equal(Object.hasOwn(template, "dashboardExport"), false);
assert.equal(Object.hasOwn(template, "recommendation"), false);

const blankTemplate = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "TICKER" }));
assert.equal(blankTemplate.reportIdentity.ticker, null, "Placeholder ticker must normalize to null.");

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
assert.ok(earningsPrompt.includes("nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base"), "Current justified value must equal the new Base.");
assert.ok(earningsPrompt.includes("Franklin لا يرفع الهدف آليًا ولا يحسب targetValue"), "Franklin must never invent or calculate the next target.");
assert.ok(earningsPrompt.includes("UPDATED أو UNCHANGED"), "The prompt must require an explicit valuation review result.");
assert.ok(earningsPrompt.includes('"ticker": "MSFT"'), "Earnings prompt template must carry the selected ticker.");
assert.equal(/OPENAI_API|api\/|fetch\(/i.test(earningsPrompt), false, "Earnings prompt must not require an API call.");
assertPromptOutputSafety(earningsPrompt, "Earnings prompt");

const invalidCanonicalOutputExamples = {
  escapedEnum: "LAST\\_CLOSE",
  markdownUrl: "[https://example.com/report](https://example.com/report)",
  decision: {
    confidence: "MEDIUM"
  }
};
assert.equal(invalidCanonicalOutputExamples.escapedEnum.includes("\\_"), true);
assert.equal(/\[[^\]]+\]\([^)]+\)/.test(invalidCanonicalOutputExamples.markdownUrl), true);
assert.equal(typeof invalidCanonicalOutputExamples.decision.confidence, "string");

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

function assertPromptOutputSafety(value, label) {
  assert.ok(value.includes("JSON.parse()"), `${label} must require JSON.parse validity.`);
  assert.ok(value.includes("Return exactly one fenced JSON code block"), `${label} must require fenced JSON output.`);
  assert.ok(value.includes("```json"), `${label} must require a json code fence.`);
  assert.ok(value.includes("Do not write any prose before or after the fenced JSON block"), `${label} must forbid prose outside the code block.`);
  assert.ok(value.includes("After removing only the opening ```json fence and closing ``` fence"), `${label} must keep the fenced content parseable as JSON.`);
  assert.ok(value.includes("NEVER escape underscores"), `${label} must prohibit escaped underscores.`);
  assert.ok(value.includes('"LAST\\_CLOSE"'), `${label} must show escaped underscores as invalid.`);
  assert.ok(value.includes("URL fields must contain raw URLs only"), `${label} must require raw URLs.`);
  assert.ok(value.includes("Never use Markdown links inside JSON"), `${label} must reject Markdown links.`);
  assert.ok(value.includes("Exactly one opening ```json fence and one closing ``` fence exist"), `${label} must limit output to one fenced block.`);
  assert.ok(value.includes("decision.confidence must be a number from 0 to 100 or null"), `${label} must keep decision confidence numeric.`);
  assert.ok(value.includes("businessQuality.score"), `${label} must mention business quality score scale.`);
  assert.ok(value.includes("0-100 scale, NOT 0-10"), `${label} must force 0-100 numeric scores.`);
  assert.ok(value.includes("nextRequirements.requirementSetId"), `${label} must define requirement set identity handling.`);
  assert.ok(value.includes("Franklin يعيّن Requirement Set ID"), `${label} must prevent ChatGPT from inventing persistent requirement set IDs.`);
  assert.ok(value.includes("Prefer concise financial statements"), `${label} must reduce repetitive narrative.`);
  assert.ok(value.includes("less repeated prose, NOT less financial evidence"), `${label} must preserve financial depth while reducing output size.`);
}
