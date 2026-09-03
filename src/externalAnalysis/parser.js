import { normalizeExternalAnalysisReport } from "./schema.js";
import { upsertQuarterlyEarningsDigestSupplement } from "./quarterlyEarningsDigest.js";
import { inflateQuarterlyEarningsLitePayload, isQuarterlyEarningsLitePayload } from "./quarterlyEarningsLite.js";
import { isFranklinV3Report } from "./v3Contract.js";
import { inspectJsonImportText, JsonImportError } from "./jsonFileImport.js";
import {
  assertDispatchedPayloadValid,
  assertDispatchedRouteAccepted,
  dispatchJsonPayload,
  JSON_IMPORT_ROUTES
} from "./jsonContractRouter.js";

let quarterlyEarningsLiteReportResolver = null;

export function setQuarterlyEarningsLiteReportResolver(resolver) {
  quarterlyEarningsLiteReportResolver = typeof resolver === "function" ? resolver : null;
}

export async function parseExternalAnalysisInput(text, { parseUnstructured, now = new Date(), currentReport = null, expectedTicker = null, expectedReportPeriod = null, strictJson = false } = {}) {
  const rawAnalysis = String(text || "").trim();
  if (!rawAnalysis) throw new Error("Paste an external ChatGPT analysis first.");

  let localJson;
  if (strictJson) {
    const inspected = inspectJsonImportText(rawAnalysis, {
      validationContext: { currentReport, expectedTicker, expectedReportPeriod }
    });
    localJson = { ok: true, value: inspected.value };
  } else {
    localJson = parseJsonCandidate(rawAnalysis);
  }
  if (localJson.ok) {
    const dispatched = dispatchJsonPayload(localJson.value, {
      intendedRoute: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
      existingReport: currentReport,
      rawText: rawAnalysis,
      now,
      context: { currentReport, expectedTicker, expectedReportPeriod }
    });
    assertDispatchedRouteAccepted(dispatched, localJson.value);
    assertDispatchedPayloadValid(dispatched, localJson.value);
    if (dispatched.action === "redirect-to-supplement") {
      return {
        route: JSON_IMPORT_ROUTES.SUPPLEMENT,
        supplement: dispatched.value,
        schemaVersion: dispatched.schemaVersion,
        payloadType: dispatched.payloadType,
        parserSource: "Franklin JSON Contract Router",
        usedAi: false
      };
    }
    if (isFranklinV3Report(dispatched.value)) {
      const normalizedV3 = dispatched.value;
      return {
        report: normalizeExternalAnalysisReport(normalizedV3, rawAnalysis, { now, importMethod: "franklin_v3_json" }),
        route: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
        schemaVersion: dispatched.schemaVersion,
        payloadType: dispatched.payloadType,
        parserSource: "Franklin v3 JSON Parser",
        usedAi: false
      };
    }
    if (isQuarterlyEarningsLitePayload(dispatched.value)) {
      const baseReport = currentReport || await resolveQuarterlyEarningsLiteReport(dispatched.value);
      if (!baseReport) {
        const error = new Error("Quarterly earnings lite JSON requires an existing saved report for this ticker.");
        error.userMessage = "هذا JSON تحديث أرباح ربع ويحتاج فتح السهم المحفوظ من شاشة التقرير قبل الاستيراد.";
        throw error;
      }
      const inflated = inflateQuarterlyEarningsLitePayload(baseReport, dispatched.value, rawAnalysis, now);
      return {
        report: {
          ...inflated,
          supplements: upsertQuarterlyEarningsDigestSupplement(inflated.supplements, inflated.reportPeriod, dispatched.value)
        },
        route: JSON_IMPORT_ROUTES.QUARTERLY_EARNINGS,
        schemaVersion: dispatched.schemaVersion,
        payloadType: dispatched.payloadType,
        parserSource: "Quarterly Earnings Lite Parser",
        usedAi: false
      };
    }
    return {
      report: dispatched.value,
      route: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
      schemaVersion: dispatched.schemaVersion,
      payloadType: dispatched.payloadType,
      parserSource: "Local JSON Parser",
      usedAi: false
    };
  }

  if (strictJson) {
    throw new JsonImportError("INVALID_JSON", "ملف غير صالح. تعذر قراءة JSON داخل الملف.", "No JSON object could be parsed from the selected file.");
  }
  if (typeof parseUnstructured !== "function") {
    throw new Error("External analysis parser is unavailable.");
  }
  const parsed = await parseUnstructured(rawAnalysis);
  const parsedValue = parsed.report || parsed;
  const dispatched = dispatchJsonPayload(parsedValue, {
    intendedRoute: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
    existingReport: currentReport,
    rawText: rawAnalysis,
    now,
    context: { currentReport, expectedTicker, expectedReportPeriod }
  });
  assertDispatchedRouteAccepted(dispatched, parsedValue);
  assertDispatchedPayloadValid(dispatched, parsedValue);
  if (dispatched.action === "redirect-to-supplement") {
    return {
      route: JSON_IMPORT_ROUTES.SUPPLEMENT,
      supplement: dispatched.value,
      schemaVersion: dispatched.schemaVersion,
      payloadType: dispatched.payloadType,
      parserSource: parsed.source || "OpenAI Backend Parser",
      usedAi: true
    };
  }
  const normalizedParsedValue = dispatched.value;
  return {
    report: normalizeExternalAnalysisReport(normalizedParsedValue, rawAnalysis, { now, importMethod: "openai_backend_parser" }),
    route: dispatched.route,
    schemaVersion: dispatched.schemaVersion,
    payloadType: dispatched.payloadType,
    parserSource: parsed.source || "OpenAI Backend Parser",
    usedAi: true
  };
}

export function parseJsonCandidate(text) {
  const clean = String(text || "").trim();
  let unfenced = clean;
  try {
    unfenced = clean.startsWith("```") ? inspectJsonImportText(clean).jsonText : clean;
  } catch {
    unfenced = clean;
  }
  const normalized = normalizeJsonLikeText(clean);
  const candidates = uniqueCandidates([
    unfenced,
    clean,
    extractFirstJsonObject(clean),
    normalized,
    extractFirstJsonObject(normalized)
  ]);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return { ok: true, value };
    } catch {
      // Continue to the next candidate.
    }
  }
  return { ok: false, value: null };
}

export function stringifyExternalAnalysisReport(report) {
  return JSON.stringify(report, null, 2);
}

export function normalizeJsonLikeText(text) {
  return String(text || "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, "\"")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\u00A0/g, " ")
    .trim();
}

async function resolveQuarterlyEarningsLiteReport(payload) {
  if (typeof quarterlyEarningsLiteReportResolver !== "function") return null;
  return quarterlyEarningsLiteReportResolver(payload);
}

function uniqueCandidates(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}
