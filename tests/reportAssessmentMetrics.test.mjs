import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  highestRiskSeverity,
  riskAssessmentMetric,
  valuationAssessmentMetric
} from "../src/ui/reportAssessmentMetrics.js";
import { compactRequirementObservationText, mixedDirectionMarkup } from "../src/ui/components.js";

assert.deepEqual(
  valuationAssessmentMetric({ scores: { valuation: 8.4 } }),
  { kind: "score", score: 8.4, progress: 84 }
);

assert.deepEqual(
  valuationAssessmentMetric({ fairValueSummary: { upsideDownsidePercent: 47.25, fairValueBase: 170 } }),
  { kind: "upside", value: 47.25, progress: 47.25, tone: "positive" }
);

assert.deepEqual(
  valuationAssessmentMetric({ fairValueSummary: { fairValueBase: 170 } }),
  { kind: "base", value: 170, progress: null, tone: "positive" }
);

assert.equal(highestRiskSeverity([{ severity: "medium" }, { severity: "critical" }, { severity: "high" }]), "critical");
assert.deepEqual(
  riskAssessmentMetric({ risks: [{ severity: "medium" }, { severity: "high" }] }),
  { kind: "severity", severity: "high", progress: 75, tone: "risk" }
);
assert.equal(riskAssessmentMetric({ risks: [{ title: "Unscored risk" }] }).kind, "missing", "Franklin must not invent a risk score.");

const mixed = mixedDirectionMarkup("11.5 مليار دولار أو أكثر");
assert.match(mixed, /<bdi dir="ltr">11\.5<\/bdi> مليار دولار أو أكثر/);
assert.equal(compactRequirementObservationText("7.814 مليارات دولار في Q2", "Q2 2026"), "7.814 مليارات دولار");
assert.equal(compactRequirementObservationText("37% خلال Q3 2026", "Q3 2026"), "37%");

const components = await readFile(new URL("../src/ui/components.js", import.meta.url), "utf8");
assert.match(components, /حماية القيمة الأساسية/);
assert.match(components, /لتبرير قيمة/);
assert.match(components, /mixedDirectionMarkup\(requirementRequiredText/);
assert.match(components, /valueDirection = isArabicUi\(\) \? "rtl" : "ltr"/);

console.log("Report assessment and RTL financial presentation tests passed.");
