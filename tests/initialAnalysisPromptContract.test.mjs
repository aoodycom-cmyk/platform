import assert from "node:assert/strict";
import { buildFullAnalysisPrompt, FRANKLIN_INITIAL_PROMPT_VERSION } from "../src/externalAnalysis/chatgptContract.js";

const prompt = buildFullAnalysisPrompt({ tickerHint: "NVDA" });

assert.equal(FRANKLIN_INITIAL_PROMPT_VERSION, "franklin-initial-analysis-prompt/v1");
assert.ok(prompt.includes("FRANKLIN_INITIAL_ANALYSIS"));
assert.ok(prompt.includes("franklin-fair-value/v3"));
assert.ok(prompt.includes("fair-value-methodology/v2"));
assert.ok(prompt.includes("analysisType يجب أن يكون INITIAL"));
assert.ok(prompt.includes("nextRequirements.currentJustifiedValue"));
assert.ok(prompt.includes("marketPrice.currency وvaluation.current.currency"));
assert.ok(prompt.includes("CANONICAL ENUM VALUES — MANDATORY"));
assert.ok(prompt.includes("strengths[].importance"));
assert.ok(prompt.includes("critical أو high أو medium أو low أو null"));
assert.ok(prompt.includes("latestQuarter.forwardOutlook.growthOutlook"));
assert.ok(prompt.includes("latestQuarter.forwardOutlook.managementTone"));
assert.ok(prompt.includes("forecast.materiality"));
assert.ok(prompt.includes("forecast.yearlyForecast.*.basis"));
assert.ok(prompt.includes("analyst_assumption"));
assert.ok(prompt.includes("company.securityUnit"));
assert.ok(prompt.includes("share أو ADS أو ADR أو unit"));
assert.equal(prompt.includes("fairValueSummary.fairValueBase"), false, "Initial prompt must stay on the V3 contract and not leak legacy fairValueSummary paths.");

const firstBrace = prompt.indexOf("{");
assert.ok(firstBrace > 0, "Prompt must contain one machine-readable request envelope.");
const request = JSON.parse(prompt.slice(firstBrace));

assert.equal(request.promptVersion, "franklin-initial-analysis-prompt/v1");
assert.equal(request.requestType, "FRANKLIN_INITIAL_ANALYSIS");
assert.equal(request.ticker, "NVDA");
assert.equal(request.authority.analyst, "ChatGPT / Fair Value");
assert.equal(request.outputContract.schemaVersion, "franklin-fair-value/v3");
assert.equal(request.outputContract.methodologyVersion, "fair-value-methodology/v2");
assert.equal(request.outputContract.analysisType, "INITIAL");
assert.equal(request.jsonTemplate.schemaVersion, "franklin-fair-value/v3");
assert.equal(request.jsonTemplate.analysisType, "INITIAL");
assert.deepEqual(Object.keys(request.jsonTemplate.valuation.scenarios), ["Bear", "Base", "Bull"]);
assert.ok(request.analysisScope.fullSceneReading.length >= 5, "Prompt must require a full industry/competitive/macro scene reading when material.");
assert.ok(request.analysisScope.valuation.some((item) => item.includes("Reverse DCF")));
assert.ok(request.analysisScope.decision.some((item) => item.includes("nextRequirements")));
assert.equal(request.researchPolicy.noFabrication, true);
assert.ok(request.researchPolicy.sourcePriority.includes("Investor Relations"));
assert.ok(request.outputContract.arithmeticChecks.some((item) => item.includes("probabilityWeighted")));
assert.ok(request.completionChecklist.some((item) => item.includes("المشهد الصناعي")));

assert.ok(prompt.length < 35000, `Initial prompt is unexpectedly large: ${prompt.length} chars.`);

console.log(`Initial analysis prompt contract: PASS (${prompt.length} chars)`);
