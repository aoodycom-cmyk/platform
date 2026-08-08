import { normalizeExternalAnalysisReport } from "../externalAnalysis/schema.js";

export function createDemoExternalAnalysisReport(now = new Date("2026-08-08T10:00:00.000Z")) {
  const raw = JSON.stringify(DEMO_EXTERNAL_ANALYSIS, null, 2);
  return normalizeExternalAnalysisReport(DEMO_EXTERNAL_ANALYSIS, raw, {
    now,
    importMethod: "demo_external_json"
  });
}

export const DEMO_EXTERNAL_ANALYSIS = {
  schemaVersion: "external-analysis-report/v1",
  analysisOrigin: "external_chatgpt",
  source: "ChatGPT",
  analysisDate: "2026-08-08",
  reportPeriod: "Q2 2026",
  company: {
    ticker: "DEMO",
    name: "Demo Semiconductor Systems",
    sector: "Technology",
    industry: "Semiconductor Equipment",
    currency: "USD"
  },
  market: {
    priceAtAnalysis: 65,
    userAverageCost: 58
  },
  scores: {
    quality: 8.4,
    growth: 8.9,
    valuation: 6.2,
    risk: 5.8,
    overall: 7.8
  },
  fairValue: {
    bear: 45,
    base: 60,
    bull: 100,
    weightedFairValue: 67,
    analystFairValue: 60,
    upsideToBasePct: -0.077,
    downsideToBearPct: -0.308,
    upsideToBullPct: 0.538
  },
  recommendation: {
    action: "HOLD",
    confidence: 78,
    reason: "الشركة عالية الجودة والنمو، لكن السعر الحالي أعلى قليلًا من Base Fair Value ولم تثبت بعد كامل متطلبات Bull Case.",
    whatWouldUpgrade: [
      "Revenue Growth يبقى أعلى من 30%",
      "Gross Margin يتجاوز 45%",
      "Guidance يتم رفعها للربع القادم"
    ],
    whatWouldDowngrade: [
      "Guidance يتم خفضها",
      "Gross Margin يهبط دون 40%",
      "طلب العملاء الرئيسيين يتراجع"
    ]
  },
  decision: {
    verdict: "HOLD",
    rationale: "الاحتفاظ مبرر لأن التنفيذ التشغيلي قوي، لكن إضافة مركز جديد تتطلب تحقق متطلبات Bull Case."
  },
  guidance: [
    {
      topic: "Revenue",
      arabicTopic: "الإيرادات",
      currentGuidance: "$1.05B-$1.12B",
      previousGuidance: "$0.98B-$1.05B",
      direction: "raised",
      type: "range",
      interpretation: "الإدارة رفعت توقعات الإيرادات بسبب قوة الطلب على أنظمة الذاكرة المتقدمة.",
      importance: "critical"
    },
    {
      topic: "Gross Margin",
      arabicTopic: "Gross Margin",
      currentGuidance: "42%-44%",
      previousGuidance: "41%-43%",
      direction: "raised",
      type: "percentage",
      interpretation: "تحسن المزيج السعري يدعم الهوامش، لكنه لم يصل بعد إلى مستوى Bull Case.",
      importance: "high"
    },
    {
      topic: "Demand commentary",
      arabicTopic: "تعليق الطلب",
      currentGuidance: "Customer demand remains broad-based.",
      previousGuidance: null,
      direction: "maintained",
      type: "qualitative",
      interpretation: "الطلب ما زال صحيًا لكنه يحتاج إلى ترجمة أوضح في Backlog.",
      importance: "medium"
    }
  ],
  companySpecificKpis: [
    {
      name: "HBM Revenue Growth",
      arabicName: "نمو إيرادات HBM",
      category: "growth",
      currentValue: "38%",
      unit: "%",
      trend: "improving",
      importance: "critical",
      interpretation: "نمو HBM هو المحرك الأساسي لاحتمال الانتقال إلى Bull Case."
    },
    {
      name: "Gross Margin",
      arabicName: "Gross Margin",
      category: "profitability",
      currentValue: "43%",
      unit: "%",
      trend: "improving",
      importance: "high",
      interpretation: "الهامش يتحسن لكنه لا يزال دون عتبة 45% المطلوبة للتقييم الأعلى."
    },
    {
      name: "Capacity Sold Out",
      arabicName: "الطاقة الإنتاجية المباعة",
      category: "capacity",
      currentValue: "2026 sold out",
      unit: "text",
      trend: "stable",
      importance: "high",
      interpretation: "امتلاء الطاقة الإنتاجية يقلل مخاطر الطلب القريب."
    }
  ],
  priceTargetRequirements: {
    currentJustifiedValue: 60,
    targetValue: 100,
    targetScenario: "bull",
    targetDescription: "المتطلبات اللازمة لتبرير Bull Case عند 100 دولار.",
    createdAt: "2026-08-08T10:00:00.000Z",
    earningsPeriod: "Q3 2026",
    requirements: [
      {
        id: "rev_growth_01",
        name: "Revenue Growth",
        arabicName: "نمو الإيرادات",
        metric: "Revenue Growth",
        type: "minimum",
        currentLevel: "25%",
        requiredValue: 30,
        unit: "%",
        importance: "critical",
        weight: 25,
        whyItMatters: "Bull Case يفترض استمرار النمو العالي.",
        actualValue: 34,
        actualRaw: "Revenue grew 34% year over year.",
        status: "EXCEEDED",
        evaluationNote: "النمو تجاوز العتبة المطلوبة."
      },
      {
        id: "gross_margin_01",
        name: "Gross Margin",
        arabicName: "Gross Margin",
        metric: "Gross Margin",
        type: "minimum",
        currentLevel: "41%",
        requiredValue: 45,
        unit: "%",
        importance: "critical",
        weight: 25,
        whyItMatters: "التقييم الأعلى يتطلب توسعًا واضحًا في الهوامش.",
        actualValue: 43,
        actualRaw: "Gross margin reached 43%.",
        status: "FAILED",
        evaluationNote: "الهامش تحسن لكنه لم يصل إلى 45%."
      },
      {
        id: "guidance_01",
        name: "Guidance Raised",
        arabicName: "رفع Guidance",
        metric: "Revenue Guidance",
        type: "qualitative",
        currentLevel: "Maintained",
        requiredValue: "Raised",
        unit: "text",
        importance: "high",
        weight: 20,
        whyItMatters: "رفع Guidance يؤكد أن الطلب مستمر بعد الربع الحالي.",
        actualValue: "Raised",
        actualRaw: "Management raised next-quarter revenue guidance.",
        status: "PASSED",
        evaluationNote: "الإدارة رفعت التوجيهات."
      },
      {
        id: "hbm_growth_01",
        name: "HBM Growth",
        arabicName: "نمو HBM",
        metric: "HBM Revenue",
        type: "qualitative",
        currentLevel: "Strong",
        requiredValue: "Strong sequential growth",
        unit: "text",
        importance: "high",
        weight: 20,
        whyItMatters: "HBM هو أهم محرك للتوسع في المضاعف.",
        actualValue: "Strong growth",
        actualRaw: "HBM revenue grew strongly sequentially.",
        status: "PASSED",
        evaluationNote: "النمو التسلسلي بقي قويًا."
      },
      {
        id: "fcf_01",
        name: "Free Cash Flow",
        arabicName: "Free Cash Flow",
        metric: "Free Cash Flow",
        type: "boolean",
        currentLevel: "Positive",
        requiredValue: "Positive",
        unit: "text",
        importance: "medium",
        weight: 10,
        whyItMatters: "التقييم الأعلى يحتاج نموًا لا يستهلك كل النقد.",
        actualValue: null,
        actualRaw: null,
        status: "NOT_REPORTED",
        evaluationNote: null
      }
    ]
  },
  requirementsAssessment: {
    overallStatus: "bull_case_weakened",
    summary: "الشركة حققت معظم متطلبات Bull Case، لكن Gross Margin بقي دون العتبة المطلوبة لتبرير 100 دولار بالكامل."
  },
  risks: [
    {
      title: "Gross Margin compression",
      severity: "High",
      explanation: "التقييم الأعلى يعتمد على استمرار توسع الهوامش.",
      whatToMonitor: "راقب Gross Margin وDRAM pricing في كل ربع.",
      thesisBreaker: "Gross Margin يبقى دون 40% لربعين متتاليين مع تباطؤ الإيرادات."
    },
    {
      title: "Customer concentration",
      severity: "Medium",
      explanation: "نمو HBM قد يعتمد على عدد محدود من العملاء.",
      whatToMonitor: "تغيرات الطلب من أكبر العملاء.",
      thesisBreaker: "خسارة عميل رئيسي أو تأجيل طلبات كبيرة."
    }
  ],
  thesis: {
    shortSummary: "DEMO شركة نمو عالية الجودة، لكن الانتقال إلى Bull Case يحتاج استمرار Revenue Growth فوق 30% وتحسن Gross Margin إلى 45% أو أكثر.",
    fullSummary: "الفرضية الاستثمارية إيجابية على المدى الطويل، لكن قرار ADD يحتاج دليلًا إضافيًا بعد الأرباح القادمة."
  },
  catalysts: [
    { title: "Raised guidance", explanation: "رفع Guidance قد يدعم إعادة تقييم السهم." },
    { title: "HBM demand", explanation: "استمرار الطلب القوي على HBM يدعم Bull Case." }
  ],
  watchItems: ["Revenue Growth", "Gross Margin", "HBM Revenue", "Guidance", "Free Cash Flow"],
  primaryValuationMethod: "EV/EBITDA",
  valuationSelectionReason: "EV/EBITDA مناسب لأن الشركة مربحة ودورية جزئيًا وتحتاج مقارنة بالهوامش والطاقة الإنتاجية.",
  valuationMethods: {
    evEbitda: {
      fairValue: 60,
      role: "primary",
      explanation: "Base Case مبني على EV/EBITDA محافظ.",
      weight: 0.6
    },
    dcf: {
      fairValue: 66,
      role: "cross-check",
      explanation: "DCF استخدم كاختبار معقولية بسبب تحسن FCF.",
      weight: 0.4
    }
  },
  scenarios: {
    Bear: {
      fairValue: 45,
      valuationMethod: "EV/EBITDA",
      revenueAssumption: "15%-18%",
      marginAssumption: "Gross Margin below 40%",
      fcfAssumption: "Positive but limited",
      multipleUsed: "12x EBITDA",
      timeHorizon: "12 months",
      assumptions: { demand: "slows" },
      thesis: "تباطؤ الطلب يضغط المضاعف."
    },
    Base: {
      fairValue: 60,
      valuationMethod: "EV/EBITDA",
      revenueAssumption: "25%",
      marginAssumption: "Gross Margin around 43%",
      fcfAssumption: "Positive",
      multipleUsed: "15x EBITDA",
      timeHorizon: "12 months",
      assumptions: { demand: "healthy" },
      thesis: "النمو جيد لكن الهوامش لم تصل إلى Bull Case."
    },
    Bull: {
      fairValue: 100,
      valuationMethod: "EV/EBITDA",
      revenueAssumption: "30%+",
      marginAssumption: "Gross Margin 45%+",
      fcfAssumption: "Strong positive FCF",
      multipleUsed: "20x EBITDA",
      timeHorizon: "12-18 months",
      assumptions: { demand: "accelerates" },
      thesis: "تحقق متطلبات النمو والهامش يبرر إعادة تقييم كبيرة."
    }
  },
  financialHighlights: {
    revenueGrowthPct: 34,
    operatingMarginPct: 21,
    freeCashFlow: 180000000
  },
  sources: [
    { title: "Demo external ChatGPT analysis", sourceType: "manual", url: null }
  ]
};
