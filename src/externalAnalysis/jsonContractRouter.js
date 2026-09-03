import {
  FAIR_VALUE_ANALYSIS_SCHEMA_VERSION,
  LEGACY_FAIR_VALUE_ANALYSIS_SCHEMA_VERSION
} from "./fairValueAdapter.js";
import { validateExternalAnalysisReport } from "./externalAnalysisSchemaValidator.js";
import { normalizeExternalAnalysisReport } from "./schema.js";
import {
  EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION,
  normalizeExternalAnalysisSupplement
} from "./supplementSchema.js";
import { validateExternalAnalysisSupplement } from "./supplementValidator.js";
import { QUARTERLY_EARNINGS_LITE_SCHEMA } from "./quarterlyEarningsLite.js";
import { FRANKLIN_FAIR_VALUE_SCHEMA_VERSION } from "./v3Contract.js";
import { normalizeFranklinV3Input } from "./v3InputNormalizer.js";
import { validateFranklinV3Report } from "./v3Validator.js";

export const JSON_IMPORT_ROUTES = Object.freeze({
  FULL_ANALYSIS: "full-analysis",
  SUPPLEMENT: "supplement",
  QUARTERLY_EARNINGS: "quarterly-earnings",
  BACKUP: "backup"
});

export const SUPPORTED_JSON_CONTRACTS = Object.freeze([
  contract(FRANKLIN_FAIR_VALUE_SCHEMA_VERSION, "full-analysis", "full-analysis", false),
  contract(EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION, "missing-data-supplement", "supplement", false),
  contract(QUARTERLY_EARNINGS_LITE_SCHEMA, "quarterly-earnings-update", "quarterly-earnings", false),
  contract("external-analysis-report/v2", "canonical-analysis-export", "full-analysis", false),
  contract("external-analysis-report/v1", "legacy-analysis", "full-analysis", true),
  contract(FAIR_VALUE_ANALYSIS_SCHEMA_VERSION, "legacy-fair-value-analysis", "full-analysis", true),
  contract(LEGACY_FAIR_VALUE_ANALYSIS_SCHEMA_VERSION, "legacy-fair-value-analysis", "full-analysis", true),
  contract("franklin-investment-backup/v1", "investment-backup", "backup", false)
]);

const CONTRACT_BY_SCHEMA = new Map(SUPPORTED_JSON_CONTRACTS.map((item) => [item.schemaVersion, item]));
const SUPPLEMENT_TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "ticker",
  "targetAnalysisId",
  "analysisDate",
  "fields",
  "notes",
  "sources",
  "source",
  "sourceModel"
]);

export class JsonContractRoutingError extends Error {
  constructor(code, diagnostic) {
    const detail = formatArabicDiagnostic(diagnostic);
    super(detail);
    this.name = "JsonContractRoutingError";
    this.code = code;
    this.userMessage = detail;
    this.technicalDetails = diagnostic.technicalMessage || detail;
    this.importErrors = [diagnostic];
    this.diagnostic = diagnostic;
  }
}

export function detectJsonContract(value) {
  if (!isPlainObject(value)) {
    throw routingError("INVALID_JSON_ROOT", value, {
      field: "$",
      expected: "JSON object",
      received: jsonType(value),
      recommendedRoute: "استخدم كائن JSON واحدًا في مسار الاستيراد المناسب."
    });
  }
  if (!Object.hasOwn(value, "schemaVersion") || typeof value.schemaVersion !== "string" || !value.schemaVersion.trim()) {
    throw routingError("MISSING_SCHEMA", value, {
      field: "$.schemaVersion",
      expected: supportedSchemaText(),
      received: Object.hasOwn(value, "schemaVersion") ? value.schemaVersion : "غير موجود",
      recommendedRoute: routeRecommendation(detectPayloadType(value))
    });
  }
  const schemaVersion = value.schemaVersion.trim();
  const contractDefinition = CONTRACT_BY_SCHEMA.get(schemaVersion);
  if (!contractDefinition) {
    throw routingError("UNSUPPORTED_SCHEMA", value, {
      field: "$.schemaVersion",
      expected: supportedSchemaText(),
      received: schemaVersion,
      recommendedRoute: routeRecommendation(detectPayloadType(value))
    });
  }
  return contractDefinition;
}

export function dispatchJsonPayload(value, options = {}) {
  const contractDefinition = detectJsonContract(value);
  const intendedRoute = options.intendedRoute || "any";
  const context = options.context || {};
  let normalizedValue = value;
  let validation = { valid: true, errors: [], warnings: [] };

  if (contractDefinition.schemaVersion === FRANKLIN_FAIR_VALUE_SCHEMA_VERSION) {
    normalizedValue = normalizeFranklinV3Input(value);
    validation = validateFranklinV3Report(normalizedValue, context);
  } else if (contractDefinition.schemaVersion === EXTERNAL_ANALYSIS_SUPPLEMENT_SCHEMA_VERSION) {
    normalizedValue = normalizeExternalAnalysisSupplement(value, options.rawText || "", {
      now: options.now,
      ticker: options.existingReport?.company?.ticker,
      targetAnalysisId: options.existingReport?.id,
      analysisDate: options.existingReport?.analysisDate
    });
    validation = combineValidations(
      validateSupplementEnvelope(value),
      validateExternalAnalysisSupplement(normalizedValue, options.existingReport || {})
    );
  } else if (contractDefinition.schemaVersion === QUARTERLY_EARNINGS_LITE_SCHEMA) {
    validation = validateQuarterlyLiteEnvelope(value);
  } else if (contractDefinition.route === JSON_IMPORT_ROUTES.FULL_ANALYSIS) {
    normalizedValue = normalizeExternalAnalysisReport(value, options.rawText || "", { now: options.now });
    validation = validateExternalAnalysisReport(normalizedValue);
    const embeddedV3 = normalizedValue.metadata?.franklinV3Report;
    if (embeddedV3?.schemaVersion === FRANKLIN_FAIR_VALUE_SCHEMA_VERSION
      && (embeddedV3.analysisType === "INITIAL" || context.currentReport)) {
      validation = combineValidations(validation, validateFranklinV3Report(embeddedV3, context));
    }
  } else if (contractDefinition.route === JSON_IMPORT_ROUTES.BACKUP) {
    validation = validateBackupEnvelope(value);
  }

  return {
    contract: contractDefinition,
    schemaVersion: contractDefinition.schemaVersion,
    payloadType: contractDefinition.payloadType,
    route: contractDefinition.route,
    intendedRoute,
    action: routingAction(contractDefinition.route, intendedRoute),
    value: normalizedValue,
    validation,
    recommendedRoute: routeRecommendation(contractDefinition.payloadType)
  };
}

export function assertDispatchedPayloadValid(dispatched, sourceValue = dispatched?.value) {
  if (dispatched?.validation?.valid) return dispatched;
  const first = dispatched?.validation?.errors?.[0] || {};
  const field = first.jsonPath || (first.field ? `$.${first.field}` : "$.");
  throw routingError("CONTRACT_VALIDATION_FAILED", sourceValue, {
    field,
    expected: first.expected || expectedFromMessage(first.message),
    received: first.received !== undefined ? first.received : readPath(sourceValue, field),
    schemaVersion: dispatched?.schemaVersion,
    payloadType: dispatched?.payloadType,
    recommendedRoute: dispatched?.recommendedRoute,
    technicalMessage: dispatched?.validation?.errors?.map((item) => `${item.field || "$"}: ${item.message}`).join("\n")
  });
}

export function assertDispatchedRouteAccepted(dispatched, sourceValue = dispatched?.value) {
  if (dispatched?.action === "accept" || dispatched?.action === "redirect-to-supplement" || dispatched?.action === "extract-approved-missing-fields") return dispatched;
  throw routingError("WRONG_IMPORT_ROUTE", sourceValue, {
    field: "$.schemaVersion",
    expected: `مخطط يقبله مسار ${dispatched?.intendedRoute || "الاستيراد"}`,
    received: dispatched?.schemaVersion,
    schemaVersion: dispatched?.schemaVersion,
    payloadType: dispatched?.payloadType,
    recommendedRoute: dispatched?.recommendedRoute
  });
}

export function detectPayloadType(value = {}) {
  if (!isPlainObject(value)) return "non-object";
  if (isPlainObject(value.fields) || Object.hasOwn(value, "targetAnalysisId")) return "missing-data-supplement";
  if (isPlainObject(value.reportIdentity) || isPlainObject(value.valuation?.current) || isPlainObject(value.latestQuarter)) return "full-analysis";
  if (Object.hasOwn(value, "quarter") && Object.hasOwn(value, "year") && isPlainObject(value.metrics)) return "quarterly-earnings-update";
  if (isPlainObject(value.data) && (value.appName || value.exportedAt)) return "investment-backup";
  if (isPlainObject(value.fairValueSummary) || isPlainObject(value.company)) return "legacy-analysis";
  return "unknown-object";
}

export function supportedSchemaVersions() {
  return SUPPORTED_JSON_CONTRACTS.map((item) => item.schemaVersion);
}

export function formatArabicDiagnostic(diagnostic = {}) {
  const schema = diagnostic.schemaVersion || "غير معروف";
  const payloadType = diagnostic.payloadType || "غير معروف";
  return [
    `فشل التحقق من JSON عند المسار ${diagnostic.field || "$"}.`,
    `المخطط النشط/المستلم: ${schema}.`,
    `نوع الحمولة المكتشف: ${payloadType}.`,
    `المتوقع: ${display(diagnostic.expected)}.`,
    `المستلم: ${display(diagnostic.received)} (${diagnostic.receivedType || jsonType(diagnostic.received)}).`,
    `الإجراء المقترح: ${diagnostic.recommendedRoute || "راجع عقد JSON ثم أعد المحاولة."}`
  ].join(" ");
}

function validateSupplementEnvelope(value) {
  const errors = [];
  for (const key of Object.keys(value)) {
    if (!SUPPLEMENT_TOP_LEVEL_KEYS.has(key)) errors.push(validationError(key, "supported supplement property", value[key], `Unknown supplement property: ${key}.`));
  }
  if (!isPlainObject(value.fields)) errors.push(validationError("fields", "object of approved dotted paths", value.fields, "Supplement fields must be an object."));
  if (value.notes !== undefined && !Array.isArray(value.notes)) errors.push(validationError("notes", "array", value.notes, "Supplement notes must be an array."));
  if (value.sources !== undefined && !Array.isArray(value.sources)) errors.push(validationError("sources", "array", value.sources, "Supplement sources must be an array."));
  return { valid: errors.length === 0, errors, warnings: [] };
}

function validateQuarterlyLiteEnvelope(value) {
  const errors = [];
  if (!validTicker(value.ticker)) errors.push(validationError("ticker", "valid market ticker", value.ticker, "Quarterly ticker is required."));
  if (!/^Q[1-4]$/i.test(String(value.quarter || ""))) errors.push(validationError("quarter", "Q1, Q2, Q3, or Q4", value.quarter, "Quarter is invalid."));
  if (!Number.isInteger(value.year) || value.year < 2000 || value.year > 2100) errors.push(validationError("year", "integer from 2000 to 2100", value.year, "Fiscal year is invalid."));
  if (value.reportDate !== undefined && value.reportDate !== null && Number.isNaN(new Date(value.reportDate).getTime())) errors.push(validationError("reportDate", "valid ISO date", value.reportDate, "Report date is invalid."));
  if (!isPlainObject(value.metrics)) errors.push(validationError("metrics", "object", value.metrics, "Quarterly metrics must be an object."));
  for (const [key, metric] of Object.entries(isPlainObject(value.metrics) ? value.metrics : {})) {
    if (!isPlainObject(metric)) errors.push(validationError(`metrics.${key}`, "object", metric, "Quarterly metric must be an object."));
    if (metric?.result !== undefined && !["BEAT", "MISS", "INLINE", "NA"].includes(metric.result)) {
      errors.push(validationError(`metrics.${key}.result`, "BEAT, MISS, INLINE, or NA", metric.result, "Quarterly metric result is invalid."));
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

function validateBackupEnvelope(value) {
  const errors = [];
  if (!isPlainObject(value.data)) errors.push(validationError("data", "backup data object", value.data, "Backup data is missing."));
  return { valid: errors.length === 0, errors, warnings: [] };
}

function routingAction(actualRoute, intendedRoute) {
  if (intendedRoute === "any" || actualRoute === intendedRoute) return "accept";
  if (intendedRoute === JSON_IMPORT_ROUTES.FULL_ANALYSIS && actualRoute === JSON_IMPORT_ROUTES.QUARTERLY_EARNINGS) return "accept";
  if (intendedRoute === JSON_IMPORT_ROUTES.FULL_ANALYSIS && actualRoute === JSON_IMPORT_ROUTES.SUPPLEMENT) return "redirect-to-supplement";
  if (intendedRoute === JSON_IMPORT_ROUTES.SUPPLEMENT && actualRoute === JSON_IMPORT_ROUTES.FULL_ANALYSIS) return "extract-approved-missing-fields";
  return "reject-wrong-route";
}

function routeRecommendation(payloadType) {
  if (payloadType === "missing-data-supplement") return "استخدم مسار استكمال البيانات واربط الرد بالتحليل المستهدف.";
  if (["full-analysis", "canonical-analysis-export", "legacy-analysis", "legacy-fair-value-analysis"].includes(payloadType)) return "استخدم مستورد التحليل الكامل.";
  if (payloadType === "quarterly-earnings-update") return "استخدم مسار تحديث الأرباح للسهم المحفوظ.";
  if (payloadType === "investment-backup") return "استخدم أداة استعادة النسخة الاحتياطية في الإعدادات.";
  return "استخدم أحد العقود المدعومة وحدد schemaVersion الصحيح دون إعادة تسمية الحمولة.";
}

function routingError(code, value, details) {
  const schemaVersion = details.schemaVersion || (typeof value?.schemaVersion === "string" ? value.schemaVersion : "غير موجود");
  const payloadType = details.payloadType || detectPayloadType(value);
  return new JsonContractRoutingError(code, {
    field: details.field,
    jsonPath: details.field,
    expected: details.expected,
    received: details.received,
    receivedType: jsonType(details.received),
    schemaVersion,
    payloadType,
    recommendedRoute: details.recommendedRoute,
    technicalMessage: details.technicalMessage || `${code}: ${details.field}`,
    message: "JSON contract validation failed."
  });
}

function validationError(field, expected, received, message) {
  return { field, jsonPath: `$.${field}`, expected, received, receivedType: jsonType(received), message };
}

function combineValidations(...validations) {
  const errors = validations.flatMap((item) => item?.errors || []);
  const warnings = validations.flatMap((item) => item?.warnings || []);
  return { valid: errors.length === 0, errors, warnings };
}

function supportedSchemaText() {
  return supportedSchemaVersions().join(" | ");
}

function expectedFromMessage(message = "") {
  if (/required|missing/i.test(message)) return "قيمة إلزامية مطابقة للعقد";
  if (/array/i.test(message)) return "array";
  if (/object/i.test(message)) return "object";
  if (/number|numeric/i.test(message)) return "number";
  return "قيمة مطابقة للعقد النشط";
}

function readPath(value, path) {
  return String(path || "").replace(/^\$\.?/, "").split(".").filter(Boolean).reduce((cursor, key) => cursor == null ? undefined : cursor[key], value);
}

function validTicker(value) {
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(String(value || "").trim().toUpperCase());
}

function display(value) {
  if (value === undefined) return "غير موجود";
  if (typeof value === "string") return value || "نص فارغ";
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 180 ? `${serialized.slice(0, 177)}...` : serialized;
  } catch {
    return String(value);
  }
}

function jsonType(value) {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function contract(schemaVersion, payloadType, route, legacy) {
  return Object.freeze({ schemaVersion, payloadType, route, legacy });
}
