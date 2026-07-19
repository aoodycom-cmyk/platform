import assert from "node:assert/strict";
import {
  approveWorkspaceValuation,
  createValuationWorkspace,
  runInvestmentAnalystBrainValuation
} from "../public/src/valuationWorkflow/workflow.js";
import { CANONICAL_METHODOLOGY_VERSION, SUPPORTED_MODELS, UNSUPPORTED_MODELS } from "../public/src/analystBrain/engine.js";
import { validateAnalystBrainOutput } from "../public/src/analystBrain/schemaValidator.js";

function runCase(ticker, paste, company = {}) {
  const workspace = createValuationWorkspace({
    ticker,
    name: company.name || `${ticker} Test Co`,
    sector: company.sector || "",
    industry: company.industry || "",
    quote: { price: company.price || 100 }
  });
  const generated = runInvestmentAnalystBrainValuation(workspace, { text: paste, language: "ar" });
  assert.equal(generated.error, undefined, `${ticker} should generate without error`);
  assert.equal(generated.report.methodologyVersion, CANONICAL_METHODOLOGY_VERSION);
  assert.equal(generated.report.dashboardExport.exported, false);
  assert.ok(validateAnalystBrainOutput(generated.report).valid, `${ticker} report should validate`);
  return generated;
}

function selectedMethods(report) {
  return report.modelSelection.selectedModels.map((model) => model.method);
}

function assertNoUnsupportedSelected(report) {
  for (const method of selectedMethods(report)) {
    assert.ok(SUPPORTED_MODELS.includes(method), `${method} must be supported`);
    assert.ok(!UNSUPPORTED_MODELS.includes(method), `${method} must not be selected`);
  }
}

function assertWeightRules(report) {
  const models = report.modelSelection.selectedModels;
  const externalWeight = models
    .filter((model) => model.role === "external_reference")
    .reduce((sum, model) => sum + model.weight, 0);
  assert.ok(models.every((model) => model.weight <= 0.450001), "No selected model may exceed 45% weight");
  assert.ok(externalWeight <= 0.250001, "External references may not exceed 25% combined weight");
}

function assertForecastContract(report) {
  assert.equal(report.forecastAssumptions.yearlyForecast.length, 5);
  for (const row of report.forecastAssumptions.yearlyForecast) {
    assert.equal(typeof row.source, "string");
    assert.ok(Number.isFinite(row.confidence));
    assert.ok(Number.isFinite(row.revenueGrowth));
    assert.ok(Number.isFinite(row.operatingMargin));
    assert.ok(Number.isFinite(row.freeCashFlow));
  }
}

const profitableGrowthPaste = `
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
Analyst Target Average: 42
Morningstar Fair Value: 40
Business Model: subscription software
Competitive Advantages: switching cost and scale
`;

const profitable = runCase("BRAIN", profitableGrowthPaste, { name: "Brain Test Co", price: 100 });
assert.equal(profitable.report.classification.classification, "High Growth — Profitable");
assert.ok(selectedMethods(profitable.report).includes("DCF"));
assert.ok(selectedMethods(profitable.report).includes("P/E"));
assert.ok(selectedMethods(profitable.report).includes("PEG"));
assertNoUnsupportedSelected(profitable.report);
assert.equal(profitable.report.modelSelection.unsupportedModels.length, 0);
assert.ok(!JSON.stringify(profitable.report.companyClassification.excludedModels).includes("P/B"));
assertWeightRules(profitable.report);
assertForecastContract(profitable.report);
assert.equal(profitable.report.scenarios.Exceptional.fairValue, null);
assert.ok(profitable.report.modelSelection.selectedModels.some((model) => String(model.source).includes("Methodology default")));

const approved = approveWorkspaceValuation(profitable.workspace, "Approved test report.");
assert.equal(approved.error, undefined);
assert.equal(approved.workspace.report.dashboardExport.exported, true);
assert.equal(approved.evaluatedCompany.approvedReport.dashboardExport.exported, true);
assert.equal(approved.evaluatedCompany.approvedReport.finalInvestmentDecision.decision, profitable.report.finalDecision.decision);

const transition = runCase("TRANS", `
Ticker: TRANS
Company Name: Transition Co
Current Price: 20
Revenue: 800000000
Revenue Estimates: 1000000000
Operating Income: -120000000
EBITDA: -50000000
Net Income: -160000000
EPS: -1.2
Free Cash Flow: -90000000
Capital Expenditure: 40000000
Cash: 300000000
Total Debt: 100000000
Diluted Shares Outstanding: 100000000
Industry: Software
Business Model: subscription platform
`);
assert.equal(transition.report.classification.classification, "High Growth — Transition to Profitability");
assert.deepEqual(selectedMethods(transition.report).sort(), ["EV/Sales", "Forward EV/Sales"].sort());
assertNoUnsupportedSelected(transition.report);
assertWeightRules(transition.report);
assertForecastContract(transition.report);

const cyclical = runCase("CYC", `
Ticker: CYC
Company Name: Cyclical Co
Current Price: 45
Industry: Semiconductor cyclical
Revenue: 3000000000
Operating Income: 400000000
EBITDA: 650000000
Free Cash Flow: 260000000
EPS: 3
Cash: 500000000
Total Debt: 700000000
Diluted Shares Outstanding: 120000000
`);
assert.equal(cyclical.report.classification.classification, "Cyclical");
assert.ok(selectedMethods(cyclical.report).includes("EV/EBITDA"));
assertNoUnsupportedSelected(cyclical.report);
assertWeightRules(cyclical.report);

const financial = runCase("BANK", `
Ticker: BANK
Company Name: Bank Co
Current Price: 50
Sector: Financial Services
Industry: Bank
Revenue: 2000000000
Net Income: 500000000
EPS: 5
Cash: 1000000000
Total Debt: 500000000
Diluted Shares Outstanding: 100000000
Analyst Target Average: 58
`);
assert.equal(financial.report.classification.classification, "Financial Institution");
assert.ok(!selectedMethods(financial.report).includes("DCF"));
assert.ok(!selectedMethods(financial.report).includes("P/B"));
assertNoUnsupportedSelected(financial.report);
assertWeightRules(financial.report);

const reit = runCase("REIT", `
Ticker: REIT
Company Name: REIT Co
Current Price: 35
Industry: REIT
Revenue: 900000000
Operating Income: 300000000
Free Cash Flow: 180000000
EPS: 1.8
Cash: 120000000
Total Debt: 1800000000
Diluted Shares Outstanding: 200000000
`);
assert.equal(reit.report.classification.classification, "REIT");
assert.ok(!selectedMethods(reit.report).includes("AFFO"));
assert.ok(!selectedMethods(reit.report).includes("NAV"));
assert.ok(!selectedMethods(reit.report).includes("DCF"));
assertNoUnsupportedSelected(reit.report);
assertWeightRules(reit.report);

const holding = runCase("HOLD", `
Ticker: HOLD
Company Name: Holding Co
Current Price: 80
Industry: Holding Company
Revenue: 500000000
Operating Income: 100000000
Free Cash Flow: 60000000
EPS: 4
Cash: 800000000
Total Debt: 200000000
Diluted Shares Outstanding: 50000000
`);
assert.equal(holding.report.classification.classification, "Holding Company");
assert.ok(!selectedMethods(holding.report).includes("Sum of the Parts"));
assert.ok(!selectedMethods(holding.report).includes("DCF"));
assertNoUnsupportedSelected(holding.report);
assertWeightRules(holding.report);

const externalOnly = runCase("EXT", `
Ticker: EXT
Company Name: External Only Co
Current Price: 100
Morningstar Fair Value: 130
Analyst Target Average: 140
`);
assert.equal(externalOnly.report.finalDecision.decision, "INSUFFICIENT_DATA");
assert.equal(externalOnly.report.finalDecision.policyGates.hasInternalValuation, false);
assertWeightRules(externalOnly.report);

const badWeight = structuredClone(profitable.report);
badWeight.modelSelection.selectedModels[0].weight = 0.51;
assert.equal(validateAnalystBrainOutput(badWeight).valid, false);

const badExternalWeight = structuredClone(profitable.report);
for (const model of badExternalWeight.modelSelection.selectedModels) {
  if (model.role === "external_reference") model.weight = 0.2;
}
assert.equal(validateAnalystBrainOutput(badExternalWeight).valid, false);

const badProbabilities = structuredClone(profitable.report);
badProbabilities.scenarios.Base.probability = 0.45;
assert.equal(validateAnalystBrainOutput(badProbabilities).valid, false);

const badForecast = structuredClone(profitable.report);
badForecast.forecastAssumptions.yearlyForecast = badForecast.forecastAssumptions.yearlyForecast.slice(0, 4);
assert.equal(validateAnalystBrainOutput(badForecast).valid, false);

const badExceptional = structuredClone(profitable.report);
badExceptional.scenarios.Exceptional = { included: false, fairValue: 500 };
assert.equal(validateAnalystBrainOutput(badExceptional).valid, false);

console.log("Investment Analyst Brain v1.1 canonical tests passed.");
