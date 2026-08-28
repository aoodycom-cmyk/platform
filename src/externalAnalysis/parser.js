import { normalizeExternalAnalysisReport } from "./schema.js";
import { upsertQuarterlyEarningsDigestSupplement } from "./quarterlyEarningsDigest.js";
import { inflateQuarterlyEarningsLitePayload, isQuarterlyEarningsLitePayload } from "./quarterlyEarningsLite.js";
import { normalizeFranklinV3Input } from "./v3InputNormalizer.js";
import { isFranklinV3Report } from "./v3Contract.js";
import { validateFranklinV3Report } from "./v3Validator.js";
import { inspectJsonImportText, JsonImportError } from "./jsonFileImport.js";

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
    if (isFranklinV3Report(localJson.value)) {
      const normalizedV3 = normalizeFranklinV3Input(localJson.value);
      assertValidFranklinV3(normalizedV3, { currentReport, expectedTicker, expectedReportPeriod });
      return {
        report: normalizeExternalAnalysisReport(normalizedV3, rawAnalysis, { now, importMethod: "franklin_v3_json" }),
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

  if (strictJson) {
    throw new JsonImportError("INVALID_JSON", "ملف غير صالح. تعذر قراءة JSON داخل الملف.", "No JSON object could be parsed from the selected file.");
  }
  if (typeof parseUnstructured !== "function") {
    throw new Error("External analysis parser is unavailable.");
  }
  const parsed = await parseUnstructured(rawAnalysis);
  const parsedValue = parsed.report || parsed;
  const normalizedParsedValue = isFranklinV3Report(parsedValue) ? normalizeFranklinV3Input(parsedValue) : parsedValue;
  if (isFranklinV3Report(normalizedParsedValue)) {
    assertValidFranklinV3(normalizedParsedValue, { currentReport, expectedTicker, expectedReportPeriod });
  }
  return {
    report: normalizeExternalAnalysisReport(normalizedParsedValue, rawAnalysis, { now, importMethod: "openai_backend_parser" }),
    parserSource: parsed.source || "OpenAI Backend Parser",
    usedAi: true
  };
}

function assertValidFranklinV3(value, context = {}) {
  const validation = validateFranklinV3Report(value, {
    currentReport: context.currentReport,
    expectedTicker: context.expectedTicker || context.currentReport?.company?.ticker,
    expectedReportPeriod: context.expectedReportPeriod
  });
  if (validation.valid) return;
  const message = validation.errors.slice(0, 6).map((error) => `${error.field}: ${error.message}`).join("\n");
  const error = new Error(`Franklin v3 JSON is not valid.\n${message}`);
  const marketErrors = validation.errors.filter((item) => String(item.field || "").startsWith("marketPrice."));
  const arithmeticErrors = validation.errors.filter((item) => /arithmetic|inconsistent|must equal|sum to 100/i.test(String(item.message || "")));
  error.userMessage = marketErrors.length
    ? "مصدر سعر السوق غير مطابق لعقد Franklin. راجع marketPrice والمصدر المرتبط به."
    : arithmeticErrors.length
      ? "يوجد خطأ حسابي في التقييم. لم يغيّر Franklin الأرقام ولم يحفظ التحليل."
      : "فشل التحقق من عقد Franklin. راجع الأخطاء الموضحة قبل الاستيراد.";
  error.validation = validation;
  throw error;
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
