import { CANONICAL_METHODOLOGY_VERSION, SUPPORTED_MODELS } from "./engine.js";
import { toNumber, weightedAverage } from "../domain/financialMetrics.js";

export const ANALYST_BRAIN_REQUIRED_KEYS = [
  "methodologyVersion",
  "company",
  "executiveDecision",
  "classification",
  "businessQuality",
  "modelSelection",
  "forecastAssumptions",
  "valuationResults",
  "scenarios",
  "catalysts",
  "risks",
  "whatChangesMyMind",
  "finalDecision",
  "finalInvestmentDecision",
  "monitoringChecklist",
  "dashboardExport"
];

export function validateAnalystBrainOutput(payload, schema = null) {
  const required = Array.isArray(schema?.required) ? schema.required : ANALYST_BRAIN_REQUIRED_KEYS;
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Investment Analyst Brain output must be an object."] };
  }
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null) errors.push(`Missing required key: ${key}`);
  }
  if (payload.methodologyVersion !== CANONICAL_METHODOLOGY_VERSION) errors.push("methodologyVersion must match the canonical Analyst Brain contract.");
  if (payload.language && !["ar", "en"].includes(payload.language)) errors.push("language must be ar or en.");
  if (payload.valuationResults && !Array.isArray(payload.valuationResults)) errors.push("valuationResults must be an array.");
  if (payload.catalysts && !Array.isArray(payload.catalysts)) errors.push("catalysts must be an array.");
  if (payload.risks && !Array.isArray(payload.risks)) errors.push("risks must be an array.");
  if (payload.monitoringChecklist && !Array.isArray(payload.monitoringChecklist)) errors.push("monitoringChecklist must be an array.");
  if (payload.scenarios && typeof payload.scenarios !== "object") errors.push("scenarios must be an object.");
  if (payload.dashboardExport && typeof payload.dashboardExport !== "object") errors.push("dashboardExport must be an object.");
  validateNestedPayload(payload, errors);
  return { valid: errors.length === 0, errors };
}

function validateNestedPayload(payload, errors) {
  const recommendation = payload.finalDecision?.decision || payload.executiveDecision?.recommendation;
  if (!["BUY", "HOLD", "SELL", "INSUFFICIENT_DATA"].includes(recommendation)) errors.push("finalDecision.decision must be BUY, HOLD, SELL, or INSUFFICIENT_DATA.");

  const scenarios = payload.scenarios || {};
  const probabilityTotal = ["Conservative", "Base", "Optimistic"].reduce((sum, key) => sum + (toNumber(scenarios[key]?.probability) || 0), 0);
  if (Math.abs(probabilityTotal - 1) > 0.0001) errors.push("Conservative + Base + Optimistic probabilities must equal 100%.");
  if (scenarios.Exceptional?.included === false && Number.isFinite(toNumber(scenarios.Exceptional.fairValue))) {
    errors.push("Exceptional fairValue must be empty unless the case is explicitly included and quantitatively supported.");
  }

  const models = payload.modelSelection?.selectedModels || [];
  if (!Array.isArray(models)) {
    errors.push("modelSelection.selectedModels must be an array.");
  } else {
    if (payload.modelSelection?.modelPolicyStatus === "NO_SUPPORTED_MODEL" && models.length) {
      errors.push("NO_SUPPORTED_MODEL status cannot include selected models.");
    }
    const externalWeight = models
      .filter((model) => model.role === "external_reference")
      .reduce((sum, model) => sum + (toNumber(model.weight) || 0), 0);
    if (externalWeight > 0.250001) errors.push("External references must not exceed 25% combined weight.");
    const totalWeight = models.reduce((sum, model) => sum + (toNumber(model.weight) || 0), 0);
    if (totalWeight > 1.0001) errors.push("Selected model weights must not exceed 100%.");
    for (const model of models) {
      if (!SUPPORTED_MODELS.includes(model.method)) errors.push(`Unsupported selected model: ${model.method}.`);
      if (!Number.isFinite(toNumber(model.fairValue ?? model.value))) errors.push(`Selected model is missing fairValue: ${model.method}.`);
      if ((toNumber(model.weight) || 0) > 0.450001 && !model.overrideReason) errors.push(`Model weight exceeds 45% without override: ${model.method}.`);
      if (!model.source) errors.push(`Selected model is missing source: ${model.method}.`);
      if (!model.assumptions || typeof model.assumptions !== "object") errors.push(`Selected model is missing assumptions: ${model.method}.`);
      const audited = auditModelFairValue(model);
      if (Number.isFinite(audited) && Math.abs(audited - toNumber(model.fairValue ?? model.value)) > Math.max(0.01, Math.abs(audited) * 0.000001)) {
        errors.push(`Selected model fair value is inconsistent with its assumptions: ${model.method}.`);
      }
      if (["DCF", "Price/FCF"].includes(model.method) && !positive(model.assumptions?.currentFreeCashFlow ?? model.assumptions?.freeCashFlow)) {
        errors.push(`${model.method} requires positive current Free Cash Flow.`);
      }
    }
    const weightedFairValue = weightedAverage(models.map((model) => ({
      value: model.fairValue ?? model.value,
      weight: model.weight * model.confidence
    })));
    if (models.length && Number.isFinite(weightedFairValue) && Math.abs(weightedFairValue - toNumber(payload.modelSelection?.fairValue)) > 0.01) {
      errors.push("modelSelection.fairValue must match the selected model weighted fair value.");
    }
  }

  const forecast = payload.forecastAssumptions?.yearlyForecast || [];
  const yearlyAssumptions = payload.forecastAssumptions?.yearlyAssumptions || [];
  if (!Array.isArray(yearlyAssumptions) || yearlyAssumptions.length !== 5) errors.push("forecastAssumptions.yearlyAssumptions must contain five independently stored assumption rows.");
  if (!Array.isArray(forecast) || forecast.length !== 5) {
    errors.push("forecastAssumptions.yearlyForecast must contain exactly five yearly rows.");
  } else {
    for (const row of forecast) {
      for (const key of ["year", "revenue", "revenueGrowth", "operatingMargin", "taxRate", "daToRevenue", "capexToRevenue", "workingCapitalToRevenueGrowth", "dilution", "freeCashFlow"]) {
        if (!Number.isFinite(toNumber(row[key]))) errors.push(`Forecast year ${row.year || "?"} is missing ${key}.`);
      }
      if (!row.source) errors.push(`Forecast year ${row.year || "?"} is missing source.`);
      if (!row.assumptionSources || typeof row.assumptionSources !== "object") errors.push(`Forecast year ${row.year || "?"} is missing assumption sources.`);
      if (!Number.isFinite(toNumber(row.confidence))) errors.push(`Forecast year ${row.year || "?"} is missing confidence.`);
    }
  }

  const wacc = payload.forecastAssumptions?.wacc;
  if (Array.isArray(wacc?.guardrail) && wacc.guardrail.length === 2) {
    const [low, high] = wacc.guardrail.map(toNumber);
    const finalWacc = toNumber(wacc.finalWacc);
    if (Number.isFinite(low) && Number.isFinite(high) && (finalWacc < low - 0.000001 || finalWacc > high + 0.000001)) errors.push("WACC must remain inside methodology guardrails.");
  } else {
    errors.push("WACC guardrail is required.");
  }

  const scenarioValues = ["Conservative", "Base", "Optimistic"].map((key) => toNumber(scenarios[key]?.fairValue));
  if (scenarioValues.every(Number.isFinite) && !(scenarioValues[0] <= scenarioValues[1] && scenarioValues[1] <= scenarioValues[2])) {
    errors.push("Scenario fair values must be ordered Conservative <= Base <= Optimistic.");
  }
  if (payload.company?.currency && payload.companyAndValuationDate?.currency && payload.company.currency !== payload.companyAndValuationDate.currency) {
    errors.push("Company currency and valuation currency must match.");
  }
  const criticalConflicts = payload.dataQuality?.conflictingData || [];
  if (criticalConflicts.some((item) => /UNIT|CURRENCY|PROBABILITY|ORDERING|MODEL/i.test(item.code || ""))) {
    errors.push("Critical data conflicts must be resolved before validation.");
  }

  const checklist = payload.monitoringChecklist || [];
  if (!Array.isArray(checklist) || checklist.length < 5 || checklist.length > 8) errors.push("monitoringChecklist must contain 5-8 company-specific items.");
}

function auditModelFairValue(model) {
  const a = model.assumptions || {};
  if (model.method === "DCF") return dcfFairValuePerShare({
    forecast: a.forecast,
    terminalGrowth: toNumber(a.terminalGrowth),
    wacc: toNumber(a.wacc),
    cash: toNumber(a.cash) || 0,
    debt: toNumber(a.debt) || 0,
    shares: toNumber(a.shares)
  });
  if (model.method === "P/E") return toNumber(a.eps) * toNumber(a.multiple);
  if (model.method === "PEG") return toNumber(a.eps) * toNumber(a.growthPercent) * toNumber(a.peg);
  if (model.method === "EV/EBITDA") return equityValueFromEv(toNumber(a.ebitda) * toNumber(a.multiple), a);
  if (model.method === "EV/Sales") return equityValueFromEv(toNumber(a.revenue) * toNumber(a.multiple), a);
  if (model.method === "Forward EV/Sales") return equityValueFromEv(toNumber(a.forwardRevenue) * toNumber(a.multiple), a);
  if (model.method === "Price/FCF") return toNumber(a.freeCashFlow) * toNumber(a.multiple) / toNumber(a.shares);
  if (model.method === "Morningstar Fair Value" || model.method === "Analyst Consensus") return toNumber(model.fairValue ?? model.value);
  return null;
}

function dcfFairValuePerShare({ forecast, terminalGrowth, wacc, cash, debt, shares }) {
  if (!Array.isArray(forecast) || !forecast.length || !positive(shares)) return null;
  let pv = 0;
  for (const row of forecast) {
    pv += toNumber(row.freeCashFlow) / Math.pow(1 + wacc, toNumber(row.year));
  }
  const terminalFcf = toNumber(forecast[forecast.length - 1].freeCashFlow) * (1 + terminalGrowth);
  const terminalValue = terminalFcf / Math.max(wacc - terminalGrowth, 0.01);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, forecast.length);
  return (pv + pvTerminal + (cash || 0) - (debt || 0)) / shares;
}

function equityValueFromEv(enterpriseValue, assumptions) {
  if (!positive(enterpriseValue) || !positive(assumptions.shares)) return null;
  return (enterpriseValue + (toNumber(assumptions.cash) || 0) - (toNumber(assumptions.debt) || 0)) / toNumber(assumptions.shares);
}

function positive(value) {
  return Number.isFinite(toNumber(value)) && toNumber(value) > 0;
}
