export const QUARTERLY_EARNINGS_LITE_SCHEMA = "quarterly-earnings-lite/v1";

const REQUIREMENT_STATUSES = new Set(["EXCEEDED", "PASSED", "PARTIALLY_PASSED", "FAILED", "NOT_REPORTED"]);
const GUIDANCE_DIRECTIONS = new Set(["raised", "maintained", "lowered", "new", "not_applicable"]);

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
    requirements: requirements.map((item) => ({
      id: item.id,
      actualValue: null,
      actualDisplay: null,
      status: "NOT_REPORTED",
      evaluationNote: "جملة قصيرة"
    })),
    highlights: ["حد أقصى 3 نقاط"],
    concerns: ["حد أقصى نقطتان"]
  };

  return [
    `اقرأ إعلان أرباح ${companyName} (${ticker || "-"}) للربع ${period} قراءة سريعة ومختصرة فقط.`,
    "",
    "المطلوب:",
    "- ركز فقط على ما يهم هذا الربع: Revenue، EPS، الهوامش المهمة، FCF/السيولة عند أهميتها، KPIs الخاصة بالشركة، Guidance، ومدى تحقق المتطلبات السابقة.",
    "- استخدم المصادر الرسمية للشركة وSEC أولًا إذا لم يرفق المستخدم نص الإعلان.",
    "- لا تخترع أي رقم؛ استخدم null عند عدم التوفر.",
    "- اجعل summary من سطر أو سطرين، highlights بحد أقصى 3، concerns بحد أقصى 2، companyKpis بحد أقصى 4، guidance بحد أقصى 3.",
    "- قارن فقط المتطلبات السابقة المرفقة أدناه، ولا تنشئ متطلبات جديدة.",
    "",
    "ممنوع في هذه المهمة:",
    "- لا تعمل تحليل سهم كامل.",
    "- لا تعمل DCF أو Reverse DCF أو مضاعفات تقييم.",
    "- لا تحسب Fair Value جديدًا.",
    "- لا تصدر BUY/ADD/HOLD/WATCH/REDUCE/SELL جديدة.",
    "- لا تكتب Company Profile أو تحليل صناعة أو سيناريوهات أو Forecast طويل.",
    "- لا تعيد كتابة التقرير السابق.",
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
  const metrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {};
  const requirementBlock = currentReport.priceTargetRequirements || {};
  const requirements = Array.isArray(payload.requirements) ? payload.requirements.map(normalizeLiteRequirement) : [];
  const summary = trimText(payload.summary, 400);
  const highlights = limitStrings(payload.highlights, 3, 220);
  const concerns = limitStrings(payload.concerns, 2, 220);
  const guidance = normalizeLiteGuidance(payload.guidance).slice(0, 3);
  const companyKpis = normalizeLiteKpis(payload.companyKpis).slice(0, 4);
  const raw = String(rawText || JSON.stringify(payload));

  return {
    ...currentReport,
    id: null,
    analysisDate: validDate(payload.reportDate) || now.toISOString().slice(0, 10),
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
    catalysts: highlights.map((item) => ({ title: item, explanation: item })),
    risks: concerns.length
      ? concerns.map((item) => ({ title: item, severity: "Quarterly", explanation: item, whatToMonitor: null, thesisBreaker: null }))
      : (currentReport.risks || []),
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
      targetQuarter: reportPeriod,
      requirements,
      requirementsAssessment: null
    },
    requirementsAssessment: null,
    rawAnalysis: raw,
    rawAnalysisOriginal: raw,
    metadata: {
      ...(currentReport.metadata || {}),
      importedAt: null,
      updatedAt: null,
      rawHash: null,
      importMethod: "quarterly_earnings_lite"
    }
  };
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

function metricNumber(item) {
  return Number.isFinite(item?.value) ? item.value : null;
}

function metricDisplay(item) {
  return trimText(item?.display, 120);
}

function limitStrings(items, max, maxLength) {
  return (Array.isArray(items) ? items : []).map((item) => trimText(item, maxLength)).filter(Boolean).slice(0, max);
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
