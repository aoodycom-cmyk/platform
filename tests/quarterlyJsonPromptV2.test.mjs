import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/ui/quarterlyEarningsJsonPromptV2.js", import.meta.url), "utf8");

assert.ok(index.includes("quarterlyEarningsJsonPromptV2.js"));
assert.ok(sw.includes("./src/ui/quarterlyEarningsJsonPromptV2.js"));
assert.ok(script.includes("نسخ برومبت JSON"));
assert.ok(script.includes("Return ONLY one valid JSON object"));
assert.ok(script.includes("EXCEEDED, PASSED, PARTIALLY_PASSED, FAILED, NOT_REPORTED"));
assert.ok(script.includes("Research the exact selected quarter"));
assert.ok(script.includes("data-action='prepare-earnings-prompt'"));

console.log("Quarterly JSON prompt V2 tests passed.");
