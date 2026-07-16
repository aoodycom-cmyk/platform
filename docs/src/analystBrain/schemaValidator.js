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
  if (payload.language && !["ar", "en"].includes(payload.language)) errors.push("language must be ar or en.");
  if (payload.valuationResults && !Array.isArray(payload.valuationResults)) errors.push("valuationResults must be an array.");
  if (payload.catalysts && !Array.isArray(payload.catalysts)) errors.push("catalysts must be an array.");
  if (payload.risks && !Array.isArray(payload.risks)) errors.push("risks must be an array.");
  if (payload.monitoringChecklist && !Array.isArray(payload.monitoringChecklist)) errors.push("monitoringChecklist must be an array.");
  if (payload.scenarios && typeof payload.scenarios !== "object") errors.push("scenarios must be an object.");
  if (payload.dashboardExport && typeof payload.dashboardExport !== "object") errors.push("dashboardExport must be an object.");
  return { valid: errors.length === 0, errors };
}
