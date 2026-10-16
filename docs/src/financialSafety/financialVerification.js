import { auditAnalysisIntegrity } from "../aiIntegrity/auditor.js";

export const FINANCIAL_VERIFICATION_STATUSES = Object.freeze({
  VERIFIED: "VERIFIED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  BLOCKED: "BLOCKED"
});

const STATUS_RANK = Object.freeze({
  VERIFIED: 0,
  NEEDS_REVIEW: 1,
  INSUFFICIENT_DATA: 2,
  BLOCKED: 3
});
const FAIR_VALUE_RELATIVE_TOLERANCE = 0.001;
const FAIR_VALUE_ABSOLUTE_TOLERANCE = 0.01;
const RATE_TOLERANCE_PCT = 0.1;
const MARGIN_TOLERANCE_PCT = 0.5;
const TERMINAL_CONCENTRATION_WARNING_PCT = 75;

export function verifyFinancialAnalysis(input = {}, options = {}) {
  const findings = [];
  const warnings = [];
  const methodResults = [];
  let status = FINANCIAL_VERIFICATION_STATUSES.VERIFIED;
  const raise = (next) => {
    if (STATUS_RANK[next] > STATUS_RANK[status]) status = next;
  };
  const add = (next, code, field, message, action = null, details = {}) => {
    raise(next);
    findings.push({ code, field, message, action, status: next, ...details });
  };
  const warn = (code, field, message, details = {}) => {
    warnings.push({ code, field, message, status: "WARNING", ...details });
  };

  if (Array.isArray(options.schemaErrors) && options.schemaErrors.length) {
    add("BLOCKED", "STRUCTURAL_VALIDATION_FAILED", "$", "The canonical JSON contract contains blocking validation errors.", "Correct the structured validation errors before relying on the analysis.");
  }

  const valuation = input.valuation || {};
  const methodology = valuation.methodology || {};
  const weightedResults = (Array.isArray(valuation.valuationResults) ? valuation.valuationResults : [])
    .filter((item) => finite(item?.weight) && item.weight > 0);
  validateWeights(valuation, add);

  for (const [index, result] of weightedResults.entries()) {
    const path = `valuation.valuationResults.${index}`;
    const recalculation = recalculateValuationMethod(result);
    methodResults.push({
      method: result?.method || null,
      reportedFairValue: number(result?.fairValue),
      recalculatedFairValue: recalculation.value,
      state: recalculation.state,
      reason: recalculation.reason,
      terminalConcentrationPct: recalculation.terminalConcentrationPct ?? null
    });
    if (recalculation.state === "INSUFFICIENT_DATA") {
      add("INSUFFICIENT_DATA", "METHOD_INPUTS_INSUFFICIENT", `${path}.inputs`, `${result?.method || "Valuation method"} cannot be independently recalculated from its typed inputs.`, "Supply every typed input required by the method.", { method: result?.method || null });
      continue;
    }
    if (recalculation.state === "BLOCKED") {
      add("BLOCKED", recalculation.code || "METHOD_FINANCIALLY_INVALID", `${path}.inputs`, recalculation.reason, recalculation.action, { method: result?.method || null });
      continue;
    }
    const reported = number(result?.fairValue);
    if (!finite(reported) || !withinFairValue(recalculation.value, reported)) {
      add("BLOCKED", "METHOD_FAIR_VALUE_MISMATCH", `${path}.fairValue`, `${result?.method || "Valuation method"} reports ${display(reported)} but Franklin recalculates ${display(recalculation.value)}.`, "Correct the inputs or the reported method fair value.", { method: result?.method || null, reportedFairValue: reported, recalculatedFairValue: recalculation.value });
    }
    if (finite(recalculation.terminalConcentrationPct) && recalculation.terminalConcentrationPct > TERMINAL_CONCENTRATION_WARNING_PCT) {
      warn("HIGH_TERMINAL_VALUE_CONCENTRATION", `${path}.inputs.terminalValue`, `Terminal value contributes ${recalculation.terminalConcentrationPct.toFixed(1)}% of DCF enterprise value.`, { method: result?.method || null, terminalConcentrationPct: recalculation.terminalConcentrationPct });
    }
    validateMethodEconomics(input, result, path, add, warn);
  }

  validateMethodSelection(methodology, weightedResults, add);
  validateSectorMethodFit(input, methodology, weightedResults, add);
  validateForecastRelationships(input, add);
  validateForecastProvenance(input, add);
  validateFinancialNormalizationCoverage(input, weightedResults, add);
  validateInputProvenance(input, weightedResults, add);
  validateInputUnits(input, weightedResults, add);

  const recalculatedWeighted = weightedResults.length && methodResults.length === weightedResults.length
    && methodResults.every((item) => finite(item.recalculatedFairValue))
    ? weightedResults.reduce((sum, item, index) => sum + methodResults[index].recalculatedFairValue * item.weight / 100, 0)
    : null;
  const base = number(valuation.current?.base);
  if (!finite(recalculatedWeighted)) {
    add("INSUFFICIENT_DATA", "BASE_RECALCULATION_UNAVAILABLE", "valuation.current.base", "Franklin cannot derive Base fair value because one or more weighted methods could not be recalculated.", "Complete all positively weighted method inputs.");
  } else if (!withinFairValue(recalculatedWeighted, base)) {
    add("BLOCKED", "BASE_WEIGHTED_VALUE_MISMATCH", "valuation.current.base", `Base fair value is ${display(base)} but the Franklin-recalculated weighted method value is ${display(recalculatedWeighted)}.`, "Set Base to Franklin's weighted result; change method inputs or weights explicitly rather than applying a detached overlay.", { reportedBaseFairValue: base, recalculatedWeightedFairValue: recalculatedWeighted });
  }

  validateCalculationAudit(valuation, recalculatedWeighted, base, add);
  validateDecisionConsistency(input, add);

  const integrity = auditAnalysisIntegrity(toIntegrityPayload(input));
  for (const finding of integrity.findings) {
    const blocking = finding.severity === "CRITICAL" || String(finding.code).includes("CONTRADICTION");
    if (blocking) add("BLOCKED", finding.code, "decision", finding.evidence || "Integrity audit found a blocking contradiction.", "Correct the decision, scenario, or evidence conflict.");
    else warn(finding.code, "decision", finding.evidence || "Integrity audit finding.");
  }

  const sourceVerification = sourceVerificationSummary(input, weightedResults);
  const derivedConfidenceScore = ({ VERIFIED: 90, NEEDS_REVIEW: 60, INSUFFICIENT_DATA: 30, BLOCKED: 0 })[status];
  const derivedDataQualityScore = Math.round(sourceVerification.linkage.coveragePct);
  return {
    status,
    complete: status === "VERIFIED",
    sourceOfTruth: "FRANKLIN_RECALCULATION",
    tolerance: {
      absolute: FAIR_VALUE_ABSOLUTE_TOLERANCE,
      relativePct: FAIR_VALUE_RELATIVE_TOLERANCE * 100
    },
    recalculatedWeightedFairValue: recalculatedWeighted,
    reportedBaseFairValue: base,
    methodResults,
    findings,
    warnings,
    sourceVerification,
    derivedConfidenceScore,
    derivedDataQualityScore,
    modelReportedConfidence: input.decision?.confidence ?? null,
    modelReportedDataQuality: input.dataQuality?.score ?? null,
    integrityStatus: integrity.finalStatus
  };
}

export function recalculateValuationMethod(result = {}) {
  const method = normalizeMethod(result.method);
  const inputs = object(result.inputs);
  if (isPe(method)) {
    const eps = firstNumber(inputs.normalizedForwardEps, inputs.forwardEps, inputs.eps);
    const multiple = firstNumber(inputs.impliedMultiple, inputs.forwardMultiple, inputs.peMultiple, inputs.multiple);
    if (![eps, multiple].every(finite)) return insufficient("P/E requires normalizedForwardEps and impliedMultiple.");
    if (eps <= 0 || multiple <= 0) return blocked("INVALID_PE_ECONOMICS", "P/E requires positive normalized earnings and a positive multiple; multiplying two negative values is not a valid equity valuation.", "Use a method suitable for loss-making companies or provide positive normalized earnings.");
    return calculated(eps * multiple);
  }
  if (method.includes("EV/EBITDA")) {
    const ebitda = firstNumber(inputs.normalizedEbitda, inputs.ebitda);
    const multiple = firstNumber(inputs.evEbitdaMultiple, inputs.impliedMultiple, inputs.multiple);
    const netDebt = firstNumber(inputs.netDebt, result.calculation?.netDebt);
    const shares = firstNumber(inputs.dilutedShares, result.calculation?.dilutedShares);
    const inputAdjustment = number(inputs.nonOperatingAdjustments);
    const legacyAdjustment = number(result.calculation?.nonOperatingAdjustments);
    if (finite(inputAdjustment) && finite(legacyAdjustment) && !withinFairValue(inputAdjustment, legacyAdjustment)) {
      return blocked("NON_OPERATING_ADJUSTMENT_CONFLICT", "nonOperatingAdjustments conflicts between inputs and the legacy calculation location.", "Keep the canonical value in inputs and remove or match the legacy duplicate.");
    }
    const adjustment = finite(inputAdjustment) ? inputAdjustment : (finite(legacyAdjustment) ? legacyAdjustment : 0);
    if (![ebitda, multiple, netDebt, shares].every(finite)) return insufficient("EV/EBITDA requires normalizedEbitda, evEbitdaMultiple, netDebt, and dilutedShares.");
    if (ebitda <= 0 || multiple <= 0 || shares <= 0) return blocked("INVALID_EV_EBITDA_ECONOMICS", "EV/EBITDA requires positive EBITDA, a positive multiple, and positive diluted shares.", "Use a valuation method suitable for negative EBITDA or correct the inputs.");
    return calculated(((ebitda * multiple) - netDebt + adjustment) / shares);
  }
  if (method.includes("P/FCF") || method.includes("PRICE/FCF")) {
    const fcf = firstNumber(inputs.normalizedFreeCashFlow, inputs.freeCashFlow, inputs.fcf);
    const shares = number(inputs.dilutedShares);
    const perShare = number(inputs.fcfPerShare);
    const multiple = firstNumber(inputs.impliedMultiple, inputs.multiple);
    const normalizedPerShare = finite(perShare) ? perShare : (finite(fcf) && finite(shares) && shares > 0 ? fcf / shares : null);
    if (![normalizedPerShare, multiple].every(finite)) return insufficient("P/FCF requires free cash flow per share (or total FCF and shares) and impliedMultiple.");
    if (normalizedPerShare <= 0 || multiple <= 0 || (finite(shares) && shares <= 0)) return blocked("INVALID_P_FCF_ECONOMICS", "P/FCF requires positive free cash flow per share, multiple, and diluted shares when supplied.", "Use another method for negative free cash flow or correct the inputs.");
    return calculated(normalizedPerShare * multiple);
  }
  if (method.includes("EV/EBIT") && !method.includes("EV/EBITDA")) {
    const ebit = firstNumber(inputs.normalizedEbit, inputs.ebit);
    const multiple = firstNumber(inputs.evEbitMultiple, inputs.multiple);
    const netDebt = number(inputs.netDebt);
    const shares = number(inputs.dilutedShares);
    if (![ebit, multiple, netDebt, shares].every(finite)) return insufficient("EV/EBIT requires normalizedEbit, evEbitMultiple, netDebt, and dilutedShares.");
    if (ebit <= 0 || multiple <= 0 || shares <= 0) return blocked("INVALID_EV_EBIT_ECONOMICS", "EV/EBIT requires positive EBIT, multiple, and diluted shares.", "Use another method for negative EBIT or correct the inputs.");
    return calculated(((ebit * multiple) - netDebt) / shares);
  }
  if (method.includes("SOTP") || method.includes("SUM OF THE PARTS")) {
    const components = inputs.componentEquityValues;
    const adjustments = number(inputs.corporateAdjustments);
    const shares = number(inputs.dilutedShares);
    if (!Array.isArray(components) || !components.length || !components.every(finite) || ![adjustments, shares].every(finite)) return insufficient("SOTP requires componentEquityValues, corporateAdjustments, and dilutedShares.");
    if (shares <= 0) return blocked("INVALID_SOTP_SHARES", "SOTP requires positive diluted shares.", "Correct dilutedShares.");
    return calculated((components.reduce((sum, value) => sum + value, 0) + adjustments) / shares);
  }
  if (method.includes("DCF")) return recalculateDcf(inputs);
  return insufficient(`Franklin has no deterministic calculator for ${result.method || "this method"}.`);
}

function recalculateDcf(inputs) {
  const flows = inputs.forecastFreeCashFlows;
  const periods = inputs.discountPeriods;
  const rate = number(inputs.discountRatePct);
  const terminalPeriod = number(inputs.terminalDiscountPeriod);
  const cash = number(inputs.cash);
  const debt = number(inputs.debt);
  const shares = number(inputs.dilutedShares);
  if (!Array.isArray(flows) || !flows.length || !flows.every(finite) || !Array.isArray(periods) || periods.length !== flows.length || !periods.every((value) => finite(value) && value >= 0) || ![rate, terminalPeriod, cash, debt, shares].every(finite)) {
    return insufficient("DCF requires a finite cash-flow schedule, matching non-negative discount periods, discount rate, terminal period, cash, debt, and diluted shares.");
  }
  if (rate <= 0 || rate > 50 || shares <= 0 || terminalPeriod < 0) return blocked("INVALID_DCF_RATE_OR_TIMING", "DCF discount rate must be greater than 0% and no more than 50%, diluted shares must be positive, and discount periods cannot be negative.", "Correct the discount rate, timing, or share count.");
  if (periods.some((period, index) => index > 0 && period <= periods[index - 1])) return blocked("DCF_SCHEDULE_NOT_ORDERED", "DCF discount periods must be strictly increasing; duplicate or reversed periods can double-count or mis-time cash flows.", "Aggregate cash flows at the same date and provide an ordered schedule.");
  if (Math.abs(terminalPeriod - periods.at(-1)) > 1e-8) return blocked("DCF_TERMINAL_TIMING_MISMATCH", "Terminal value must be measured at the end of the explicit cash-flow schedule.", "Use the last explicit discount period for terminalDiscountPeriod; encode any intervening flows explicitly.");
  if (cash < 0 || debt < 0) return blocked("INVALID_DCF_CAPITAL_BRIDGE", "DCF cash and debt must be non-negative gross balances.", "Correct the capital bridge; represent net debt through its components, not a negative gross debt or cash balance.");
  const flowType = String(inputs.cashFlowType || "").toUpperCase();
  const rateType = String(inputs.discountRateType || "").toUpperCase();
  if (flowType && !["FCFF", "FCFE"].includes(flowType)) return blocked("INVALID_DCF_FLOW_TYPE", "cashFlowType must be FCFF or FCFE.", "Declare the DCF cash-flow type explicitly.");
  if (flowType === "FCFF" && rateType && rateType !== "WACC") return blocked("DCF_RATE_TYPE_MISMATCH", "FCFF must be discounted with WACC.", "Use discountRateType WACC for FCFF.");
  if (flowType === "FCFE" && rateType && rateType !== "COST_OF_EQUITY") return blocked("DCF_RATE_TYPE_MISMATCH", "FCFE must be discounted with Cost of Equity.", "Use discountRateType COST_OF_EQUITY for FCFE.");
  if (flowType === "FCFE" && (Math.abs(cash) > FAIR_VALUE_ABSOLUTE_TOLERANCE || Math.abs(debt) > FAIR_VALUE_ABSOLUTE_TOLERANCE)) return blocked("FCFE_ENTERPRISE_BRIDGE_INVALID", "FCFE is already an equity cash flow and must not add cash or subtract debt again.", "Set cash and debt to zero for FCFE or use FCFF with WACC.");

  const terminal = deriveTerminalValue(inputs, rate);
  if (terminal.state !== "CALCULATED") return terminal;
  const discount = 1 + rate / 100;
  const pvFlows = flows.reduce((sum, value, index) => sum + value / Math.pow(discount, periods[index]), 0);
  const pvTerminal = terminal.value / Math.pow(discount, terminalPeriod);
  const enterpriseOrEquity = pvFlows + pvTerminal;
  const bridge = flowType === "FCFE" ? 0 : cash - debt;
  const fairValue = (enterpriseOrEquity + bridge) / shares;
  return {
    ...calculated(fairValue),
    terminalValue: terminal.value,
    terminalConcentrationPct: enterpriseOrEquity === 0 ? null : Math.abs(pvTerminal / enterpriseOrEquity) * 100
  };
}

function deriveTerminalValue(inputs, ratePct) {
  const supplied = number(inputs.terminalValue);
  const method = String(inputs.terminalValueMethod || "").toUpperCase();
  if (!method) {
    if (supplied === 0) return calculated(0);
    return insufficient("A non-zero DCF terminalValue requires terminalValueMethod and derivation inputs.");
  }
  let derived = null;
  if (["PERPETUITY_GROWTH", "GORDON_GROWTH"].includes(method)) {
    const terminalCashFlow = firstNumber(inputs.terminalCashFlow, Array.isArray(inputs.forecastFreeCashFlows) ? inputs.forecastFreeCashFlows.at(-1) : null);
    const growthPct = number(inputs.terminalGrowthPct);
    if (![terminalCashFlow, growthPct].every(finite) || terminalCashFlow <= 0 || growthPct <= -100 || growthPct >= ratePct) return blocked("INVALID_TERMINAL_GROWTH", "Perpetuity-growth terminal value requires positive sustainable cash flow and terminal growth greater than -100% and below the discount rate.", "Supply a supportable positive terminal cash flow and a valid growth rate, or use a finite-life model.");
    derived = terminalCashFlow * (1 + growthPct / 100) / ((ratePct - growthPct) / 100);
  } else if (method === "EXIT_MULTIPLE") {
    const metric = number(inputs.terminalMetric);
    const multiple = number(inputs.terminalExitMultiple);
    if (![metric, multiple].every(finite) || metric <= 0 || multiple <= 0) return blocked("INVALID_TERMINAL_MULTIPLE", "Exit-multiple terminal value requires a positive terminalMetric and terminalExitMultiple.", "Supply positive terminal metric and multiple inputs.");
    derived = metric * multiple;
  } else if (method === "NONE" && supplied === 0) {
    derived = 0;
  } else {
    return blocked("UNSUPPORTED_TERMINAL_VALUE_METHOD", `Unsupported terminalValueMethod ${inputs.terminalValueMethod}.`, "Use PERPETUITY_GROWTH, EXIT_MULTIPLE, or NONE.");
  }
  if (!finite(supplied) || !withinFairValue(derived, supplied)) return blocked("TERMINAL_VALUE_MISMATCH", `Reported terminalValue is ${display(supplied)} but Franklin derives ${display(derived)}.`, "Correct the terminal assumptions or terminalValue.");
  return calculated(derived);
}

function validateMethodEconomics(input, result, path, add, warn) {
  const method = normalizeMethod(result?.method);
  const inputs = object(result?.inputs);
  if (method.includes("DCF")) {
    const flowType = String(inputs.cashFlowType || "").toUpperCase();
    const rateType = String(inputs.discountRateType || "").toUpperCase();
    if (!flowType || !rateType || !inputs.valuationDate || !inputs.terminalValueMethod) {
      add("NEEDS_REVIEW", "DCF_CONTRACT_METADATA_MISSING", `${path}.inputs`, "DCF must declare valuationDate, cashFlowType, discountRateType, and terminalValueMethod before it can be shown as complete.", "Add the explicit DCF contract fields; legacy DCF files remain importable for review.");
    }
    if (inputs.valuationDate && (!validDate(inputs.valuationDate) || inputs.valuationDate !== input.reportIdentity?.analysisDate)) {
      add("NEEDS_REVIEW", "DCF_VALUATION_DATE_MISMATCH", `${path}.inputs.valuationDate`, "DCF valuationDate must be a valid date matching the report analysis date.", "Rebase discount periods to the report date or prepare a separately dated analysis.");
    }
    if (inputs.discountPeriods?.includes(0) && !text(inputs.timeZeroReason)) {
      add("NEEDS_REVIEW", "DCF_TIME_ZERO_UNEXPLAINED", `${path}.inputs.discountPeriods`, "A time-zero cash flow needs an explicit bridge explanation, not an undiscounted forecast year.", "Provide inputs.timeZeroReason and explain why this amount occurs at the valuation date.");
    }
    const forecastWacc = number(input.forecast?.wacc?.value);
    const rate = number(inputs.discountRatePct);
    if (flowType === "FCFF" && rateType === "WACC" && finite(forecastWacc) && finite(rate) && Math.abs(rate - forecastWacc) > RATE_TOLERANCE_PCT) {
      add("BLOCKED", "DCF_WACC_MISMATCH", `${path}.inputs.discountRatePct`, `DCF discountRatePct ${rate}% does not match forecast WACC ${forecastWacc}%.`, "Use the same WACC or explain and encode a consistent rate.");
    }
    validateDcfForecastLink(input, result, path, add);
    if (inputs.terminalValueMethod === "EXIT_MULTIPLE") {
      const metricType = String(inputs.terminalMetricType || "").toUpperCase();
      const allowed = flowType === "FCFE" ? ["NET_INCOME", "FCFE"] : ["EBITDA", "EBIT", "FCFF", "REVENUE"];
      if (!allowed.includes(metricType)) add("NEEDS_REVIEW", "DCF_TERMINAL_METRIC_BASIS_UNVERIFIED", `${path}.inputs.terminalMetricType`, "The exit multiple must declare an enterprise or equity metric consistent with FCFF/FCFE.", "Set terminalMetricType to a compatible metric; an enterprise multiple cannot directly produce an FCFE equity terminal value.");
    }
  }
  if (isPe(method)) {
    const eps = firstNumber(inputs.normalizedForwardEps, inputs.forwardEps, inputs.eps);
    const provenance = result.inputProvenance?.normalizedForwardEps || result.inputProvenance?.forwardEps || result.inputProvenance?.eps;
    const records = (Array.isArray(input.forecast?.yearlyForecast) ? input.forecast.yearlyForecast : []).map((row) => ({ ...row.eps, period: row.period }));
    records.push(input.financialNormalization?.normalizedDilutedEps || {});
    const linked = records.some((record) => {
      const unit = parseUnit(record.unit);
      return finite(number(record.value)) && withinFairValue(record.value, eps)
        && unit?.kind === "perShare" && unit.currency === input.valuation?.current?.currency && unit.scale === 1
        && record.period === provenance?.period;
    });
    if (finite(eps) && !linked) {
      add("NEEDS_REVIEW", "PE_EPS_NOT_LINKED_TO_FORECAST", `${path}.inputs.normalizedForwardEps`, "P/E EPS does not reconcile to a forecast EPS or normalized EPS record.", "Link the EPS input to the forecast/normalization period or explain the exception.");
    }
  }
  if (method.includes("EV/EBITDA")) {
    const ebitda = firstNumber(inputs.normalizedEbitda, inputs.ebitda);
    if (finite(ebitda) && !forecastValues(input, "ebitda").some((value) => withinFairValue(value, ebitda))) {
      warn("EV_EBITDA_FORECAST_LINK_UNCLEAR", `${path}.inputs.normalizedEbitda`, "EV/EBITDA input does not directly match a forecast EBITDA row; confirm its period and whether it is current, forward, or normalized.");
    }
  }
}

function validateDcfForecastLink(input, result, path, add) {
  const inputs = result.inputs || {};
  const flows = inputs.forecastFreeCashFlows || [];
  const periods = inputs.forecastPeriods;
  const unit = parseUnit(result.inputProvenance?.forecastFreeCashFlows?.unit);
  const rows = Array.isArray(input.forecast?.yearlyForecast) ? input.forecast.yearlyForecast : [];
  const reconciliations = Array.isArray(inputs.cashFlowReconciliation) ? inputs.cashFlowReconciliation : [];
  const linked = Array.isArray(periods) && periods.length === flows.length && unit?.kind === "money"
    && periods.every((period, index) => {
      // A documented time-zero bridge is not a forecast year.
      if (inputs.discountPeriods?.[index] === 0) return text(inputs.timeZeroReason);
      const row = rows.find((item) => item.period === period);
      const rowUnit = parseUnit(row?.freeCashFlow?.unit);
      if (!rowUnit || rowUnit.kind !== "money" || rowUnit.currency !== unit.currency || !finite(number(row?.freeCashFlow?.value))) return false;
      const forecastFlow = row.freeCashFlow.value * rowUnit.scale / unit.scale;
      if (withinFairValue(forecastFlow, flows[index])) return true;
      const bridge = reconciliations.find((item) => item?.period === period);
      return text(bridge?.reason) && finite(bridge?.adjustment)
        && withinFairValue(forecastFlow + bridge.adjustment, flows[index]);
    });
  if (!linked) add("NEEDS_REVIEW", "DCF_FORECAST_LINK_UNVERIFIED", `${path}.inputs.forecastPeriods`, "DCF cash flows must reconcile to the forecast periods and units, or disclose a numeric adjustment bridge.", "Provide forecastPeriods matching yearlyForecast and cashFlowReconciliation entries {period, adjustment, reason} for any differences; adjustments use the DCF cash-flow unit.");
}

function validateMethodSelection(methodology, results, add) {
  if (!text(methodology.selectionReason)) add("NEEDS_REVIEW", "SELECTION_REASON_MISSING", "valuation.methodology.selectionReason", "A complete analysis requires a method-selection reason.", "Explain why the selected methods fit the company and sector.");
  if (!text(methodology.weightReasoning)) add("NEEDS_REVIEW", "WEIGHT_REASONING_MISSING", "valuation.methodology.weightReasoning", "A complete analysis requires weight reasoning.", "Explain the economic basis for every method weight.");
  const excluded = Array.isArray(methodology.excludedMethods) ? methodology.excludedMethods : [];
  if (!excluded.length || excluded.some((item) => !text(item?.method) || !text(item?.reason))) add("NEEDS_REVIEW", "EXCLUDED_METHODS_INCOMPLETE", "valuation.methodology.excludedMethods", "A complete analysis must identify excluded methods and explain each exclusion.", "Provide method and reason for excluded approaches.");
  for (const [index, result] of results.entries()) {
    if (!text(result?.rationale)) add("NEEDS_REVIEW", "METHOD_RATIONALE_MISSING", `valuation.valuationResults.${index}.rationale`, "Every weighted valuation method requires a rationale.", "Explain why the method is suitable for this company.");
    if (!result?.assumptions || typeof result.assumptions !== "object" || !Object.keys(result.assumptions).length) add("NEEDS_REVIEW", "METHOD_ASSUMPTIONS_MISSING", `valuation.valuationResults.${index}.assumptions`, "Every weighted valuation method requires explicit assumptions.", "List the material assumptions rather than leaving an empty object.");
  }
}

function validateWeights(valuation, add) {
  const results = Array.isArray(valuation.valuationResults) ? valuation.valuationResults : [];
  const weights = Array.isArray(valuation.methodology?.modelWeights) ? valuation.methodology.modelWeights : [];
  const active = results.filter((r) => r?.role !== "CROSS_CHECK");
  const valid = (items) => items.length > 0 && items.every((r) => text(r?.method) && finite(r?.weight) && r.weight > 0)
    && Math.abs(items.reduce((sum, r) => sum + r.weight, 0) - 100) <= 0.01
    && new Set(items.map((r) => normalizeMethod(r.method))).size === items.length;
  const matches = valid(active) && valid(weights) && active.length === weights.length
    && active.every((r) => weights.some((w) => normalizeMethod(w.method) === normalizeMethod(r.method) && Math.abs(w.weight - r.weight) <= 0.01))
    && results.filter((r) => r?.role === "CROSS_CHECK").every((r) => r.weight === 0 || r.weight === null || r.weight === undefined);
  if (!matches) add("BLOCKED", "METHOD_WEIGHTS_INVALID", "valuation.methodology.modelWeights", "Weighted results and modelWeights must agree, use unique methods with positive weights totaling 100%, and exclude zero-weight cross-checks from the weighted list.", "Correct both weight arrays; keep zero-weight methods as CROSS_CHECK results only.");
}

function validateSectorMethodFit(input, methodology, results, add) {
  const classification = [input.company?.sector, input.company?.industry, input.classification?.companyType]
    .filter(text)
    .join(" ")
    .toLowerCase();
  const rationale = [
    methodology?.selectionReason,
    ...results.map((result) => result?.rationale)
  ].filter(text).join(" ").toLowerCase();
  const methods = results.map((result) => normalizeMethod(result?.method));

  const isDepositoryOrInsurer = /bank|banking|insurance|insurer|مصرف|بنك|تأمين/.test(classification);
  const usesEnterpriseMethod = results.some((result) => {
    const method = normalizeMethod(result?.method);
    return method.includes("EV/EBIT") || (method.includes("DCF") && String(result?.inputs?.cashFlowType || "").toUpperCase() === "FCFF");
  });
  const documentsFinancialSectorException = /exception|non[- ]?bank|holding company|subsidiar|corporate center|استثناء|غير مصرف|غير بنكي|شركة قابضة|نشاط غير/.test(rationale);
  if (isDepositoryOrInsurer && usesEnterpriseMethod && !documentsFinancialSectorException) {
    add("NEEDS_REVIEW", "SECTOR_METHOD_EXCEPTION_UNEXPLAINED", "valuation.methodology.selectionReason", "Enterprise-value methods are unusual for banks and insurers because debt and cash are operating inputs; an explicit company-specific exception is required.", "Use an equity method such as P/B, dividend/FCFE, or document why the selected enterprise method is economically valid here.", { sector: input.company?.sector || null, methods });
  }

  const isReit = /\breit\b|real estate investment trust|صندوق استثمار عقاري/.test(classification);
  const usesPe = methods.some(isPe);
  if (isReit && usesPe && !/\baffo\b|\bffo\b|funds from operations|التدفقات من العمليات/.test(rationale)) {
    add("NEEDS_REVIEW", "REIT_PE_NORMALIZATION_UNEXPLAINED", "valuation.methodology.selectionReason", "P/E for a REIT requires an explicit FFO/AFFO reconciliation because depreciation can make accounting EPS economically misleading.", "Use P/FFO or P/AFFO, or document the EPS-to-FFO/AFFO reconciliation and why P/E remains suitable.");
  }
}

function validateForecastRelationships(input, add) {
  for (const [index, row] of (Array.isArray(input.forecast?.yearlyForecast) ? input.forecast.yearlyForecast : []).entries()) {
    validateMargin(row, index, "ebitda", "ebitdaMarginPct", add);
    validateMargin(row, index, "freeCashFlow", "fcfMarginPct", add);
  }
}

function validateForecastProvenance(input, add) {
  const sourceIds = new Set((Array.isArray(input.sources) ? input.sources : []).map((source) => source?.id).filter(text));
  const incomplete = [];
  const missingSources = [];
  for (const [rowIndex, row] of (Array.isArray(input.forecast?.yearlyForecast) ? input.forecast.yearlyForecast : []).entries()) {
    for (const [metric, record] of Object.entries(object(row))) {
      if (metric === "period" || !finite(number(record?.value))) continue;
      const basis = String(record?.basis || "").toLowerCase();
      const analystAssumption = basis === "analyst_assumption";
      if (!text(row?.period) || !text(record?.unit) || !validDate(record?.asOf) || !text(record?.basis) || (!analystAssumption && !text(record?.sourceId))) {
        incomplete.push(`forecast.yearlyForecast.${rowIndex}.${metric}`);
      }
      if (text(record?.sourceId) && !sourceIds.has(record.sourceId)) missingSources.push(`forecast.yearlyForecast.${rowIndex}.${metric}.sourceId`);
      if (validDate(record?.asOf) && validDate(input.reportIdentity?.analysisDate) && record.asOf.slice(0, 10) > input.reportIdentity.analysisDate.slice(0, 10)) {
        add("BLOCKED", "PROVENANCE_LOOKAHEAD", `forecast.yearlyForecast.${rowIndex}.${metric}.asOf`, "Forecast provenance is dated after the report analysis date.", "Use the information available on the analysis date or re-date the report.");
      }
    }
  }
  if (incomplete.length) {
    add("NEEDS_REVIEW", "FORECAST_PROVENANCE_INCOMPLETE", "forecast.yearlyForecast", `${incomplete.length} material forecast metrics lack basis, as-of date, unit, period, or a required source link.`, "Complete provenance for each numeric forecast metric; label unsourced analyst estimates as analyst_assumption.", { missingMetrics: incomplete });
  }
  if (missingSources.length) {
    add("INSUFFICIENT_DATA", "FORECAST_SOURCE_NOT_FOUND", "forecast.yearlyForecast", "One or more forecast sourceId values do not resolve to sources[].", "Add the referenced source records or correct the source identifiers.", { missingSourceFields: missingSources });
  }
}

function validateMargin(row, index, metric, marginMetric, add) {
  const revenue = number(row?.revenue?.value);
  const amount = number(row?.[metric]?.value);
  const margin = number(row?.[marginMetric]?.value);
  if (![revenue, amount, margin].every(finite) || revenue === 0) return;
  const revenueUnit = parseUnit(row?.revenue?.unit);
  const amountUnit = parseUnit(row?.[metric]?.unit);
  if (revenueUnit && amountUnit && (revenueUnit.kind !== "money" || amountUnit.kind !== "money" || revenueUnit.currency !== amountUnit.currency)) {
    add("BLOCKED", "FORECAST_UNIT_MISMATCH", `forecast.yearlyForecast.${index}.${metric}.unit`, "Revenue and forecast amount must be comparable monetary units in the same currency.", "Convert the forecast amounts to one currency before calculating margins.");
    return;
  }
  if (!revenueUnit || !amountUnit) {
    add("NEEDS_REVIEW", "FORECAST_UNITS_UNVERIFIED", `forecast.yearlyForecast.${index}.${metric}.unit`, "Franklin cannot reconcile forecast margins without recognized currency and scale metadata.", "Use explicit units such as USD, USD million, or USD billion.");
    return;
  }
  const expected = (amount * amountUnit.scale) / (revenue * revenueUnit.scale) * 100;
  if (Math.abs(expected - margin) > MARGIN_TOLERANCE_PCT) {
    add("BLOCKED", "FORECAST_MARGIN_MISMATCH", `forecast.yearlyForecast.${index}.${marginMetric}.value`, `${marginMetric} is ${margin}% but revenue and ${metric} imply ${expected.toFixed(2)}%.`, "Correct the forecast amount or margin.");
  }
}

function validateFinancialNormalizationCoverage(input, results, add) {
  const normalization = object(input.financialNormalization);
  const finiteCount = Object.values(normalization).filter((item) => item && typeof item === "object" && finite(number(item.value))).length;
  const methodsNeedNormalization = results.some((result) => /P\/E|EV\/EBIT|P\/FCF|DCF/.test(normalizeMethod(result?.method)));
  if (methodsNeedNormalization && finiteCount === 0) {
    add("INSUFFICIENT_DATA", "FINANCIAL_NORMALIZATION_MISSING", "financialNormalization", "The selected valuation methods require normalized financial data, but no normalized numeric metrics are available.", "Provide the applicable normalized earnings, cash flow, balance-sheet, and share-count data with provenance.");
  }
  if (finiteCount > 0 && results.some((r) => isPe(normalizeMethod(r.method))) && !finite(number(normalization.normalizedDilutedEps?.value))) {
    add("INSUFFICIENT_DATA", "NORMALIZATION_METHOD_COVERAGE_MISSING", "financialNormalization.normalizedDilutedEps", "P/E requires an explicit normalized EPS record; an unrelated numeric normalization field does not satisfy earnings normalization.", "Provide normalizedDilutedEps with its accounting basis and provenance, even when it matches reported EPS.");
  }
}

function validateInputProvenance(input, results, add) {
  const sourceIds = new Set((Array.isArray(input.sources) ? input.sources : []).map((source) => source?.id).filter(text));
  const materialInputs = results.flatMap((result) => Object.entries(object(result?.inputs))
    .filter(([, value]) => finite(value) || (Array.isArray(value) && value.some(finite)))
    .map(([key]) => ({ method: result?.method || "method", key, provenance: result?.inputProvenance?.[key] })));
  if (!materialInputs.length) return;
  const incomplete = materialInputs.filter((item) => !provenanceComplete(item.provenance));
  if (incomplete.length) {
    add("NEEDS_REVIEW", "MATERIAL_INPUT_PROVENANCE_INCOMPLETE", "valuation.valuationResults.inputProvenance", `${incomplete.length} of ${materialInputs.length} material valuation inputs lack source/assumption type, date, unit, or financial period.`, "Add inputProvenance for every material input. Analyst assumptions must be labeled ANALYST_ASSUMPTION and explained.", { missingInputs: incomplete.map((item) => `${item.method}.${item.key}`) });
  }
  const unresolved = materialInputs.filter((item) => text(item.provenance?.sourceId) && !sourceIds.has(item.provenance.sourceId));
  if (unresolved.length) {
    add("INSUFFICIENT_DATA", "VALUATION_INPUT_SOURCE_NOT_FOUND", "valuation.valuationResults.inputProvenance", `${unresolved.length} material valuation inputs reference sourceId values that do not exist in sources[].`, "Add the referenced source records or correct the input provenance identifiers.", { missingInputs: unresolved.map((item) => `${item.method}.${item.key}`) });
  }
  const analysisDate = input.reportIdentity?.analysisDate;
  const lookahead = materialInputs.filter((item) => validDate(item.provenance?.asOf) && validDate(analysisDate) && item.provenance.asOf.slice(0, 10) > analysisDate.slice(0, 10));
  if (lookahead.length) add("BLOCKED", "PROVENANCE_LOOKAHEAD", "valuation.valuationResults.inputProvenance", "Material inputs use information dated after the report analysis date.", "Re-date the report or use only information available at its analysis date.");
}

function validateCalculationAudit(valuation, recalculatedWeighted, base, add) {
  const audit = valuation.calculationAudit;
  if (!audit || typeof audit !== "object" || Array.isArray(audit) || !Object.keys(audit).length) {
    add("NEEDS_REVIEW", "CALCULATION_AUDIT_REQUIRED", "valuation.calculationAudit", "calculationAudit is mandatory before an analysis can be displayed as complete.", "Provide the weighted value, overlay, reconciliation, and gap fields.");
    return;
  }
  const suppliedWeighted = number(audit.weightedMethodFairValue);
  const overlay = number(audit.analystOverlayPct);
  const reconciled = number(audit.reconciledBaseFairValue);
  const gap = number(audit.gapToReportedBasePct);
  if (![suppliedWeighted, overlay, reconciled, gap].every(finite)) {
    add("NEEDS_REVIEW", "CALCULATION_AUDIT_INCOMPLETE", "valuation.calculationAudit", "calculationAudit contains missing numeric fields.", "Complete weightedMethodFairValue, analystOverlayPct, reconciledBaseFairValue, and gapToReportedBasePct.");
    return;
  }
  if (finite(recalculatedWeighted) && !withinFairValue(suppliedWeighted, recalculatedWeighted)) add("BLOCKED", "AUDIT_WEIGHTED_VALUE_MISMATCH", "valuation.calculationAudit.weightedMethodFairValue", "calculationAudit does not match Franklin's recalculated weighted value.", "Use Franklin's recomputed method outputs.");
  const expectedReconciled = suppliedWeighted * (1 + overlay / 100);
  if (Math.abs(overlay) > 0.01) add("BLOCKED", "ANALYST_OVERLAY_NOT_ALLOWED", "valuation.calculationAudit.analystOverlayPct", "A complete Franklin analysis requires Base to equal the recalculated weighted method value; a detached analyst overlay is not permitted.", "Set analystOverlayPct to 0 and express judgment through explicit method inputs, weights, scenarios, and rationale.");
  if (!withinFairValue(expectedReconciled, reconciled) || !withinFairValue(reconciled, base)) add("BLOCKED", "AUDIT_BASE_RECONCILIATION_MISMATCH", "valuation.calculationAudit.reconciledBaseFairValue", "The audit overlay and reconciliation do not reproduce Base fair value.", "Correct the overlay and reconciled Base.");
  const expectedGap = base === 0 ? null : ((reconciled / base) - 1) * 100;
  if (finite(expectedGap) && Math.abs(expectedGap - gap) > RATE_TOLERANCE_PCT) add("BLOCKED", "AUDIT_GAP_MISMATCH", "valuation.calculationAudit.gapToReportedBasePct", "calculationAudit gapToReportedBasePct is inconsistent.", "Recalculate the gap from reconciled Base and reported Base.");
}

function validateDecisionConsistency(input, add) {
  const price = number(input.marketPrice?.value);
  const base = number(input.valuation?.current?.base);
  const action = String(input.decision?.action || "").toUpperCase();
  if (![price, base].every(finite) || price <= 0) return;
  const upsidePct = (base / price - 1) * 100;
  const rationale = flattenText(input.decision?.rationale);
  const exceptional = text(input.decision?.exceptionalReason);
  if (["BUY", "ADD"].includes(action) && upsidePct <= 0 && !exceptional) add("BLOCKED", "BUY_WITHOUT_UPSIDE", "decision.action", `${action} conflicts with ${upsidePct.toFixed(1)}% upside to Base and no documented exception.`, "Use a conservative action or document an explicit, reviewable exception.");
  if (["SELL", "REDUCE"].includes(action) && upsidePct >= 0 && !exceptional) add("BLOCKED", "SELL_WITH_POSITIVE_UPSIDE", "decision.action", `${action} conflicts with ${upsidePct.toFixed(1)}% upside to Base and no documented exception.`, "Reconcile the action with fair value or document an explicit exception.");
  if (exceptional && ((["BUY", "ADD"].includes(action) && upsidePct <= 0) || (["SELL", "REDUCE"].includes(action) && upsidePct >= 0))) add("NEEDS_REVIEW", "DECISION_EXCEPTION_REQUIRES_REVIEW", "decision.exceptionalReason", "A documented decision exception requires human review; its presence cannot automatically verify an action that conflicts with Base upside.", "Review the exception and its evidence before acting on the recommendation.");
  const saysBelow = /price.{0,40}(below|under).{0,40}(fair|base)|market.{0,40}(below|under).{0,40}(fair|base)|السعر.{0,35}(أقل|ادنى|أدنى).{0,35}(القيمة|base)|سعر السوق.{0,35}(أقل|دون).{0,35}(القيمة|base)/iu.test(rationale);
  const saysAbove = /price.{0,40}(above|over).{0,40}(fair|base)|market.{0,40}(above|over).{0,40}(fair|base)|السعر.{0,35}(أعلى|فوق).{0,35}(القيمة|base)|سعر السوق.{0,35}(أعلى|فوق).{0,35}(القيمة|base)/iu.test(rationale);
  if (saysBelow && price >= base) add("BLOCKED", "DECISION_TEXT_NUMERIC_CONTRADICTION", "decision.rationale", "Decision rationale says market price is below fair value while the numbers show otherwise.", "Correct the narrative or the underlying numbers.");
  if (saysAbove && price <= base) add("BLOCKED", "DECISION_TEXT_NUMERIC_CONTRADICTION", "decision.rationale", "Decision rationale says market price is above fair value while the numbers show otherwise.", "Correct the narrative or the underlying numbers.");
}

function sourceVerificationSummary(input, results) {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const sourceIds = new Set(sources.map((source) => source?.id).filter(text));
  const valuationMaterial = results.flatMap((result) => Object.entries(object(result?.inputs))
    .filter(([, value]) => finite(value) || (Array.isArray(value) && value.some(finite)))
    .map(([key]) => result?.inputProvenance?.[key]));
  const forecastMaterial = (Array.isArray(input.forecast?.yearlyForecast) ? input.forecast.yearlyForecast : [])
    .flatMap((row) => Object.entries(object(row))
      .filter(([key, record]) => key !== "period" && finite(number(record?.value)))
      .map(([, record]) => ({
        sourceId: record?.sourceId,
        type: String(record?.basis || "").toLowerCase() === "analyst_assumption" ? "ANALYST_ASSUMPTION" : null,
        asOf: record?.asOf,
        unit: record?.unit,
        period: row?.period
      })));
  const material = [...valuationMaterial, ...forecastMaterial];
  const linked = material.filter((item) => provenanceComplete(item) && (!text(item.sourceId) || sourceIds.has(item.sourceId))).length;
  return {
    presence: { status: sources.length ? "VERIFIED" : "MISSING", sourceCount: sources.length },
    linkage: { status: material.length && linked === material.length ? "VERIFIED" : "INCOMPLETE", linkedInputs: linked, materialInputs: material.length, coveragePct: material.length ? linked / material.length * 100 : 0 },
    externalVerification: { status: "NOT_PERFORMED", statement: "Franklin validated source presence and declared linkage only; it did not externally confirm that each source contains the claimed number." }
  };
}

function toIntegrityPayload(input) {
  return {
    companyId: input.reportIdentity?.ticker,
    analysisDate: input.reportIdentity?.analysisDate,
    marketPrice: input.marketPrice?.value,
    fairValue: input.valuation?.current?.base,
    recommendation: { action: input.decision?.action, exceptionalReason: input.decision?.exceptionalReason },
    scenarios: {
      bear: number(input.valuation?.current?.bear),
      base: number(input.valuation?.current?.base),
      bull: number(input.valuation?.current?.bull)
    },
    claims: [],
    sources: (Array.isArray(input.sources) ? input.sources : []).map((source) => ({ ...source, companyId: input.reportIdentity?.ticker, facts: [] }))
  };
}

function provenanceComplete(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = String(value.type || "").toUpperCase();
  const sourceOrAssumption = text(value.sourceId) || type === "ANALYST_ASSUMPTION";
  return Boolean(sourceOrAssumption && validDate(value.asOf) && text(value.unit) && text(value.period));
}

function forecastValues(input, metric) {
  return (Array.isArray(input.forecast?.yearlyForecast) ? input.forecast.yearlyForecast : [])
    .map((row) => number(row?.[metric]?.value))
    .filter(finite);
}

function isPe(method) {
  return method.includes("P/E") || /\bPE\b/.test(method);
}

function normalizeMethod(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNumber(...values) {
  return values.map(number).find(finite) ?? null;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value ?? "");
}

function withinFairValue(expected, actual) {
  if (![expected, actual].every(finite)) return false;
  return Math.abs(expected - actual) <= Math.max(FAIR_VALUE_ABSOLUTE_TOLERANCE, Math.max(Math.abs(expected), Math.abs(actual)) * FAIR_VALUE_RELATIVE_TOLERANCE);
}

function calculated(value) {
  if (!finite(value)) return blocked("NON_FINITE_VALUATION_RESULT", "Valuation arithmetic overflowed or produced a non-finite result.", "Correct the scale and inputs; non-finite values cannot be verified.");
  return { state: "CALCULATED", value, reason: null };
}

function validDate(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const day = value.slice(0, 10);
  const parsedDay = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsedDay.getTime()) && parsedDay.toISOString().slice(0, 10) === day && Number.isFinite(Date.parse(value));
}

function parseUnit(value) {
  const unit = String(value || "").trim().toUpperCase().replace(/_/g, " ");
  if (/^(%|PERCENT|PCT)$/.test(unit)) return { kind: "percent", scale: 1 };
  if (/^(X|MULTIPLE|TIMES|YEARS|YEAR)$/.test(unit)) return { kind: "ratio", scale: 1 };
  const currency = unit.match(/\b(USD|SAR|EUR|GBP|JPY|CNY|HKD|CAD|AUD|CHF|KRW)\b/)?.[1]
    || unit.match(/^(USD|SAR|EUR|GBP|JPY|CNY|HKD|CAD|AUD|CHF|KRW)[MBK]$/)?.[1];
  const scale = /BILLION|مليار|BN\b|^[A-Z]{3}B$/.test(unit) ? 1e9
    : /MILLION|مليون|MN\b|^[A-Z]{3}M$/.test(unit) ? 1e6
      : /THOUSAND|ألف|^[A-Z]{3}K$/.test(unit) ? 1e3 : 1;
  const shares = /SHARES?|سهم|أسهم/.test(unit);
  if (currency) return { kind: shares ? "perShare" : "money", currency, scale };
  if (shares) return { kind: "shares", scale };
  return null;
}

function validateInputUnits(input, results, add) {
  for (const [index, result] of results.entries()) {
    const method = normalizeMethod(result.method);
    const money = [];
    let shareScale = null;
    for (const [key, value] of Object.entries(object(result.inputs))) {
      if (!finite(value) && !(Array.isArray(value) && value.some(finite))) continue;
      const unit = parseUnit(result.inputProvenance?.[key]?.unit);
      if (!unit) {
        add("NEEDS_REVIEW", "VALUATION_INPUT_UNIT_UNVERIFIED", `valuation.valuationResults.${index}.inputProvenance.${key}.unit`, "A material input has missing or unrecognized dimensional units.", "Provide explicit currency, scale, per-share, share-count, percentage, or multiple units.");
        continue;
      }
      const expected = key === "dilutedShares" ? "shares"
        : /eps|pershare/i.test(key) ? "perShare"
          : /pct$/i.test(key) ? "percent"
            : /multiple|discountPeriods|terminalDiscountPeriod/i.test(key) ? "ratio" : "money";
      if (unit.kind !== expected || (unit.currency && unit.currency !== input.valuation?.current?.currency)
        || (expected === "perShare" && unit.scale !== 1)) {
        add("BLOCKED", "VALUATION_INPUT_UNIT_MISMATCH", `valuation.valuationResults.${index}.inputProvenance.${key}.unit`, `${key} has incompatible units or currency for the valuation.`, "Convert inputs explicitly to the valuation currency and correct dimensional units.");
      }
      if (expected === "money" && unit.kind === "money") money.push(unit.scale);
      if (key === "dilutedShares" && unit.kind === "shares") shareScale = unit.scale;
    }
    if (money.length && (money.some((scale) => scale !== money[0]) || (shareScale !== null && money[0] !== shareScale))) {
      add("BLOCKED", "VALUATION_SCALE_MISMATCH", `valuation.valuationResults.${index}.inputs`, "Raw valuation formulas require all total amounts and diluted shares to use the same scale (for example, USD million and million shares).", "Normalize currency amounts and share counts to compatible scales before valuation.");
    }
    // Legacy net debt/share inputs in calculation must not bypass provenance checks.
    for (const key of ["netDebt", "dilutedShares"]) {
      if (method.includes("EV/EBITDA") && !finite(result.inputs?.[key]) && finite(result.calculation?.[key])) {
        add("NEEDS_REVIEW", "LEGACY_CALCULATION_INPUT_UNVERIFIED", `valuation.valuationResults.${index}.calculation.${key}`, "A material input exists only in the legacy calculation object and lacks canonical input provenance.", "Move the value into inputs and provide inputProvenance.");
      }
    }
  }
}

function insufficient(reason) {
  return { state: "INSUFFICIENT_DATA", value: null, reason };
}

function blocked(code, reason, action) {
  return { state: "BLOCKED", value: null, code, reason, action };
}

function display(value) {
  return finite(value) ? Number(value.toFixed(4)) : "unavailable";
}
