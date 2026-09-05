import { parseJsonCandidate } from "./parser.js";
import { getByPath, isMissing } from "./fieldPaths.js";
import {
  assertDispatchedRouteAccepted,
  dispatchJsonPayload,
  JSON_IMPORT_ROUTES
} from "./jsonContractRouter.js";
import { normalizeExternalAnalysisReport } from "./schema.js";
import { SUPPLEMENT_FIELD_DEFINITIONS, isApprovedSupplementField } from "./supplementContract.js";
import { normalizeExternalAnalysisSupplement } from "./supplementSchema.js";

export async function parseExternalAnalysisSupplement(text, {
  parseUnstructured,
  existingReport = null,
  missingFields = [],
  now = new Date()
} = {}) {
  const rawSupplement = String(text || "").trim();
  if (!rawSupplement) throw new Error("Paste a supplementary ChatGPT response first.");

  const localJson = parseJsonCandidate(rawSupplement);
  if (localJson.ok) {
    const dispatched = dispatchJsonPayload(localJson.value, {
      intendedRoute: JSON_IMPORT_ROUTES.SUPPLEMENT,
      existingReport,
      rawText: rawSupplement,
      now,
      context: {
        currentReport: existingReport,
        expectedTicker: existingReport?.company?.ticker
      }
    });
    assertDispatchedRouteAccepted(dispatched, localJson.value);
    if (dispatched.action === "extract-approved-missing-fields") {
      return {
        supplement: extractApprovedMissingFields(dispatched, existingReport, missingFields, rawSupplement, now),
        parserSource: "Franklin Full Analysis Extractor",
        sourceSchemaVersion: dispatched.schemaVersion,
        usedAi: false
      };
    }
    return {
      supplement: dispatched.value,
      parserSource: "Local Supplement JSON Parser",
      usedAi: false
    };
  }

  if (typeof parseUnstructured !== "function") {
    throw new Error("Supplement parser is unavailable.");
  }

  const parsed = await parseUnstructured(rawSupplement, {
    existingReport,
    missingFields
  });
  const parsedValue = parsed.supplement || parsed;
  const dispatched = dispatchJsonPayload(parsedValue, {
    intendedRoute: JSON_IMPORT_ROUTES.SUPPLEMENT,
    existingReport,
    rawText: rawSupplement,
    now,
    context: { currentReport: existingReport, expectedTicker: existingReport?.company?.ticker }
  });
  assertDispatchedRouteAccepted(dispatched, parsedValue);
  return {
    supplement: dispatched.action === "extract-approved-missing-fields"
      ? extractApprovedMissingFields(dispatched, existingReport, missingFields, rawSupplement, now)
      : dispatched.value,
    parserSource: parsed.source || "OpenAI Supplement Parser",
    usedAi: true
  };
}

function extractApprovedMissingFields(dispatched, existingReport, missingFields, rawSupplement, now) {
  if (!existingReport) {
    throw routedExtractionError("لا يمكن استخراج حقول الاستكمال من تحليل كامل قبل تحديد التحليل المحفوظ المستهدف.");
  }
  if (!dispatched.validation.valid) {
    const first = dispatched.validation.errors?.[0];
    throw routedExtractionError(`التحليل الكامل لم يجتز التحقق عند ${first?.field || "$"}، لذلك لم يُستخرج منه أي تحديث.`);
  }
  const sourceReport = dispatched.schemaVersion === "franklin-fair-value/v3"
    ? normalizeExternalAnalysisReport(dispatched.value, rawSupplement, { now, importMethod: "franklin_v3_supplement_extraction" })
    : dispatched.value;
  const candidates = (Array.isArray(missingFields) && missingFields.length ? missingFields : SUPPLEMENT_FIELD_DEFINITIONS)
    .map((item) => typeof item === "string" ? item : item.path)
    .filter((path) => isApprovedSupplementField(path))
    .filter((path) => isMissing(getByPath(existingReport, path), path));
  const fields = {};
  for (const path of candidates) {
    const value = getByPath(sourceReport, path);
    if (!isMissing(value, path)) fields[path] = clone(value);
  }
  if (!Object.keys(fields).length) {
    throw routedExtractionError("التحليل الكامل لا يحتوي قيمًا موثقة للحقول الناقصة المسموح بها. بقي السجل الحالي دون تغيير؛ استخدم JSON Supplement مطابقًا للقالب.");
  }
  return normalizeExternalAnalysisSupplement({
    schemaVersion: "external-analysis-supplement/v1",
    ticker: sourceReport.company?.ticker,
    targetAnalysisId: existingReport.id || null,
    analysisDate: existingReport.analysisDate || null,
    fields,
    sources: sourceReport.sources || [],
    notes: [`Extracted deterministically from ${dispatched.schemaVersion}; the full payload was not stored as a supplement.`]
  }, "", supplementOptions(existingReport, now));
}

function routedExtractionError(message) {
  const error = new Error(message);
  error.userMessage = message;
  error.code = "FULL_ANALYSIS_EXTRACTION_FAILED";
  return error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function supplementOptions(existingReport, now) {
  return {
    now,
    ticker: existingReport?.company?.ticker,
    targetAnalysisId: existingReport?.id,
    analysisDate: existingReport?.analysisDate
  };
}
