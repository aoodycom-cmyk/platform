import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createValuationWorkspace,
  runFixedMethodologyValuation,
  updateWorkspaceField
} from "../public/src/valuationWorkflow/workflow.js";

const components = readFileSync(new URL("../public/src/ui/components.js", import.meta.url), "utf8");

assert.ok(components.includes("function investmentReportExperience"));
assert.ok(components.includes("quick-summary-card"));
assert.ok(components.includes("report-detail"));
assert.ok(components.includes("collapsibleReportDetails"));
assert.ok(components.includes("Executive Summary"));
assert.ok(components.includes("What Could Change This Decision"));

let workspace = createValuationWorkspace({
  ticker: "RPT",
  name: "Report First Co",
  sector: "Technology",
  industry: "Software",
  quote: { price: 100 }
});

for (const [field, value] of Object.entries({
  ticker: "RPT",
  companyName: "Report First Co",
  currentPrice: 100,
  marketCap: 10_000_000_000,
  totalDebt: 500_000_000,
  cash: 1_000_000_000,
  revenue: 1_000_000_000,
  operatingIncome: 220_000_000,
  ebitda: 260_000_000,
  eps: 2.1,
  capex: 55_000_000,
  freeCashFlow: 180_000_000,
  dilutedShares: 100_000_000
})) {
  workspace = updateWorkspaceField(workspace, field, value);
}

const result = runFixedMethodologyValuation(workspace, "en");
assert.equal(result.error, undefined);
assert.ok(result.report.executiveConclusion.recommendation);
assert.ok(Number.isFinite(result.report.executiveConclusion.investmentScore));

console.log("Version 8 investment report experience tests passed.");
