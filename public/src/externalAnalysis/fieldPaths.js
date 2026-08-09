const KNOWN_ANALYSIS_ROOTS = new Set([
  "id",
  "schemaVersion",
  "analysisOrigin",
  "source",
  "sourceModel",
  "sourceConversation",
  "analysisDate",
  "reportPeriod",
  "company",
  "companyProfile",
  "market",
  "scores",
  "fairValue",
  "valuationMethods",
  "financialHighlights",
  "growthHighlights",
  "quality",
  "risks",
  "catalysts",
  "thesis",
  "earningsQuality",
  "watchItems",
  "decision",
  "recommendation",
  "guidance",
  "companySpecificKpis",
  "priceTargetRequirements",
  "previousRequirementsEvaluation",
  "requirementsAssessment",
  "scenarios",
  "primaryValuationMethod",
  "valuationSelectionReason",
  "sources",
  "rawAnalysis",
  "rawAnalysisOriginal",
  "supplements",
  "completionStatus",
  "userEditedFields",
  "metadata"
]);

export function getByPath(object, path) {
  return pathParts(path).reduce((current, key) => {
    if (current == null) return undefined;
    return current[key];
  }, object);
}

export function setByPath(object, path, value) {
  const parts = pathParts(path);
  if (!parts.length) return;
  let cursor = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

export function isMissing(value, path = "") {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return !Number.isFinite(value);
  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) return true;
    if (path === "company.ticker") return ["TICKER", "SYMBOL"].includes(clean.toUpperCase());
    return false;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return true;
    return Object.values(value).every((item) => isMissing(item));
  }
  return false;
}

export function valuePresent(value, path = "") {
  return !isMissing(value, path);
}

export function isKnownAnalysisPath(path) {
  const parts = pathParts(path);
  if (!parts.length) return false;
  if (!KNOWN_ANALYSIS_ROOTS.has(parts[0])) return false;
  if (pathHasUnsafePart(parts)) return false;
  return true;
}

export function diagnosticRowsForPaths(report = {}, fields = []) {
  return fields.map((field) => {
    const path = typeof field === "string" ? field : field.path;
    const value = getByPath(report, path);
    return {
      path,
      value,
      missing: isMissing(value, path)
    };
  });
}

export function diagnosticRowsForSupplement(report = {}, fields = {}) {
  return Object.entries(fields || {}).map(([path, incomingValue]) => {
    const currentValue = getByPath(report, path);
    const currentMissing = isMissing(currentValue, path);
    const incomingMissing = isMissing(incomingValue, path);
    return {
      path,
      currentValue,
      incomingValue,
      currentMissing,
      incomingMissing,
      willMerge: !incomingMissing && currentMissing
    };
  });
}

function pathParts(path) {
  return String(path || "").split(".").filter(Boolean);
}

function pathHasUnsafePart(parts = []) {
  return parts.some((part) => ["__proto__", "constructor", "prototype"].includes(part));
}
