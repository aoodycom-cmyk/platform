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

assert.ok(script.includes("shouldUseQuarterObservation"));
assert.ok(script.includes("selected !== target"));
assert.ok(script.includes("quarterlyObservationOnly"));
assert.ok(script.includes("حلل ${period} فقط حتى لو كانت نتائج Q2 أو Q3 أو Q4"));
assert.ok(script.includes("ليس تاريخ اليوم"));
assert.ok(script.includes("لا تغيّر Fair Value ولا القرار"));
assert.ok(script.includes(".franklin-cloud-trigger"));
assert.ok(script.includes(".panel-settings"));
assert.ok(script.includes("trigger.hidden = !settingsVisible"));
assert.ok(script.includes("trigger.tabIndex = settingsVisible ? 0 : -1"));

console.log("Quarterly JSON prompt V2 historical-mode and cloud-visibility tests passed.");
