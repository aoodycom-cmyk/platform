import {
  buildFranklinV3ReportTemplate,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION
} from "./v3Contract.js";

export const FRANKLIN_INITIAL_PROMPT_VERSION = "franklin-initial-analysis-prompt/v1";

export function buildInitialAnalysisPrompt(options = {}) {
  const ticker = normalizeTicker(options.tickerHint);
  const template = buildFranklinV3ReportTemplate({ tickerHint: ticker, analysisType: "INITIAL" });
  const request = {
    promptVersion: FRANKLIN_INITIAL_PROMPT_VERSION,
    requestType: "FRANKLIN_INITIAL_ANALYSIS",
    instruction: "نفّذ تحليلًا استثماريًا أوليًا كاملًا وعميقًا للشركة، ثم أعد النتيجة فقط بعقد Franklin JSON المحدد أدناه.",
    ticker: ticker || null,
    authority: {
      analyst: "ChatGPT / Fair Value",
      franklinRole: "يعرض ويحفظ ويتحقق حسابيًا فقط ولا يصدر الحكم المالي",
      rule: "كل اختيار مالي أو استثماري، بما في ذلك طرق التقييم والافتراضات وBear/Base/Bull والاحتمالات والقيمة العادلة والقرار والفرضية والمتطلبات، يصدر من ChatGPT / Fair Value فقط."
    },
    analysisScope: {
      companyUnderstanding: [
        "اشرح بوضوح للمستثمر الذكي غير المتخصص ماذا تفعل الشركة وكيف تكسب المال ومن هم العملاء وأهم المنتجات أو الأنشطة.",
        "اختر KPIs خاصة بهذه الشركة وصناعتها فقط، واشرح لماذا كل KPI مهم."
      ],
      fullSceneReading: [
        "اقرأ آخر النتائج المالية والتوجيهات وتعليقات الإدارة والاتجاه التشغيلي.",
        "حلل النمو والهوامش والربحية وFCF والسيولة والديون وجودة الميزانية وتخصيص رأس المال عندما تكون مادية.",
        "اقرأ وضع الصناعة والدورة والطلب والتسعير والمنافسة والحصة السوقية والقدرة الإنتاجية أو التوريد عندما تكون مادية.",
        "أدخل أثر الفائدة والعملات والتنظيم والجغرافيا السياسية والاقتصاد الكلي فقط عندما يكون لها أثر مادي على الشركة.",
        "قارن ما يسعره السوق حاليًا مع ما تراه الأدلة والافتراضات، واستخدم Reverse DCF أو مقارنة التوقعات بالسعر عندما يكون ذلك مفيدًا.",
        "حدد نقاط القوة والضعف الحالية، والمخاطر المستقبلية، والمحفزات، وما الذي قد يغيّر الفرضية."
      ],
      forecast: [
        "كوّن توقعًا أماميًا مبنيًا على reported data ثم consensus ثم analyst assumptions مع فصل واضح بينها.",
        "لا تخترع رقمًا. استخدم null عند غياب معلومة لا يمكن توثيقها."
      ],
      valuation: [
        "اختر طرق التقييم المناسبة لطبيعة الشركة فقط، ولا تستخدم قالب تقييم ثابت لكل الشركات.",
        "الطرق المتاحة تشمل DCF وReverse DCF وP/E وPEG وEV/EBITDA وEV/EBIT وP/S وEV/Sales وP/FCF وSOTP وDividend Discount Model وPrice to Book وComparable Companies وHistorical Multiples.",
        "اشرح لماذا اخترت كل طريقة ولماذا استبعدت الطرق غير المناسبة.",
        "أنشئ ثلاثة سيناريوهات فقط: Bear وBase وBull، وحدد احتمالات تجمع 100% وقيمة عادلة لكل سيناريو.",
        "احسب probabilityWeighted من قيم السيناريوهات واحتمالاتها."
      ],
      decision: [
        "أصدر قرارًا واحدًا فقط على مستوى السهم: BUY أو ADD أو HOLD أو WATCH أو REDUCE أو SELL.",
        "أنشئ فرضية استثمار واضحة، أهم ما يدعمها، أهم ما يهددها، ومحفزات الترقية والتخفيض.",
        "أنشئ 4 إلى 8 nextRequirements موضوعية ومادية للربع القادم، أوزانها تجمع 100% وكل status فيها NOT_REPORTED."
      ]
    },
    researchPolicy: {
      freshness: "استخدم أحدث معلومات متاحة وقت التحليل.",
      sourcePriority: ["Investor Relations", "SEC", "Earnings Call", "Market Data", "Consensus Data", "Trusted Financial News"],
      provenance: "كل رقم مادي أو ادعاء مهم يجب أن يكون قابلاً للتتبع إلى sourceId موجود في sources عندما يسمح الحقل بذلك.",
      evidenceSeparation: "افصل بوضوح بين reportedData وconsensusEstimates وanalystAssumptions؛ لا تعرض التقدير كرقم معلن.",
      noFabrication: true
    },
    outputContract: {
      schemaVersion: FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
      methodologyVersion: FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
      analysisType: "INITIAL",
      format: "EXACTLY_ONE_FENCED_JSON_BLOCK",
      language: "العربية للنصوص، مع إبقاء المصطلحات المالية القياسية بالإنجليزية عند الحاجة",
      missingValue: null,
      forbidden: ["نص قبل JSON", "نص بعد JSON", "تعليقات برمجية", "undefined", "NaN", "Infinity", "trailing commas", "حقول مخترعة خارج العقد"],
      validatorCompatibility: [
        `schemaVersion يجب أن يكون ${FRANKLIN_FAIR_VALUE_SCHEMA_VERSION}`,
        `methodologyVersion يجب أن يكون ${FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION}`,
        "analysisType يجب أن يكون INITIAL",
        "previousRequirementsEvaluation = null",
        "nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base",
        "marketPrice.currency وvaluation.current.currency يجب أن يساويا company.tradingCurrency"
      ],
      initialRules: {
        previousAnalysisId: null,
        previousRequirementSetId: null,
        previousRequirementsEvaluation: null,
        valuationReviewStatus: "INITIAL",
        valuationPrevious: null,
        valuationChange: null,
        thesisStatus: "INITIAL",
        thesisPreviousSummary: null,
        nextRequirementSetId: null,
        nextRequirementStatuses: "NOT_REPORTED"
      },
      arithmeticChecks: [
        "Bear <= Base <= Bull",
        "Bear/Base/Bull probabilities total 100%",
        "valuation methodology modelWeights total 100%",
        "valuation.current values equal scenario fair values",
        "probabilityWeighted equals scenario probability-weighted value",
        "upsideToBasePct = (Base / marketPrice.value - 1) * 100",
        "marginOfSafetyPct = ((Base - marketPrice.value) / Base) * 100",
        "nextRequirements.currentJustifiedValue = valuation.current.base",
        "nextRequirements weights total 100%"
      ],
      marketRules: [
        "marketPrice.value must be a traceable positive market price",
        "marketPrice.asOf and priceType must describe whether it is LIVE, DELAYED, or LAST_CLOSE",
        "company.reportingCurrency and company.tradingCurrency must remain distinct",
        "marketPrice.currency and valuation.current.currency must equal company.tradingCurrency"
      ],
      brevityRules: [
        "اكتب السرد بعمق لكن بدون تكرار الفكرة نفسها في عدة حقول.",
        "اجعل summary مختصرًا، وضع التفاصيل في الحقول المتخصصة.",
        "لا تحذف الأرقام المادية من أجل الاختصار."
      ]
    },
    completionChecklist: [
      "ملف الشركة ونموذج العمل واضحان",
      "آخر ربع وKPIs والتوجيهات والمشهد الأمامي مقروءة",
      "المشهد الصناعي والتنافسي والمخاطر المادية مغطى",
      "طرق التقييم مختارة حسب الشركة ومبررة",
      "Bear/Base/Bull فقط ومجموع الاحتمالات 100%",
      "Base وprobabilityWeighted والسعر الحالي والقرار متسقة",
      "الفرضية والمخاطر والمحفزات والمتطلبات القادمة موجودة",
      "المصادر قابلة للتتبع ولا توجد أرقام مختلقة",
      "JSON صالح ومتوافق مع القالب حرفيًا"
    ],
    jsonTemplate: template
  };

  const compatibilityPreamble = [
    "Fair value / ChatGPT هو نظام التحليل المالي المسؤول عن البحث والتفسير والتقييم.",
    "اشرح الشركة للمستثمر الذكي غير المتخصص.",
    ticker ? `قيمة ticker داخل القالب: \"ticker\": \"${ticker}\"` : "قيمة ticker داخل القالب يجب أن تكون null إذا لم يتوفر رمز صالح.",
    "كل status في nextRequirements.requirements يجب أن يكون NOT_REPORTED.",
    "Franklin يعيّن Requirement Set ID الدائم بعد نجاح الحفظ؛ nextRequirements.requirementSetId = null.",
    "JSON OUTPUT SAFETY — MANDATORY",
    "Return exactly one fenced JSON code block.",
    "Do not write any prose before or after the fenced JSON block.",
    "After removing only the opening ```json fence and closing ``` fence, the remaining text must pass JSON.parse().",
    "Exactly one opening ```json fence and one closing ``` fence exist.",
    "NEVER escape underscores in JSON enum values or keys.",
    "Invalid example: \"LAST\\_CLOSE\". Correct value: \"LAST_CLOSE\".",
    "URL fields must contain raw URLs only.",
    "Never use Markdown links inside JSON.",
    "decision.confidence must be a number from 0 to 100 or null.",
    "businessQuality.score and all score fields use a 0-100 scale, NOT 0-10.",
    "Prefer concise financial statements and avoid duplicated narrative.",
    "Target: less repeated prose, NOT less financial evidence."
  ];

  return [
    ...compatibilityPreamble,
    "نفّذ الطلب التالي كما هو. اقرأ كل التعليمات أولًا ثم ابحث وحلل، ولا تبدأ بإخراج JSON قبل اكتمال التحليل والتحقق الداخلي.",
    "بعد الانتهاء أخرج فقط fenced JSON واحد يبدأ بـ ```json وينتهي بـ ```، بدون أي نص خارجه.",
    JSON.stringify(request)
  ].join("\n\n");
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}
