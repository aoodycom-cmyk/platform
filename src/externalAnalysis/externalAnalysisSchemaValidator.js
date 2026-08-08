export function validateExternalAnalysisReport(report = {}) {
  const errors = [];
  const warnings = [];

  if (!isValidTicker(report.company?.ticker)) errors.push(fieldError("company.ticker", "Ticker is required and must be a valid market symbol."));
  if (!isValidDate(report.analysisDate)) errors.push(fieldError("analysisDate", "Analysis date is required and must be valid."));
  if (!isPositiveNumber(report.market?.priceAtAnalysis)) errors.push(fieldError("market.priceAtAnalysis", "Price at analysis is required and must be greater than zero."));

  for (const key of ["quality", "growth", "valuation", "risk", "overall", "moat", "management"]) {
    if (report.scores?.[key] !== null && report.scores?.[key] !== undefined && !isScore(report.scores?.[key])) {
      errors.push(fieldError(`scores.${key}`, `${key} score must be between 0 and 10 when present.`));
    }
  }

  for (const key of ["bear", "base", "bull"]) {
    if (!isPositiveNumber(report.fairValue?.[key])) errors.push(fieldError(`fairValue.${key}`, `${key} fair value is required and must be greater than zero.`));
  }
  validateFairValueOrdering(report, errors);
  validateOptionalPositiveFairValues(report, errors);
  validateExternalDecisionFields(report, errors);

  if (!hasText(report.thesis?.shortSummary) && !hasText(report.thesis?.fullSummary)) {
    errors.push(fieldError("thesis.shortSummary", "Investment thesis summary is required."));
  }
  if (!Array.isArray(report.risks) || !report.risks.length || !report.risks.some((risk) => hasText(risk?.title) || hasText(risk?.explanation))) {
    errors.push(fieldError("risks", "At least one main risk is required."));
  }
  if (!hasText(report.decision?.verdict)) errors.push(fieldError("decision.verdict", "Verdict is required and must be stated in the pasted analysis."));

  validateArrays(report, errors);
  validateGuidance(report, errors);
  validateCompanySpecificKpis(report, errors);
  validatePriceTargetRequirements(report, errors);
  validateFiniteNumbers(report, errors);

  if (report.analysisOrigin && report.analysisOrigin !== "external_chatgpt") {
    errors.push(fieldError("analysisOrigin", "External reports must keep analysisOrigin = external_chatgpt."));
  }
  if (report.source && report.source !== "ChatGPT") {
    warnings.push(fieldError("source", "Source is not ChatGPT. Keep this only if the pasted analysis explicitly identifies another source."));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateExternalDecisionFields(report, errors) {
  const action = report.recommendation?.action;
  if (action && !["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"].includes(String(action).toUpperCase())) {
    errors.push(fieldError("recommendation.action", "External recommendation action must be BUY, ADD, HOLD, WATCH, REDUCE, or SELL."));
  }
  const confidence = report.recommendation?.confidence;
  if (confidence !== null && confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 100)) {
    errors.push(fieldError("recommendation.confidence", "External recommendation confidence must be between 0 and 100 when present."));
  }
}

function validateFairValueOrdering(report, errors) {
  const bear = report.fairValue?.bear;
  const base = report.fairValue?.base;
  const bull = report.fairValue?.bull;
  if (![bear, base, bull].every(Number.isFinite)) return;
  if (!(bear <= base && base <= bull)) {
    errors.push(fieldError("fairValue", "Bear/Base/Bull Fair Value must be ordered as Bear <= Base <= Bull."));
  }
}

function validateOptionalPositiveFairValues(report, errors) {
  for (const key of ["weightedFairValue", "analystFairValue", "finalFairValue"]) {
    const value = report.fairValue?.[key];
    if (value !== null && value !== undefined && !isPositiveNumber(value)) {
      errors.push(fieldError(`fairValue.${key}`, `${key} must be a positive number when present.`));
    }
  }
}

function validateArrays(report, errors) {
  const arrayPaths = ["risks", "catalysts", "watchItems", "sources", "quality.strengths", "quality.weaknesses", "earningsQuality.oneOffItems", "guidance", "companySpecificKpis", "priceTargetRequirements.requirements", "recommendation.whatWouldUpgrade", "recommendation.whatWouldDowngrade"];
  for (const path of arrayPaths) {
    const value = getPath(report, path);
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      errors.push(fieldError(path, `${path} must be an array when present.`));
    }
  }
}

function validateGuidance(report, errors) {
  const directions = new Set(["raised", "maintained", "lowered", "new", "not_applicable"]);
  for (const [index, item] of (report.guidance || []).entries()) {
    if (item?.direction && !directions.has(item.direction)) {
      errors.push(fieldError(`guidance.${index}.direction`, "Guidance direction is not supported."));
    }
  }
}

function validateCompanySpecificKpis(report, errors) {
  const trends = new Set(["improving", "stable", "deteriorating", "unknown"]);
  for (const [index, item] of (report.companySpecificKpis || []).entries()) {
    if (!hasText(item?.name) && !hasText(item?.arabicName)) {
      errors.push(fieldError(`companySpecificKpis.${index}.name`, "Company-specific KPI needs a name when present."));
    }
    if (item?.trend && !trends.has(item.trend)) {
      errors.push(fieldError(`companySpecificKpis.${index}.trend`, "Company-specific KPI trend is not supported."));
    }
  }
}

function validatePriceTargetRequirements(report, errors) {
  const requirements = report.priceTargetRequirements?.requirements || [];
  const statuses = new Set(["NOT_REPORTED", "PASSED", "PARTIALLY_PASSED", "FAILED", "EXCEEDED"]);
  for (const [index, item] of requirements.entries()) {
    if (!statuses.has(item.status)) errors.push(fieldError(`priceTargetRequirements.requirements.${index}.status`, "Requirement status is not supported."));
    if (!Number.isFinite(item.weight) || item.weight < 0) errors.push(fieldError(`priceTargetRequirements.requirements.${index}.weight`, "Requirement weight must be zero or greater."));
  }
}

function validateFiniteNumbers(value, errors, path = "") {
  if (typeof value === "number" && !Number.isFinite(value)) {
    errors.push(fieldError(path || "report", "Numbers cannot be NaN or Infinity."));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    validateFiniteNumbers(child, errors, path ? `${path}.${key}` : key);
  }
}

function isValidTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean) && !["TICKER", "SYMBOL"].includes(clean);
}

function isValidDate(value) {
  if (!hasText(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 10;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getPath(object, path) {
  return String(path).split(".").reduce((cursor, key) => cursor?.[key], object);
}

function fieldError(field, message) {
  return { field, message };
}
