import assert from "node:assert/strict";
import {
  applyParsedPreview,
  approveWorkspaceValuation,
  canRunValuation,
  createValuationWorkspace,
  parseWorkspacePaste,
  runFixedMethodologyValuation,
  setMethodologyOverride,
  updatePasteDraft,
  updateWorkspaceField,
  validateValuationReport
} from "../public/src/valuationWorkflow/workflow.js";

function completeWorkspace() {
  let workspace = createValuationWorkspace({
    ticker: "TST",
    name: "Test Compounder",
    sector: "Technology",
    industry: "Software",
    quote: { price: 100 }
  });
  const inputs = {
    ticker: "TST",
    companyName: "Test Compounder",
    currentPrice: 100,
    marketCap: 10_000_000_000,
    totalDebt: 500_000_000,
    cash: 1_000_000_000,
    revenue: 1_000_000_000,
    grossProfit: 700_000_000,
    operatingIncome: 220_000_000,
    ebitda: 260_000_000,
    netIncome: 170_000_000,
    eps: 2.1,
    operatingCashFlow: 220_000_000,
    capex: 55_000_000,
    freeCashFlow: 180_000_000,
    dilutedShares: 100_000_000,
    analystTargetAverage: 42,
    morningstarFairValue: 40
  };
  for (const [field, value] of Object.entries(inputs)) {
    workspace = updateWorkspaceField(workspace, field, value);
  }
  return workspace;
}

{
  const draft = createValuationWorkspace({ ticker: "AAA", name: "Draft Co" });
  assert.equal(draft.status, "Draft");
  assert.equal(canRunValuation(draft), false);
  assert.equal(draft.report, null);
}

{
  let workspace = createValuationWorkspace({ ticker: "PST", name: "Paste Co" });
  workspace = updatePasteDraft(workspace, "incomeStatement", "Revenue: 1,200 million\nOperating Income: 300 million\nEPS: 4.20");
  workspace = parseWorkspacePaste(workspace, "incomeStatement");
  assert.ok(workspace.pastePreview.candidates.some((item) => item.fieldId === "revenue"));
  workspace = applyParsedPreview(workspace);
  assert.equal(workspace.inputs.revenue.value, 1_200_000_000);
  assert.equal(workspace.inputs.revenue.mode, "Automatic");
}

{
  const workspace = completeWorkspace();
  assert.equal(canRunValuation(workspace), true);
  const first = runFixedMethodologyValuation(workspace, "en");
  const second = runFixedMethodologyValuation(workspace, "en");
  assert.equal(first.error, undefined);
  assert.deepEqual(first.report.executiveConclusion, second.report.executiveConclusion);
  assert.ok(first.report.assumptionRationale.wacc.value > 0);
  assert.ok(first.report.valuationModels.some((model) => model.method === "DCF"));
  const probabilityTotal = first.report.bearScenario.probability + first.report.baseScenario.probability + first.report.bullScenario.probability;
  assert.equal(probabilityTotal, 1);
}

{
  const workspace = completeWorkspace();
  const base = runFixedMethodologyValuation(workspace, "en").report;
  const overridden = runFixedMethodologyValuation(
    setMethodologyOverride(workspace, "wacc", { value: 0.12, reason: "Higher risk premium" }),
    "en"
  ).report;
  assert.notEqual(base.executiveConclusion.baseFairValue, overridden.executiveConclusion.baseFairValue);
  assert.equal(overridden.assumptionRationale.wacc.value, overridden.forecastAssumptions.wacc.guardrail[1]);
}

{
  const workspace = completeWorkspace();
  const generated = runFixedMethodologyValuation(workspace, "ar");
  const approved = approveWorkspaceValuation(generated.workspace, "Approved after review.");
  assert.equal(approved.error, undefined);
  assert.equal(approved.evaluatedCompany.ticker, "TST");
  assert.ok(approved.evaluatedCompany.valuationVersion.startsWith("VAL-TST-"));
  assert.equal(approved.evaluatedCompany.approvedReport.finalInvestmentDecision.decision, generated.report.finalInvestmentDecision.decision);
}

{
  const invalid = validateValuationReport({
    executiveConclusion: {},
    bearScenario: { probability: 0.4 },
    baseScenario: { probability: 0.4 },
    bullScenario: { probability: 0.4 },
    assumptionRationale: {}
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("Scenario probabilities")));
}

console.log("Version 7 valuation workflow tests passed.");
