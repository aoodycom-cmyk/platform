import {
  normalizeQuarterlyForwardOutlook,
  upsertQuarterlyForwardOutlookSupplement
} from "./quarterlyForwardOutlook.js";
import { normalizeRequirementsAssessment } from "./requirements.js";
import {
  normalizeFiscalQuarterPeriod,
  normalizeFiscalQuarterPeriodOrOriginal
} from "./fiscalQuarterPeriod.js";

export const LEGACY_QUARTERLY_EARNINGS_LITE_SCHEMA = "quarterly-earnings-lite/v1";
export const QUARTERLY_EARNINGS_LITE_SCHEMA = "quarterly-earnings-lite/v2";
export const SUPPORTED_QUARTERLY_EARNINGS_LITE_SCHEMAS = Object.freeze([
  QUARTERLY_EARNINGS_LITE_SCHEMA,
  LEGACY_QUARTERLY_EARNINGS_LITE_SCHEMA
]);

const REQUIREMENT_STATUSES = new Set(["EXCEEDED", "PASSED", "PARTIALLY_PASSED", "FAILED", "NOT_REPORTED"]);
const REQUIREMENT_OVERALL_STATUSES = new Set(["EXCEEDED", "PASSED", "MIXED", "FAILED", "INCOMPLETE"]);
const METRIC_RESULTS = new Set(["BEAT", "MISS", "INLINE", "NA"]);
const GUIDANCE_DIRECTIONS = new Set(["raised", "maintained", "lowered", "new", "not_applicable"]);
const ACCOUNTING_BASES = new Set(["GAAP", "NON_GAAP", "REPORTED", "NOT_APPLICABLE"]);
const QUARTERLY_SOURCE_TYPES = new Set([
  "Investor Relations",
  "SEC",
  "Earnings Call",
  "Consensus Data",
  "User-provided earnings materials"
]);
const METRIC_KEYS = [
  "revenue",
  "revenueGrowthPct",
  "eps",
  "grossMarginPct",
  "operatingMarginPct",
  "freeCashFlow",
  "cash",
  "debt"
];
const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "ticker",
  "quarter",
  "year",
  "reportDate",
  "requirementSetId",
  "summary",
  "metrics",
  "companyKpis",
  "guidance",
  "forwardOutlook",
  "requirements",
  "requirementsAssessment",
  "highlights",
  "concerns",
  "sources"
]);
const METRIC_FIELDS = new Set([
  "value",
  "display",
  "consensusValue",
  "consensusDisplay",
  "unit",
  "accountingBasis",
  "result",
  "sourceId",
  "consensusSourceId"
]);
const KPI_FIELDS = new Set(["name", ...METRIC_FIELDS]);
const GUIDANCE_FIELDS = new Set(["topic", "currentGuidance", "direction", "interpretation", "sourceId"]);
const REQUIREMENT_FIELDS = new Set(["id", "actualValue", "actualDisplay", "unit", "status", "partialCreditPct", "evaluationNote", "sourceId"]);
const ASSESSMENT_FIELDS = new Set([
  "weightedAchievement",
  "reportedRequirements",
  "totalRequirements",
  "passed",
  "failed",
  "exceeded",
  "partiallyPassed",
  "notReported",
  "overallStatus",
  "summary"
]);
const OUTLOOK_FIELDS = new Set(["growthOutlook", "marginOutlook", "guidanceTrend", "managementTone", "thesisImpact", "summary"]);
const SOURCE_FIELDS = new Set(["id", "title", "url", "sourceType", "date", "usedFor"]);
const OUTLOOK_ENUMS = {
  growthOutlook: new Set(["accelerating", "stable", "slowing", "unclear"]),
  marginOutlook: new Set(["improving", "stable", "pressured", "unclear"]),
  guidanceTrend: new Set(["raised", "maintained", "lowered", "mixed", "new", "not_reported"]),
  managementTone: new Set(["positive", "neutral", "cautious", "mixed", "unclear"]),
  thesisImpact: new Set(["supports", "neutral", "weakens", "unclear"])
};
const ASSESSMENT_COUNT_FIELDS = [
  "reportedRequirements",
  "totalRequirements",
  "passed",
  "failed",
  "exceeded",
  "partiallyPassed",
  "notReported"
];

export function parseQuarterlyEarningsContext(text = "") {
  const match = String(text || "").match(/\[Selected quarter:\s*Q([1-4])\s+(\d{4})\]/i);
  if (!match) return null;
  return { quarter: Number(match[1]), year: Number(match[2]) };
}

export function isQuarterlyEarningsLitePayload(value) {
  return Boolean(value
    && typeof value === "object"
    && SUPPORTED_QUARTERLY_EARNINGS_LITE_SCHEMAS.includes(value.schemaVersion));
}

export function validateQuarterlyEarningsLitePayload(value = {}, currentReport = null) {
  const errors = [];
  if (!isPlainObject(value)) {
    errors.push(validationError("$", "JSON object", value, "Quarterly earnings payload must be a JSON object."));
    return validationResult(errors);
  }
  if (!SUPPORTED_QUARTERLY_EARNINGS_LITE_SCHEMAS.includes(value.schemaVersion)) {
    errors.push(validationError("schemaVersion", SUPPORTED_QUARTERLY_EARNINGS_LITE_SCHEMAS.join(" or "), value.schemaVersion, "Quarterly earnings schemaVersion is not supported."));
    return validationResult(errors);
  }

  validateQuarterIdentity(value, errors, {
    strictDate: value.schemaVersion === QUARTERLY_EARNINGS_LITE_SCHEMA,
    dateOptional: value.schemaVersion === LEGACY_QUARTERLY_EARNINGS_LITE_SCHEMA
  });
  if (value.schemaVersion === LEGACY_QUARTERLY_EARNINGS_LITE_SCHEMA) {
    validateLegacyQuarterlyPayload(value, errors);
    return validationResult(errors);
  }

  validateExactFields("$", value, TOP_LEVEL_FIELDS, errors);
  validateRequiredFields("$", value, TOP_LEVEL_FIELDS, errors);
  validateRequiredText("summary", value.summary, 400, errors);
  const sourceIds = validateQuarterlySources(value.sources, errors);
  validateQuarterlyMetrics(value.metrics, sourceIds, errors);
  validateQuarterlyKpis(value.companyKpis, sourceIds, errors);
  validateQuarterlyGuidance(value.guidance, sourceIds, errors);
  validateQuarterlyOutlook(value.forwardOutlook, errors);
  validateQuarterlyRequirements(value.requirements, sourceIds, errors);
  validateQuarterlyAssessment(value.requirementsAssessment, errors);
  validateStringList("highlights", value.highlights, 3, 220, errors);
  validateStringList("concerns", value.concerns, 2, 220, errors);
  validateQuarterlyContext(value, currentReport, errors);
  return validationResult(errors);
}

function validateQuarterIdentity(value, errors, options = {}) {
  if (!normalizeTicker(value.ticker)) {
    errors.push(validationError("ticker", "valid market ticker", value.ticker, "Quarterly ticker is required."));
  }
  if (!normalizeQuarter(value.quarter)) {
    errors.push(validationError("quarter", "Q1, Q2, Q3, or Q4", value.quarter, "Quarter is invalid."));
  }
  if (!Number.isInteger(value.year) || value.year < 2000 || value.year > 2100) {
    errors.push(validationError("year", "integer from 2000 to 2100", value.year, "Fiscal year is invalid."));
  }
  const missingDate = value.reportDate === null || value.reportDate === undefined || value.reportDate === "";
  if (options.dateOptional && missingDate) return;
  const reportDateValid = options.strictDate ? validIsoDateOnly(value.reportDate) : validIsoDate(value.reportDate);
  if (!reportDateValid) {
    errors.push(validationError("reportDate", options.strictDate ? "real ISO date in YYYY-MM-DD format" : "valid ISO date", value.reportDate, "Report date is invalid."));
  }
}

function validateLegacyQuarterlyPayload(value, errors) {
  if (!isPlainObject(value.metrics)) {
    errors.push(validationError("metrics", "object", value.metrics, "Quarterly metrics must be an object."));
    return;
  }
  for (const [key, metric] of Object.entries(value.metrics)) {
    if (!isPlainObject(metric)) {
      errors.push(validationError(`metrics.${key}`, "object", metric, "Quarterly metric must be an object."));
      continue;
    }
    if (metric.result !== undefined && !METRIC_RESULTS.has(metric.result)) {
      errors.push(validationError(`metrics.${key}.result`, "BEAT, MISS, INLINE, or NA", metric.result, "Quarterly metric result is invalid."));
    }
  }
}

function validateQuarterlyMetrics(metrics, sourceIds, errors) {
  if (!isPlainObject(metrics)) {
    errors.push(validationError("metrics", "object with the eight canonical quarterly metrics", metrics, "Quarterly metrics must be an object."));
    return;
  }
  validateExactFields("metrics", metrics, new Set(METRIC_KEYS), errors);
  validateRequiredFields("metrics", metrics, new Set(METRIC_KEYS), errors);
  for (const key of METRIC_KEYS) validateComparableMetric(`metrics.${key}`, metrics[key], sourceIds, errors);
}

function validateComparableMetric(path, metric, sourceIds, errors, options = {}) {
  if (!isPlainObject(metric)) {
    errors.push(validationError(path, "metric object", metric, `${path} must be an object.`));
    return;
  }
  const allowedFields = options.kpi ? KPI_FIELDS : METRIC_FIELDS;
  validateExactFields(path, metric, allowedFields, errors);
  validateRequiredFields(path, metric, allowedFields, errors);
  if (options.kpi) validateRequiredText(`${path}.name`, metric.name, 100, errors);
  validateNumberOrNull(`${path}.value`, metric.value, errors);
  validateNumberOrNull(`${path}.consensusValue`, metric.consensusValue, errors);
  validateTextOrNull(`${path}.display`, metric.display, 120, errors);
  validateTextOrNull(`${path}.consensusDisplay`, metric.consensusDisplay, 120, errors);
  validateTextOrNull(`${path}.unit`, metric.unit, 60, errors);
  validateTextOrNull(`${path}.sourceId`, metric.sourceId, 60, errors);
  validateTextOrNull(`${path}.consensusSourceId`, metric.consensusSourceId, 60, errors);
  if (metric.accountingBasis !== null && !ACCOUNTING_BASES.has(metric.accountingBasis)) {
    errors.push(validationError(`${path}.accountingBasis`, [...ACCOUNTING_BASES].join(", "), metric.accountingBasis, "Metric accountingBasis is invalid."));
  }
  if (!METRIC_RESULTS.has(metric.result)) {
    errors.push(validationError(`${path}.result`, "BEAT, MISS, INLINE, or NA", metric.result, "Quarterly metric result is invalid."));
  }

  const actual = Number.isFinite(metric.value) ? metric.value : null;
  const consensus = Number.isFinite(metric.consensusValue) ? metric.consensusValue : null;
  if (Number.isFinite(actual)) {
    requireMetricEvidence(path, metric, sourceIds, errors, "sourceId");
    if (!hasText(metric.display)) errors.push(validationError(`${path}.display`, "non-empty display text", metric.display, "A numeric actual value requires display text."));
    if (!hasText(metric.unit)) errors.push(validationError(`${path}.unit`, "non-empty shared unit", metric.unit, "A numeric actual value requires a unit."));
    if (!ACCOUNTING_BASES.has(metric.accountingBasis)) errors.push(validationError(`${path}.accountingBasis`, [...ACCOUNTING_BASES].join(", "), metric.accountingBasis, "A numeric actual value requires accountingBasis."));
  } else if (hasText(metric.display)) {
    errors.push(validationError(`${path}.value`, "number when display is supplied", metric.value, "Metric display cannot be populated without a numeric value."));
  }

  if (Number.isFinite(consensus)) {
    requireMetricEvidence(path, metric, sourceIds, errors, "consensusSourceId");
    if (!hasText(metric.consensusDisplay)) errors.push(validationError(`${path}.consensusDisplay`, "non-empty consensus display text", metric.consensusDisplay, "A numeric consensus requires consensusDisplay."));
    if (!hasText(metric.unit)) errors.push(validationError(`${path}.unit`, "non-empty shared unit", metric.unit, "A numeric consensus requires a shared unit."));
    if (!ACCOUNTING_BASES.has(metric.accountingBasis)) errors.push(validationError(`${path}.accountingBasis`, [...ACCOUNTING_BASES].join(", "), metric.accountingBasis, "A numeric consensus requires accountingBasis."));
  } else {
    if (hasText(metric.consensusDisplay)) errors.push(validationError(`${path}.consensusValue`, "number when consensusDisplay is supplied", metric.consensusValue, "consensusDisplay cannot be populated without consensusValue."));
    if (hasText(metric.consensusSourceId)) errors.push(validationError(`${path}.consensusSourceId`, "null when consensusValue is null", metric.consensusSourceId, "consensusSourceId must be null when no consensus value is supplied."));
  }

  if (Number.isFinite(actual) && Number.isFinite(consensus)) {
    const expectedResult = comparisonResult(actual, consensus);
    if (metric.result !== expectedResult) {
      errors.push(validationError(`${path}.result`, expectedResult, metric.result, `Metric result contradicts value (${actual}) and consensusValue (${consensus}).`));
    }
  } else if (metric.result !== "NA") {
    errors.push(validationError(`${path}.result`, "NA unless both value and consensusValue are numeric", metric.result, "BEAT/MISS/INLINE requires comparable actual and consensus numbers."));
  }
}

function requireMetricEvidence(path, metric, sourceIds, errors, field) {
  const sourceId = metric[field];
  if (!hasText(sourceId)) {
    errors.push(validationError(`${path}.${field}`, "source id", sourceId, `A numeric metric requires ${field}.`));
  } else if (!sourceIds.has(sourceId)) {
    errors.push(validationError(`${path}.${field}`, "id from sources[]", sourceId, `${field} must reference sources[].id.`));
  }
}

function validateQuarterlyKpis(items, sourceIds, errors) {
  if (!Array.isArray(items)) {
    errors.push(validationError("companyKpis", "array", items, "companyKpis must be an array."));
    return;
  }
  if (items.length > 4) errors.push(validationError("companyKpis", "at most 4 items", items.length, "companyKpis cannot exceed 4 items."));
  items.forEach((item, index) => validateComparableMetric(`companyKpis.${index}`, item, sourceIds, errors, { kpi: true }));
}

function validateQuarterlyGuidance(items, sourceIds, errors) {
  if (!Array.isArray(items)) {
    errors.push(validationError("guidance", "array", items, "guidance must be an array."));
    return;
  }
  if (items.length > 3) errors.push(validationError("guidance", "at most 3 items", items.length, "guidance cannot exceed 3 items."));
  items.forEach((item, index) => {
    const path = `guidance.${index}`;
    if (!isPlainObject(item)) {
      errors.push(validationError(path, "guidance object", item, "Guidance item must be an object."));
      return;
    }
    validateExactFields(path, item, GUIDANCE_FIELDS, errors);
    validateRequiredFields(path, item, GUIDANCE_FIELDS, errors);
    validateRequiredText(`${path}.topic`, item.topic, 80, errors);
    validateRequiredText(`${path}.currentGuidance`, item.currentGuidance, 140, errors);
    validateTextOrNull(`${path}.interpretation`, item.interpretation, 220, errors);
    if (!GUIDANCE_DIRECTIONS.has(item.direction)) {
      errors.push(validationError(`${path}.direction`, [...GUIDANCE_DIRECTIONS].join(", "), item.direction, "Guidance direction is invalid."));
    }
    validateSourceReference(`${path}.sourceId`, item.sourceId, sourceIds, errors, { required: true });
  });
}

function validateQuarterlyOutlook(value, errors) {
  if (!isPlainObject(value)) {
    errors.push(validationError("forwardOutlook", "object", value, "forwardOutlook must be an object."));
    return;
  }
  validateExactFields("forwardOutlook", value, OUTLOOK_FIELDS, errors);
  validateRequiredFields("forwardOutlook", value, OUTLOOK_FIELDS, errors);
  for (const [field, allowed] of Object.entries(OUTLOOK_ENUMS)) {
    if (!allowed.has(value[field])) {
      errors.push(validationError(`forwardOutlook.${field}`, [...allowed].join(", "), value[field], `forwardOutlook.${field} is invalid.`));
    }
  }
  validateTextOrNull("forwardOutlook.summary", value.summary, 420, errors);
}

function validateQuarterlyRequirements(items, sourceIds, errors) {
  if (!Array.isArray(items)) {
    errors.push(validationError("requirements", "array", items, "requirements must be an array."));
    return;
  }
  const ids = [];
  items.forEach((item, index) => {
    const path = `requirements.${index}`;
    if (!isPlainObject(item)) {
      errors.push(validationError(path, "requirement result object", item, "Requirement result must be an object."));
      return;
    }
    validateExactFields(path, item, REQUIREMENT_FIELDS, errors);
    validateRequiredFields(path, item, REQUIREMENT_FIELDS, errors);
    validateRequiredText(`${path}.id`, item.id, 120, errors);
    ids.push(item.id);
    if (!isScalarOrNull(item.actualValue)) {
      errors.push(validationError(`${path}.actualValue`, "number, string, or null", item.actualValue, "Requirement actualValue must be a scalar value or null."));
    }
    validateTextOrNull(`${path}.actualDisplay`, item.actualDisplay, 120, errors);
    validateTextOrNull(`${path}.unit`, item.unit, 60, errors);
    validateTextOrNull(`${path}.evaluationNote`, item.evaluationNote, 220, errors);
    if (!REQUIREMENT_STATUSES.has(item.status)) {
      errors.push(validationError(`${path}.status`, [...REQUIREMENT_STATUSES].join(", "), item.status, "Requirement status is invalid."));
    }
    if (item.status === "PARTIALLY_PASSED") {
      if (!Number.isFinite(item.partialCreditPct) || item.partialCreditPct < 0 || item.partialCreditPct > 100) {
        errors.push(validationError(`${path}.partialCreditPct`, "number from 0 to 100", item.partialCreditPct, "PARTIALLY_PASSED requires partialCreditPct."));
      }
    } else if (item.partialCreditPct !== null) {
      errors.push(validationError(`${path}.partialCreditPct`, "null unless status is PARTIALLY_PASSED", item.partialCreditPct, "partialCreditPct is only valid for PARTIALLY_PASSED."));
    }
    const sourceRequired = item.actualValue !== null || item.status !== "NOT_REPORTED";
    validateSourceReference(`${path}.sourceId`, item.sourceId, sourceIds, errors, { required: sourceRequired });
  });
  validateUniqueValues("requirements.id", ids, errors);
}

function validateQuarterlyAssessment(value, errors) {
  if (value === null) return;
  if (!isPlainObject(value)) {
    errors.push(validationError("requirementsAssessment", "object or null", value, "requirementsAssessment must be an object or null."));
    return;
  }
  validateExactFields("requirementsAssessment", value, ASSESSMENT_FIELDS, errors);
  validateRequiredFields("requirementsAssessment", value, ASSESSMENT_FIELDS, errors);
  if (value.weightedAchievement !== null
    && (!Number.isFinite(value.weightedAchievement) || value.weightedAchievement < 0 || value.weightedAchievement > 100)) {
    errors.push(validationError("requirementsAssessment.weightedAchievement", "number from 0 to 100 or null", value.weightedAchievement, "weightedAchievement is invalid."));
  }
  for (const field of ASSESSMENT_COUNT_FIELDS) {
    if (value[field] !== null && (!Number.isInteger(value[field]) || value[field] < 0)) {
      errors.push(validationError(`requirementsAssessment.${field}`, "non-negative integer or null", value[field], `${field} is invalid.`));
    }
  }
  validateTextOrNull("requirementsAssessment.overallStatus", value.overallStatus, 120, errors);
  validateTextOrNull("requirementsAssessment.summary", value.summary, 400, errors);
  if (value.overallStatus !== null && !REQUIREMENT_OVERALL_STATUSES.has(value.overallStatus)) {
    errors.push(validationError("requirementsAssessment.overallStatus", [...REQUIREMENT_OVERALL_STATUSES].join(", "), value.overallStatus, "requirementsAssessment.overallStatus is invalid."));
  }
  if (Number.isInteger(value.notReported) && value.notReported > 0 && value.overallStatus !== "INCOMPLETE") {
    errors.push(validationError("requirementsAssessment.overallStatus", "INCOMPLETE when notReported is greater than zero", value.overallStatus, "overallStatus must be INCOMPLETE while requirements remain unreported."));
  }
  if (value.notReported === 0 && value.overallStatus === "INCOMPLETE") {
    errors.push(validationError("requirementsAssessment.overallStatus", "a completed status when notReported is zero", value.overallStatus, "overallStatus cannot be INCOMPLETE when every requirement is reported."));
  }
}

function validateQuarterlySources(items, errors) {
  const ids = new Set();
  if (!Array.isArray(items)) {
    errors.push(validationError("sources", "array with 1 to 5 sources", items, "sources must be an array."));
    return ids;
  }
  if (items.length < 1 || items.length > 5) {
    errors.push(validationError("sources", "1 to 5 quarter-specific sources", items.length, "Quarterly JSON requires 1 to 5 sources."));
  }
  const allIds = [];
  items.forEach((item, index) => {
    const path = `sources.${index}`;
    if (!isPlainObject(item)) {
      errors.push(validationError(path, "source object", item, "Source must be an object."));
      return;
    }
    validateExactFields(path, item, SOURCE_FIELDS, errors);
    validateRequiredFields(path, item, SOURCE_FIELDS, errors);
    validateRequiredText(`${path}.id`, item.id, 60, errors);
    validateRequiredText(`${path}.title`, item.title, 180, errors);
    allIds.push(item.id);
    if (!QUARTERLY_SOURCE_TYPES.has(item.sourceType)) {
      errors.push(validationError(`${path}.sourceType`, [...QUARTERLY_SOURCE_TYPES].join(", "), item.sourceType, "Quarterly sourceType is invalid."));
    }
    if (!validIsoDateOnly(item.date)) {
      errors.push(validationError(`${path}.date`, "real ISO date in YYYY-MM-DD format", item.date, "Source date is invalid."));
    }
    if (item.url === null) {
      if (item.sourceType !== "User-provided earnings materials") {
        errors.push(validationError(`${path}.url`, "https URL", item.url, "Only user-provided earnings materials may omit the source URL."));
      }
    } else if (!validHttpsUrl(item.url)) {
      errors.push(validationError(`${path}.url`, "valid https URL or null for user materials", item.url, "Source URL is invalid."));
    }
    if (!Array.isArray(item.usedFor) || !item.usedFor.length || item.usedFor.some((entry) => !hasText(entry))) {
      errors.push(validationError(`${path}.usedFor`, "non-empty array of supported claims", item.usedFor, "Source usedFor must be a non-empty string array."));
    }
  });
  validateUniqueValues("sources.id", allIds, errors);
  for (const id of allIds) if (hasText(id)) ids.add(id);
  return ids;
}

function validateQuarterlyContext(value, currentReport, errors) {
  if (!isPlainObject(currentReport)) return;
  const expectedTicker = normalizeTicker(currentReport.company?.ticker);
  if (expectedTicker && normalizeTicker(value.ticker) !== expectedTicker) {
    errors.push(validationError("ticker", expectedTicker, value.ticker, "Quarterly ticker does not match the opened report."));
  }
  const requirementBlock = currentReport.priceTargetRequirements || {};
  const expectedSetId = trimText(requirementBlock.requirementSetId, 160);
  if ((value.requirementSetId ?? null) !== (expectedSetId ?? null)) {
    errors.push(validationError("requirementSetId", expectedSetId, value.requirementSetId, "requirementSetId must match the frozen requirement set on the opened report."));
  }
  const definitions = Array.isArray(requirementBlock.requirements) ? requirementBlock.requirements : [];
  const results = Array.isArray(value.requirements) ? value.requirements : [];
  const expectedIds = definitions.map((item) => String(item?.id || "").trim()).filter(Boolean);
  const incomingIds = results.map((item) => String(item?.id || "").trim()).filter(Boolean);
  for (const id of expectedIds) {
    if (incomingIds.filter((candidate) => candidate === id).length !== 1) {
      errors.push(validationError("requirements", `exactly one result for frozen requirement ${id}`, incomingIds, `Missing or duplicate frozen requirement id ${id}.`));
    }
  }
  for (const id of incomingIds) {
    if (!expectedIds.includes(id)) {
      errors.push(validationError("requirements", `only frozen ids: ${expectedIds.join(", ") || "none"}`, id, `Unknown requirement id ${id} cannot be added by a quarterly update.`));
    }
  }
  for (const definition of definitions) {
    const definitionId = String(definition?.id || "").trim();
    const result = results.find((item) => String(item?.id || "").trim() === definitionId);
    if (!result) continue;
    if (normalizeUnit(result.unit) !== normalizeUnit(definition.unit)) {
      errors.push(validationError(`requirements.${definitionId}.unit`, definition.unit ?? null, result.unit, `Requirement ${definitionId} must preserve its frozen unit.`));
    }
    validateRequirementDirection(definition, result, errors);
  }
  if (errors.length) return;
  try {
    const requirements = mergeLiteRequirementResults(definitions, results, { strict: true });
    validateQuarterlyAssessmentIntegrity({
      reportPeriod: `${normalizeQuarter(value.quarter)} ${value.year}`,
      targetPeriod: requirementBlock.targetQuarter || requirementBlock.earningsPeriod || null,
      requirements,
      requirementsAssessment: value.requirementsAssessment
    });
  } catch (error) {
    errors.push(validationError("requirementsAssessment", "assessment consistent with frozen requirement weights and statuses", value.requirementsAssessment, error.message));
  }
}

export function buildQuarterlyEarningsLitePrompt(report = {}, options = {}) {
  const ticker = String(report.company?.ticker || "").trim().toUpperCase();
  const companyName = report.company?.name || ticker || "-";
  const quarter = Number(options.quarter);
  const year = Number(options.year);
  const period = Number.isInteger(quarter) && quarter >= 1 && quarter <= 4 && Number.isInteger(year)
    ? `Q${quarter} ${year}`
    : String(report.priceTargetRequirements?.earningsPeriod || report.reportPeriod || "").trim();
  const earningsText = stripQuarterContext(options.earningsText || "");
  const requirementBlock = report.priceTargetRequirements || {};
  const requirements = compactRequirements(requirementBlock.requirements || []);
  const currentThesis = trimText(report.thesis?.shortSummary, 520);
  const targetQuarter = normalizeFiscalQuarterPeriod(requirementBlock.targetQuarter || requirementBlock.earningsPeriod)
    || trimText(requirementBlock.targetQuarter || requirementBlock.earningsPeriod, 40);
  const template = {
    schemaVersion: QUARTERLY_EARNINGS_LITE_SCHEMA,
    ticker: ticker || null,
    quarter: Number.isInteger(quarter) ? `Q${quarter}` : null,
    year: Number.isInteger(year) ? year : null,
    reportDate: "YYYY-MM-DD",
    requirementSetId: requirementBlock.requirementSetId || null,
    summary: "ملخص من سطر أو سطرين فقط",
    metrics: {
      revenue: metricTemplate(),
      revenueGrowthPct: metricTemplate(),
      eps: metricTemplate(),
      grossMarginPct: metricTemplate(),
      operatingMarginPct: metricTemplate(),
      freeCashFlow: metricTemplate(),
      cash: metricTemplate(),
      debt: metricTemplate()
    },
    companyKpis: [
      { name: "KPI مهم خاص بالشركة عند الحاجة", ...metricTemplate() }
    ],
    guidance: [
      { topic: "", currentGuidance: "", direction: "raised|maintained|lowered|new|not_applicable", interpretation: "جملة قصيرة", sourceId: null }
    ],
    forwardOutlook: {
      growthOutlook: "accelerating|stable|slowing|unclear",
      marginOutlook: "improving|stable|pressured|unclear",
      guidanceTrend: "raised|maintained|lowered|mixed|new|not_reported",
      managementTone: "positive|neutral|cautious|mixed|unclear",
      thesisImpact: "supports|neutral|weakens|unclear",
      summary: null
    },
    requirements: requirements.map((item) => ({
      id: item.id,
      actualValue: null,
      actualDisplay: null,
      unit: item.unit,
      status: "NOT_REPORTED",
      partialCreditPct: null,
      evaluationNote: "جملة قصيرة",
      sourceId: null
    })),
    requirementsAssessment: {
      weightedAchievement: null,
      reportedRequirements: null,
      totalRequirements: null,
      passed: null,
      failed: null,
      exceeded: null,
      partiallyPassed: null,
      notReported: null,
      overallStatus: null,
      summary: null
    },
    highlights: ["حد أقصى 3 نقاط"],
    concerns: ["حد أقصى نقطتان"],
    sources: [
      {
        id: "S1",
        title: "اسم المصدر",
        url: "https://... أو null لمواد المستخدم فقط",
        sourceType: "Investor Relations|SEC|Earnings Call|Consensus Data|User-provided earnings materials",
        date: "YYYY-MM-DD",
        usedFor: ["revenue", "eps", "guidance", "requirements"]
      }
    ]
  };

  return [
    `اقرأ إعلان أرباح ${companyName} (${ticker || "-"}) للربع ${period} قراءة سريعة ومختصرة فقط.`,
    "",
    "المطلوب:",
    "- ركز فقط على ما يهم هذا الربع: Revenue، EPS، الهوامش المهمة، FCF/السيولة عند أهميتها، KPIs الخاصة بالشركة، Guidance، ومدى تحقق المتطلبات السابقة.",
    "- أضف Forward Outlook مختصرًا فقط إذا كان الإعلان أو Guidance أو تعليق الإدارة يعطي معلومات مستقبلية حقيقية عن النمو أو الهوامش أو الطلب أو القدرة أو التنفيذ.",
    "- Forward Outlook ليس تقييمًا جديدًا للسهم: لا تغيّر Fair Value ولا تصدر توصية جديدة. thesisImpact يقيس فقط هل هذا الربع يدعم فرضية الاستثمار الحالية أو يضعفها.",
    "- إذا لم توجد معلومات مستقبلية كافية، استخدم unclear / not_reported واجعل forwardOutlook.summary = null بدل الاستنتاج أو التخمين.",
    "- إذا كانت فرضية الاستثمار الحالية غير متوفرة أدناه، اجعل thesisImpact = unclear ولا تنشئ فرضية جديدة.",
    "- استخدم المصادر الرسمية للشركة وSEC أولًا إذا لم يرفق المستخدم نص الإعلان.",
    "- لا تخترع أي رقم؛ استخدم null عند عدم التوفر.",
    "- value وconsensusValue أرقام فقط وبنفس unit وaccountingBasis. لا تضع عملة أو فاصلة أو علامة % داخل الحقول الرقمية.",
    "- accountingBasis يجب أن يكون GAAP أو NON_GAAP أو REPORTED أو NOT_APPLICABLE. لا تقارن EPS أو هامشًا بأساس محاسبي مختلف.",
    "- BEAT يعني value > consensusValue، وMISS يعني value < consensusValue، وINLINE يعني التساوي الرقمي. إذا غاب أحد الرقمين استخدم NA.",
    "- كل رقم فعلي يحتاج sourceId، وكل consensusValue يحتاج consensusSourceId، ويجب أن يطابقا sources[].id.",
    "- اجعل summary من سطر أو سطرين، highlights بحد أقصى 3، concerns بحد أقصى 2، companyKpis بحد أقصى 4، guidance بحد أقصى 3، وforwardOutlook.summary بحد أقصى سطرين.",
    "- قارن فقط المتطلبات السابقة المرفقة أدناه، ولا تنشئ متطلبات جديدة.",
    "- انسخ unit لكل متطلب كما هو دون تغيير؛ actualValue يجب أن يستخدم هذه الوحدة نفسها.",
    "- عند وصول الربع المستهدف، أرسل requirementsAssessment كما حسبته أنت من التحليل: لا تترك weightedAchievement أو أعداد النتائج فارغة إذا كانت قابلة للتقييم.",
    "- أرسل القيم والحالات النهائية كما توصلت إليها؛ Franklin سيعيد تدقيق الأعداد وweightedAchievement مقابل الأوزان والحالات المجمدة.",
    "- اجعل reportedRequirements وtotalRequirements وأعداد PASSED/FAILED/EXCEEDED/PARTIALLY_PASSED/NOT_REPORTED مطابقة حرفيًا لحالات requirements؛ Franklin سيتحقق من الاتساق ويرفض الحفظ عند التعارض.",
    "- requirementsAssessment.overallStatus يجب أن يكون EXCEEDED أو PASSED أو MIXED أو FAILED أو INCOMPLETE؛ استخدم INCOMPLETE إذا بقي أي متطلب NOT_REPORTED.",
    "- PARTIALLY_PASSED يتطلب partialCreditPct من 0 إلى 100؛ وفي جميع الحالات الأخرى يجب أن يكون partialCreditPct = null.",
    "- إذا كان المتطلب هدفًا لربع لاحق، سجّل actualValue/actualDisplay لهذا الربع فقط عندما يكون نفس الـKPI قابلًا للمقارنة، لكن أبقِ status = NOT_REPORTED حتى يصل الربع المستهدف؛ هذا Observation للتقدم وليس حكمًا نهائيًا.",
    "- قبل الربع المستهدف اجعل حقول requirementsAssessment = null، ولا تحوّل ملاحظة التقدم إلى نسبة إنجاز نهائية.",
    "- لا تستخدم رقم الربع الحالي بدل متطلب يذكر ربعًا مستقبليًا صراحةً؛ مثال: Q1 Net Sales لا يملأ متطلب Q3 Net Sales.",
    "- في evaluationNote وضّح باختصار أن القراءة الحالية ملاحظة تقدم إذا لم يصل الربع المستهدف بعد.",
    "",
    "ممنوع في هذه المهمة:",
    "- لا تعمل تحليل سهم كامل.",
    "- لا تعمل DCF أو Reverse DCF أو مضاعفات تقييم.",
    "- لا تحسب Fair Value جديدًا.",
    "- لا تصدر BUY/ADD/HOLD/WATCH/REDUCE/SELL جديدة.",
    "- لا تكتب Company Profile أو تحليل صناعة أو سيناريوهات أو Forecast طويل.",
    "- لا تعيد كتابة التقرير السابق.",
    "",
    "فرضية الاستثمار الحالية للمقارنة فقط:",
    currentThesis || "- غير متوفرة؛ لا تنشئ فرضية بديلة واجعل thesisImpact = unclear.",
    "",
    "الربع المستهدف للمتطلبات الحالية:",
    targetQuarter || "- غير محدد.",
    "",
    "المتطلبات السابقة التي يجب تقييمها فقط:",
    JSON.stringify(requirements),
    "",
    earningsText
      ? `مواد إعلان الأرباح المرفقة من المستخدم:\n${earningsText}`
      : "لا توجد مواد مرفقة. ابحث عن إعلان هذا الربع المحدد فقط من Investor Relations / SEC / Earnings Release ثم أكمل.",
    "",
    "[Franklin source provenance contract]",
    "- لا تنسخ مصادر التقرير السابق. أدرج فقط المصادر المستخدمة لنتائج هذا الربع، من مصدر واحد إلى 5 مصادر.",
    "- المصدر الرسمي أو مصدر Consensus يحتاج رابط https فعليًا. url = null مسموح فقط لمواد الأرباح التي ألصقها المستخدم.",
    "- اجعل source id فريدًا، وusedFor غير فارغ ويصف الأرقام أو الأقسام التي يدعمها المصدر.",
    "",
    `ROOT SCHEMA GATE — يجب أن يكون أول حقل بعد القوس الافتتاحي حرفيًا \"schemaVersion\": \"${QUARTERLY_EARNINGS_LITE_SCHEMA}\"، ولا تضع JSON داخل result أو report أو data أو response أو أي غلاف آخر.`,
    "أخرج JSON واحدًا فقط بدون Markdown أو شرح خارجي، وبنفس البنية التالية. احذف العناصر الفارغة من arrays، لكن لا تضف حقولًا جديدة:",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function inflateQuarterlyEarningsLitePayload(currentReport = {}, payload = {}, rawText = "", now = new Date()) {
  if (!isQuarterlyEarningsLitePayload(payload)) throw new Error("Unsupported quarterly earnings payload.");
  const validation = validateQuarterlyEarningsLitePayload(payload, currentReport);
  if (!validation.valid) throw new Error(validation.errors[0]?.message || "Quarterly earnings JSON failed validation.");
  const currentTicker = normalizeTicker(currentReport.company?.ticker);
  const incomingTicker = normalizeTicker(payload.ticker);
  if (!currentTicker || !incomingTicker || currentTicker !== incomingTicker) {
    throw new Error(`Ticker mismatch. Expected ${currentTicker || "-"}, received ${incomingTicker || "-"}.`);
  }
  const quarter = normalizeQuarter(payload.quarter);
  const year = Number(payload.year);
  if (!quarter || !Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Quarter/year are required for quarterly earnings lite JSON.");
  const reportPeriod = `${quarter} ${year}`;
  const reportDate = validDate(payload.reportDate) || now.toISOString().slice(0, 10);
  const metrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {};
  const requirementBlock = currentReport.priceTargetRequirements || {};
  const strict = payload.schemaVersion === QUARTERLY_EARNINGS_LITE_SCHEMA;
  const requirements = mergeLiteRequirementResults(requirementBlock.requirements, payload.requirements, { strict });
  const sources = normalizeLiteSources(payload.sources);
  const requirementsAssessment = payload.requirementsAssessment && typeof payload.requirementsAssessment === "object" && !Array.isArray(payload.requirementsAssessment)
    ? normalizeRequirementsAssessment(payload.requirementsAssessment)
    : null;
  validateQuarterlyAssessmentIntegrity({
    reportPeriod,
    targetPeriod: requirementBlock.targetQuarter || requirementBlock.earningsPeriod || null,
    requirements,
    requirementsAssessment
  });
  const summary = trimText(payload.summary, 400);
  const guidance = normalizeLiteGuidance(payload.guidance).slice(0, 3);
  const companyKpis = normalizeLiteKpis(payload.companyKpis).slice(0, 4);
  const forwardOutlook = normalizeQuarterlyForwardOutlook(payload.forwardOutlook);
  const raw = String(rawText || JSON.stringify(payload));
  const currentMetadata = currentReport.metadata || {};
  const baseAnalysisId = currentMetadata.baseAnalysisId || currentReport.id || null;
  const baseAnalysisDate = currentMetadata.baseAnalysisDate || currentReport.analysisDate || null;
  const baseReportPeriod = normalizeFiscalQuarterPeriodOrOriginal(
    currentMetadata.baseReportPeriod || currentReport.reportPeriod
  );
  const valuationAsOfDate = currentMetadata.valuationAsOfDate || baseAnalysisDate;
  const decisionAsOfDate = currentMetadata.decisionAsOfDate || baseAnalysisDate;

  return {
    ...currentReport,
    id: null,
    analysisDate: reportDate,
    reportPeriod,
    financialHighlights: {
      revenue: metricNumber(metrics.revenue),
      revenueGrowthPct: metricNumber(metrics.revenueGrowthPct),
      operatingIncome: null,
      operatingIncomeGrowthPct: null,
      operatingMarginPct: metricNumber(metrics.operatingMarginPct),
      epsReported: metricNumber(metrics.eps),
      epsNormalized: null,
      operatingCashFlow: null,
      freeCashFlow: metricNumber(metrics.freeCashFlow),
      capex: null,
      cash: metricNumber(metrics.cash),
      debt: metricNumber(metrics.debt)
    },
    growthHighlights: {
      revenueGrowth: metricDisplay(metrics.revenueGrowthPct),
      epsGrowth: null,
      fcfGrowth: null,
      majorSegmentGrowth: null,
      marginTrend: metricDisplay(metrics.grossMarginPct) || metricDisplay(metrics.operatingMarginPct),
      marketShareTrend: null,
      tamComment: null
    },
    earningsQuality: {
      ...(currentReport.earningsQuality || {}),
      reportedVsNormalizedExplanation: summary || currentReport.earningsQuality?.reportedVsNormalizedExplanation || null
    },
    guidance,
    companySpecificKpis: enrichMetricsAsKpis(companyKpis, metrics),
    sources,
    catalysts: currentReport.catalysts || [],
    risks: currentReport.risks || [],
    supplements: upsertQuarterlyForwardOutlookSupplement(currentReport.supplements, reportPeriod, forwardOutlook),
    previousRequirementsEvaluation: {
      requirementSetId: strict
        ? (requirementBlock.requirementSetId || null)
        : (payload.requirementSetId || requirementBlock.requirementSetId || null),
      ticker: currentTicker,
      earningsPeriod: reportPeriod,
      createdAt: requirementBlock.createdAt || null,
      createdFromAnalysisId: requirementBlock.createdFromAnalysisId || currentReport.id || null,
      targetValue: requirementBlock.targetValue ?? null,
      targetScenario: requirementBlock.targetScenario || null,
      targetDescription: requirementBlock.targetDescription || null,
      summary: summary || null,
      matchType: "quarterly_earnings_lite",
      previousQuarter: normalizeFiscalQuarterPeriodOrOriginal(requirementBlock.previousQuarter),
      targetQuarter: normalizeFiscalQuarterPeriodOrOriginal(
        requirementBlock.targetQuarter || requirementBlock.earningsPeriod || reportPeriod
      ),
      requirements,
      requirementsAssessment
    },
    requirementsAssessment,
    rawAnalysis: raw,
    rawAnalysisOriginal: raw,
    metadata: {
      ...currentMetadata,
      importedAt: null,
      updatedAt: null,
      rawHash: null,
      importMethod: "quarterly_earnings_lite",
      analysisScope: "quarterly_earnings_update",
      analysisType: null,
      franklinV3Report: null,
      franklinV3: null,
      baseAnalysisId,
      baseAnalysisDate,
      baseReportPeriod,
      earningsReportDate: reportDate,
      valuationAsOfDate,
      decisionAsOfDate,
      quarterlySourcesProvided: sources.length > 0,
      quarterlySourceCount: sources.length,
      quarterlySourcesCapturedAt: sources.length ? validTimestamp(now) : null
    }
  };
}

export function validateQuarterlyAssessmentIntegrity({
  reportPeriod,
  targetPeriod,
  requirements = [],
  requirementsAssessment = null
} = {}) {
  const reportQuarter = normalizeFiscalQuarterPeriod(reportPeriod);
  const targetQuarter = normalizeFiscalQuarterPeriod(targetPeriod);
  const items = Array.isArray(requirements) ? requirements : [];
  const counts = requirementStatusCounts(items);
  const atTarget = Boolean(reportQuarter && targetQuarter && reportQuarter === targetQuarter);
  const beforeOrDifferentTarget = Boolean(reportQuarter && targetQuarter && reportQuarter !== targetQuarter);

  if (beforeOrDifferentTarget) {
    if (counts.reported > 0) {
      throw new Error(`Quarterly requirement statuses must remain NOT_REPORTED before the target quarter (${targetQuarter}).`);
    }
    if (hasMaterialAssessment(requirementsAssessment)) {
      throw new Error(`requirementsAssessment must remain null before the target quarter (${targetQuarter}).`);
    }
    return true;
  }

  if (!atTarget || counts.reported === 0) return true;
  if (!requirementsAssessment || !hasMaterialAssessment(requirementsAssessment)) {
    throw new Error("requirementsAssessment is required when the target quarter contains reported requirement results.");
  }

  if (!Number.isFinite(requirementsAssessment.weightedAchievement)
    || requirementsAssessment.weightedAchievement < 0
    || requirementsAssessment.weightedAchievement > 100) {
    throw new Error("requirementsAssessment.weightedAchievement must be a number between 0 and 100 at the target quarter.");
  }
  for (const field of ASSESSMENT_COUNT_FIELDS) {
    if (!Number.isInteger(requirementsAssessment[field]) || requirementsAssessment[field] < 0) {
      throw new Error(`requirementsAssessment.${field} must be a non-negative integer at the target quarter.`);
    }
  }
  if (!trimText(requirementsAssessment.overallStatus, 120)) {
    throw new Error("requirementsAssessment.overallStatus is required at the target quarter.");
  }
  if (!trimText(requirementsAssessment.summary, 400)) {
    throw new Error("requirementsAssessment.summary is required at the target quarter.");
  }

  const expected = {
    totalRequirements: counts.total,
    reportedRequirements: counts.reported,
    passed: counts.passed,
    failed: counts.failed,
    exceeded: counts.exceeded,
    partiallyPassed: counts.partiallyPassed,
    notReported: counts.notReported
  };
  for (const [field, value] of Object.entries(expected)) {
    if (requirementsAssessment[field] !== value) {
      throw new Error(`requirementsAssessment.${field} (${requirementsAssessment[field]}) does not match requirement statuses (${value}).`);
    }
  }

  const weights = items.map((item) => item?.weight);
  if (weights.length && weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Quarterly requirement definitions must preserve valid non-negative weights.");
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length && Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Quarterly requirement weights must total 100; received ${totalWeight}.`);
  }
  const partialCreditsValid = items.every((item) => {
    const status = String(item?.status || "NOT_REPORTED").trim().toUpperCase();
    return status !== "PARTIALLY_PASSED"
      || (Number.isFinite(item?.partialCreditPct) && item.partialCreditPct >= 0 && item.partialCreditPct <= 100);
  });
  if (weights.length && partialCreditsValid) {
    const earnedWeight = items.reduce((sum, item) => {
      const status = String(item?.status || "NOT_REPORTED").trim().toUpperCase();
      const weight = Number(item?.weight) || 0;
      if (status === "PASSED" || status === "EXCEEDED") return sum + weight;
      if (status === "PARTIALLY_PASSED") return sum + (weight * item.partialCreditPct / 100);
      return sum;
    }, 0);
    const expectedAchievement = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
    if (!numbersWithin(requirementsAssessment.weightedAchievement, expectedAchievement, 0.1)) {
      throw new Error(`requirementsAssessment.weightedAchievement (${requirementsAssessment.weightedAchievement}) does not match frozen weights and statuses (${roundNumber(expectedAchievement)}).`);
    }
  }
  return true;
}

function compactRequirements(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id || null,
    name: item.name || item.arabicName || item.metric || null,
    metric: item.metric || item.name || null,
    type: item.type || null,
    requiredValue: item.requiredValue ?? null,
    unit: item.unit || null,
    weight: Number.isFinite(item.weight) ? item.weight : null
  })).filter((item) => item.id || item.name || item.metric);
}

function metricTemplate() {
  return {
    value: null,
    display: null,
    consensusValue: null,
    consensusDisplay: null,
    unit: null,
    accountingBasis: null,
    result: "NA",
    sourceId: null,
    consensusSourceId: null
  };
}

function stripQuarterContext(value) {
  return String(value || "")
    .replace(/^\[Selected quarter:[^\]]+\]\s*/i, "")
    .replace(/^Quarter context:[^\n]*\n?/i, "")
    .replace(/^Paste the earnings release \/ 10-Q excerpts \/ management commentary below:\s*/i, "")
    .trim();
}

function normalizeLiteRequirement(item = {}) {
  const status = String(item.status || "NOT_REPORTED").trim().toUpperCase();
  return {
    id: item.id || null,
    actualValue: item.actualValue ?? null,
    actualDisplay: trimText(item.actualDisplay, 120),
    ...(Object.hasOwn(item, "unit") ? { unit: trimText(item.unit, 60) } : {}),
    actualRaw: null,
    direction: "unknown",
    impact: "unknown",
    status: REQUIREMENT_STATUSES.has(status) ? status : "NOT_REPORTED",
    partialCreditPct: Number.isFinite(item.partialCreditPct) ? item.partialCreditPct : null,
    evaluationNote: trimText(item.evaluationNote, 220),
    sourceId: trimText(item.sourceId, 60)
  };
}

function mergeLiteRequirementResults(definitionsInput, resultsInput, options = {}) {
  const definitions = Array.isArray(definitionsInput) ? definitionsInput : [];
  const results = (Array.isArray(resultsInput) ? resultsInput : []).map(normalizeLiteRequirement);
  if (!definitions.length) return options.strict ? [] : results;

  const used = new Set();
  const merged = definitions.map((definition, index) => {
    const matchIndex = results.findIndex((result, resultIndex) => !used.has(resultIndex) && requirementsMatch(definition, result));
    const result = matchIndex >= 0 ? results[matchIndex] : normalizeLiteRequirement({ id: definition.id || `requirement_${index + 1}` });
    if (matchIndex >= 0) used.add(matchIndex);
    return {
      ...definition,
      ...result,
      id: definition.id || result.id || `requirement_${index + 1}`
    };
  });

  if (!options.strict) {
    results.forEach((result, index) => {
      if (!used.has(index)) merged.push(result);
    });
  }
  return merged;
}

function requirementsMatch(definition = {}, result = {}) {
  const definitionKeys = requirementKeys(definition);
  const resultKeys = requirementKeys(result);
  return resultKeys.some((key) => definitionKeys.includes(key));
}

function requirementKeys(item = {}) {
  return [item.id, item.metric, item.name, item.arabicName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizeLiteGuidance(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const direction = String(item?.direction || "not_applicable").trim().toLowerCase();
    return {
      topic: trimText(item?.topic, 80),
      arabicTopic: null,
      currentGuidance: trimText(item?.currentGuidance, 140),
      previousGuidance: null,
      direction: GUIDANCE_DIRECTIONS.has(direction) ? direction : "not_applicable",
      type: null,
      interpretation: trimText(item?.interpretation, 220),
      importance: null,
      sourceId: trimText(item?.sourceId, 60)
    };
  }).filter((item) => item.topic || item.currentGuidance || item.interpretation);
}

function normalizeLiteKpis(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: trimText(item?.name, 100),
    arabicName: null,
    category: "quarterly",
    currentValue: trimText(item?.display ?? item?.actualDisplay, 120),
    unit: trimText(item?.unit, 60),
    trend: "unknown",
    importance: "high",
    interpretation: normalizeResultText(item?.result),
    sourceId: trimText(item?.sourceId, 60)
  })).filter((item) => item.name || item.currentValue);
}

function normalizeLiteSources(items) {
  return (Array.isArray(items) ? items : []).slice(0, 5).map((item) => ({
    id: trimText(item?.id, 60),
    title: trimText(item?.title, 180),
    url: trimText(item?.url, 500),
    sourceType: trimText(item?.sourceType, 100),
    date: validDate(item?.date),
    usedFor: (Array.isArray(item?.usedFor) ? item.usedFor : [])
      .map((value) => trimText(value, 100))
      .filter(Boolean)
  })).filter((item) => item.id || item.title || item.sourceType);
}

function enrichMetricsAsKpis(items, metrics) {
  const result = [...items];
  const grossMargin = metricDisplay(metrics.grossMarginPct);
  if (grossMargin && !result.some((item) => /gross margin/i.test(item.name || ""))) {
    result.push({ name: "Gross Margin", arabicName: "الهامش الإجمالي", category: "quarterly", currentValue: grossMargin, unit: "%", trend: "unknown", importance: "high", interpretation: normalizeResultText(metrics.grossMarginPct?.result) });
  }
  return result.slice(0, 5);
}

function normalizeResultText(value) {
  const clean = String(value || "NA").trim().toUpperCase();
  if (clean === "BEAT") return "أفضل من المتوقع";
  if (clean === "MISS") return "أقل من المتوقع";
  if (clean === "INLINE") return "متوافق مع المتوقع";
  return null;
}

function requirementStatusCounts(items = []) {
  const counts = {
    total: items.length,
    reported: 0,
    passed: 0,
    failed: 0,
    exceeded: 0,
    partiallyPassed: 0,
    notReported: 0
  };
  for (const item of items) {
    const status = String(item?.status || "NOT_REPORTED").trim().toUpperCase();
    if (status === "PASSED") counts.passed += 1;
    else if (status === "FAILED") counts.failed += 1;
    else if (status === "EXCEEDED") counts.exceeded += 1;
    else if (status === "PARTIALLY_PASSED") counts.partiallyPassed += 1;
    else counts.notReported += 1;
  }
  counts.reported = counts.total - counts.notReported;
  return counts;
}

function hasMaterialAssessment(value) {
  if (!value || typeof value !== "object") return false;
  return value.weightedAchievement !== null
    || ASSESSMENT_COUNT_FIELDS.some((field) => value[field] !== null)
    || Boolean(trimText(value.overallStatus, 120))
    || Boolean(trimText(value.summary, 400));
}

function metricNumber(item) {
  return Number.isFinite(item?.value) ? item.value : null;
}

function metricDisplay(item) {
  return trimText(item?.display, 120);
}

function trimText(value, maxLength = 240) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean) ? clean : null;
}

function normalizeQuarter(value) {
  const match = String(value || "").trim().toUpperCase().match(/^Q([1-4])$/);
  return match ? `Q${match[1]}` : null;
}

function validDate(value) {
  const text = String(value || "").trim();
  if (!validIsoDate(text)) return null;
  return text.slice(0, 10);
}

function validTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validIsoDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function validIsoDate(value) {
  const text = String(value || "").trim();
  if (validIsoDateOnly(text)) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return false;
  if (!validIsoDateOnly(text.slice(0, 10))) return false;
  return !Number.isNaN(new Date(text).getTime());
}

function validHttpsUrl(value) {
  if (!hasText(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function validateExactFields(path, value, allowed, errors) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(validationError(joinPath(path, key), `only fields: ${[...allowed].join(", ")}`, value[key], `Unknown property ${joinPath(path, key)}.`));
    }
  }
}

function validateRequiredFields(path, value, required, errors) {
  if (!isPlainObject(value)) return;
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      errors.push(validationError(joinPath(path, key), "required field", undefined, `Missing required property ${joinPath(path, key)}.`));
    }
  }
}

function validateRequiredText(path, value, maxLength, errors) {
  if (!hasText(value) || String(value).trim().length > maxLength) {
    errors.push(validationError(path, `non-empty string up to ${maxLength} characters`, value, `${path} must be concise non-empty text.`));
  }
}

function validateTextOrNull(path, value, maxLength, errors) {
  if (value === null) return;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    errors.push(validationError(path, `string up to ${maxLength} characters or null`, value, `${path} must be text or null.`));
  }
}

function validateNumberOrNull(path, value, errors) {
  if (value !== null && !Number.isFinite(value)) {
    errors.push(validationError(path, "finite JSON number or null", value, `${path} must be numeric or null.`));
  }
}

function validateSourceReference(path, value, sourceIds, errors, options = {}) {
  if (!hasText(value)) {
    if (options.required) errors.push(validationError(path, "source id from sources[]", value, `${path} is required.`));
    return;
  }
  if (!sourceIds.has(value)) errors.push(validationError(path, "id from sources[]", value, `${path} must reference sources[].id.`));
}

function validateUniqueValues(path, values, errors) {
  const seen = new Set();
  for (const value of values) {
    if (!hasText(value)) continue;
    if (seen.has(value)) errors.push(validationError(path, "unique non-empty values", value, `${path} contains duplicate value ${value}.`));
    seen.add(value);
  }
}

function validateStringList(path, value, maxItems, maxLength, errors) {
  if (!Array.isArray(value)) {
    errors.push(validationError(path, "array", value, `${path} must be an array.`));
    return;
  }
  if (value.length > maxItems) errors.push(validationError(path, `at most ${maxItems} items`, value.length, `${path} exceeds its item limit.`));
  value.forEach((item, index) => validateRequiredText(`${path}.${index}`, item, maxLength, errors));
}

function comparisonResult(actual, consensus) {
  const tolerance = Math.max(1e-9, Math.abs(consensus) * 1e-9);
  if (Math.abs(actual - consensus) <= tolerance) return "INLINE";
  return actual > consensus ? "BEAT" : "MISS";
}

function validateRequirementDirection(definition, result, errors) {
  const required = definition?.requiredValue;
  const actual = result?.actualValue;
  const type = String(definition?.type || "").trim().toLowerCase();
  if (!Number.isFinite(required) || actual === null || actual === undefined || !["minimum", "maximum"].includes(type)) return;
  if (!Number.isFinite(actual)) {
    errors.push(validationError(`requirements.${definition.id}.actualValue`, "finite JSON number in the frozen unit", actual, `Numeric requirement ${definition.id} needs a numeric actualValue.`));
    return;
  }
  const thresholdMet = type === "minimum" ? actual >= required : actual <= required;
  const thresholdExceeded = type === "minimum" ? actual > required : actual < required;
  const status = String(result.status || "").trim().toUpperCase();
  if (thresholdMet && status === "FAILED") {
    errors.push(validationError(`requirements.${definition.id}.status`, "PASSED, EXCEEDED, PARTIALLY_PASSED, or NOT_REPORTED", status, `Requirement ${definition.id} is marked FAILED even though its numeric threshold is met.`));
  }
  if (!thresholdMet && ["PASSED", "EXCEEDED"].includes(status)) {
    errors.push(validationError(`requirements.${definition.id}.status`, "FAILED, PARTIALLY_PASSED, or NOT_REPORTED", status, `Requirement ${definition.id} is marked ${status} even though its numeric threshold is not met.`));
  }
  if (status === "EXCEEDED" && thresholdMet && !thresholdExceeded) {
    errors.push(validationError(`requirements.${definition.id}.status`, "PASSED when actualValue only equals the threshold", status, `Requirement ${definition.id} is marked EXCEEDED without exceeding its numeric threshold.`));
  }
}

function normalizeUnit(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function validationResult(errors) {
  return { valid: errors.length === 0, errors, warnings: [] };
}

function validationError(field, expected, received, message) {
  const normalizedField = field === "$" ? "$" : String(field || "").replace(/^\$\.?/, "");
  return {
    field: normalizedField,
    jsonPath: normalizedField === "$" ? "$" : `$.${normalizedField}`,
    expected,
    received,
    receivedType: jsonType(received),
    message
  };
}

function jsonType(value) {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function joinPath(path, key) {
  return path === "$" ? key : `${path}.${key}`;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isScalarOrNull(value) {
  return value === null || typeof value === "string" || Number.isFinite(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function numbersWithin(left, right, tolerance) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}
