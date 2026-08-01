import { validateExternalAnalysisReport } from "./externalAnalysisSchemaValidator.js";

export const FIELD_PRIORITY = {
  CRITICAL: "critical",
  RECOMMENDED: "recommended",
  OPTIONAL: "optional"
};

export const FIELD_REQUIREMENTS = [
  requirement("company.ticker", "رمز السهم", "Ticker", FIELD_PRIORITY.CRITICAL, "Text", "لا يمكن حفظ التقرير أو ربطه بالشركة بدون رمز السهم."),
  requirement("analysisDate", "تاريخ التحليل", "Analysis Date", FIELD_PRIORITY.CRITICAL, "Date", "مطلوب لتثبيت النسخة ومقارنتها بالتحليلات السابقة."),
  requirement("market.priceAtAnalysis", "السعر وقت التحليل", "Price at Analysis", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لفهم السياق السعري وقت إعداد التقرير."),
  requirement("scores.quality", "Quality Score", "Quality Score", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لعرض جودة الشركة ضمن التقرير."),
  requirement("scores.growth", "Growth Score", "Growth Score", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لعرض تقييم النمو ضمن التقرير."),
  requirement("scores.valuation", "Valuation Score", "Valuation Score", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لعرض تقييم السعر والتقييم."),
  requirement("scores.risk", "Risk Score", "Risk Score", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لعرض مستوى المخاطر."),
  requirement("fairValue.bear", "القيمة العادلة في Bear", "Bear Fair Value", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لقياس الهبوط المحتمل."),
  requirement("fairValue.base", "القيمة العادلة الأساسية", "Base Fair Value", FIELD_PRIORITY.CRITICAL, "Number", "لا يمكن عرض تقييم السهم بدون السيناريو الأساسي."),
  requirement("fairValue.bull", "القيمة العادلة في Bull", "Bull Fair Value", FIELD_PRIORITY.CRITICAL, "Number", "مطلوب لقياس أعلى نطاق منطقي للتقييم."),
  requirement("thesis.shortSummary", "ملخص فرضية الاستثمار", "Investment Thesis Summary", FIELD_PRIORITY.CRITICAL, "Text", "مطلوب حتى يعرف القارئ لماذا توجد هذه الفرضية.", ["thesis.fullSummary"]),
  requirement("risks", "المخاطر الرئيسية", "Key Risks", FIELD_PRIORITY.CRITICAL, "Array", "مطلوب لعرض المخاطر التي قد تغير القرار."),
  requirement("decision.verdict", "التوصية النهائية", "Investment Verdict", FIELD_PRIORITY.CRITICAL, "Text", "مطلوب لإكمال التقرير الاستثماري."),
  requirement("scores.overall", "Overall Score", "Overall Score", FIELD_PRIORITY.RECOMMENDED, "Number", "يحسن قراءة التقرير لكنه لا يمنع الحفظ."),
  requirement("valuationMethods", "طرق التقييم", "Valuation Methods", FIELD_PRIORITY.RECOMMENDED, "Object", "توضح كيف وصل التحليل الخارجي إلى Fair Value."),
  requirement("earningsQuality.status", "جودة الأرباح", "Earnings Quality", FIELD_PRIORITY.RECOMMENDED, "Text", "تساعد على فهم مدى قابلية الأرباح للاستمرار."),
  requirement("catalysts", "المحفزات", "Catalysts", FIELD_PRIORITY.RECOMMENDED, "Array", "تساعد على معرفة ما قد يرفع أو يخفض الفرضية."),
  requirement("watchItems", "عناصر المتابعة", "Watch Items", FIELD_PRIORITY.RECOMMENDED, "Array", "تساعد المستثمر على متابعة الفرضية لاحقًا."),
  requirement("financialHighlights", "أبرز البيانات المالية", "Financial Highlights", FIELD_PRIORITY.RECOMMENDED, "Object", "تحسن قراءة التقرير المالي المختصر."),
  requirement("sources", "المصادر", "Sources", FIELD_PRIORITY.RECOMMENDED, "Array", "ترفع قابلية التدقيق والمراجعة."),
  requirement("decision.rationale", "سبب التوصية", "Decision Rationale", FIELD_PRIORITY.RECOMMENDED, "Text", "يوضح لماذا انتهى التحليل إلى هذه التوصية."),
  requirement("scores.moat", "Moat Score", "Moat Score", FIELD_PRIORITY.OPTIONAL, "Number", "حقل اختياري لتحسين عمق التقرير."),
  requirement("scores.management", "Management Score", "Management Score", FIELD_PRIORITY.OPTIONAL, "Number", "حقل اختياري لتحسين تقييم الإدارة."),
  requirement("company.sector", "القطاع", "Sector", FIELD_PRIORITY.OPTIONAL, "Text", "يساعد على التصنيف فقط."),
  requirement("company.industry", "الصناعة", "Industry", FIELD_PRIORITY.OPTIONAL, "Text", "يساعد على التصنيف فقط."),
  requirement("market.userAverageCost", "متوسط تكلفة المستخدم", "User Average Cost", FIELD_PRIORITY.OPTIONAL, "Number", "اختياري وشخصي للمستخدم."),
  requirement("decision.buyZone", "منطقة الشراء", "Buy Zone", FIELD_PRIORITY.OPTIONAL, "Text", "تحسين إضافي للتقرير."),
  requirement("decision.fairZone", "منطقة السعر العادل", "Fair Zone", FIELD_PRIORITY.OPTIONAL, "Text", "تحسين إضافي للتقرير."),
  requirement("decision.expensiveZone", "منطقة الغلاء", "Expensive Zone", FIELD_PRIORITY.OPTIONAL, "Text", "تحسين إضافي للتقرير.")
];

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
  const targetFields = fields.length ? fields : [...(details.optional || [])];
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
    "",
    "البيانات الحالية:",
    `Ticker: ${knownTicker || "غير محدد"}`,
    `Company: ${report.company?.name || companyName}`,
    `Analysis Date: ${report.analysisDate || "-"}`,
    `Report Period: ${report.reportPeriod || "-"}`,
    `Price at Analysis: ${report.market?.priceAtAnalysis ?? "-"}`,
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
  return paths.some((path) => valuePresent(getPath(report, path), path));
}

export function getPath(object, path) {
  return String(path || "").split(".").filter(Boolean).reduce((cursor, key) => cursor?.[key], object);
}

export function valuePresent(value, path = "") {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) {
    if (path === "risks") return value.some((item) => item && (hasText(item.title) || hasText(item.explanation) || hasText(item)));
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.values(value).some((item) => valuePresent(item));
  }
  return true;
}

function requirement(path, labelAr, labelEn, priority, expectedType, reasonAr, alternatives = []) {
  return {
    path,
    technicalName: path,
    labelAr,
    labelEn,
    priority,
    expectedType,
    reasonAr,
    reasonEn: reasonAr,
    alternatives
  };
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

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}
