import {
  canonicalSupplementFieldPath,
  isUnsafeJsonPath,
  supplementFieldDefinition
} from "./supplementContract.js";

export const EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION = "external-analysis-supplement/v1";

export function normalizeExternalAnalysisSupplement(input = {}, rawSupplement = "", options = {}) {
  const fields = normalizeFields(input.fields);
  return {
    schemaVersion: nullableString(input.schemaVersion),
    ticker: normalizeTicker(input.ticker ?? input.company?.ticker ?? options.ticker),
    targetAnalysisId: nullableString(input.targetAnalysisId ?? input.reportId ?? input.id ?? options.targetAnalysisId),
    analysisDate: normalizeDate(input.analysisDate ?? input.date ?? options.analysisDate),
    fields,
    notes: normalizeStringArray(input.notes),
    sources: normalizeSources(input.sources),
    rawSupplement: String(rawSupplement || input.rawSupplement || ""),
    source: nullableString(input.source) || "ChatGPT",
    sourceModel: nullableString(input.sourceModel ?? input.model),
    metadata: {
      parsedAt: (options.now || new Date()).toISOString(),
      parserVersion: "external-supplement-parser-v1"
    }
  };
}

export function normalizeSupplementFieldValue(path, value) {
  if (value === undefined || value === "") return null;
  if (value === null) return null;
  const definition = supplementFieldDefinition(path);
  if (definition?.expectedType === "Number") return value;
  if (path === "risks") return normalizeRiskItems(value);
  if (path === "catalysts") return normalizeTitledItems(value, ["title", "explanation", "timeframe", "sourceIds"]);
  if (path === "sources") return normalizeSources(value);
  if (definition?.expectedType === "Array") return Array.isArray(value) ? preserveNulls(value) : [value].filter((item) => item !== null && item !== undefined && item !== "");
  if (definition?.expectedType === "Object") return value && typeof value === "object" && !Array.isArray(value) ? preserveNulls(value) : value;
  if (typeof value === "object") return preserveNulls(value);
  return typeof value === "string" ? nullableString(value) : value;
}

function normalizeFields(fields = {}) {
  const result = {};
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return result;
  for (const [path, value] of Object.entries(fields)) {
    const canonicalPath = canonicalSupplementFieldPath(path);
    defineSafeOwnProperty(result, canonicalPath, isUnsafeJsonPath(canonicalPath) ? value : normalizeSupplementFieldValue(canonicalPath, value));
  }
  return result;
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { title: item, url: null, sourceType: null };
    if (!item || typeof item !== "object") return null;
    return {
      id: nullableString(item.id),
      title: nullableString(item.title ?? item.name),
      url: nullableString(item.url),
      sourceType: nullableString(item.sourceType ?? item.type),
      date: nullableString(item.date),
      usedFor: normalizeStringArray(item.usedFor)
    };
  }).filter(Boolean);
}

function normalizeRiskItems(value) {
  return normalizeTitledItems(value, ["title", "severity", "explanation", "whatToMonitor", "thesisBreaker", "sourceIds"]);
}

function normalizeTitledItems(value, keys) {
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => {
    if (typeof item === "string") {
      return Object.fromEntries(keys.map((key, index) => [key, index === 0 ? item : null]));
    }
    if (!item || typeof item !== "object") return null;
    return Object.fromEntries(keys.map((key) => {
      const fieldValue = item[key] ?? (key === "title" ? item.name : null);
      return [key, key === "sourceIds" ? normalizeStringArray(fieldValue) : toMaybeTextOrNumber(fieldValue)];
    }));
  }).filter(Boolean);
}

function toMaybeTextOrNumber(value) {
  if (value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value === null ? null : String(value).trim() || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => nullableString(item)).filter(Boolean);
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  const clean = String(value).trim();
  return clean || null;
}

function normalizeTicker(value) {
  const clean = nullableString(value);
  return clean ? clean.toUpperCase() : null;
}

function normalizeDate(value) {
  const clean = nullableString(value);
  if (!clean) return null;
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) return clean;
  return clean;
}

function defineSafeOwnProperty(object, key, value) {
  Object.defineProperty(object, key, { value, enumerable: true, configurable: true, writable: true });
}

function preserveNulls(value) {
  if (Array.isArray(value)) return value.map(preserveNulls);
  if (!value || typeof value !== "object") return value === undefined ? null : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, preserveNulls(item)]));
}
