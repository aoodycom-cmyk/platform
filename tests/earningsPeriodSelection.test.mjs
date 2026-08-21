import assert from "node:assert/strict";
import { buildNewEarningsAnalysisPrompt } from "../src/externalAnalysis/chatgptContract.js";
import {
  earningsPeriodMatches,
  parseEarningsPeriod,
  resolveEarningsPeriodSelection
} from "../src/externalAnalysis/earningsPeriod.js";

assert.deepEqual(parseEarningsPeriod("q1 2026"), { quarter: 1, year: 2026, reportPeriod: "Q1 2026" });
assert.equal(parseEarningsPeriod("FY 2026"), null);
assert.equal(earningsPeriodMatches("Q1-2026", "Q1 2026"), true);
assert.equal(earningsPeriodMatches("Q2 2026", "Q1 2026"), false);

const report = {
  id: "FUTU-Q4-2025",
  analysisDate: "2026-03-31",
  reportPeriod: "Q4 2025",
  company: { ticker: "FUTU", name: "Futu Holdings Limited", currency: "USD" },
  fairValueSummary: { fairValueLow: 95, fairValueBase: 150, fairValueHigh: 190 },
  decision: { action: "WATCH" },
  priceTargetRequirements: {
    targetQuarter: "Q2 2026",
    earningsPeriod: "Q2 2026",
    requirements: []
  }
};

assert.deepEqual(
  resolveEarningsPeriodSelection(report, { quarter: 1, year: 2026 }),
  { quarter: 1, year: 2026, reportPeriod: "Q1 2026" },
  "The user's quarter must override the report's next target quarter."
);
assert.equal(resolveEarningsPeriodSelection(report).reportPeriod, "Q2 2026");
assert.equal(resolveEarningsPeriodSelection({ reportPeriod: "Q4 2026" }).reportPeriod, "Q1 2027");

const prompt = buildNewEarningsAnalysisPrompt(report, { quarter: 1, year: 2026 });
assert.ok(prompt.includes("الربع الذي اختاره المستخدم لهذا التحديث: Q1 2026"));
assert.ok(prompt.includes("حلل مواد Q1 2026 فقط"));
assert.ok(prompt.includes('"reportPeriod": "Q1 2026"'));
assert.ok(prompt.includes('"earningsPeriod": "Q1 2026"'));

console.log("Selected earnings period contract tests passed.");
