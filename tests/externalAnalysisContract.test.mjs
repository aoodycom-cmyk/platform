import assert from "node:assert/strict";
import {
  analysisContractRequiredFields,
  buildExternalAnalysisJsonTemplate,
  buildFullAnalysisPrompt
} from "../src/externalAnalysis/chatgptContract.js";

const prompt = buildFullAnalysisPrompt({ tickerHint: "aaoi" });
assert.ok(prompt.includes("أخرج JSON فقط"), "Prompt must require JSON-only output.");
assert.ok(prompt.includes("company.ticker"), "Prompt must name required schema paths.");
assert.ok(prompt.includes("fairValue.base"), "Prompt must include core valuation fields.");
assert.ok(prompt.includes("Bear <= Base <= Bull"), "Prompt must document Fair Value ordering.");
assert.ok(prompt.includes('"ticker": "AAOI"'), "Prompt template must carry the entered ticker.");
assert.equal(prompt.includes('"ticker": "TICKER"'), false, "Prompt must not use TICKER as a placeholder value.");
assert.equal(prompt.includes("```"), false, "Prompt must not use Markdown fences.");

const template = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "msft" }));
assert.equal(template.schemaVersion, "external-analysis-report/v1");
assert.equal(template.analysisOrigin, "external_chatgpt");
assert.equal(template.company.ticker, "MSFT");
assert.equal(template.market.priceAtAnalysis, null);
assert.equal(template.scores.quality, null);
assert.equal(template.fairValue.base, null);
assert.deepEqual(template.risks, []);
assert.deepEqual(template.sources, []);

const blankTemplate = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "TICKER" }));
assert.equal(blankTemplate.company.ticker, null, "Placeholder ticker must normalize to null.");

const requiredFields = analysisContractRequiredFields().map((field) => field.path);
for (const field of [
  "company.ticker",
  "analysisDate",
  "market.priceAtAnalysis",
  "scores.quality",
  "scores.growth",
  "scores.valuation",
  "scores.risk",
  "fairValue.bear",
  "fairValue.base",
  "fairValue.bull",
  "thesis.shortSummary",
  "risks",
  "decision.verdict"
]) {
  assert.ok(requiredFields.includes(field), `${field} must be documented as required.`);
}

console.log("External analysis ChatGPT contract tests passed.");
