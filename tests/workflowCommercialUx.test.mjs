import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowUx = readFileSync(new URL("../src/financialSafety/workflowCommercialUx.js", import.meta.url), "utf8");
const readiness = readFileSync(new URL("../src/financialSafety/decisionReadinessUi.js", import.meta.url), "utf8");

assert.ok(workflowUx.includes("أضف شركة إلى Franklin"));
assert.ok(workflowUx.includes("نسخ طلب التحليل"));
assert.ok(workflowUx.includes("مراجعة النتيجة"));
assert.ok(workflowUx.includes("ألصق JSON الناتج من ChatGPT هنا"));
assert.ok(workflowUx.includes("Demo Semiconductor Systems"));
assert.ok(workflowUx.includes('new Set(["DEMO", "FQC"])'), "Known product demo tickers must be hidden from the commercial library.");
assert.ok(workflowUx.includes("Parser:|AI Parser|Local JSON"), "Developer parser metadata must be suppressed in the normal flow.");
assert.ok(workflowUx.includes("تحديث التحليل الكامل"));
assert.ok(workflowUx.includes("تحليل إعلان أرباح"));
assert.equal(workflowUx.includes("Investment Analyst Brain v1.1"), false, "Commercial workflow enhancer must not add internal analyst-engine branding.");
assert.ok(readiness.includes("installWorkflowCommercialUx"), "Commercial workflow polish must install with the normal Franklin runtime.");

console.log("Premium analysis workflow UX tests passed.");
