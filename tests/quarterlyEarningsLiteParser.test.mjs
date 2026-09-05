import assert from "node:assert/strict";
import {
  parseExternalAnalysisInput,
  setQuarterlyEarningsLiteReportResolver
} from "../src/externalAnalysis/parser.js";
import { LEGACY_QUARTERLY_EARNINGS_LITE_SCHEMA } from "../src/externalAnalysis/quarterlyEarningsLite.js";

const currentReport = {
  id: "AMZN-existing",
  analysisDate: "2026-02-05",
  reportPeriod: "Q4 2025",
  company: { ticker: "AMZN", name: "Amazon.com, Inc.", currency: "USD" },
  fairValueSummary: {
    currentPrice: 220,
    fairValueLow: 190,
    fairValueBase: 250,
    fairValueHigh: 310
  },
  thesis: { shortSummary: "Existing investment thesis." },
  risks: [{ title: "Existing strategic risk." }],
  decision: { action: "HOLD", rationale: "Existing decision." },
  priceTargetRequirements: {
    requirementSetId: "AMZN_Q32026_TEST",
    requirements: [{ id: "aws_growth", metric: "AWS revenue YoY growth", requiredValue: 30, type: "minimum", unit: "percent" }]
  },
  metadata: { importMethod: "structured_json" }
};

const litePayload = {
  schemaVersion: LEGACY_QUARTERLY_EARNINGS_LITE_SCHEMA,
  ticker: "AMZN",
  quarter: "Q1",
  year: 2026,
  reportDate: "2026-04-29",
  requirementSetId: "AMZN_Q32026_TEST",
  summary: "ربع قوي مع استمرار نمو AWS.",
  metrics: {
    revenue: { value: 181.5, display: "$181.5B", consensusDisplay: null, result: "BEAT" },
    revenueGrowthPct: { value: 17, display: "17%", consensusDisplay: null, result: "NA" },
    eps: { value: 2.78, display: "$2.78", consensusDisplay: null, result: "BEAT" },
    grossMarginPct: { value: null, display: null, consensusDisplay: null, result: "NA" },
    operatingMarginPct: { value: 13.1, display: "13.1%", consensusDisplay: null, result: "NA" },
    freeCashFlow: { value: 1.2, display: "$1.2B TTM", consensusDisplay: null, result: "NA" },
    cash: { value: 101.8, display: "$101.8B", consensusDisplay: null, result: "NA" },
    debt: { value: 119.1, display: "$119.1B", consensusDisplay: null, result: "NA" }
  },
  companyKpis: [{ name: "AWS Revenue Growth", actualDisplay: "28% YoY", result: "NA" }],
  guidance: [],
  requirements: [{ id: "aws_growth", actualValue: 28, actualDisplay: "28%", status: "NOT_REPORTED", evaluationNote: "Q3 لم يصدر بعد." }],
  highlights: [],
  concerns: []
};

setQuarterlyEarningsLiteReportResolver(() => currentReport);
const parsed = await parseExternalAnalysisInput(JSON.stringify(litePayload), {
  now: new Date("2026-04-29T22:00:00Z")
});

assert.equal(parsed.parserSource, "Quarterly Earnings Lite Parser");
assert.equal(parsed.usedAi, false);
assert.equal(parsed.report.analysisDate, "2026-04-29");
assert.equal(parsed.report.reportPeriod, "Q1 2026");
assert.equal(parsed.report.financialHighlights.revenue, 181.5);
assert.equal(parsed.report.financialHighlights.epsReported, 2.78);
assert.equal(parsed.report.fairValueSummary.fairValueBase, 250);
assert.equal(parsed.report.thesis.shortSummary, "Existing investment thesis.");
assert.equal(parsed.report.decision.action, "HOLD");
assert.equal(parsed.report.metadata.importMethod, "quarterly_earnings_lite");

setQuarterlyEarningsLiteReportResolver(null);
await assert.rejects(
  () => parseExternalAnalysisInput(JSON.stringify(litePayload)),
  /requires an existing saved report/
);

console.log("Quarterly earnings lite parser integration checks passed.");
