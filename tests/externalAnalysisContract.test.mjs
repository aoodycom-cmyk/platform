import assert from "node:assert/strict";
import {
  analysisContractRequiredFields,
  buildExternalAnalysisJsonTemplate,
  buildFullAnalysisPrompt
} from "../src/externalAnalysis/chatgptContract.js";

const prompt = buildFullAnalysisPrompt({ tickerHint: "aaoi" });
assert.ok(prompt.includes("Fair value"), "Prompt must identify the Fair value ChatGPT system.");
assert.ok(prompt.includes("company.ticker"), "Prompt must name required schema paths.");
assert.ok(prompt.includes("fairValueSummary"), "Prompt must include Fair value summary fields.");
assert.ok(prompt.includes("Conservative"), "Prompt must document Fair value scenarios.");
assert.ok(prompt.includes('"ticker": "AAOI"'), "Prompt template must carry the entered ticker.");
assert.equal(prompt.includes('"ticker": "TICKER"'), false, "Prompt must not use TICKER as a placeholder value.");
assert.equal(prompt.includes("```"), false, "Prompt must not use Markdown fences.");

const template = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "msft" }));
assert.equal(template.schemaVersion, "fair-value-analysis/v1");
assert.equal(template.methodologyVersion, "fair-value-system/v1");
assert.equal(template.company.ticker, "MSFT");
assert.equal(template.company.currentPrice, null);
assert.equal(template.businessQuality.score, null);
assert.equal(template.fairValueSummary.fairValueBase, null);
assert.deepEqual(template.risks, []);
assert.equal(template.dashboardExport.ticker, "MSFT");

const blankTemplate = JSON.parse(buildExternalAnalysisJsonTemplate({ tickerHint: "TICKER" }));
assert.equal(blankTemplate.company.ticker, null, "Placeholder ticker must normalize to null.");

const requiredFields = analysisContractRequiredFields().map((field) => field.path);
for (const field of [
  "company.ticker",
  "analysisDate",
  "market.priceAtAnalysis",
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
