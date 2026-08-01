import { FIELD_PRIORITY, FIELD_REQUIREMENTS } from "./missingFields.js";

export function buildFullAnalysisPrompt(options = {}) {
  const ticker = normalizeTicker(options.tickerHint);
  const requiredFields = fieldsByPriority(FIELD_PRIORITY.CRITICAL);
  const recommendedFields = fieldsByPriority(FIELD_PRIORITY.RECOMMENDED);
  const template = buildExternalAnalysisJsonObject({ tickerHint: ticker });

  return [
    "أريدك أن تعمل كمحلل أسهم محترف وتجهز تحليلًا قابلًا للاستيراد داخل Franklin Research.",
    "",
    "المطلوب:",
    "- حلل الشركة اعتمادًا على معلومات موثوقة ومصادر رسمية أو مذكورة بوضوح.",
    "- لا تخترع أي رقم غير متوفر.",
    "- إذا لم تجد معلومة، ضع null.",
    "- لا تستخدم Markdown.",
    "- لا تضف شرحًا خارج JSON.",
    "- أخرج JSON فقط مطابقًا للأسماء والهيكل أدناه.",
    "- اكتب التحليل والتفسير بالعربية.",
    "- اترك المصطلحات المالية القياسية بالإنجليزية مثل DCF وFCF وROIC وEPS وP/E وEV/EBITDA.",
    "",
    ticker ? `رمز السهم المطلوب: ${ticker}` : "رمز السهم: حدده من الشركة محل التحليل إذا كان معروفًا، وإلا ضع null.",
    "",
    "الحقول المطلوبة التي تمنع اعتماد التقرير إذا نقصت:",
    ...fieldLines(requiredFields),
    "",
    "حقول مستحسنة ترفع جودة التقرير لكنها لا تمنع الحفظ:",
    ...fieldLines(recommendedFields),
    "",
    "قواعد مهمة:",
    "- scores يجب أن تكون بين 0 و10.",
    "- market.priceAtAnalysis يجب أن يكون رقمًا أكبر من صفر.",
    "- fairValue.bear وfairValue.base وfairValue.bull يجب أن تكون أرقامًا موجبة.",
    "- يجب أن يكون الترتيب: Bear <= Base <= Bull.",
    "- risks يجب أن تكون Array.",
    "- decision.verdict يجب أن تكون نصًا واضحًا مثل BUY أو HOLD أو SELL أو صياغة قريبة.",
    "- لا تضع TICKER أو SYMBOL كقيمة؛ إذا الرمز غير معروف ضع null.",
    "",
    "استخدم هذا الهيكل فقط واملأ القيم المتوفرة:",
    "",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function buildExternalAnalysisJsonTemplate(options = {}) {
  return JSON.stringify(buildExternalAnalysisJsonObject(options), null, 2);
}

export function analysisContractRequiredFields() {
  return fieldsByPriority(FIELD_PRIORITY.CRITICAL);
}

function buildExternalAnalysisJsonObject(options = {}) {
  const ticker = normalizeTicker(options.tickerHint);
  return {
    schemaVersion: "external-analysis-report/v1",
    analysisOrigin: "external_chatgpt",
    source: "ChatGPT",
    sourceModel: null,
    analysisDate: null,
    reportPeriod: null,
    company: {
      ticker: ticker || null,
      name: null,
      sector: null,
      industry: null,
      currency: "USD"
    },
    market: {
      priceAtAnalysis: null,
      userAverageCost: null
    },
    scores: {
      quality: null,
      growth: null,
      valuation: null,
      risk: null,
      overall: null,
      moat: null,
      management: null
    },
    fairValue: {
      bear: null,
      base: null,
      bull: null,
      weightedFairValue: null,
      analystFairValue: null,
      upsideToBasePct: null,
      downsideToBearPct: null,
      upsideToBullPct: null
    },
    valuationMethods: {
      dcf: null,
      pe: null,
      evEbitda: null,
      ps: null,
      peg: null,
      sotp: null,
      other: null
    },
    financialHighlights: {
      revenue: null,
      revenueGrowthPct: null,
      operatingIncome: null,
      operatingIncomeGrowthPct: null,
      operatingMarginPct: null,
      epsReported: null,
      epsNormalized: null,
      operatingCashFlow: null,
      freeCashFlow: null,
      capex: null,
      cash: null,
      debt: null
    },
    growthHighlights: {
      revenueGrowth: null,
      epsGrowth: null,
      fcfGrowth: null,
      majorSegmentGrowth: null,
      marginTrend: null,
      marketShareTrend: null,
      tamComment: null
    },
    quality: {
      summary: null,
      strengths: [],
      weaknesses: [],
      moat: null,
      profitability: null,
      balanceSheet: null,
      capitalAllocation: null,
      earningsQuality: null
    },
    risks: [],
    catalysts: [],
    thesis: {
      shortSummary: null,
      fullSummary: null
    },
    earningsQuality: {
      status: null,
      reportedVsNormalizedExplanation: null,
      oneOffItems: []
    },
    watchItems: [],
    decision: {
      verdict: null,
      rationale: null,
      buyZone: null,
      fairZone: null,
      expensiveZone: null
    },
    sources: []
  };
}

function fieldsByPriority(priority) {
  return FIELD_REQUIREMENTS.filter((field) => field.priority === priority);
}

function fieldLines(fields) {
  return fields.map((field, index) => `${index + 1}. ${field.path} - ${field.labelAr} - ${field.expectedType}`);
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!clean || ["TICKER", "SYMBOL"].includes(clean)) return "";
  return clean.slice(0, 12);
}
