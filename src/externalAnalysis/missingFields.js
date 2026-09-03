import { validateExternalAnalysisReport } from "./externalAnalysisSchemaValidator.js";
import { diagnosticRowsForPaths, getByPath, isMissing, valuePresent } from "./fieldPaths.js";
import { SUPPLEMENT_FIELD_DEFINITIONS, SUPPLEMENT_FIELD_PRIORITY } from "./supplementContract.js";

export { isMissing, valuePresent } from "./fieldPaths.js";

export const FIELD_PRIORITY = SUPPLEMENT_FIELD_PRIORITY;
export const FIELD_REQUIREMENTS = SUPPLEMENT_FIELD_DEFINITIONS;

export function analyzeExternalAnalysisCompletion(report = {}, validation = validateExternalAnalysisReport(report), options = {}) {
  const missingRequired = missingByPriority(report, FIELD_PRIORITY.CRITICAL);
  const missingRecommended = missingByPriority(report, FIELD_PRIORITY.RECOMMENDED);
  const missingOptional = missingByPriority(report, FIELD_PRIORITY.OPTIONAL);
  const requiredTotal = FIELD_REQUIREMENTS.filter((item) => item.priority === FIELD_PRIORITY.CRITICAL).length;
  const recommendedTotal = FIELD_REQUIREMENTS.filter((item) => item.priority === FIELD_PRIORITY.RECOMMENDED).length;
  const requiredComplete = requiredTotal - missingRequired.length;
  const recommendedComplete = recommendedTotal - missingRecommended.length;
  const conflictingPaths = options.conflictingPaths || report.completionStatus?.conflictingPaths || [];
  const nonMissingErrors = (validation.errors || []).filter((error) => !missingRequired.some((item) => item.path === error.field));
  const completionPct = requiredTotal ? Math.round((requiredComplete / requiredTotal) * 100) : 100;
  const status = resolveCompletionStatus({
    draft: options.draft,
    missingRequired,
    validation,
    nonMissingErrors,
    conflictingPaths
  });

  return {
    status,
    requiredTotal,
    requiredComplete,
    recommendedTotal,
    recommendedComplete,
    completionPct,
    missingRequiredPaths: missingRequired.map((item) => item.path),
    missingRecommendedPaths: missingRecommended.map((item) => item.path),
    missingOptionalPaths: missingOptional.map((item) => item.path),
    conflictingPaths,
    invalidPaths: nonMissingErrors.map((item) => item.field),
    lastValidatedAt: (options.now || new Date()).toISOString(),
    details: {
      criticalRequired: missingRequired,
      recommended: missingRecommended,
      optional: missingOptional,
      errors: validation.errors || [],
      warnings: validation.warnings || []
    }
  };
}

export function attachCompletionStatus(report = {}, validation, options = {}) {
  return {
    ...report,
    completionStatus: analyzeExternalAnalysisCompletion(report, validation || validateExternalAnalysisReport(report), options)
  };
}

export function buildMissingRequirementsPrompt(report = {}, completionStatus = analyzeExternalAnalysisCompletion(report), options = {}) {
  const details = completionStatus.details || {};
  const fields = [
    ...(details.criticalRequired || []),
    ...(options.includeRecommended === false ? [] : (details.recommended || []))
  ];
  const candidateFields = fields;
  const targetFields = candidateFields.filter((item) => !requirementSatisfied(report, item));
  if (options.debug) {
    console.table(diagnosticRowsForPaths(report, candidateFields));
  }
  if (!targetFields.length) {
    return {
      text: "",
      count: 0,
      fields: [],
      reason: "no_missing_fields",
      message: "لا توجد بيانات ناقصة في هذه المجموعة."
    };
  }
  const knownTicker = valuePresent(report.company?.ticker, "company.ticker") ? report.company.ticker : null;
  const ticker = knownTicker || null;
  const companyName = report.company?.name || knownTicker || "الشركة محل التقرير";
  const fieldJson = Object.fromEntries(targetFields.map((item) => [item.path, null]));

  const lines = [
    knownTicker
      ? `لدي تحليل سابق لشركة ${companyName} ${knownTicker}، لكن التطبيق اكتشف أن البيانات التالية ناقصة أو غير مكتملة.`
      : "لدي تحليل سابق لشركة لم يتم تحديد رمزها بعد، لكن التطبيق اكتشف أن البيانات التالية ناقصة أو غير مكتملة.",
    "",
    "أريد منك إكمال هذه البيانات فقط، اعتمادًا على التقرير الأصلي والمصادر الرسمية المتاحة.",
    "",
    "مهم جدًا:",
    "- لا تعِد كتابة التحليل كاملًا.",
    "- لا تغيّر أي قيمة لم أطلب تعديلها.",
    "- لا تخترع بيانات.",
    "- إذا تعذر العثور على معلومة، ضع null.",
    "- حافظ على نفس العملة.",
    "- أخرج النتيجة بصيغة JSON فقط.",
    "- استخدم أسماء الحقول كما هي.",
    "- اكتب كل الشروحات والمخاطر والمحفزات وسبب التوصية باللغة العربية.",
    "- أبق المصطلحات المالية القياسية بالإنجليزية مثل DCF وFCF وROIC وEPS وP/E وEV/EBITDA.",
    knownTicker ? `- يجب أن يكون "ticker": "${knownTicker}" في أعلى JSON. لا تستخدم TICKER أو SYMBOL.` : "- إذا كان رمز السهم غير معروف، لا تستخدم TICKER أو SYMBOL؛ ضع null.",
    "- لا ترجع القالب فارغًا كما هو. املأ الحقول التي تستطيع توثيقها بقيم فعلية.",
    "- إذا كان الرد لا يحتوي على قيمة واحدة على الأقل غير null فلن يقبله التطبيق كتحديث مفيد.",
    "",
    "البيانات الحالية:",
    `Ticker: ${knownTicker || "غير محدد"}`,
    `Company: ${report.company?.name || companyName}`,
    `Analysis Date: ${report.analysisDate || "-"}`,
    `Report Period: ${report.reportPeriod || "-"}`,
    `Price at Analysis: ${report.fairValueSummary?.currentPrice ?? "-"}`,
    "",
    "الحقول المطلوبة:",
    "",
    ...targetFields.flatMap((item, index) => [
      `${index + 1}. ${item.path}`,
      `الاسم: ${item.labelAr}`,
      `النوع: ${item.expectedType}`,
      `الحالة: ${priorityArabic(item.priority)}`,
      `السبب: ${item.reasonAr}`,
      ""
    ]),
    "أعد فقط هذا الهيكل:",
    "",
    JSON.stringify({
      schemaVersion: "external-analysis-supplement/v1",
      ticker,
      targetAnalysisId: report.id || null,
      analysisDate: report.analysisDate || null,
      fields: fieldJson,
      notes: []
    }, null, 2)
  ];

  return {
    text: lines.join("\n"),
    count: targetFields.length,
    fields: targetFields
  };
}

export function missingByPriority(report, priority) {
  return FIELD_REQUIREMENTS
    .filter((item) => item.priority === priority)
    .filter((item) => !requirementSatisfied(report, item))
    .map((item) => ({
      ...item,
      currentValue: displayCurrentValue(getPath(report, item.path))
    }));
}

export function requirementSatisfied(report, item) {
  const paths = [item.path, ...(item.alternatives || [])];
  return paths.some((path) => !isMissing(getByPath(report, path), path));
}

export function getPath(object, path) {
  return getByPath(object, path);
}

function resolveCompletionStatus({ draft, missingRequired, validation, nonMissingErrors, conflictingPaths }) {
  if (draft) return "draft";
  if (conflictingPaths.length) return "has_conflicts";
  if (missingRequired.length) return "incomplete";
  if (!validation.valid || nonMissingErrors.length) return "invalid";
  return "complete";
}

function priorityArabic(priority) {
  if (priority === FIELD_PRIORITY.CRITICAL) return "مطلوب";
  if (priority === FIELD_PRIORITY.RECOMMENDED) return "مستحسن";
  return "اختياري";
}

function displayCurrentValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : null;
  if (typeof value === "object") return valuePresent(value) ? "Object" : null;
  return String(value);
}
