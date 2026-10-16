import assert from "node:assert/strict";
import { verifyFinancialAnalysis, recalculateValuationMethod } from "../src/financialSafety/financialVerification.js";
import { financialVerificationForReport } from "../src/financialSafety/decisionReadinessUi.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";

const { verifiedFixture } = await import("./launchAuditFinancialVerification.test.mjs");
const clean = verifiedFixture();
const check = (edit, code) => {
  const report = structuredClone(clean);
  edit(report);
  const result = verifyFinancialAnalysis(report);
  assert.notEqual(result.status, "VERIFIED", code);
  assert.ok(result.findings.some((item) => item.code === code), JSON.stringify(result.findings));
};

// The UI must never trust a supplied/cached badge, nor skip schema validation on reload.
assert.equal(financialVerificationForReport({ metadata: { financialVerification: {
  status: "VERIFIED", complete: true, findings: [], warnings: []
} } }).status, "NEEDS_REVIEW");
const parsed = (await parseExternalAnalysisInput(JSON.stringify(clean), { strictJson: true })).report;
assert.equal(financialVerificationForReport(parsed).status, "VERIFIED");
const stale = structuredClone(parsed);
stale.metadata.franklinV3Report.valuation.scenarios.Base.fairValue = 99999;
assert.equal(financialVerificationForReport(stale).status, "BLOCKED");

check((r) => { r.valuation.valuationResults[0].weight = 50; }, "METHOD_WEIGHTS_INVALID");
check((r) => { r.valuation.methodology.modelWeights[0].weight = 50; }, "METHOD_WEIGHTS_INVALID");
check((r) => { r.valuation.valuationResults.push({ ...r.valuation.valuationResults[0], weight: -1 }); }, "METHOD_WEIGHTS_INVALID");
check((r) => { r.decision.action = "BUY"; r.decision.exceptionalReason = "Exception"; r.decision.rationale = ["A special case."]; }, "DECISION_EXCEPTION_REQUIRES_REVIEW");
check((r) => { r.valuation.valuationResults[0].inputProvenance.normalizedForwardEps.asOf = "not-a-date"; }, "MATERIAL_INPUT_PROVENANCE_INCOMPLETE");
check((r) => { r.valuation.valuationResults[0].inputProvenance.normalizedForwardEps.asOf = "2099-01-01"; }, "PROVENANCE_LOOKAHEAD");
check((r) => { r.valuation.valuationResults[0].inputProvenance.normalizedForwardEps.unit = "USD million"; }, "VALUATION_INPUT_UNIT_MISMATCH");
check((r) => { r.financialNormalization = { revenue: { value: 1 } }; }, "NORMALIZATION_METHOD_COVERAGE_MISSING");

const dcf = {
  valuationDate: clean.reportIdentity.analysisDate,
  cashFlowType: "FCFF", discountRateType: "WACC",
  forecastFreeCashFlows: [10, 20], discountPeriods: [1, 2], discountRatePct: 10,
  terminalValueMethod: "EXIT_MULTIPLE", terminalMetric: 20, terminalExitMultiple: 5,
  terminalValue: 100, terminalDiscountPeriod: 2, cash: 0, debt: 0, dilutedShares: 1
};
for (const [edit, code] of [
  [(i) => { i.discountPeriods = [2, 1]; }, "DCF_SCHEDULE_NOT_ORDERED"],
  [(i) => { i.discountPeriods = [1, 1]; }, "DCF_SCHEDULE_NOT_ORDERED"],
  [(i) => { i.terminalDiscountPeriod = 0; }, "DCF_TERMINAL_TIMING_MISMATCH"],
  [(i) => { i.cash = -10; }, "INVALID_DCF_CAPITAL_BRIDGE"],
  [(i) => { i.terminalValueMethod = "PERPETUITY_GROWTH"; i.terminalGrowthPct = -200; i.terminalCashFlow = -10; }, "INVALID_TERMINAL_GROWTH"]
]) {
  const inputs = structuredClone(dcf);
  edit(inputs);
  assert.equal(recalculateValuationMethod({ method: "DCF", inputs }).code, code);
}
assert.equal(recalculateValuationMethod({ method: "P/E", inputs: { normalizedForwardEps: 1e308, impliedMultiple: 100 } }).code, "NON_FINITE_VALUATION_RESULT");

// Margin checks must compare like units, not raw numeric magnitudes.
const mixedUnits = structuredClone(clean);
const row = mixedUnits.forecast.yearlyForecast[0];
row.revenue = { ...row.revenue, value: 1, unit: "USD billion" };
row.ebitda = { ...row.ebitda, value: 200, unit: "USD million" };
row.ebitdaMarginPct = { ...row.ebitdaMarginPct, value: 20, unit: "%" };
row.freeCashFlow = { ...row.freeCashFlow, value: 100, unit: "USD million" };
row.fcfMarginPct = { ...row.fcfMarginPct, value: 10, unit: "%" };
assert.ok(!verifyFinancialAnalysis(mixedUnits).findings.some((f) => f.code === "FORECAST_MARGIN_MISMATCH"));
row.ebitdaMarginPct.value = 20000;
assert.ok(verifyFinancialAnalysis(mixedUnits).findings.some((f) => f.code === "FORECAST_MARGIN_MISMATCH"));

// A complete DCF control proves that the added gates do not just reject everything.
const fullDcf = structuredClone(clean);
for (const [index, forecast] of fullDcf.forecast.yearlyForecast.entries()) {
  forecast.revenue.value = 100;
  forecast.revenue.unit = "USD";
  forecast.ebitda.value = 30;
  forecast.ebitda.unit = "USD";
  forecast.ebitdaMarginPct.value = 30;
  forecast.freeCashFlow.value = dcf.forecastFreeCashFlows[index];
  forecast.freeCashFlow.unit = "USD";
  forecast.fcfMarginPct.value = dcf.forecastFreeCashFlows[index];
  for (const key of ["freeCashFlow", "fcfMarginPct"]) {
    Object.assign(forecast[key], { basis: "analyst_assumption", asOf: clean.reportIdentity.analysisDate });
  }
  forecast.fcfMarginPct.unit = "%";
}
const dcfInputs = { ...dcf, forecastPeriods: fullDcf.forecast.yearlyForecast.map((r) => r.period), terminalMetricType: "EBITDA" };
const value = recalculateValuationMethod({ method: "DCF", inputs: dcfInputs }).value;
fullDcf.forecast.wacc.value = 10;
fullDcf.valuation.current.base = value;
fullDcf.valuation.valuationResults = [{
  method: "DCF", role: "PRIMARY", weight: 100, fairValue: value,
  inputs: dcfInputs, rationale: "Discount forecast enterprise cash flows with WACC.", assumptions: { terminal: "EBITDA exit multiple" },
  inputProvenance: Object.fromEntries(Object.entries(dcfInputs)
    .filter(([, v]) => typeof v === "number" || (Array.isArray(v) && v.every(Number.isFinite)))
    .map(([key]) => [key, {
      type: "ANALYST_ASSUMPTION", asOf: clean.reportIdentity.analysisDate, period: "FY2026E-FY2027E",
      unit: key === "dilutedShares" ? "shares" : /Pct$/.test(key) ? "%" : /Multiple/.test(key) ? "x" : /Period/.test(key) ? "years" : "USD"
    }]))
}];
fullDcf.valuation.methodology.modelWeights = [{ method: "DCF", weight: 100 }];
fullDcf.valuation.methodology.primaryMethod = "DCF";
fullDcf.valuation.methodology.excludedMethods = [{ method: "P/E", reason: "Cash flows are the basis of this control." }];
Object.assign(fullDcf.valuation.calculationAudit, { weightedMethodFairValue: value, reconciledBaseFairValue: value });
fullDcf.decision.rationale = ["WATCH pending further evidence."];
assert.equal(verifyFinancialAnalysis(fullDcf).status, "VERIFIED", JSON.stringify(verifyFinancialAnalysis(fullDcf).findings));
const mutateDcf = (edit, code) => {
  const r = structuredClone(fullDcf);
  edit(r.valuation.valuationResults[0]);
  assert.ok(verifyFinancialAnalysis(r).findings.some((f) => f.code === code), code);
};
mutateDcf((m) => { delete m.inputs.forecastPeriods; }, "DCF_FORECAST_LINK_UNVERIFIED");
mutateDcf((m) => { m.inputs.forecastPeriods[0] = "FY2099E"; }, "DCF_FORECAST_LINK_UNVERIFIED");
mutateDcf((m) => { m.inputs.terminalMetricType = "NET_INCOME"; }, "DCF_TERMINAL_METRIC_BASIS_UNVERIFIED");
mutateDcf((m) => { m.inputs.valuationDate = "not-a-date"; }, "DCF_VALUATION_DATE_MISMATCH");
mutateDcf((m) => { m.inputProvenance.dilutedShares.unit = "million shares"; }, "VALUATION_SCALE_MISMATCH");
mutateDcf((m) => { m.inputProvenance.cash.unit = "EUR"; }, "VALUATION_INPUT_UNIT_MISMATCH");
const reconciled = structuredClone(fullDcf);
reconciled.forecast.yearlyForecast[0].freeCashFlow.value = 8;
reconciled.forecast.yearlyForecast[0].fcfMarginPct.value = 8;
reconciled.valuation.valuationResults[0].inputs.cashFlowReconciliation = [{ period: dcfInputs.forecastPeriods[0], adjustment: 2, reason: "Explicit operating-versus-equity flow bridge." }];
assert.equal(verifyFinancialAnalysis(reconciled).status, "VERIFIED");
console.log("Post-remediation boundary regressions passed.");
