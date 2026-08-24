import {
  FRANKLIN_V3_ANALYSIS_TYPES,
  FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS,
  FRANKLIN_V3_CONFIDENCE_LEVELS,
  FRANKLIN_V3_DECISION_ACTIONS,
  FRANKLIN_V3_DECISION_SCOPES,
  FRANKLIN_V3_FORECAST_BASIS,
  FRANKLIN_V3_FORECAST_MATERIALITY,
  FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS,
  FRANKLIN_V3_GUIDANCE_DIRECTIONS,
  FRANKLIN_V3_IMPORTANCE_LEVELS,
  FRANKLIN_V3_MARKET_PRICE_TYPES,
  FRANKLIN_V3_METRIC_RESULTS,
  FRANKLIN_V3_NEXT_REQUIREMENT_MODES,
  FRANKLIN_V3_REQUIREMENT_OVERALL_STATUSES,
  FRANKLIN_V3_REQUIREMENT_STATUSES,
  FRANKLIN_V3_REQUIREMENT_TYPES,
  FRANKLIN_V3_REVIEW_STATUSES,
  FRANKLIN_V3_SECURITY_UNITS,
  FRANKLIN_V3_SOURCE_TYPES,
  FRANKLIN_V3_TARGET_SCENARIOS,
  FRANKLIN_V3_THESIS_STATUSES,
  FRANKLIN_V3_VALUATION_ROLES
} from "./v3Contract.js";

// Normalizes representation-only differences produced by LLMs before strict V3 validation.
// It never changes financial numbers, valuation outputs, requirement thresholds, or decisions.
export function normalizeFranklinV3Input(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = clone(input);

  value.analysisType = canonicalEnum(value.analysisType, FRANKLIN_V3_ANALYSIS_TYPES);
  if (value.valuation) value.valuation.reviewStatus = canonicalEnum(value.valuation.reviewStatus, FRANKLIN_V3_REVIEW_STATUSES);
  if (value.thesis) value.thesis.status = canonicalEnum(value.thesis.status, FRANKLIN_V3_THESIS_STATUSES);
  if (value.decision) {
    value.decision.scope = canonicalEnum(value.decision.scope, FRANKLIN_V3_DECISION_SCOPES);
    value.decision.action = canonicalEnum(value.decision.action, FRANKLIN_V3_DECISION_ACTIONS);
  }

  normalizeOptionalConfidence(value.dataQuality);
  normalizeOptionalConfidence(value.classification);
  normalizeOptionalConfidence(value.businessQuality);
  normalizeOptionalConfidence(value.valuation?.current);

  if (value.company) value.company.securityUnit = canonicalSecurityUnit(value.company.securityUnit);
  if (value.valuation?.current) value.valuation.current.securityUnit = canonicalSecurityUnit(value.valuation.current.securityUnit);
  if (value.marketPrice) value.marketPrice.priceType = canonicalEnum(value.marketPrice.priceType, FRANKLIN_V3_MARKET_PRICE_TYPES);

  for (const item of list(value.strengths)) {
    normalizeOptionalConfidence(item);
    item.importance = canonicalEnum(item.importance, FRANKLIN_V3_IMPORTANCE_LEVELS);
  }
  for (const item of list(value.weaknesses)) {
    normalizeOptionalConfidence(item);
    item.severity = canonicalEnum(item.severity, FRANKLIN_V3_IMPORTANCE_LEVELS);
  }
  for (const item of list(value.risks)) item.severity = canonicalEnum(item.severity, FRANKLIN_V3_IMPORTANCE_LEVELS);

  const latestQuarter = value.latestQuarter || {};
  for (const metric of Object.values(latestQuarter.coreMetrics || {})) {
    if (metric && Object.hasOwn(metric, "result")) metric.result = canonicalEnum(metric.result, FRANKLIN_V3_METRIC_RESULTS);
  }
  for (const item of list(latestQuarter.companySpecificKpis)) {
    item.result = canonicalEnum(item.result, FRANKLIN_V3_METRIC_RESULTS);
    item.importance = canonicalEnum(item.importance, FRANKLIN_V3_IMPORTANCE_LEVELS);
  }
  for (const item of list(latestQuarter.guidance)) item.direction = canonicalEnum(item.direction, FRANKLIN_V3_GUIDANCE_DIRECTIONS);
  for (const [field, allowed] of Object.entries(FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS)) {
    if (latestQuarter.forwardOutlook) latestQuarter.forwardOutlook[field] = canonicalEnum(latestQuarter.forwardOutlook[field], allowed);
  }

  const forecast = value.forecast || {};
  forecast.materiality = canonicalEnum(forecast.materiality, FRANKLIN_V3_FORECAST_MATERIALITY);
  for (const row of list(forecast.yearlyForecast)) {
    for (const metric of ["revenue", "revenueGrowthPct", "eps", "ebitda", "ebitdaMarginPct", "freeCashFlow", "fcfMarginPct"]) {
      if (row?.[metric]) row[metric].basis = canonicalEnum(row[metric].basis, FRANKLIN_V3_FORECAST_BASIS);
    }
  }
  for (const item of list(forecast.changedAssumptions)) item.direction = canonicalEnum(item.direction, FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS);

  for (const item of list(value.valuation?.valuationResults)) {
    item.role = canonicalEnum(item.role, FRANKLIN_V3_VALUATION_ROLES);
    normalizeOptionalConfidence(item);
  }

  const next = value.nextRequirements || {};
  next.mode = canonicalEnum(next.mode, FRANKLIN_V3_NEXT_REQUIREMENT_MODES);
  next.targetScenario = canonicalEnum(next.targetScenario, FRANKLIN_V3_TARGET_SCENARIOS);
  for (const item of list(next.requirements)) {
    item.type = canonicalEnum(item.type, FRANKLIN_V3_REQUIREMENT_TYPES);
    item.importance = canonicalEnum(item.importance, FRANKLIN_V3_IMPORTANCE_LEVELS);
    item.status = canonicalEnum(item.status, FRANKLIN_V3_REQUIREMENT_STATUSES);
  }

  const previous = value.previousRequirementsEvaluation || {};
  for (const item of list(previous.requirements)) item.status = canonicalEnum(item.status, FRANKLIN_V3_REQUIREMENT_STATUSES);
  if (previous.assessment) previous.assessment.overallStatus = canonicalEnum(previous.assessment.overallStatus, FRANKLIN_V3_REQUIREMENT_OVERALL_STATUSES);

  for (const source of list(value.sources)) source.type = canonicalEnum(source.type, FRANKLIN_V3_SOURCE_TYPES);
  return value;
}

function normalizeOptionalConfidence(target) {
  if (!target || typeof target !== "object") return;
  const normalized = canonicalEnum(target.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS);
  target.confidence = FRANKLIN_V3_CONFIDENCE_LEVELS.includes(normalized) ? normalized : null;
}

function canonicalSecurityUnit(value) {
  if (value === null || value === undefined || value === "") return value;
  const token = normalizeToken(value);
  const aliases = {
    share: "share",
    shares: "share",
    commonshare: "share",
    commonshares: "share",
    commonstock: "share",
    stock: "share",
    ads: "ADS",
    americandepositaryshare: "ADS",
    americandepositaryshares: "ADS",
    adr: "ADR",
    americandepositaryreceipt: "ADR",
    americandepositaryreceipts: "ADR",
    unit: "unit",
    units: "unit"
  };
  return aliases[token] || canonicalEnum(value, FRANKLIN_V3_SECURITY_UNITS);
}

function canonicalEnum(value, allowed = []) {
  if (value === null || value === undefined || value === "") return value;
  const token = normalizeToken(value);
  const match = allowed.find((item) => normalizeToken(item) === token);
  if (match !== undefined) return match;
  // Narrative importance/severity fields are optional in V3. When an LLM returns an
  // unsupported descriptive label (for example "strategic" or "very high"), drop
  // only that optional presentation value rather than rejecting an otherwise valid report.
  // Required importance fields (such as nextRequirements) still fail strict validation
  // because null is not accepted there.
  if (allowed === FRANKLIN_V3_IMPORTANCE_LEVELS) return null;
  return value;
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
