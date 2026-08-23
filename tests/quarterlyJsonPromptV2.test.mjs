import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/ui/quarterlyEarningsJsonPromptV2.js", import.meta.url), "utf8");
const parser = readFileSync(new URL("../src/externalAnalysis/parser.js", import.meta.url), "utf8");

assert.ok(main.includes("quarterlyEarningsJsonPromptV2.js"));
assert.ok(sw.includes("./src/ui/quarterlyEarningsJsonPromptV2.js"));
assert.ok(sw.includes("./src/externalAnalysis/quarterlyEarningsLite.js"));
assert.ok(script.includes("Quick Earnings Read"));
assert.ok(script.includes("غير Canonical"));
assert.ok(script.includes("buildQuarterlyEarningsLitePrompt"));
assert.equal(script.includes("hidden = true"), false);
assert.ok(parser.includes("inflateQuarterlyEarningsLitePayload"));
assert.ok(script.includes("step: 3"));
assert.ok(script.includes("بدون تقييم سهم كامل أو Fair Value جديد"));

console.log("Quarterly JSON prompt V2 lite-mode tests passed.");
