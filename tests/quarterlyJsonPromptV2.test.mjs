import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/ui/quarterlyEarningsJsonPromptV2.js", import.meta.url), "utf8");

assert.ok(index.includes("quarterlyEarningsJsonPromptV2.js"));
assert.ok(sw.includes("./src/ui/quarterlyEarningsJsonPromptV2.js"));
assert.ok(sw.includes("./src/externalAnalysis/quarterlyEarningsLite.js"));
assert.ok(script.includes("نسخ برومبت الربع المختصر"));
assert.ok(script.includes("buildQuarterlyEarningsLitePrompt"));
assert.ok(script.includes("inflateQuarterlyEarningsLitePayload"));
assert.ok(script.includes("step: 3"));
assert.ok(script.includes("Forward Outlook"));
assert.ok(script.includes("بدون تقييم سهم كامل أو Fair Value جديد"));

console.log("Quarterly JSON prompt V2 lite-mode tests passed.");
