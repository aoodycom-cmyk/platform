import { CANONICAL_METHODOLOGY_VERSION, SUPPORTED_MODELS } from "./engine.js";
import { toNumber } from "../domain/financialMetrics.js";

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
    const externalWeight = models
      .filter((model) => model.role === "external_reference")
      .reduce((sum, model) => sum + (toNumber(model.weight) || 0), 0);
    if (externalWeight > 0.250001) errors.push("External references must not exceed 25% combined weight.");
    for (const model of models) {
      if (!SUPPORTED_MODELS.includes(model.method)) errors.push(`Unsupported selected model: ${model.method}.`);
      if (!Number.isFinite(toNumber(model.fairValue ?? model.value))) errors.push(`Selected model is missing fairValue: ${model.method}.`);
      if ((toNumber(model.weight) || 0) > 0.450001 && !model.overrideReason) errors.push(`Model weight exceeds 45% without override: ${model.method}.`);
      if (!model.source) errors.push(`Selected model is missing source: ${model.method}.`);
      if (!model.assumptions || typeof model.assumptions !== "object") errors.push(`Selected model is missing assumptions: ${model.method}.`);
    }
  }

  const forecast = payload.forecastAssumptions?.yearlyForecast || [];
  if (!Array.isArray(forecast) || forecast.length !== 5) {
    errors.push("forecastAssumptions.yearlyForecast must contain exactly five yearly rows.");
  } else {
    for (const row of forecast) {
      for (const key of ["year", "revenue", "revenueGrowth", "operatingMargin", "taxRate", "daToRevenue", "capexToRevenue", "workingCapitalToRevenueGrowth", "dilution", "freeCashFlow"]) {
        if (!Number.isFinite(toNumber(row[key]))) errors.push(`Forecast year ${row.year || "?"} is missing ${key}.`);
      }
      if (!row.source) errors.push(`Forecast year ${row.year || "?"} is missing source.`);
      if (!Number.isFinite(toNumber(row.confidence))) errors.push(`Forecast year ${row.year || "?"} is missing confidence.`);
    }
  }

  const checklist = payload.monitoringChecklist || [];
  if (!Array.isArray(checklist) || checklist.length < 5 || checklist.length > 8) errors.push("monitoringChecklist must contain 5-8 company-specific items.");
}
