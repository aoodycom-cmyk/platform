import { getByPath, isKnownAnalysisPath, isMissing, valuePresent } from "./fieldPaths.js";
import { EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION } from "./supplementSchema.js";

export const PROTECTED_SUPPLEMENT_PATHS = new Set([
  "id",
  "analysisOrigin",
  "rawAnalysisOriginal",
  "metadata.rawHash",
  "company.ticker"
]);

export function validateExternalAnalysisSupplement(supplement = {}, existingReport = {}) {
  const errors = [];
  const warnings = [];

  if (supplement.schemaVersion !== EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION) {
    errors.push(fieldError("schemaVersion", "Supplement schemaVersion must be external-analysis-supplement/v1."));
  }
  if (!supplement.fields || typeof supplement.fields !== "object" || Array.isArray(supplement.fields)) {
    errors.push(fieldError("fields", "Supplement fields object is required."));
  }
  if (supplement.ticker && placeholderTicker(supplement.ticker)) {
    errors.push(fieldError("ticker", "Supplement ticker cannot be TICKER or SYMBOL. Use the real market symbol."));
  }
  const currentTicker = existingReport.company?.ticker;
  if (supplement.ticker && validSupplementTicker(currentTicker) && normalizeTicker(supplement.ticker) !== normalizeTicker(currentTicker)) {
    errors.push(fieldError("ticker", "Supplement ticker does not match the current report ticker."));
  }
  if (supplement.targetAnalysisId && existingReport.id && supplement.targetAnalysisId !== existingReport.id) {
    errors.push(fieldError("targetAnalysisId", "Supplement targetAnalysisId does not match the current report."));
  }

  const fields = effectiveSupplementFields(supplement, existingReport);
  for (const [path, value] of Object.entries(fields)) {
    if (!isKnownAnalysisPath(path)) {
      errors.push(fieldError("fields", `Unknown supplement field path: ${path}.`));
      continue;
    }
    if (!isMissing(value, path) && PROTECTED_SUPPLEMENT_PATHS.has(path) && !canUseProtectedField(path, value, existingReport)) {
      errors.push(fieldError(path, "This protected field cannot be changed by a supplement."));
      continue;
    }
    validateFieldValue(path, value, errors);
  }
  if (!hasUsableField(fields)) {
    errors.push(fieldError("fields", "Supplement did not include any non-empty values for the requested fields."));
  }

  validateCombinedFairValueOrdering(existingReport, fields, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function effectiveSupplementFields(supplement = {}, existingReport = {}) {
  const fields = { ...(supplement.fields || {}) };
  const missingTicker = !valuePresent(existingReport.company?.ticker, "company.ticker");
  if (missingTicker && !valuePresent(fields["company.ticker"], "company.ticker") && validSupplementTicker(supplement.ticker)) {
    fields["company.ticker"] = normalizeTicker(supplement.ticker);
  }
  return fields;
}

export function canUseProtectedField(path, value, existingReport = {}) {
  if (path !== "company.ticker") return false;
  const incoming = normalizeTicker(value);
  if (!validSupplementTicker(incoming)) return false;
  const current = normalizeTicker(existingReport.company?.ticker);
  return !validSupplementTicker(current) || incoming === current;
}

function validateFieldValue(path, value, errors) {
  if (value === null || value === undefined) return;
  if (typeof value === "number" && !Number.isFinite(value)) {
    errors.push(fieldError(path, "Numbers cannot be NaN or Infinity."));
    return;
  }
  if (/^scores\./.test(path) && !isScore(value)) {
    errors.push(fieldError(path, "Scores must be between 0 and 10."));
  }
  if (/^fairValueSummary\./.test(path) && ["fairValueSummary.fairValueLow", "fairValueSummary.fairValueBase", "fairValueSummary.fairValueHigh", "fairValueSummary.probabilityWeightedFairValue"].includes(path) && !isPositiveNumber(value)) {
    errors.push(fieldError(path, "Fair Value fields must be positive numbers when present."));
  }
  if (path === "fairValueSummary.currentPrice" && !isPositiveNumber(value)) {
    errors.push(fieldError(path, "Price at Analysis must be greater than zero."));
  }
  if (path === "analysisDate" && !isValidDate(value)) {
    errors.push(fieldError(path, "Analysis date must be valid."));
  }
  if (path === "risks" && !Array.isArray(value)) {
    errors.push(fieldError(path, "Risks must be an array."));
  }
  if (path === "decision.action" && typeof value === "string" && !value.trim()) {
    errors.push(fieldError(path, "Verdict text cannot be empty."));
  }
  if (path === "company.ticker" && !validSupplementTicker(value)) {
    errors.push(fieldError(path, "Ticker must be a valid market symbol."));
  }
}

function validateCombinedFairValueOrdering(existingReport, fields, errors) {
  const bear = valueFor("fairValueSummary.fairValueLow", existingReport, fields);
  const base = valueFor("fairValueSummary.fairValueBase", existingReport, fields);
  const bull = valueFor("fairValueSummary.fairValueHigh", existingReport, fields);
  if (![bear, base, bull].every(Number.isFinite)) return;
  if (!(bear <= base && base <= bull)) {
    errors.push(fieldError("fairValueSummary", "Bear/Base/Bull Fair Value must be ordered as Bear <= Base <= Bull."));
  }
}

function valueFor(path, report, fields) {
  return fields[path] !== undefined ? fields[path] : getByPath(report, path);
}

function isScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 10;
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isValidDate(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function validSupplementTicker(value) {
  const clean = normalizeTicker(value);
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean) && !placeholderTicker(clean);
}

function placeholderTicker(value) {
  return ["TICKER", "SYMBOL"].includes(normalizeTicker(value));
}

function hasUsableField(fields = {}) {
  return Object.entries(fields).some(([path, value]) => valuePresent(value, path));
}

function fieldError(field, message) {
  return { field, message };
}
