import {
  normalizeQuarterlyForwardOutlook,
  upsertQuarterlyForwardOutlookSupplement
} from "./quarterlyForwardOutlook.js";
import { normalizeRequirementsAssessment } from "./requirements.js";

export const QUARTERLY_EARNINGS_LITE_SCHEMA = "quarterly-earnings-lite/v1";

const REQUIREMENT_STATUSES = new Set(["EXCEEDED", "PASSED", "PARTIALLY_PASSED", "FAILED", "NOT_REPORTED"]);
const GUIDANCE_DIRECTIONS = new Set(["raised", "maintained", "lowered", "new", "not_applicable"]);
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
  return Boolean(value && typeof value === "object" && value.schemaVersion === QUARTERLY_EARNINGS_LITE_SCHEMA);
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
  const targetQuarter = trimText(requirementBlock.targetQuarter || requirementBlock.earningsPeriod, 40);
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
      { name: "KPI مهم خاص بالشركة عند الحاجة", actualDisplay: null, result: "BEAT|MISS|INLINE|NA" }
    ],
    guidance: [
      { topic: "", currentGuidance: "", direction: "raised|maintained|lowered|new|not_applicable", interpretation: "جملة قصيرة" }
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
      status: "NOT_REPORTED",
      evaluationNote: "جملة قصيرة"
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
    concerns: ["حد أقصى نقطتان"]
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
    "- اجعل summary من سطر أو سطرين، highlights بحد أقصى 3، concerns بحد أقصى 2، companyKpis بحد أقصى 4، guidance بحد أقصى 3، وforwardOutlook.summary بحد أقصى سطرين.",
    "- قارن فقط المتطلبات السابقة المرفقة أدناه، ولا تنشئ متطلبات جديدة.",
    "- عند وصول الربع المستهدف، أرسل requirementsAssessment كما حسبته أنت من التحليل: لا تترك weightedAchievement أو أعداد النتائج فارغة إذا كانت قابلة للتقييم.",
    "- Franklin لا يعيد حساب requirementsAssessment ولا حالات المتطلبات؛ لذلك أرسل القيم والحالات النهائية كما توصلت إليها أنت.",
    "- اجعل reportedRequirements وtotalRequirements وأعداد PASSED/FAILED/EXCEEDED/PARTIALLY_PASSED/NOT_REPORTED مطابقة حرفيًا لحالات requirements؛ Franklin سيتحقق من الاتساق ويرفض الحفظ عند التعارض.",
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
    "أخرج JSON واحدًا فقط بدون Markdown أو شرح خارجي، وبنفس البنية التالية. احذف العناصر الفارغة من arrays، لكن لا تضف حقولًا جديدة:",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function inflateQuarterlyEarningsLitePayload(currentReport = {}, payload = {}, rawText = "", now = new Date()) {
  if (!isQuarterlyEarningsLitePayload(payload)) throw new Error("Unsupported quarterly earnings payload.");
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
  const requirements = mergeLiteRequirementResults(requirementBlock.requirements, payload.requirements);
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
  const baseReportPeriod = currentMetadata.baseReportPeriod || currentReport.reportPeriod || null;
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
    catalysts: currentReport.catalysts || [],
    risks: currentReport.risks || [],
    supplements: upsertQuarterlyForwardOutlookSupplement(currentReport.supplements, reportPeriod, forwardOutlook),
    previousRequirementsEvaluation: {
      requirementSetId: payload.requirementSetId || requirementBlock.requirementSetId || null,
      ticker: currentTicker,
      earningsPeriod: reportPeriod,
      createdAt: requirementBlock.createdAt || null,
      createdFromAnalysisId: requirementBlock.createdFromAnalysisId || currentReport.id || null,
      targetValue: requirementBlock.targetValue ?? null,
      targetScenario: requirementBlock.targetScenario || null,
      targetDescription: requirementBlock.targetDescription || null,
      summary: summary || null,
      matchType: "quarterly_earnings_lite",
      previousQuarter: requirementBlock.previousQuarter || null,
      targetQuarter: requirementBlock.targetQuarter || requirementBlock.earningsPeriod || reportPeriod,
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
      baseAnalysisId,
      baseAnalysisDate,
      baseReportPeriod,
      earningsReportDate: reportDate,
      valuationAsOfDate,
      decisionAsOfDate
    }
  };
}

export function validateQuarterlyAssessmentIntegrity({
  reportPeriod,
  targetPeriod,
  requirements = [],
  requirementsAssessment = null
} = {}) {
  const reportQuarter = normalizeQuarterPeriod(reportPeriod);
  const targetQuarter = normalizeQuarterPeriod(targetPeriod);
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
  return { value: null, display: null, consensusDisplay: null, result: "BEAT|MISS|INLINE|NA" };
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
    actualRaw: null,
    direction: "unknown",
    impact: "unknown",
    status: REQUIREMENT_STATUSES.has(status) ? status : "NOT_REPORTED",
    evaluationNote: trimText(item.evaluationNote, 220)
  };
}

function mergeLiteRequirementResults(definitionsInput, resultsInput) {
  const definitions = Array.isArray(definitionsInput) ? definitionsInput : [];
  const results = (Array.isArray(resultsInput) ? resultsInput : []).map(normalizeLiteRequirement);
  if (!definitions.length) return results;

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

  results.forEach((result, index) => {
    if (!used.has(index)) merged.push(result);
  });
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
      importance: null
    };
  }).filter((item) => item.topic || item.currentGuidance || item.interpretation);
}

function normalizeLiteKpis(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: trimText(item?.name, 100),
    arabicName: null,
    category: "quarterly",
    currentValue: trimText(item?.actualDisplay, 120),
    unit: null,
    trend: "unknown",
    importance: "high",
    interpretation: normalizeResultText(item?.result)
  })).filter((item) => item.name || item.currentValue);
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

function normalizeQuarterPeriod(value) {
  const text = String(value || "").trim().toUpperCase();
  const quarter = text.match(/\bQ([1-4])\b/);
  const year = text.match(/(20\d{2})/);
  return quarter && year ? `Q${quarter[1]} ${year[1]}` : null;
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
  if (!text || Number.isNaN(new Date(text).getTime())) return null;
  return text.slice(0, 10);
}
