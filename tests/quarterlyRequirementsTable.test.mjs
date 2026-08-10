import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNewEarningsAnalysisPrompt } from "../src/externalAnalysis/chatgptContract.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import {
  normalizeNextQuarterGuidance,
  normalizePreviousRequirementsEvaluation,
  normalizePriceTargetRequirements
} from "../src/externalAnalysis/requirements.js";

const monitored = normalizePriceTargetRequirements({
  previousQuarter: "Q2 FY2026",
  targetQuarter: "Q3 FY2026",
  currentJustifiedValue: 35,
  nextTargetValue: 50,
  targetScenario: "bull",
  requirements: [
    {
      id: "revenue",
      name: "Revenue",
      arabicName: "الإيرادات",
      previousValue: 51,
      previousDisplay: "$51M",
      requiredValue: 57.5,
      requiredDisplay: ">= $57.5M",
      actualValue: 60,
      actualDisplay: "$60M",
      direction: "up",
      impact: "positive",
      status: "PASSED",
      weight: 30
    },
    {
      id: "dilution",
      name: "Dilution",
      arabicName: "زيادة عدد الأسهم",
      previousValue: 75,
      previousDisplay: "75M",
      requiredValue: 74,
      requiredDisplay: "<= 74M",
      actualValue: 80,
      actualDisplay: "80M",
      direction: "up",
      impact: "negative",
      status: "FAILED",
      weight: 10
    }
  ]
});

assert.equal(monitored.earningsPeriod, "Q3 FY2026");
assert.equal(monitored.targetValue, 50);
assert.equal(monitored.requirements[0].direction, "up");
assert.equal(monitored.requirements[0].impact, "positive");
assert.equal(monitored.requirements[1].direction, "up", "Numerical direction must be preserved separately from impact.");
assert.equal(monitored.requirements[1].impact, "negative", "Investment impact must be preserved exactly as supplied.");
assert.equal(monitored.requirements[1].status, "FAILED");
assert.equal(monitored.requirements[1].actualDisplay, "80M");

const evaluated = normalizePreviousRequirementsEvaluation({
  previousQuarter: "Q2 FY2026",
  targetQuarter: "Q3 FY2026",
  targetValue: 50,
  requirements: [
    { id: "revenue_down", actualDisplay: "$52M", direction: "down", impact: "negative", status: "FAILED" },
    { id: "dilution_down", actualDisplay: "74M", direction: "down", impact: "positive", status: "PASSED" },
    { id: "awaiting", actualDisplay: null, direction: "unknown", impact: "unknown", status: "NOT_REPORTED" }
  ],
  requirementsAssessment: {
    weightedAchievement: 61,
    reportedRequirements: 2,
    totalRequirements: 3,
    failed: 1,
    passed: 1,
    notReported: 1
  }
});

assert.equal(evaluated.requirements[0].direction, "down");
assert.equal(evaluated.requirements[0].impact, "negative");
assert.equal(evaluated.requirements[1].direction, "down");
assert.equal(evaluated.requirements[1].impact, "positive");
assert.equal(evaluated.requirements[2].status, "NOT_REPORTED");
assert.equal(evaluated.requirementsAssessment.weightedAchievement, 61);

const report = normalizeExternalAnalysisReport({
  analysisDate: "2026-08-08",
  reportPeriod: "Q2 FY2026",
  company: { ticker: "TBL", name: "Table Test" },
  market: { priceAtAnalysis: 40 },
  scores: { quality: 8, growth: 8, valuation: 7, risk: 4 },
  fairValue: { bear: 30, base: 40, bull: 50 },
  thesis: { shortSummary: "تقرير اختبار جدول المتطلبات." },
  risks: [{ title: "Risk" }],
  decision: { verdict: "HOLD" },
  priceTargetMonitoring: monitored,
  nextQuarterGuidance: {
    quarter: "Q4 FY2026",
    items: [
      { topic: "Revenue", arabicTopic: "الإيرادات", guidance: "$62M-$66M", direction: "raised", interpretation: "الإدارة تتوقع استمرار النمو.", importance: "high" }
    ]
  }
}, "raw");

assert.equal(report.priceTargetRequirements.targetQuarter, "Q3 FY2026");
assert.equal(report.priceTargetRequirements.requirements[1].impact, "negative");
assert.equal(normalizeNextQuarterGuidance(report.nextQuarterGuidance).items[0].guidance, "$62M-$66M");

const earningsPrompt = buildNewEarningsAnalysisPrompt(report);
assert.ok(earningsPrompt.includes("direction: up أو down أو flat أو unknown"));
assert.ok(earningsPrompt.includes("impact: positive أو negative أو mixed أو neutral أو unknown"));
assert.ok(earningsPrompt.includes("actualDisplay"));
assert.ok(earningsPrompt.includes("nextQuarterGuidance"));
assert.ok(earningsPrompt.includes("previousValue"));
assert.ok(earningsPrompt.includes("requiredDisplay"));
assert.ok(earningsPrompt.includes("dilution"));

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

assert.ok(components.includes("requirementsComparisonView"), "Requirements must render through the comparison table/dashboard.");
assert.ok(components.includes("requirementActualCell"), "Actual values must render with separate direction and impact styling.");
assert.ok(components.includes("investmentDataTableArea"), "Investment data must be consolidated into one compact table area.");
assert.ok(components.includes("guidanceTableView"), "Guidance must render in the same compact table area.");
assert.ok(components.includes("compactFinancialTable"), "Reusable compact financial table component must exist.");
assert.ok(components.includes("directionIndicator(item.direction)"), "Direction arrows must use supplied direction.");
assert.ok(components.includes("requirementImpactClass(item.impact)"), "Number color must use supplied investment impact.");
assert.ok(styles.includes(".compact-financial-table"), "Compact financial table styles must exist.");
assert.ok(styles.includes(".sticky-metric-col"), "Mobile tables must keep the metric column sticky.");
assert.ok(styles.includes(".data-view-tabs"), "Selector-driven data table area must be styled.");
assert.ok(styles.includes(".requirement-actual.impact-negative"), "Negative investment impact must color the number red.");
assert.ok(styles.includes(".direction-up"), "Up direction arrow must be styled independently.");
assert.ok(styles.includes(".direction-down"), "Down direction arrow must be styled independently.");

console.log("Quarterly requirements table tests passed.");
