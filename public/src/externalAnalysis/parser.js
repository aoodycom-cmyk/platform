import { normalizeExternalAnalysisReport } from "./schema.js";
import { upsertQuarterlyEarningsDigestSupplement } from "./quarterlyEarningsDigest.js";
import { inflateQuarterlyEarningsLitePayload, isQuarterlyEarningsLitePayload } from "./quarterlyEarningsLite.js";
import { isFranklinV3Report } from "./v3Contract.js";
import { validateFranklinV3Report } from "./v3Validator.js";

let quarterlyEarningsLiteReportResolver = null;

export function setQuarterlyEarningsLiteReportResolver(resolver) {
  quarterlyEarningsLiteReportResolver = typeof resolver === "function" ? resolver : null;
}

export async function parseExternalAnalysisInput(text, { parseUnstructured, now = new Date(), currentReport = null, expectedReportPeriod = null } = {}) {
  const rawAnalysis = String(text || "").trim();
  if (!rawAnalysis) throw new Error("Paste an external ChatGPT analysis first.");

  const localJson = parseJsonCandidate(rawAnalysis);
  if (localJson.ok) {
    if (isFranklinV3Report(localJson.value)) {
      assertValidFranklinV3(localJson.value, { currentReport, expectedReportPeriod });
      return {
        report: normalizeExternalAnalysisReport(localJson.value, rawAnalysis, { now, importMethod: "franklin_v3_json" }),
        parserSource: "Franklin v3 JSON Parser",
        usedAi: false
      };
    }
    if (isQuarterlyEarningsLitePayload(localJson.value)) {
      const baseReport = currentReport || await resolveQuarterlyEarningsLiteReport(localJson.value);
      if (!baseReport) {
        const error = new Error("Quarterly earnings lite JSON requires an existing saved report for this ticker.");
        error.userMessage = "هذا JSON تحديث أرباح ربع ويحتاج فتح السهم المحفوظ من شاشة التقرير قبل الاستيراد.";
        throw error;
      }
      const inflated = inflateQuarterlyEarningsLitePayload(baseReport, localJson.value, rawAnalysis, now);
      return {
        report: {
          ...inflated,
          supplements: upsertQuarterlyEarningsDigestSupplement(inflated.supplements, inflated.reportPeriod, localJson.value)
        },
        parserSource: "Quarterly Earnings Lite Parser",
        usedAi: false
      };
    }
    return {
      report: normalizeExternalAnalysisReport(localJson.value, rawAnalysis, { now, importMethod: "structured_json" }),
      parserSource: "Local JSON Parser",
      usedAi: false
    };
  }

  if (typeof parseUnstructured !== "function") {
    throw new Error("External analysis parser is unavailable.");
  }
  const parsed = await parseUnstructured(rawAnalysis);
  if (isFranklinV3Report(parsed.report || parsed)) {
    assertValidFranklinV3(parsed.report || parsed, { currentReport, expectedReportPeriod });
  }
  return {
    report: normalizeExternalAnalysisReport(parsed.report || parsed, rawAnalysis, { now, importMethod: "openai_backend_parser" }),
    parserSource: parsed.source || "OpenAI Backend Parser",
    usedAi: true
  };
}

function assertValidFranklinV3(value, context = {}) {
  const validation = validateFranklinV3Report(value, {
    currentReport: context.currentReport,
    expectedTicker: context.currentReport?.company?.ticker,
    expectedReportPeriod: context.expectedReportPeriod
  });
  if (validation.valid) return;
  const message = validation.errors.slice(0, 6).map((error) => `${error.field}: ${error.message}`).join("\n");
  const error = new Error(`Franklin v3 JSON is not valid.\n${message}`);
  error.userMessage = `JSON v3 غير صالح:\n${message}`;
  error.validation = validation;
  throw error;
}

export function parseJsonCandidate(text) {
  const clean = String(text || "").trim();
  const normalized = normalizeJsonLikeText(clean);
  const candidates = uniqueCandidates([
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
