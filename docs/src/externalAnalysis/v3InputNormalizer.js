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
  normalizeMarketPriceShape(value);

  for (const item of list(value.strengths)) {
    normalizeOptionalConfidence(item);
    item.importance = optionalEnum(item.importance, FRANKLIN_V3_IMPORTANCE_LEVELS);
  }
  for (const item of list(value.weaknesses)) {
    normalizeOptionalConfidence(item);
    item.severity = optionalEnum(item.severity, FRANKLIN_V3_IMPORTANCE_LEVELS);
  }
  for (const item of list(value.risks)) item.severity = optionalEnum(item.severity, FRANKLIN_V3_IMPORTANCE_LEVELS);

  const latestQuarter = value.latestQuarter || {};
  for (const metric of Object.values(latestQuarter.coreMetrics || {})) {
    if (metric && Object.hasOwn(metric, "result")) metric.result = canonicalEnum(metric.result, FRANKLIN_V3_METRIC_RESULTS);
  }
  for (const item of list(latestQuarter.companySpecificKpis)) {
    item.result = optionalEnum(item.result, FRANKLIN_V3_METRIC_RESULTS);
    item.importance = optionalEnum(item.importance, FRANKLIN_V3_IMPORTANCE_LEVELS);
  }
  for (const item of list(latestQuarter.guidance)) item.direction = optionalEnum(item.direction, FRANKLIN_V3_GUIDANCE_DIRECTIONS);
  for (const [field, allowed] of Object.entries(FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS)) {
    if (latestQuarter.forwardOutlook) latestQuarter.forwardOutlook[field] = optionalEnum(latestQuarter.forwardOutlook[field], allowed);
  }

  const forecast = value.forecast || {};
  forecast.materiality = optionalEnum(forecast.materiality, FRANKLIN_V3_FORECAST_MATERIALITY);
  for (const row of list(forecast.yearlyForecast)) {
    for (const metric of ["revenue", "revenueGrowthPct", "eps", "ebitda", "ebitdaMarginPct", "freeCashFlow", "fcfMarginPct"]) {
      if (row?.[metric]) row[metric].basis = optionalEnum(row[metric].basis, FRANKLIN_V3_FORECAST_BASIS);
    }
  }
  for (const item of list(forecast.changedAssumptions)) item.direction = optionalEnum(item.direction, FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS);

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
  normalizeMarketPriceSourceUsage(value);
  return value;
}

function normalizeMarketPriceSourceUsage(value) {
  const sourceId = String(value?.marketPrice?.sourceId || "").trim();
  if (!sourceId) return;
  const source = list(value.sources).find((item) => String(item?.id || "").trim() === sourceId);
  if (!source) return;
  const usedFor = Array.isArray(source.usedFor)
    ? source.usedFor.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (!usedFor.some((item) => normalizeToken(item) === "marketprice")) {
    source.usedFor = [...usedFor, "marketPrice"];
  }
}

function normalizeMarketPriceShape(value) {
  const rawMarketPrice = value.marketPrice;
  const existing = rawMarketPrice && typeof rawMarketPrice === "object" ? rawMarketPrice : {};
  const market = { ...existing };
  const aliasValue = firstPositiveNumber([
    existing.value,
    existing.currentPrice,
    existing.price,
    typeof rawMarketPrice !== "object" ? rawMarketPrice : null,
    value.currentPrice,
    value.priceAtAnalysis,
    value.market?.value,
    value.market?.currentPrice,
    value.market?.price,
    value.valuation?.current?.marketPrice,
    value.valuation?.current?.marketPrice?.value,
    value.valuation?.current?.currentPrice,
    value.valuation?.current?.price,
    value.fairValueSummary?.currentPrice,
    value.market?.priceAtAnalysis
  ]);
  if (!positiveNumber(existing.value) && aliasValue !== null) market.value = aliasValue;
  if (!market.currency && value.company?.tradingCurrency) market.currency = value.company.tradingCurrency;
  if (!market.asOf) {
    market.asOf = existing.date
      || existing.timestamp
      || existing.priceDate
      || value.marketPriceDate
      || value.priceAsOf
      || value.market?.asOf
      || value.valuation?.current?.priceAsOf
      || null;
  }
  if (!market.sourceId) market.sourceId = sourceIdAlias(existing, value.sources);
  market.priceType = canonicalMarketPriceType(existing.priceType || existing.type || existing.quoteType);
  value.marketPrice = market;
}

function canonicalMarketPriceType(value) {
  const canonical = canonicalEnum(value, FRANKLIN_V3_MARKET_PRICE_TYPES);
  if (FRANKLIN_V3_MARKET_PRICE_TYPES.includes(canonical)) return canonical;
  const aliases = {
    close: "LAST_CLOSE",
    closing: "LAST_CLOSE",
    closingprice: "LAST_CLOSE",
    lastprice: "LAST_CLOSE",
    previousclose: "LAST_CLOSE",
    realtime: "LIVE",
    realtimeprice: "LIVE",
    current: "LIVE",
    delayedprice: "DELAYED",
    fifteenminutedelayed: "DELAYED",
    delayed15minutes: "DELAYED"
  };
  return aliases[normalizeToken(value)] || canonical;
}

function sourceIdAlias(market = {}, sources = []) {
  if (typeof market.source === "string" && market.source.trim()) return market.source.trim();
  if (market.source?.id) return String(market.source.id).trim();
  const candidates = list(sources).filter((source) => {
    const usedFor = list(source?.usedFor).map(normalizeToken);
    return normalizeToken(source?.type) === "marketdata" || usedFor.includes("marketprice");
  });
  return candidates.length === 1 && candidates[0]?.id ? String(candidates[0].id).trim() : null;
}

function firstPositiveNumber(values = []) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function normalizeOptionalConfidence(target) {
  if (!target || typeof target !== "object") return;
  target.confidence = optionalEnum(target.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS);
}

function optionalEnum(value, allowed = []) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = canonicalEnum(value, allowed);
  return allowed.includes(normalized) ? normalized : null;
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
  return match ?? value;
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
