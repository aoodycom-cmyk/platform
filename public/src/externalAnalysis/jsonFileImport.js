import { isFranklinV3Report } from "./v3Contract.js";
import { normalizeFranklinV3Input } from "./v3InputNormalizer.js";
import { validateFranklinV3Report } from "./v3Validator.js";

export const JSON_IMPORT_MAX_BYTES = 12 * 1024 * 1024;

export class JsonImportError extends Error {
  constructor(code, userMessage, technicalDetails = "", errors = []) {
    super(technicalDetails || userMessage);
    this.name = "JsonImportError";
    this.code = code;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
    this.importErrors = errors;
  }
}

export async function readLocalJsonFile(file, options = {}) {
  const maxBytes = Number(options.maxBytes) || JSON_IMPORT_MAX_BYTES;
  const name = String(file?.name || "");
  if (!/\.json$/i.test(name)) {
    throw importError("UNSUPPORTED_EXTENSION", "امتداد الملف غير مدعوم. اختر ملفًا ينتهي بـ .json فقط.", `Unsupported file extension: ${name || "(missing filename)"}`);
  }
  const size = Number(file?.size) || 0;
  if (size > maxBytes) {
    throw importError("FILE_TOO_LARGE", "حجم ملف التحليل غير مسموح. اختر ملف JSON أصغر.", `File size ${size} exceeds limit ${maxBytes} bytes.`);
  }
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch (error) {
    throw importError("FILE_READ_FAILED", "تعذر قراءة ملف التحليل على هذا الجهاز.", error?.message || "File.arrayBuffer() failed.");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw importError("INVALID_UTF8", "ملف التحليل ليس بترميز UTF-8 صالح.", error?.message || "UTF-8 decoding failed.");
  }
  if (!text.trim()) {
    throw importError("EMPTY_FILE", "ملف التحليل فارغ. اختر ملف JSON يحتوي على التحليل الكامل.", "The selected file contains no text.");
  }
  return { name, size: bytes.byteLength || size, text };
}

export function inspectJsonImportText(text, options = {}) {
  const rawText = String(text ?? "");
  if (!rawText.trim()) throw importError("EMPTY_FILE", "ملف التحليل فارغ. اختر ملف JSON يحتوي على التحليل الكامل.", "The JSON input is empty.");
  const jsonText = stripJsonCodeFence(rawText);
  assertStructurallyCompleteJson(jsonText);

  let value;
  try {
    value = JSON.parse(jsonText);
  } catch (error) {
    if (/unterminated|unexpected end|end of json|eof/i.test(String(error?.message || ""))) {
      throw incompleteJsonError(error?.message);
    }
    throw importError("INVALID_JSON", "ملف غير صالح. تأكد من تنزيل ملف JSON الأصلي من ChatGPT من دون تعديل.", error?.message || "JSON.parse failed.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw importError("INVALID_JSON_ROOT", "ملف غير صالح. يجب أن يحتوي الملف على كائن JSON واحد.", "The JSON root must be an object.");
  }

  if (/^franklin-fair-value\//.test(String(value.schemaVersion || "")) && value.schemaVersion !== "franklin-fair-value/v3") {
    throw importError("UNSUPPORTED_SCHEMA", "إصدار عقد Franklin غير مدعوم. استخدم franklin-fair-value/v3.", `Unsupported schemaVersion: ${value.schemaVersion}`);
  }

  const missing = requiredSectionErrors(value);
  if (missing.length) {
    throw new JsonImportError(
      "INCOMPLETE_REPORT",
      "ملف التحليل غير مكتمل. يبدو أن إنشاء JSON انقطع قبل النهاية. أعد تنزيل الملف الكامل من ChatGPT ثم حاول مرة أخرى.",
      `Missing required report sections: ${missing.map((item) => item.field).join(", ")}`,
      missing
    );
  }

  const normalized = isFranklinV3Report(value) ? normalizeFranklinV3Input(value) : value;
  const validation = isFranklinV3Report(normalized)
    ? validateFranklinV3Report(normalized, options.validationContext || {})
    : { valid: true, errors: [], warnings: [] };
  return {
    rawText,
    jsonText,
    value: normalized,
    validation,
    summary: analysisFileSummary(normalized)
  };
}

export function stripJsonCodeFence(text) {
  const clean = String(text ?? "").trim();
  if (!clean.startsWith("```")) return clean;
  const opening = clean.match(/^```(?:json)?[ \t]*\r?\n/i);
  if (!opening) {
    throw importError("INVALID_JSON", "ملف غير صالح. يجب أن يحتوي السياج على JSON فقط.", "Malformed opening code fence.");
  }
  if (!/\r?\n```\s*$/.test(clean)) throw incompleteJsonError("Opening JSON code fence has no closing fence.");
  return clean.slice(opening[0].length).replace(/\r?\n```\s*$/, "");
}

export function assertStructurallyCompleteJson(text) {
  const clean = String(text ?? "").trim();
  if (!clean) throw incompleteJsonError("JSON body is empty.");
  if (!clean.startsWith("{")) {
    throw importError("INVALID_JSON", "ملف غير صالح. يجب أن يبدأ JSON بالرمز {.", `Unexpected first token: ${clean.slice(0, 20)}`);
  }
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack.pop() !== expected) {
        throw importError("INVALID_JSON", "ملف غير صالح. ترتيب الأقواس داخل JSON غير صحيح.", `Mismatched closing token ${char} at character ${index}.`);
      }
    }
  }
  if (inString || escaped || stack.length || !clean.endsWith("}")) {
    throw incompleteJsonError(inString ? "Unterminated JSON string." : `Unclosed JSON containers: ${stack.join("") || "root object"}.`);
  }
}

export function formatJsonFileSize(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function analysisFileSummary(value = {}) {
  const identity = value.reportIdentity || {};
  const company = value.company || {};
  const analysisType = value.analysisType || value.metadata?.analysisType || value.metadata?.franklinV3?.analysisType || null;
  return {
    ticker: identity.ticker || company.ticker || value.ticker || value.symbol || null,
    companyName: identity.companyName || company.name || value.companyName || value.name || null,
    analysisType,
    analysisDate: identity.analysisDate || value.analysisDate || value.date || null,
    reportPeriod: identity.fiscalQuarter && identity.fiscalYear
      ? `${identity.fiscalQuarter} ${identity.fiscalYear}`
      : value.reportPeriod || value.period || null,
    previousAnalysisId: identity.previousAnalysisId || null
  };
}

export function describeImportValidationErrors(errors = [], value = {}) {
  return (Array.isArray(errors) ? errors : []).map((item) => {
    const field = String(item?.field || "json");
    const message = String(item?.message || "Validation failed.");
    return {
      ...item,
      field,
      currentValue: displayValue(readPath(value, field)),
      requiredValue: expectedValue(field, message),
      suggestion: repairSuggestion(field, message)
    };
  });
}

function requiredSectionErrors(value) {
  const missing = [];
  if (!value.schemaVersion) missing.push(sectionError("schemaVersion"));
  if (value.schemaVersion === "franklin-fair-value/v3") {
    for (const field of ["reportIdentity", "valuation", "sources"]) {
      const section = value[field];
      if (field === "sources" ? !Array.isArray(section) : (!section || typeof section !== "object" || Array.isArray(section))) {
        missing.push(sectionError(field));
      }
    }
  }
  return missing;
}

function readPath(value, path) {
  return String(path || "").split(".").filter(Boolean).reduce((cursor, part) => {
    if (cursor === null || cursor === undefined) return undefined;
    return cursor[part];
  }, value);
}

function displayValue(value) {
  if (value === undefined || value === null || value === "") return "غير موجود";
  if (typeof value === "object") {
    const serialized = JSON.stringify(value);
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
  }
  return String(value);
}

function expectedValue(field, message) {
  if (field === "schemaVersion") return "franklin-fair-value/v3";
  if (field.includes("ticker")) return "رمز سهم صحيح";
  if (field === "analysisType") return "INITIAL أو EARNINGS_REVALUATION";
  if (field === "marketPrice.sourceId") return "معرّف مصدر Market Data مطابق ومستخدم لسعر السوق";
  if (/arithmetic|inconsistent|must equal|sum to 100/i.test(message)) return "قيمة متطابقة مع معادلات Franklin الحالية";
  if (/required|must include|missing/i.test(message)) return "قيمة إلزامية مكتملة";
  if (/not supported|must be/i.test(message)) return "إحدى القيم المعتمدة في عقد Franklin v3";
  return "قيمة مطابقة لعقد Franklin v3";
}

function repairSuggestion(field, message) {
  if (field === "schemaVersion") return "نزّل نتيجة برومبت Franklin v3 الكاملة ولا تغيّر إصدار العقد.";
  if (field.includes("ticker")) return "أكمل رمز السهم داخل reportIdentity.ticker.";
  if (field === "marketPrice.sourceId") return "اربط سعر السوق بمصدر من sources نوعه Market Data ويحتوي marketPrice في usedFor.";
  if (/arithmetic|inconsistent|must equal|sum to 100/i.test(message)) return "اطلب من ChatGPT إعادة إخراج JSON بعد تصحيح الحساب فقط، من دون تعديل بيانات المصادر.";
  return "أعد تنزيل JSON الكامل من ChatGPT وتحقق من هذا الحقل قبل الاستيراد.";
}

function sectionError(field) {
  return {
    field,
    currentValue: "غير موجود",
    requiredValue: "قسم أساسي كامل",
    suggestion: `أعد تنزيل الملف الكامل وتأكد من وجود ${field}.`,
    message: `${field} is missing from the report.`
  };
}

function incompleteJsonError(details = "") {
  return importError(
    "INCOMPLETE_JSON",
    "ملف التحليل غير مكتمل. يبدو أن إنشاء JSON انقطع قبل النهاية. أعد تنزيل الملف الكامل من ChatGPT ثم حاول مرة أخرى.",
    details || "The JSON document ended before all strings and containers were closed."
  );
}

function importError(code, userMessage, technicalDetails) {
  return new JsonImportError(code, userMessage, technicalDetails);
}
