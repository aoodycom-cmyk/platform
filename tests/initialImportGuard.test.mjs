import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInitialAnalysisPrompt } from "../src/externalAnalysis/initialAnalysisPolicyV2.js";

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const parser = readFileSync(new URL("../src/externalAnalysis/parser.js", import.meta.url), "utf8");
const prompt = buildInitialAnalysisPrompt({ tickerHint: "NVDA" });

assert.match(components, /اكتب رمز السهم أولًا/);
assert.match(components, /inputmode="latin-prose"/);
assert.match(prompt, /marketPrice إلزامي بالكامل/);
assert.match(prompt, /MARKET PRICE GATE/);
assert.match(prompt, /إذا لم يتوفر سعر LIVE موثق، استخدم أحدث LAST_CLOSE/);
assert.match(prompt, /usedFor يحتوي القيمة الحرفية marketPrice/);
assert.match(prompt, /"ticker": "NVDA"/);
assert.match(parser, /لم يُكمل سعر السوق الموثق/);

console.log("Initial analysis import guard: PASS");
