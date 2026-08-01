export const EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION = "external-analysis-supplement/v1";

const PATH_OBJECT_KEYS = new Set([
  "company",
  "market",
  "scores",
  "fairValue",
  "valuationMethods",
  "financialHighlights",
  "growthHighlights",
  "quality",
  "earningsQuality",
  "decision"
]);

export function normalizeExternalAnalysisSupplement(input = {}, rawSupplement = "", options = {}) {
  const fields = normalizeFields(input.fields || flattenPartialReport(input));
  return {
    schemaVersion: input.schemaVersion || EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION,
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
  if (numericPath(path)) return toNullableNumber(value);
  if (arrayPath(path)) return Array.isArray(value) ? value : [value].filter((item) => item !== null && item !== undefined && item !== "");
  if (typeof value === "object") return preserveNulls(value);
  return nullableString(value);
}

function normalizeFields(fields = {}) {
  const result = {};
  for (const [path, value] of Object.entries(fields || {})) {
    if (!isAllowedPath(path)) continue;
    result[path] = normalizeSupplementFieldValue(path, value);
  }
  return result;
}

function flattenPartialReport(input = {}) {
  const result = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!PATH_OBJECT_KEYS.has(key)) continue;
    flattenObject(value, key, result);
  }
  for (const path of ["analysisDate", "reportPeriod", "risks", "catalysts", "watchItems", "sources"]) {
    if (input[path] !== undefined) result[path] = input[path];
  }
  return result;
}

function flattenObject(value, prefix, result) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    result[prefix] = value;
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}.${key}`;
    if (child && typeof child === "object" && !Array.isArray(child) && !valuationMethodPath(path)) {
      flattenObject(child, path, result);
    } else {
      result[path] = child;
    }
  }
}

function isAllowedPath(path) {
  const clean = String(path || "");
  if (!clean || clean.includes("__proto__") || clean.includes("constructor") || clean.includes("prototype")) return false;
  return /^[A-Za-z0-9_.-]+$/.test(clean);
}

function numericPath(path) {
  return /(^scores\.|^fairValue\.|^market\.|Pct$|price|Price|value|Value|revenue|Income|cash|debt|capex|eps|flow|Flow)/i.test(path);
}

function arrayPath(path) {
  return ["risks", "catalysts", "watchItems", "sources", "quality.strengths", "quality.weaknesses", "earningsQuality.oneOffItems"].includes(path);
}

function valuationMethodPath(path) {
  return /^valuationMethods\.[A-Za-z0-9_-]+$/.test(path);
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { title: item, url: null, sourceType: null };
    if (!item || typeof item !== "object") return null;
    return {
      title: nullableString(item.title),
      url: nullableString(item.url),
      sourceType: nullableString(item.sourceType)
    };
  }).filter(Boolean);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => nullableString(item)).filter(Boolean);
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[%,$\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
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
  if (!Number.isNaN(parsed.getTime())) return clean.slice(0, 10);
  return clean;
}

function preserveNulls(value) {
  if (Array.isArray(value)) return value.map(preserveNulls);
  if (!value || typeof value !== "object") return value === undefined ? null : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, preserveNulls(item)]));
}
