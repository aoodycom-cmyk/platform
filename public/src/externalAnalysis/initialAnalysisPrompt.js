import {
  buildFranklinV3ReportTemplate,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION
} from "./v3Contract.js";
import { buildDownloadableJsonDeliveryInstructions } from "./downloadableJsonDelivery.js";

export const FRANKLIN_INITIAL_PROMPT_VERSION = "franklin-initial-analysis-prompt/v3";

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
        "اشرح المحرك الاقتصادي الحقيقي: ما الذي يرفع الإيراد، وما الذي يحدد الهامش، وما الذي يحتاج رأس مال، وأين توجد قوة التسعير أو الدورية.",
        "اختر KPIs خاصة بهذه الشركة وصناعتها فقط، واشرح لماذا كل KPI مهم ولا تستبدلها بمؤشرات عامة لا تقيس محرك النشاط."
      ],
      fullSceneReading: [
        "اقرأ آخر النتائج المالية والتوجيهات وتعليقات الإدارة والاتجاه التشغيلي.",
        "حلل النمو والهوامش والربحية وFCF والسيولة والديون وجودة الميزانية وتخصيص رأس المال عندما تكون مادية.",
        "افحص جودة الأرباح: افصل GAAP عن non-GAAP، وبيّن أثر SBC والبنود غير المتكررة ورأس المال العامل وCapex والاستحواذات عندما تكون مادية.",
        "املأ financialNormalization كطبقة مالية موحدة: الإيراد، GAAP/adjusted/normalized net income وEPS، diluted shares، SBC، OCF، Capex، working capital، FCF، cash، debt، net debt والضريبة، مع basis والفترة والوحدة والمصدر لكل رقم متاح.",
        "يجب أن يساوي netDebt = debt - cash عند تطابق الفترة والعملة، وأن يوضح reconciliationNotes أي تعريف مختلف لـ FCF أو أي بند مستبعد من التطبيع.",
        "افحص عدد الأسهم المخفف والتخفيف المحتمل، وحوّل كل قيمة عادلة إلى أساس share أو ADS أو ADR الصحيح دون خلط.",
        "اقرأ وضع الصناعة والدورة والطلب والتسعير والمنافسة والحصة السوقية والقدرة الإنتاجية أو التوريد عندما تكون مادية.",
        "أدخل أثر الفائدة والعملات والتنظيم والجغرافيا السياسية والاقتصاد الكلي فقط عندما يكون لها أثر مادي على الشركة.",
        "طبّع الأرباح والهوامش للشركات الدورية، ولا تثبّت ذروة أو قاع دورة داخل التقييم طويل الأجل دون تبرير.",
        "قارن ما يسعره السوق حاليًا مع ما تراه الأدلة والافتراضات، واستخدم Reverse DCF أو مقارنة التوقعات بالسعر عندما يكون ذلك مفيدًا.",
        "حدد نقاط القوة والضعف الحالية، والمخاطر المستقبلية، والمحفزات، وما الذي قد يغيّر الفرضية."
      ],
      forecast: [
        "كوّن توقعًا أماميًا مبنيًا على reported data ثم consensus ثم analyst assumptions مع فصل واضح بينها.",
        "استخدم أفقًا مناسبًا لطبيعة الشركة، واذكر لكل سنة basis واضحًا؛ لا تمدد Guidance قصير الأجل ميكانيكيًا إلى سنوات بعيدة.",
        "اربط توقع EPS وFCF بعدد الأسهم المخفف وCapex ورأس المال العامل والضرائب عندما تكون مادية.",
        "لا تخترع رقمًا. استخدم null عند غياب معلومة لا يمكن توثيقها."
      ],
      valuation: [
        "اختر طرق التقييم المناسبة لطبيعة الشركة فقط، ولا تستخدم قالب تقييم ثابت لكل الشركات.",
        "الطرق المتاحة تشمل DCF وReverse DCF وP/E وPEG وEV/EBITDA وEV/EBIT وP/S وEV/Sales وP/FCF وSOTP وDividend Discount Model وPrice to Book وComparable Companies وHistorical Multiples.",
        "اشرح لماذا اخترت كل طريقة ولماذا استبعدت الطرق غير المناسبة.",
        "عند استخدام EV-based valuation، اعرض الانتقال من Enterprise Value إلى Equity Value باستخدام صافي الدين والبنود غير التشغيلية ثم اقسم على diluted shares؛ لا تخلط EV multiple مع قيمة السهم مباشرة.",
        "حافظ على اتساق العملة والوحدة والأساس المحاسبي والفترة الزمنية بين المقارنات، ولا تجمع طرقًا غير مستقلة لإعطاء دقة زائفة.",
        "لكل valuationResult اكتب formula وcalculation steps والمدخلات، ثم computedFairValue؛ وعند طرق EV املأ Enterprise Value وصافي الدين والتعديلات غير التشغيلية وEquity Value وعدد الأسهم المخفف.",
        "احسب valuation.calculationAudit.weightedMethodFairValue من نتائج الطرق وأوزانها. إذا اختلف Base بسبب حكم تحليلي، عبّر عنه فقط عبر analystOverlayPct مع سبب صريح، واجعل reconciledBaseFairValue مساويًا لـ Base.",
        "استخدم الطريقة الأساسية للحكم والطريقة الثانوية كاختبار معقولية، ولا تجعل المتوسط الحسابي يعوّض افتراضات ضعيفة.",
        "أنشئ ثلاثة سيناريوهات فقط: Bear وBase وBull، وحدد احتمالات تجمع 100% وقيمة عادلة لكل سيناريو.",
        "احسب probabilityWeighted من قيم السيناريوهات واحتمالاتها."
      ],
      decision: [
        "أصدر قرارًا واحدًا فقط على مستوى السهم: BUY أو ADD أو HOLD أو WATCH أو REDUCE أو SELL.",
        "اربط القرار بالسعر الحالي مقابل Base وprobabilityWeighted، وهامش الأمان، وجودة الشركة، ومخاطر الهبوط والثقة؛ لا تصدر القرار من نسبة upside وحدها.",
        "أنشئ فرضية استثمار واضحة، أهم ما يدعمها، أهم ما يهددها، ومحفزات الترقية والتخفيض.",
        "أنشئ 4 إلى 8 nextRequirements موضوعية ومادية للربع القادم، أوزانها تجمع 100% وكل status فيها NOT_REPORTED."
      ]
    },
    researchPolicy: {
      freshness: "استخدم أحدث معلومات متاحة وقت التحليل.",
      sourcePriority: ["Investor Relations", "SEC", "Earnings Call", "Market Data", "Consensus Data", "Trusted Financial News"],
      sourceRoles: "استخدم IR/SEC/Earnings Call للبيانات المعلنة، وConsensus Data للتوقعات فقط، وMarket Data للسعر فقط؛ لا تعرض consensus أو خبرًا صحفيًا كإفصاح صادر عن الشركة.",
      provenance: "كل رقم مادي أو ادعاء مهم يجب أن يكون قابلاً للتتبع إلى sourceId موجود في sources عندما يسمح الحقل بذلك.",
      comparability: "لا تقارن رقمين إلا بعد توحيد الفترة والوحدة والعملة وأساس GAAP/non-GAAP وأساس share/ADS/ADR.",
      evidenceSeparation: "افصل بوضوح بين reportedData وconsensusEstimates وanalystAssumptions؛ لا تعرض التقدير كرقم معلن.",
      noFabrication: true
    },
    outputContract: {
      schemaVersion: FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
      methodologyVersion: FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
      analysisType: "INITIAL",
      format: "DOWNLOADABLE_UTF8_JSON_FILE",
      language: "العربية المبسطة أولًا في جميع النصوص الموجهة للمستثمر. اذكر المصطلح الإنجليزي بين قوسين عند أول ظهور فقط، ولا تكتب جملًا عربية ممزوجة بعبارات إنجليزية غير مشروحة.",
      languageQuality: [
        "outputLanguage يجب أن يساوي ar.",
        "أنشئ companyGlossary من 4 إلى 12 مصطلحًا خاصًا بنشاط الشركة أو قطاعها.",
        "لكل مصطلح اكتب termAr وtermEn وplainExplanationAr وwhyItMattersAr.",
        "plainExplanationAr يشرح المعنى بلغة مستثمر ذكي غير متخصص، وwhyItMattersAr يشرح أثره على النمو أو الهوامش أو المخاطر أو التقييم.",
        "لا تستخدم مصطلحًا فنيًا إنجليزيًا داخل السرد قبل شرحه بالعربية وإضافته إلى companyGlossary.",
        "أسماء الشركات والمنتجات والرموز والأسهم يمكن أن تبقى بالإنجليزية، أما المعنى والاستنتاج فيجب أن يكونا بالعربية."
      ],
      missingValue: null,
      forbidden: ["نص قبل JSON", "نص بعد JSON", "تعليقات برمجية", "undefined", "NaN", "Infinity", "trailing commas", "حقول مخترعة خارج العقد"],
      arrayPolicy: "احذف عناصر القالب الوهمية من arrays؛ استخدم عناصر حقيقية فقط أو [] عندما يسمح العقد، ولا تترك عنصرًا كله null.",
      validatorCompatibility: [
        `schemaVersion يجب أن يكون ${FRANKLIN_FAIR_VALUE_SCHEMA_VERSION}`,
        `methodologyVersion يجب أن يكون ${FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION}`,
        "analysisType يجب أن يكون INITIAL",
        "previousRequirementsEvaluation = null",
        "nextRequirements.previousQuarter وnextRequirements.targetQuarter يجب أن يستخدما الصيغة الحرفية Q{1-4} YYYY.",
        "nextRequirements.previousQuarter يجب أن يساوي فترة reportIdentity، وtargetQuarter يجب أن يكون الربع المالي التالي مباشرة.",
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
      quarterPeriodRules: {
        exactFormat: "Q{1-4} YYYY",
        correctExamples: ["Q3 2026", "Q4 2026"],
        incorrectExamples: ["FY2026 Q3", "Q3 FY2026"],
        previousQuarter: "must equal reportIdentity fiscalQuarter + fiscalYear",
        targetQuarter: "must equal the immediately following fiscal quarter unless Franklin lifecycle logic intentionally supplies another target",
        mandatoryPreOutputValidation: "Before output, verify both fields use the exact format and the quarter transition is correct."
      },
      arithmeticChecks: [
        "Bear <= Base <= Bull",
        "Bear/Base/Bull probabilities total 100%",
        "valuation methodology modelWeights total 100%",
        "weightedMethodFairValue = sum(valuationResults fairValue * weight / 100)",
        "reconciledBaseFairValue = weightedMethodFairValue * (1 + analystOverlayPct / 100) = valuation.current.base",
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
      "GAAP/non-GAAP والعملات والوحدات وأساس share/ADS/ADR متسقة",
      "صافي الدين وعدد الأسهم المخفف وأثر SBC/التخفيف داخل التقييم عندما تكون مادية",
      "financialNormalization مكتمل بقدر البيانات المتاحة ومتصالح حسابيًا",
      "كل طريقة تقييم قابلة للتتبع من formula وsteps إلى computedFairValue",
      "متوسط الطرق والحكم التحليلي يتصالحان حسابيًا مع Base",
      "الفرضية والمخاطر والمحفزات والمتطلبات القادمة موجودة",
      "صيغة previousQuarter وtargetQuarter هي Q{1-4} YYYY، والأول يطابق ربع التقرير والثاني هو الربع التالي مباشرة",
      "المصادر قابلة للتتبع ولا توجد أرقام مختلقة",
      "JSON صالح ومتوافق مع القالب حرفيًا"
    ],
    jsonTemplate: template
  };

  const compatibilityPreamble = [
    "Fair value / ChatGPT هو نظام التحليل المالي المسؤول عن البحث والتفسير والتقييم.",
    "قبل التحليل: ابحث في الويب عن سعر السوق الحالي الموثق للسهم المطلوب. إذا لم يتوفر سعر LIVE موثق، استخدم أحدث LAST_CLOSE موثق. لا تستخدم الذاكرة ولا تترك السعر null.",
    "MARKET PRICE GATE — يمنع إخراج JSON حتى تملأ الحقول الخمسة التالية: marketPrice.value وmarketPrice.currency وmarketPrice.asOf وmarketPrice.priceType وmarketPrice.sourceId.",
    "أنشئ داخل sources مصدر Market Data مطابقًا لـ marketPrice.sourceId، واجعل usedFor يحتوي القيمة الحرفية marketPrice. يجب أن يكون رابط المصدر مباشرًا وتاريخ المصدر موافقًا للسعر.",
    "مثال بنيوي فقط بلا أرقام قابلة للنسخ: ضع داخل marketPrice الحقول value وcurrency وasOf وpriceType وsourceId؛ ثم أنشئ مصدرًا مطابقًا بمعرّف مثل MKT1 ونوع Market Data وusedFor يتضمن marketPrice.",
    "اشرح الشركة للمستثمر الذكي غير المتخصص.",
    "LANGUAGE GATE — outputLanguage = ar. اكتب السرد بالعربية المبسطة، واجعل المصطلح العربي أولًا ثم الإنجليزي بين قوسين عند أول ظهور فقط.",
    "أنشئ companyGlossary من 4 إلى 12 مصطلحًا فنيًا خاصًا بالشركة. أي مصطلح إنجليزي فني يظهر في السرد يجب أن يكون مشروحًا في هذا القاموس.",
    ticker ? `قيمة ticker داخل القالب: \"ticker\": \"${ticker}\"` : "قيمة ticker داخل القالب يجب أن تكون null إذا لم يتوفر رمز صالح.",
    "كل status في nextRequirements.requirements يجب أن يكون NOT_REPORTED.",
    "QUARTER FORMAT GATE — nextRequirements.previousQuarter وnextRequirements.targetQuarter يجب أن يكونا حرفيًا بصيغة Q1-Q4 ثم مسافة ثم YYYY، مثل \"Q3 2026\" و\"Q4 2026\". الصيغ \"FY2026 Q3\" و\"Q3 FY2026\" ممنوعة.",
    "قبل إخراج JSON تحقق إلزاميًا أن previousQuarter يطابق reportIdentity fiscalQuarter/fiscalYear وأن targetQuarter هو الربع المالي التالي مباشرة، إلا إذا زودت دورة Franklin هدفًا مختلفًا مقصودًا.",
    "Franklin يعيّن Requirement Set ID الدائم بعد نجاح الحفظ؛ nextRequirements.requirementSetId = null.",
    "sourceType: Investor Relations | SEC | Earnings Call | Market Data | Consensus Data | Trusted Financial News | User Provided | Other",
    "valuationRole: PRIMARY | SECONDARY | CROSS_CHECK",
    "JSON OUTPUT SAFETY — MANDATORY",
    ...buildDownloadableJsonDeliveryInstructions({
      fileName: `franklin-${ticker || "TICKER"}-initial-analysis.json`,
      schemaVersion: FRANKLIN_FAIR_VALUE_SCHEMA_VERSION
    }),
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
    "بعد اكتمال التحليل أنشئ ملف JSON القابل للتنزيل وأرفقه وفق FILE DELIVERY أعلاه؛ لا تجعل المستخدم ينسخ JSON الطويل يدويًا.",
    JSON.stringify(request)
  ].join("\n\n");
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}
