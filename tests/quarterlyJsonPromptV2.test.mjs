import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/ui/quarterlyEarningsJsonPromptV2.js", import.meta.url), "utf8");
const parser = readFileSync(new URL("../src/externalAnalysis/parser.js", import.meta.url), "utf8");

assert.ok(index.includes("quarterlyEarningsJsonPromptV2.js"));
assert.ok(sw.includes("./src/ui/quarterlyEarningsJsonPromptV2.js"));
assert.ok(script.includes("تحليل وإعادة تقييم"));
assert.ok(script.includes("buildEarningsRevaluationPrompt"));
assert.ok(parser.includes("inflateEarningsRevaluationPayload"));
assert.ok(parser.includes("Earnings Revaluation Parser"));
assert.ok(script.includes("step: 3"));
assert.ok(script.includes("Bear / Base / Bull"));
assert.ok(script.includes("إنشاء متطلبات الربع القادم تلقائيًا"));

console.log("Quarterly JSON prompt V2 earnings-revaluation tests passed.");
