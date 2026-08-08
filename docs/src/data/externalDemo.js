import { normalizeExternalAnalysisReport } from "../externalAnalysis/schema.js";

export function createDemoExternalAnalysisReport(now = new Date("2026-08-08T10:00:00.000Z")) {
  const raw = JSON.stringify(DEMO_EXTERNAL_ANALYSIS, null, 2);
  return normalizeExternalAnalysisReport(DEMO_EXTERNAL_ANALYSIS, raw, {
    now,
    importMethod: "demo_external_json"
  });
}

export function createDemoExternalAnalysisScenario() {
  return [
    normalizeDemoReport(DEMO_PRE_EARNINGS_ANALYSIS, "2026-08-08T10:00:00.000Z"),
    normalizeDemoReport(DEMO_EARNINGS_ANALYSIS, "2026-11-08T10:00:00.000Z")
  ];
}

function normalizeDemoReport(report, timestamp) {
  const raw = JSON.stringify(report, null, 2);
  return normalizeExternalAnalysisReport(report, raw, {
    now: new Date(timestamp),
    importMethod: "demo_external_json"
  });
}

const DEMO_REQUIREMENTS_Q4 = [
  {
    id: "revenue_growth",
    name: "Revenue Growth",
    arabicName: "نمو الإيرادات",
    metric: "Revenue Growth",
    type: "minimum",
    currentLevel: "25%",
    requiredValue: 30,
    unit: "%",
    importance: "critical",
    weight: 25,
    whyItMatters: "Bull Case عند 100 دولار يتطلب استمرار النمو فوق 30%.",
    actualValue: null,
    actualRaw: null,
    status: "NOT_REPORTED",
    evaluationNote: null
  },
  {
    id: "gross_margin",
    name: "Gross Margin",
    arabicName: "Gross Margin",
    metric: "Gross Margin",
    type: "minimum",
    currentLevel: "41%",
    requiredValue: 45,
    unit: "%",
    importance: "critical",
    weight: 30,
    whyItMatters: "التقييم الأعلى يحتاج توسعًا واضحًا في الهوامش.",
    actualValue: null,
    actualRaw: null,
    status: "NOT_REPORTED",
    evaluationNote: null
  },
  {
    id: "eps",
    name: "EPS",
    arabicName: "EPS",
    metric: "EPS",
    type: "minimum",
    currentLevel: "$2.70",
    requiredValue: 3,
    unit: "USD",
    importance: "high",
    weight: 20,
    whyItMatters: "EPS فوق 3 دولارات يؤكد أن النمو يصل إلى الربحية.",
    actualValue: null,
    actualRaw: null,
    status: "NOT_REPORTED",
    evaluationNote: null
  },
  {
    id: "guidance",
    name: "Guidance Raised",
    arabicName: "رفع Guidance",
    metric: "Guidance",
    type: "qualitative",
    currentLevel: "Maintained",
    requiredValue: "Raised",
    unit: "text",
    importance: "critical",
    weight: 25,
    whyItMatters: "رفع Guidance يؤكد أن الطلب مستمر بعد Q4.",
    actualValue: null,
    actualRaw: null,
    status: "NOT_REPORTED",
    evaluationNote: null
  }
];

export const DEMO_PRE_EARNINGS_ANALYSIS = {
  schemaVersion: "external-analysis-report/v1",
  analysisOrigin: "external_chatgpt",
  source: "ChatGPT",
  id: "DEMO-analysis-2026-08-08-pre-q4",
  analysisDate: "2026-08-08",
  reportPeriod: "Q3 2026",
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
    bull: 100
  },
  recommendation: {
    action: "HOLD",
    confidence: 78,
    reason: "الشركة عالية الجودة والنمو، لكن السعر الحالي أعلى من Base Fair Value ويحتاج تحقق Q4 قبل رفع التقييم.",
    whatWouldUpgrade: [
      "Revenue Growth يتجاوز 30%",
      "Gross Margin يصل إلى 45%",
      "Guidance يتم رفعها للربع القادم"
    ],
    whatWouldDowngrade: [
      "Gross Margin يبقى دون 40%",
      "Guidance يتم خفضها"
    ]
  },
  decision: {
    verdict: "HOLD",
    rationale: "الاحتفاظ مبرر، لكن ADD يحتاج إثبات متطلبات Bull Case في Q4."
  },
  guidance: [
    {
      topic: "Revenue",
      arabicTopic: "الإيرادات",
      currentGuidance: "$1.05B-$1.12B",
      previousGuidance: "$0.98B-$1.05B",
      direction: "raised",
      type: "range",
      interpretation: "الإدارة رفعت توقعات الإيرادات قبل Q4.",
      importance: "critical"
    }
  ],
  companySpecificKpis: [
    {
      name: "HBM Revenue Growth",
      arabicName: "نمو إيرادات HBM",
      category: "growth",
      currentValue: "25%",
      unit: "%",
      trend: "improving",
      importance: "critical",
      interpretation: "HBM هو المحرك المطلوب لمعادلة Bull Case."
    }
  ],
  priceTargetRequirements: {
    currentJustifiedValue: 60,
    targetValue: 100,
    targetScenario: "bull",
    targetDescription: "متطلبات Q4 2026 اللازمة لتبرير Bull Case عند 100 دولار.",
    createdAt: "2026-08-08T10:00:00.000Z",
    earningsPeriod: "Q4 2026",
    requirements: DEMO_REQUIREMENTS_Q4
  },
  thesis: {
    shortSummary: "DEMO تستحق المتابعة، لكن الانتقال من Base 60 إلى Bull 100 يحتاج تنفيذ Q4 بوضوح.",
    fullSummary: "هذا التقرير التجريبي يمثل التحليل السابق قبل الأرباح ويخلق متطلبات تاريخية مجمدة."
  },
  risks: [
    {
      title: "Execution risk",
      severity: "Medium",
      explanation: "التقييم الأعلى يعتمد على تحقق النمو والهامش في Q4.",
      whatToMonitor: "Revenue Growth وGross Margin وGuidance.",
      thesisBreaker: "فشل متطلبات Q4 الأساسية مع خفض Guidance."
    }
  ],
  primaryValuationMethod: "EV/EBITDA",
  valuationSelectionReason: "EV/EBITDA مناسب للتقرير التجريبي لأنه يربط Bull Case بتحسن الهوامش والنمو.",
  sources: [
    { title: "Demo pre-earnings ChatGPT analysis", sourceType: "manual", url: null }
  ]
};

export const DEMO_EARNINGS_ANALYSIS = {
  ...DEMO_PRE_EARNINGS_ANALYSIS,
  id: "DEMO-analysis-2026-11-08-q4-results",
  analysisDate: "2026-11-08",
  reportPeriod: "Q4 2026",
  market: {
    priceAtAnalysis: 78,
    userAverageCost: 58
  },
  scores: {
    quality: 8.5,
    growth: 8.7,
    valuation: 6.7,
    risk: 5.2,
    overall: 8.1
  },
  fairValue: {
    bear: 55,
    base: 75,
    bull: 115
  },
  recommendation: {
    action: "ADD",
    confidence: 79,
    reason: "Q4 حقق معظم متطلبات Bull Case السابقة، لكن Gross Margin لم يصل بعد إلى العتبة الكاملة.",
    whatWouldUpgrade: [
      "Gross Margin يتجاوز 46%",
      "Revenue Growth يبقى فوق 28%",
      "Guidance ترتفع مجددًا في Q1 2027"
    ],
    whatWouldDowngrade: [
      "Revenue Growth يهبط دون 20%",
      "Gross Margin يتراجع دون 42%"
    ]
  },
  decision: {
    verdict: "ADD",
    rationale: "التحليل الجديد يقيّم متطلبات Q4 السابقة ويخلق متطلبات Q1 منفصلة، مع بقاء عتبات Q4 الأصلية محفوظة."
  },
  previousRequirementsEvaluation: {
    requirements: [
      { id: "revenue_growth", actualValue: 34, actualRaw: "Revenue Growth reached 34%.", status: "EXCEEDED" },
      { id: "gross_margin", actualValue: 43, actualRaw: "Gross Margin reached 43%.", status: "FAILED" },
      { id: "eps", actualValue: 3.2, actualRaw: "EPS reached $3.20.", status: "PASSED" },
      { id: "guidance", actualValue: "Raised", actualRaw: "Management raised Q1 guidance.", status: "PASSED" }
    ],
    requirementsAssessment: {
      weightedAchievement: 70,
      reportedRequirements: 4,
      totalRequirements: 4,
      passed: 2,
      failed: 1,
      exceeded: 1,
      partiallyPassed: 0,
      notReported: 0,
      overallStatus: "bull_case_strengthened",
      summary: "Revenue Growth وEPS وGuidance حققت المتطلبات، لكن Gross Margin فشل عند 43% مقابل 45%.",
      calculatedAt: "2026-11-08T10:00:00.000Z"
    }
  },
  guidance: [
    {
      topic: "Revenue",
      arabicTopic: "الإيرادات",
      currentGuidance: "$1.20B-$1.28B",
      previousGuidance: "$1.05B-$1.12B",
      direction: "raised",
      type: "range",
      interpretation: "رفع Guidance بعد Q4 يدعم استمرار الطلب.",
      importance: "critical"
    },
    {
      topic: "Gross Margin",
      arabicTopic: "Gross Margin",
      currentGuidance: "44%-46%",
      previousGuidance: "42%-44%",
      direction: "raised",
      type: "percentage",
      interpretation: "الهامش يتحسن لكن يحتاج وصولًا أعلى لتبرير Bull Case الجديد.",
      importance: "high"
    }
  ],
  companySpecificKpis: [
    {
      name: "HBM Revenue Growth",
      arabicName: "نمو إيرادات HBM",
      category: "growth",
      currentValue: "34%",
      unit: "%",
      trend: "improving",
      importance: "critical",
      interpretation: "HBM تجاوز عتبة النمو المطلوبة في Q4."
    },
    {
      name: "Gross Margin",
      arabicName: "Gross Margin",
      category: "profitability",
      currentValue: "43%",
      unit: "%",
      trend: "improving",
      importance: "high",
      interpretation: "الهامش فشل مقابل عتبة 45% لكنه لا يزال يتحسن."
    }
  ],
  priceTargetRequirements: {
    currentJustifiedValue: 75,
    targetValue: 115,
    targetScenario: "bull",
    targetDescription: "متطلبات Q1 2027 الجديدة لتبرير Bull Case عند 115 دولار.",
    createdAt: "2026-11-08T10:00:00.000Z",
    earningsPeriod: "Q1 2027",
    requirements: [
      { id: "revenue_growth_q1", name: "Revenue Growth", arabicName: "نمو الإيرادات", metric: "Revenue Growth", type: "minimum", currentLevel: "34%", requiredValue: 28, unit: "%", importance: "critical", weight: 35, whyItMatters: "استمرار النمو يحافظ على مضاعف Bull Case.", actualValue: null, actualRaw: null, status: "NOT_REPORTED", evaluationNote: null },
      { id: "gross_margin_q1", name: "Gross Margin", arabicName: "Gross Margin", metric: "Gross Margin", type: "minimum", currentLevel: "43%", requiredValue: 46, unit: "%", importance: "critical", weight: 35, whyItMatters: "Bull Case الجديد يحتاج تجاوز مشكلة الهامش.", actualValue: null, actualRaw: null, status: "NOT_REPORTED", evaluationNote: null },
      { id: "guidance_q1", name: "Guidance Raised", arabicName: "رفع Guidance", metric: "Guidance", type: "qualitative", currentLevel: "Raised", requiredValue: "Raised", unit: "text", importance: "high", weight: 30, whyItMatters: "رفع Guidance يؤكد استمرار الطلب.", actualValue: null, actualRaw: null, status: "NOT_REPORTED", evaluationNote: null }
    ]
  },
  thesis: {
    shortSummary: "Q4 عزز الفرضية الاستثمارية لأن DEMO حققت 70% من المتطلبات الموزونة، لكنها لم تبرر Bull Case بالكامل بسبب Gross Margin.",
    fullSummary: "هذا التقرير التجريبي يمثل تحليل الأرباح التالي: يقيم المتطلبات السابقة ثم يخلق متطلبات الربع القادم بشكل منفصل."
  },
  sources: [
    { title: "Demo Q4 earnings ChatGPT analysis", sourceType: "manual", url: null }
  ]
};

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
    weightedAchievement: 72,
    reportedRequirements: 4,
    totalRequirements: 5,
    passed: 2,
    failed: 1,
    exceeded: 1,
    partiallyPassed: 0,
    notReported: 1,
    overallStatus: "bull_case_weakened",
    summary: "الشركة حققت معظم متطلبات Bull Case، لكن Gross Margin بقي دون العتبة المطلوبة لتبرير 100 دولار بالكامل.",
    calculatedAt: "2026-08-08T10:00:00.000Z"
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
