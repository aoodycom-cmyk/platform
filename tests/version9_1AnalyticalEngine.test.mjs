import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createValuationWorkspace,
  runFixedMethodologyValuation,
  updateWorkspaceField
} from "../public/src/valuationWorkflow/workflow.js";
import { runAnalystBrainEngine, SUPPORTED_MODELS, UNSUPPORTED_MODELS } from "../public/src/analystBrain/engine.js";
import { validateAnalystBrainOutput } from "../public/src/analystBrain/schemaValidator.js";

const EPSILON = 1e-8;

function completeWorkspace(overrides = {}) {
  let workspace = createValuationWorkspace({
    ticker: "V91",
    name: "Version 9.1 Compounder",
    sector: "Technology",
    industry: "Software",
    quote: { price: 100 }
  });
  const inputs = {
    ticker: "V91",
    companyName: "Version 9.1 Compounder",
    currentPrice: 100,
    marketCap: 10_000_000_000,
    enterpriseValue: 9_600_000_000,
    currency: "USD",
    sector: "Technology",
    industry: "Software",
    revenue: 1_000_000_000,
    revenueEstimates: 1_120_000_000,
    grossProfit: 700_000_000,
    operatingIncome: 250_000_000,
    ebitda: 300_000_000,
    netIncome: 180_000_000,
    eps: 2,
    operatingCashFlow: 210_000_000,
    capex: 50_000_000,
    freeCashFlow: 160_000_000,
    cash: 500_000_000,
    totalDebt: 100_000_000,
    dilutedShares: 100_000_000,
    peerPeMultiple: 25,
    peerPegMultiple: 1.4,
    peerEvEbitdaMultiple: 15,
    peerEvSalesMultiple: 5,
    peerPriceFcfMultiple: 22,
    morningstarFairValue: 80,
    analystTargetAverage: 78,
    businessModel: "subscription platform with recurring revenue",
    competitiveAdvantages: "wide switching cost and scale advantage"
  };
  for (const [field, value] of Object.entries({ ...inputs, ...overrides })) {
    workspace = updateWorkspaceField(workspace, field, value);
  }
  return workspace;
}

function actionableBuyWorkspace(overrides = {}) {
  return completeWorkspace({
    currentPrice: 20,
    marketCap: 2_000_000_000,
    enterpriseValue: 1_600_000_000,
    morningstarFairValue: 60,
    analystTargetAverage: 58,
    ...overrides
  });
}

function engineReportFromFields(fields, company = {}) {
  let workspace = createValuationWorkspace({
    ticker: company.ticker || fields.ticker || "ENG",
    name: company.name || fields.companyName || "Engine Test Co",
    sector: company.sector || fields.sector || "",
    industry: company.industry || fields.industry || "",
    quote: { price: company.price || fields.currentPrice || 20 }
  });
  for (const [field, value] of Object.entries(fields)) {
    workspace = updateWorkspaceField(workspace, field, value);
  }
  return runAnalystBrainEngine(workspace, { language: "en" }).report;
}

function model(report, method) {
  return report.modelSelection.selectedModels.find((item) => item.method === method);
}

function assertClose(actual, expected, tolerance = EPSILON, message = "") {
  assert.ok(Number.isFinite(actual), `${message} actual value must be finite`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} expected ${expected}, received ${actual}`);
}

function independentDcfComponents({ forecast, terminalGrowth, wacc, cash, debt, shares }) {
  const presentValue = forecast.reduce((sum, row) => sum + row.freeCashFlow / Math.pow(1 + wacc, row.year), 0);
  const terminalFcf = forecast[forecast.length - 1].freeCashFlow * (1 + terminalGrowth);
  const terminalValue = terminalFcf / Math.max(wacc - terminalGrowth, 0.01);
  const presentTerminalValue = terminalValue / Math.pow(1 + wacc, forecast.length);
  const equityValue = presentValue + presentTerminalValue + cash - debt;
  return {
    presentValue,
    terminalFcf,
    terminalValue,
    presentTerminalValue,
    equityValue,
    perShareFairValue: equityValue / shares
  };
}

function independentDcf(input) {
  return independentDcfComponents(input).perShareFairValue;
}

function weightedFairValue(models) {
  const usable = models
    .map((item) => ({ value: item.fairValue, weight: item.weight * item.confidence }))
    .filter((item) => Number.isFinite(item.value) && Number.isFinite(item.weight) && item.weight > 0);
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0);
  return usable.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function runByFixedWorkflow(workspace = completeWorkspace()) {
  const result = runFixedMethodologyValuation(workspace, "en");
  assert.equal(result.error, undefined);
  assert.equal(validateAnalystBrainOutput(result.report).valid, true);
  return result.report;
}

const engineSource = readFileSync(new URL("../public/src/analystBrain/engine.js", import.meta.url), "utf8");
for (const gate of [
  "balanceSheetAcceptable",
  "businessQuality",
  "riskAcceptable",
  "confidenceAcceptable",
  "marginOfSafety",
  "dilutionAcceptable",
  "scenarioAsymmetryPositive",
  "dataQuality",
  "hasInternalValuation"
]) {
  assert.ok(engineSource.includes(`"${gate}"`), `mandatory BUY gate ${gate} must remain in source`);
}

const report = runByFixedWorkflow();
assert.equal(report.classification.classification, "High Growth — Profitable");

assertClose(model(report, "P/E").fairValue, 50, EPSILON, "P/E");
assertClose(model(report, "PEG").fairValue, 33.6, EPSILON, "PEG");
assertClose(model(report, "EV/EBITDA").fairValue, 49, EPSILON, "EV/EBITDA");
assertClose(model(report, "EV/Sales").fairValue, 54, EPSILON, "EV/Sales");
assertClose(model(report, "Price/FCF").fairValue, 35.2, EPSILON, "Price/FCF");
assertClose(model(report, "Morningstar Fair Value").fairValue, 80, EPSILON, "Morningstar");
assertClose(model(report, "Analyst Consensus").fairValue, 78, EPSILON, "Analyst Consensus");

const dcf = model(report, "DCF");
const dcfComponents = independentDcfComponents(dcf.assumptions);
assertClose(dcf.assumptions.wacc, 0.086, EPSILON, "WACC");
assertClose(dcf.assumptions.terminalGrowth, 0.03, EPSILON, "Terminal Growth");
assertClose(dcfComponents.presentValue, 993_639_828.1971937, 0.001, "Present Value of forecast FCF");
assertClose(dcfComponents.terminalFcf, 296_111_043.5525934, 0.001, "Terminal FCF");
assertClose(dcfComponents.terminalValue, 5_287_697_206.296311, 0.001, "Terminal Value");
assertClose(dcfComponents.presentTerminalValue, 3_500_398_197.7764688, 0.001, "Present Value of Terminal Value");
assertClose(dcfComponents.equityValue, 4_894_038_025.973662, 0.001, "Equity Value");
assertClose(dcfComponents.perShareFairValue, 47.97320959009141, 0.000001, "Per-share DCF Fair Value");
assertClose(dcf.fairValue, independentDcf(dcf.assumptions), 0.000001, "DCF");

const rawWeights = new Map([
  ["DCF", 0.34],
  ["P/E", 0.12],
  ["PEG", 0.08],
  ["EV/EBITDA", 0.13],
  ["EV/Sales", 0.09],
  ["Price/FCF", 0.12],
  ["Morningstar Fair Value", 0.08],
  ["Analyst Consensus", 0.06]
].map(([method, baseWeight]) => [method, baseWeight * model(report, method).confidence]));
const rawTotal = [...rawWeights.values()].reduce((sum, value) => sum + value, 0);
for (const [method, rawWeight] of rawWeights.entries()) {
  assertClose(model(report, method).weight, rawWeight / rawTotal, 0.000001, `${method} weight`);
}
assertClose(report.modelSelection.fairValue, weightedFairValue(report.modelSelection.selectedModels), 0.01, "weighted fair value");
const scenarioProbabilityWeightedFairValue =
  report.scenarios.Conservative.fairValue * report.scenarios.Conservative.probability
  + report.scenarios.Base.fairValue * report.scenarios.Base.probability
  + report.scenarios.Optimistic.fairValue * report.scenarios.Optimistic.probability;
assertClose(scenarioProbabilityWeightedFairValue, 49.805960266932274, 0.000001, "Scenario probability weighted Fair Value");
assertClose(report.dashboardExport.rangeFairValue, scenarioProbabilityWeightedFairValue, 0.000001, "Dashboard scenario weighted Fair Value");
assertClose(report.executiveDecision.upsideDownside, (report.executiveDecision.fairValue - report.executiveDecision.currentPrice) / report.executiveDecision.currentPrice, EPSILON, "Margin of Safety");
assertClose(report.executiveDecision.upsideDownside, -0.5019577823185997, 0.000001, "Margin of Safety fixture");

const baseForecast = report.forecastAssumptions.yearlyForecast;
assert.equal(baseForecast.length, 5);
assert.equal(report.forecastAssumptions.yearlyAssumptions.length, 5);
for (const row of baseForecast) {
  assert.ok(row.assumptionSources.revenueGrowth.source);
  assert.ok(row.assumptionSources.operatingMargin.source);
  assert.ok(row.assumptionSources.taxRate.source);
  assert.ok(row.assumptionSources.capexToRevenue.source);
  assert.ok(row.assumptionSources.workingCapitalToRevenueGrowth.source);
  assert.ok(row.assumptionSources.daToRevenue.source);
  assert.ok(row.assumptionSources.dilution.source);
}

const yearlyOverrideWorkspace = {
  ...completeWorkspace(),
  overrides: {
    yearlyAssumptions: {
      3: {
        revenueGrowth: { value: 0.01, confidence: 0.91 },
        operatingMargin: { value: 0.2, confidence: 0.9 }
      }
    }
  }
};
const yearlyOverrideReport = runByFixedWorkflow(yearlyOverrideWorkspace);
assertClose(yearlyOverrideReport.forecastAssumptions.yearlyForecast[2].revenueGrowth, 0.01, EPSILON, "Year 3 revenue override");
assertClose(yearlyOverrideReport.forecastAssumptions.yearlyForecast[2].operatingMargin, 0.2, EPSILON, "Year 3 margin override");
assert.notEqual(yearlyOverrideReport.forecastAssumptions.yearlyForecast[1].revenueGrowth, yearlyOverrideReport.forecastAssumptions.yearlyForecast[2].revenueGrowth);

const balanceSheetGateReport = runByFixedWorkflow(completeWorkspace({
  currentPrice: 20,
  marketCap: 2_000_000_000,
  enterpriseValue: 3_200_000_000,
  cash: 0,
  totalDebt: 1_200_000_000,
  peerPeMultiple: 12,
  peerPegMultiple: 0.8,
  peerEvEbitdaMultiple: 10,
  peerEvSalesMultiple: 3,
  peerPriceFcfMultiple: 12,
  morningstarFairValue: 35,
  analystTargetAverage: 34
}));
assert.equal(balanceSheetGateReport.finalDecision.policyGates.balanceSheetAcceptable, false);
assert.notEqual(balanceSheetGateReport.finalDecision.decision, "BUY");

const cleanBuyReport = runByFixedWorkflow(actionableBuyWorkspace());
assert.equal(cleanBuyReport.finalDecision.decision, "BUY");
assert.ok(cleanBuyReport.finalDecision.mandatoryBuyGates.every((gate) => cleanBuyReport.finalDecision.policyGates[gate]));

const riskGateReport = runAnalystBrainEngine(actionableBuyWorkspace({
  industry: "Semiconductor cyclical",
  currentPrice: 10,
  marketCap: 1_000_000_000,
  enterpriseValue: 1_500_000_000,
  cash: 0,
  totalDebt: 500_000_000,
  customerConcentration: "one large customer",
  regulatoryRisks: "export controls",
  stockBasedCompensation: 100_000_000,
  morningstarFairValue: 40,
  analystTargetAverage: 38
}), { language: "en" }).report;
assert.equal(riskGateReport.finalDecision.policyGates.riskAcceptable, false);
assert.notEqual(riskGateReport.finalDecision.decision, "BUY");

const dataQualityGateReport = engineReportFromFields({
  ticker: "DQ",
  companyName: "Data Quality Gate Co",
  currentPrice: 20,
  eps: 2,
  dilutedShares: 100_000_000
});
assert.equal(dataQualityGateReport.finalDecision.policyGates.dataQuality, false);
assert.notEqual(dataQualityGateReport.finalDecision.decision, "BUY");

const forecastGateSyntheticReport = structuredClone(cleanBuyReport);
forecastGateSyntheticReport.finalDecision.policyGates.forecastConfidence = false;
assert.ok(forecastGateSyntheticReport.finalDecision.mandatoryBuyGates.includes("forecastConfidence"));

const externalOnlyReport = engineReportFromFields({
  ticker: "EXT",
  companyName: "External Only",
  currentPrice: 20,
  morningstarFairValue: 40,
  analystTargetAverage: 42
});
assert.equal(externalOnlyReport.finalDecision.policyGates.hasInternalValuation, false);
assert.equal(externalOnlyReport.finalDecision.decision, "INSUFFICIENT_DATA");

const marginGateReport = runByFixedWorkflow(actionableBuyWorkspace({
  currentPrice: 40,
  marketCap: 4_000_000_000,
  enterpriseValue: 3_600_000_000
}));
assert.equal(marginGateReport.finalDecision.policyGates.marginOfSafety, false);
assert.equal(marginGateReport.finalDecision.decision, "HOLD");

const sellBoundaryHold = runByFixedWorkflow(actionableBuyWorkspace({
  currentPrice: 56.85,
  marketCap: 5_685_000_000,
  enterpriseValue: 5_285_000_000
}));
assert.ok(sellBoundaryHold.executiveDecision.upsideDownside > -0.15);
assert.equal(sellBoundaryHold.finalDecision.decision, "HOLD");

const sellBoundarySell = runByFixedWorkflow(actionableBuyWorkspace({
  currentPrice: 57,
  marketCap: 5_700_000_000,
  enterpriseValue: 5_300_000_000
}));
assert.ok(sellBoundarySell.executiveDecision.upsideDownside <= -0.15);
assert.equal(sellBoundarySell.finalDecision.decision, "SELL");

const lowBusinessQualityReport = engineReportFromFields({
  ticker: "LOWQ",
  companyName: "Low Quality Co",
  currentPrice: 20,
  sector: "Retail",
  industry: "Retail",
  revenue: 1_000_000_000,
  grossProfit: 100_000_000,
  operatingIncome: -100_000_000,
  netIncome: 10_000_000,
  eps: 0.1,
  ebitda: 10_000_000,
  freeCashFlow: -50_000_000,
  capex: 50_000_000,
  cash: 0,
  totalDebt: 100_000_000,
  dilutedShares: 100_000_000,
  peerPeMultiple: 10,
  peerEvSalesMultiple: 1
});
assert.ok(lowBusinessQualityReport.businessQuality.score < 40);
assert.equal(lowBusinessQualityReport.finalDecision.decision, "SELL");

for (const [ticker, sector, industry, expectedClass] of [
  ["BNK", "Financial Services", "Bank", "Financial Institution"],
  ["RIT", "Real Estate", "REIT", "REIT"],
  ["HLD", "Financial Services", "Holding Company", "Holding Company"]
]) {
  const unsupportedWorkspace = completeWorkspace({ ticker, sector, industry });
  const unsupportedReport = runByFixedWorkflow(unsupportedWorkspace);
  assert.equal(unsupportedReport.classification.classification, expectedClass);
  assert.equal(unsupportedReport.modelSelection.modelPolicyStatus, "NO_SUPPORTED_MODEL");
  assert.equal(unsupportedReport.modelSelection.selectedModels.length, 0);
  assert.equal(unsupportedReport.finalDecision.decision, "INSUFFICIENT_DATA");
}

const negativeFcfReport = engineReportFromFields({
  ticker: "NEGFCF",
  companyName: "Negative FCF Co",
  currentPrice: 20,
  revenue: 1_000_000_000,
  revenueEstimates: 1_200_000_000,
  operatingIncome: -100_000_000,
  freeCashFlow: -50_000_000,
  eps: -1,
  cash: 100_000_000,
  totalDebt: 0,
  dilutedShares: 100_000_000,
  peerEvSalesMultiple: 3,
  peerForwardEvSalesMultiple: 4
});
assert.ok(!model(negativeFcfReport, "DCF"));
assert.ok(!model(negativeFcfReport, "Price/FCF"));
assert.ok(!model(negativeFcfReport, "P/E"));
assert.ok(model(negativeFcfReport, "EV/Sales"));
assert.ok(model(negativeFcfReport, "Forward EV/Sales"));

const matureNoPegReport = engineReportFromFields({
  ticker: "NOPEG",
  companyName: "No PEG Co",
  currentPrice: 20,
  sector: "Consumer Staples",
  industry: "Household Products",
  revenue: 1_000_000_000,
  revenueEstimates: 1_020_000_000,
  operatingIncome: 180_000_000,
  ebitda: 220_000_000,
  freeCashFlow: 120_000_000,
  eps: 2,
  cash: 100_000_000,
  totalDebt: 0,
  dilutedShares: 100_000_000
});
assert.ok(model(matureNoPegReport, "P/E"));
assert.ok(!model(matureNoPegReport, "PEG"));

const missingEbitdaReport = engineReportFromFields({
  ticker: "NOEBITDA",
  companyName: "No EBITDA Co",
  currentPrice: 20,
  revenue: 1_000_000_000,
  operatingIncome: 180_000_000,
  freeCashFlow: 120_000_000,
  eps: 2,
  cash: 100_000_000,
  totalDebt: 0,
  dilutedShares: 100_000_000
});
assert.ok(!model(missingEbitdaReport, "EV/EBITDA"));

const missingRevenueReport = engineReportFromFields({
  ticker: "NOREV",
  companyName: "No Revenue Co",
  currentPrice: 20,
  eps: 2,
  ebitda: 220_000_000,
  cash: 100_000_000,
  totalDebt: 0,
  dilutedShares: 100_000_000
});
assert.ok(!model(missingRevenueReport, "EV/Sales"));

for (const selectedModel of report.modelSelection.selectedModels) {
  assert.ok(SUPPORTED_MODELS.includes(selectedModel.method));
  assert.ok(!UNSUPPORTED_MODELS.includes(selectedModel.method));
}

const conflictWorkspace = completeWorkspace({
  marketCap: 1_000_000,
  enterpriseValue: 10_000,
  cash: 0,
  totalDebt: 100_000_000,
  grossProfit: 100_000_000,
  operatingIncome: 400_000_000
});
const conflictReport = runAnalystBrainEngine(conflictWorkspace, { language: "en" }).report;
const conflictCodes = conflictReport.dataQuality.conflictingData.map((item) => item.code);
assert.ok(conflictCodes.includes("MARKET_CAP_UNIT_CONFLICT"));
assert.ok(conflictCodes.includes("ENTERPRISE_VALUE_CONFLICT"));
assert.ok(conflictCodes.includes("IMPOSSIBLE_MARGIN_STACK"));
assert.equal(validateAnalystBrainOutput(conflictReport).valid, false);

const badDcf = structuredClone(report);
model(badDcf, "DCF").fairValue += 1;
assert.equal(validateAnalystBrainOutput(badDcf).valid, false);

const badWacc = structuredClone(report);
badWacc.forecastAssumptions.wacc.finalWacc = 0.2;
assert.equal(validateAnalystBrainOutput(badWacc).valid, false);

const badProbabilities = structuredClone(report);
badProbabilities.scenarios.Base.probability = 0.49;
assert.equal(validateAnalystBrainOutput(badProbabilities).valid, false);

const badModelWeight = structuredClone(report);
model(badModelWeight, "DCF").weight = 0.51;
assert.equal(validateAnalystBrainOutput(badModelWeight).valid, false);

const badExternalWeight = structuredClone(report);
model(badExternalWeight, "Morningstar Fair Value").weight = 0.2;
model(badExternalWeight, "Analyst Consensus").weight = 0.2;
assert.equal(validateAnalystBrainOutput(badExternalWeight).valid, false);

const badUnsupportedModel = structuredClone(report);
badUnsupportedModel.modelSelection.selectedModels.push({
  ...model(report, "P/E"),
  method: "P/B",
  fairValue: 12,
  value: 12,
  weight: 0.01
});
assert.equal(validateAnalystBrainOutput(badUnsupportedModel).valid, false);

const badEvEbitda = structuredClone(report);
model(badEvEbitda, "EV/EBITDA").fairValue += 1;
assert.equal(validateAnalystBrainOutput(badEvEbitda).valid, false);

const badEvSales = structuredClone(report);
model(badEvSales, "EV/Sales").fairValue += 1;
assert.equal(validateAnalystBrainOutput(badEvSales).valid, false);

const badWeightedFairValue = structuredClone(report);
badWeightedFairValue.modelSelection.fairValue += 1;
assert.equal(validateAnalystBrainOutput(badWeightedFairValue).valid, false);

const badOrder = structuredClone(report);
badOrder.scenarios.Conservative.fairValue = badOrder.scenarios.Optimistic.fairValue + 1;
assert.equal(validateAnalystBrainOutput(badOrder).valid, false);

const badCurrency = structuredClone(report);
badCurrency.companyAndValuationDate.currency = "SAR";
assert.equal(validateAnalystBrainOutput(badCurrency).valid, false);

const badCriticalConflict = structuredClone(report);
badCriticalConflict.dataQuality.conflictingData = [{ code: "MARKET_CAP_UNIT_CONFLICT", message: "unit mismatch", fields: ["marketCap"] }];
assert.equal(validateAnalystBrainOutput(badCriticalConflict).valid, false);

const badExceptional = structuredClone(report);
badExceptional.scenarios.Exceptional = { included: false, fairValue: 999 };
assert.equal(validateAnalystBrainOutput(badExceptional).valid, false);

console.log("Version 9.1 analytical engine tests passed.");
