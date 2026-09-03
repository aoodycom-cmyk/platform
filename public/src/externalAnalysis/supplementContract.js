export const SUPPLEMENT_FIELD_PRIORITY = Object.freeze({
  CRITICAL: "critical",
  RECOMMENDED: "recommended",
  OPTIONAL: "optional"
});

export const SUPPLEMENT_ARRAY_POLICIES = Object.freeze({
  risks: "replace-on-explicit-approval",
  catalysts: "replace-on-explicit-approval",
  valuationResults: "replace-on-explicit-approval",
  monitoringChecklist: "replace-on-explicit-approval",
  sources: "replace-on-explicit-approval",
  "decision.rationale": "replace-on-explicit-approval"
});

export const SUPPLEMENT_FIELD_DEFINITIONS = Object.freeze([
  field("company.ticker", "رمز السهم", "Ticker", "critical", "Text", "لا يمكن حفظ التقرير أو ربطه بالشركة بدون رمز السهم."),
  field("analysisDate", "تاريخ التحليل", "Analysis Date", "critical", "Date", "مطلوب لتثبيت النسخة ومقارنتها بالتحليلات السابقة."),
  field("fairValueSummary.currentPrice", "السعر وقت التحليل", "Price at Analysis", "critical", "Number", "مطلوب لفهم السياق السعري وقت إعداد التقرير."),
  field("fairValueSummary.fairValueLow", "القيمة العادلة في Bear", "Bear Fair Value", "critical", "Number", "مطلوب لقياس الهبوط المحتمل."),
  field("fairValueSummary.fairValueBase", "القيمة العادلة الأساسية", "Base Fair Value", "critical", "Number", "لا يمكن عرض تقييم السهم بدون السيناريو الأساسي."),
  field("fairValueSummary.fairValueHigh", "القيمة العادلة في Bull", "Bull Fair Value", "critical", "Number", "مطلوب لقياس أعلى نطاق منطقي للتقييم."),
  field("thesis.shortSummary", "ملخص فرضية الاستثمار", "Investment Thesis Summary", "critical", "Text", "مطلوب حتى يعرف القارئ لماذا توجد هذه الفرضية.", ["thesis.fullSummary"]),
  field("risks", "المخاطر الرئيسية", "Key Risks", "critical", "Array", "مطلوب لعرض المخاطر التي قد تغير القرار."),
  field("decision.action", "التوصية النهائية", "Investment Verdict", "critical", "Text", "مطلوب لإكمال التقرير الاستثماري."),
  field("scores.quality", "Quality Score", "Quality Score", "recommended", "Number", "يحسن قراءة جودة الشركة لكنه لا يمنع حفظ التقرير."),
  field("scores.growth", "Growth Score", "Growth Score", "recommended", "Number", "يحسن قراءة النمو لكنه لا يمنع حفظ التقرير."),
  field("scores.valuation", "Valuation Score", "Valuation Score", "recommended", "Number", "يحسن قراءة التقييم لكنه لا يمنع حفظ التقرير."),
  field("scores.risk", "Risk Score", "Risk Score", "recommended", "Number", "يحسن قراءة المخاطر لكنه لا يمنع حفظ التقرير."),
  field("decision.investmentScore", "Investment Score", "Investment Score", "recommended", "Number", "يحسن قراءة التقرير لكنه لا يمنع الحفظ."),
  field("valuationResults", "طرق التقييم", "Valuation Results", "recommended", "Array", "توضح كيف وصل التحليل الخارجي إلى Fair Value."),
  field("earningsQuality.status", "جودة الأرباح", "Earnings Quality", "recommended", "Text", "تساعد على فهم مدى قابلية الأرباح للاستمرار."),
  field("catalysts", "المحفزات", "Catalysts", "recommended", "Array", "تساعد على معرفة ما قد يرفع أو يخفض الفرضية."),
  field("monitoringChecklist", "عناصر المتابعة", "Monitoring Checklist", "recommended", "Array", "تساعد المستثمر على متابعة الفرضية لاحقًا."),
  field("financialHighlights", "أبرز البيانات المالية", "Financial Highlights", "recommended", "Object", "تحسن قراءة التقرير المالي المختصر."),
  field("sources", "المصادر", "Sources", "recommended", "Array", "ترفع قابلية التدقيق والمراجعة."),
  field("decision.rationale", "سبب التوصية", "Decision Rationale", "recommended", "Array", "يوضح لماذا انتهى التحليل إلى هذه التوصية."),
  field("scores.moat", "Moat Score", "Moat Score", "optional", "Number", "حقل اختياري لتحسين عمق التقرير."),
  field("scores.management", "Management Score", "Management Score", "optional", "Number", "حقل اختياري لتحسين تقييم الإدارة."),
  field("company.sector", "القطاع", "Sector", "optional", "Text", "يساعد على التصنيف فقط."),
  field("company.industry", "الصناعة", "Industry", "optional", "Text", "يساعد على التصنيف فقط."),
  field("market.userAverageCost", "متوسط تكلفة المستخدم", "User Average Cost", "optional", "Number", "اختياري وشخصي للمستخدم."),
  field("decision.buyZone", "منطقة الشراء", "Buy Zone", "optional", "Text", "تحسين إضافي للتقرير."),
  field("decision.fairZone", "منطقة السعر العادل", "Fair Zone", "optional", "Text", "تحسين إضافي للتقرير."),
  field("decision.expensiveZone", "منطقة الغلاء", "Expensive Zone", "optional", "Text", "تحسين إضافي للتقرير.")
]);

export const SUPPLEMENT_FIELD_ALIASES = Object.freeze({
  "market.priceAtAnalysis": "fairValueSummary.currentPrice",
  "market.currentPrice": "fairValueSummary.currentPrice",
  "scores.overall": "decision.investmentScore",
  "fairValue.bear": "fairValueSummary.fairValueLow",
  "fairValue.base": "fairValueSummary.fairValueBase",
  "fairValue.bull": "fairValueSummary.fairValueHigh",
  "fairValue.weightedFairValue": "fairValueSummary.probabilityWeightedFairValue",
  "fairValue.analystFairValue": "fairValueSummary.fairValueBase",
  "fairValue.upsideToBasePct": "fairValueSummary.upsideDownsidePercent",
  "fairValue.marginOfSafetyPercent": "fairValueSummary.marginOfSafetyPercent",
  "decision.verdict": "decision.action",
  "recommendation.action": "decision.action",
  "recommendation.confidence": "decision.confidence",
  "recommendation.reason": "decision.rationale",
  "recommendation.rationale": "decision.rationale",
  "recommendation.whatWouldUpgrade": "decision.upgradeTriggers",
  "recommendation.whatWouldDowngrade": "decision.downgradeTriggers",
  "watchItems": "monitoringChecklist",
  "valuationMethods": "valuationResults"
});

const FIELD_BY_PATH = new Map(SUPPLEMENT_FIELD_DEFINITIONS.map((item) => [item.path, item]));

export function canonicalSupplementFieldPath(path) {
  const clean = String(path || "").trim();
  return SUPPLEMENT_FIELD_ALIASES[clean] || clean;
}

export function supplementFieldDefinition(path) {
  return FIELD_BY_PATH.get(canonicalSupplementFieldPath(path)) || null;
}

export function isApprovedSupplementField(path) {
  return Boolean(supplementFieldDefinition(path));
}

export function isUnsafeJsonPath(path) {
  return String(path || "").split(".").some((part) => ["__proto__", "constructor", "prototype"].includes(part));
}

function field(path, labelAr, labelEn, priority, expectedType, reasonAr, alternatives = []) {
  return Object.freeze({
    path,
    technicalName: path,
    labelAr,
    labelEn,
    priority,
    expectedType,
    reasonAr,
    reasonEn: reasonAr,
    alternatives: Object.freeze([...alternatives])
  });
}
