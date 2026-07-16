import assert from "node:assert/strict";
import {
  approveWorkspaceValuation,
  createValuationWorkspace,
  runInvestmentAnalystBrainValuation
} from "../public/src/valuationWorkflow/workflow.js";
import { validateAnalystBrainOutput } from "../public/src/analystBrain/schemaValidator.js";

let workspace = createValuationWorkspace({
  ticker: "BRAIN",
  name: "Brain Test Co",
  sector: "Technology",
  industry: "Software",
  quote: { price: 100 }
});

const paste = `
Ticker: BRAIN
Company Name: Brain Test Co
Current Price: 100
Market Capitalization: 10000000000
Cash: 1000000000
Total Debt: 400000000
Revenue: 1200000000
Gross Profit: 780000000
Operating Income: 260000000
EBITDA: 310000000
Net Income: 210000000
EPS: 2.1
Operating Cash Flow: 260000000
Capital Expenditure: 60000000
Free Cash Flow: 200000000
Diluted Shares Outstanding: 100000000
Analyst Target Average: 124
Morningstar Fair Value: 118
Business Model: subscription software
Competitive Advantages: switching cost and scale
`;

const generated = runInvestmentAnalystBrainValuation(workspace, { text: paste, language: "ar" });
assert.equal(generated.error, undefined);
assert.equal(generated.report.methodologyVersion, "investment-analyst-brain-v1");
assert.ok(validateAnalystBrainOutput(generated.report).valid);
assert.equal(generated.report.dashboardExport.exported, false);
assert.ok(generated.report.scenarios.Conservative);
assert.ok(generated.report.monitoringChecklist.length >= 5);

const approved = approveWorkspaceValuation(generated.workspace, "Approved test report.");
assert.equal(approved.error, undefined);
assert.equal(approved.workspace.report.dashboardExport.exported, true);
assert.equal(approved.evaluatedCompany.approvedReport.dashboardExport.exported, true);

console.log("Investment Analyst Brain v1 integration tests passed.");
