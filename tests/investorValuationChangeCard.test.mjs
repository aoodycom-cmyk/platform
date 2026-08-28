import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");

assert.match(components, /meta\.analysisType !== "EARNINGS_REVALUATION"\) return ""/);
assert.match(components, /ما الذي تغيّر منذ التحليل السابق؟/);
assert.match(components, /القيمة الأساسية/);
assert.match(components, /حالة الفرضية/);
assert.match(components, /تحقق المتطلبات/);
assert.match(components, /لماذا تغيّر التقييم؟/);
assert.doesNotMatch(components.slice(components.indexOf("function canonicalFinancialCycleSection"), components.indexOf("function v31RangeMetric")), /Requirement Mode/);
assert.doesNotMatch(components.slice(components.indexOf("function canonicalFinancialCycleSection"), components.indexOf("function v31RangeMetric")), /دورة التقييم v3/);

console.log("Investor valuation change card checks passed.");
