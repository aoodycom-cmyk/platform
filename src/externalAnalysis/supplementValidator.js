import { getByPath, isMissing, valuePresent } from "./fieldPaths.js";
import { EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION } from "./supplementSchema.js";
import {
  isApprovedSupplementField,
  isUnsafeJsonPath,
  supplementFieldDefinition
} from "./supplementContract.js";

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
    if (isUnsafeJsonPath(path)) {
      errors.push(fieldError(`fields.${path}`, "Unsafe supplement field path is not allowed.", "approved dotted field path", value));
      continue;
    }
    if (!isApprovedSupplementField(path)) {
      errors.push(fieldError(`fields.${path}`, `Unknown supplement field path: ${path}.`, "approved supplement field", value));
      continue;
    }
    if (!isMissing(value, path) && PROTECTED_SUPPLEMENT_PATHS.has(path) && !canUseProtectedField(path, value, existingReport)) {
      errors.push(fieldError(`fields.${path}`, "This protected field cannot be changed by a supplement.", "unchanged protected field", value));
      continue;
    }
    validateFieldValue(path, value, errors);
  }
  if (!hasUsableField(fields)) {
    errors.push(fieldError("fields", "Supplement did not include any non-empty values for the requested fields."));
  }

  validateCombinedFairValueOrdering(existingReport, fields, errors);
  validateSupplementSourceReferences(supplement, existingReport, fields, errors);

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
  const definition = supplementFieldDefinition(path);
  if (!matchesExpectedType(value, definition?.expectedType)) {
    errors.push(fieldError(`fields.${path}`, `${path} must be ${definition?.expectedType || "a supported type"}.`, definition?.expectedType, value));
    return;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    errors.push(fieldError(`fields.${path}`, "Numbers cannot be NaN or Infinity.", "finite number", value));
    return;
  }
  if (/^scores\./.test(path) && !isScore(value)) {
    errors.push(fieldError(`fields.${path}`, "Scores must be between 0 and 10.", "number from 0 to 10", value));
  }
  if (/^fairValueSummary\./.test(path) && ["fairValueSummary.fairValueLow", "fairValueSummary.fairValueBase", "fairValueSummary.fairValueHigh", "fairValueSummary.probabilityWeightedFairValue"].includes(path) && !isPositiveNumber(value)) {
    errors.push(fieldError(`fields.${path}`, "Fair Value fields must be positive numbers when present.", "positive number", value));
  }
  if (path === "fairValueSummary.currentPrice" && !isPositiveNumber(value)) {
    errors.push(fieldError(`fields.${path}`, "Price at Analysis must be greater than zero.", "positive number", value));
  }
  if (path === "analysisDate" && !isValidDate(value)) {
    errors.push(fieldError(`fields.${path}`, "Analysis date must be valid.", "ISO date or timestamp", value));
  }
  if (path === "risks" && !Array.isArray(value)) {
    errors.push(fieldError(`fields.${path}`, "Risks must be an array.", "array", value));
  }
  if (path === "decision.action" && typeof value === "string" && !value.trim()) {
    errors.push(fieldError(`fields.${path}`, "Verdict text cannot be empty.", "non-empty text", value));
  }
  if (path === "company.ticker" && !validSupplementTicker(value)) {
    errors.push(fieldError(`fields.${path}`, "Ticker must be a valid market symbol.", "valid market ticker", value));
  }
}

function validateSupplementSourceReferences(supplement, existingReport, fields, errors) {
  const available = new Set([
    ...(existingReport.sources || []),
    ...(Array.isArray(fields.sources) ? fields.sources : [])
  ].map((source) => source?.id).filter(Boolean));
  const references = [];
  collectSourceReferences(fields, "fields", references);
  for (const reference of references) {
    if (!available.has(reference.id)) {
      errors.push(fieldError(reference.path, `sourceId ${reference.id} does not reference an available source.`, "id from existing or incoming sources", reference.id));
    }
  }
}

function collectSourceReferences(value, path, result) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSourceReferences(item, `${path}.${index}`, result));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === "sourceId" && typeof child === "string" && child) result.push({ path: childPath, id: child });
    if (key === "sourceIds" && Array.isArray(child)) {
      child.filter((item) => typeof item === "string" && item).forEach((id, index) => result.push({ path: `${childPath}.${index}`, id }));
    }
    collectSourceReferences(child, childPath, result);
  }
}

function matchesExpectedType(value, expectedType) {
  if (value === null || value === undefined) return true;
  if (expectedType === "Number") return typeof value === "number" && Number.isFinite(value);
  if (expectedType === "Text" || expectedType === "Date") return typeof value === "string";
  if (expectedType === "Array") return Array.isArray(value);
  if (expectedType === "Object") return Boolean(value && typeof value === "object" && !Array.isArray(value));
  return false;
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

function fieldError(field, message, expected = null, received = undefined) {
  return {
    field,
    jsonPath: `$.${field}`,
    message,
    expected,
    received,
    receivedType: jsonType(received)
  };
}

function jsonType(value) {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
