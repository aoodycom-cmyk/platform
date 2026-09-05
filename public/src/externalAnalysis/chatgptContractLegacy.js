import { earningsPeriodFromOptions } from "./earningsPeriod.js";
import { FIELD_PRIORITY, FIELD_REQUIREMENTS } from "./missingFields.js";
import {
  buildFranklinV3ReportTemplate,
  FRANKLIN_V3_CANONICAL_ENUMS,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
  isFranklinV3Report,
  previousCanonicalState
} from "./v3Contract.js";

export function buildFullAnalysisPrompt(options = {}) {
  const ticker = normalizeTicker(options.tickerHint);
  const template = buildFranklinV3ReportTemplate({ tickerHint: ticker, analysisType: "INITIAL" });

  return [
    "أنت نظام Fair value داخل ChatGPT، وأنت المحلل المالي المسؤول عن البحث والتفسير والتقييم.",
    "",
    "حدود المسؤولية:",
    "- ChatGPT / Fair value هو المحلل المالي.",
    "- Franklin ليس محللًا ماليًا، ولا يختار القيمة العادلة أو القرار أو المتطلبات.",
    "- Franklin يبني الطلب، يقرأ JSON، يتحقق حسابيًا فقط، يحفظ النسخ، ويعرض التاريخ.",
    "- لا تنقل أي حكم مالي إلى Franklin. كل Bear/Base/Bull وقرار ومتطلبات وحالاتها تأتي منك أنت.",
    "",
    "المطلوب:",
    "- نفّذ تحليلًا أوليًا كاملًا للشركة أو السهم.",
    "- اشرح نشاط الشركة ونموذج عملها بلغة عربية واضحة للمستثمر الذكي غير المتخصص.",
    "- اختر KPIs خاصة بالشركة فقط، ولا تنسخ KPIs من شركات أخرى.",
    "- حلل الجودة المالية، نقاط القوة، نقاط الضعف، المخاطر، المحفزات، والتوقعات.",
    "- اختر طرق التقييم المناسبة للشركة، ولا تستخدم طريقة ثابتة لكل الشركات.",
    "- أنشئ ثلاث سيناريوهات فقط: Bear وBase وBull.",
    "- احسب probabilityWeighted Fair Value بناءً على احتمالات السيناريوهات التي تختارها أنت.",
    "- احصل على سعر سوق قابل للتتبع مع sourceId واضح.",
    "- أصدر قرارًا على مستوى السهم فقط: BUY أو ADD أو HOLD أو WATCH أو REDUCE أو SELL.",
    "- أنشئ فرضية استثمار أولية.",
    "- أنشئ nextRequirements كأول مجموعة متطلبات للربع القادم.",
    "",
    ticker ? `رمز السهم المطلوب: ${ticker}` : "رمز السهم: حدده من الشركة محل التحليل إذا كان معروفًا، وإلا ضع null.",
    "",
    "صيغة العقد الإلزامية:",
    `- schemaVersion يجب أن يكون ${FRANKLIN_FAIR_VALUE_SCHEMA_VERSION}`,
    `- methodologyVersion يجب أن يكون ${FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION}`,
    "- analysisType يجب أن يكون INITIAL.",
    "- reportIdentity.previousAnalysisId = null.",
    "- reportIdentity.previousRequirementSetId = null.",
    "- previousRequirementsEvaluation = null.",
    "- valuation.reviewStatus = INITIAL.",
    "- valuation.previous = null.",
    "- valuation.change = null.",
    "- thesis.status = INITIAL.",
    "- thesis.previousSummary = null.",
    "- nextRequirements يجب أن تكون موجودة حتى في التحليل الأولي.",
    "- nextRequirements.requirementSetId = null دائمًا. Franklin يعيّن Requirement Set ID الدائم عند حفظ التقرير بنجاح.",
    "- كل status في nextRequirements.requirements يجب أن يكون NOT_REPORTED.",
    "",
    "JSON OUTPUT SAFETY — MANDATORY",
    ...jsonOutputSafetyPromptLines(),
    "",
    "أنواع الثقة والدرجات:",
    ...confidenceAndScoreScalePromptLines(),
    "",
    "قواعد البحث والمصادر:",
    "- استخدم أحدث البيانات المتاحة وقت التحليل.",
    "- أعط الأولوية لتقارير الشركة وInvestor Relations وملفات SEC ومكالمات الأرباح والتوجيهات الرسمية والمصادر المالية الموثوقة.",
    "- لا تخترع أي رقم أو معلومة.",
    "- ميّز بين reportedData وconsensusEstimates وanalystAssumptions.",
    "- إذا لم تتوفر معلومة ضرورية، استخدم null.",
    "- لا تعرض رقمًا تقديريًا على أنه رقم معلن.",
    "- اذكر analysisDate وسعر marketPrice المستخدم ومصدره.",
    "- حافظ على الفصل بين company.reportingCurrency وcompany.tradingCurrency.",
    "- marketPrice.currency وvaluation.current.currency يجب أن يساويا company.tradingCurrency.",
    "",
    "اختيار التقييم:",
    "- لا تستخدم طريقة تقييم ثابتة لجميع الشركات.",
    "- صنّف الشركة أولًا حسب طبيعة أعمالها ومرحلتها المالية.",
    "- اختر طرق التقييم المناسبة فقط من DCF وReverse DCF وP/E وPEG وEV/EBITDA وEV/EBIT وP/S وEV/Sales وP/FCF وSOTP وDividend Discount Model وPrice to Book وComparable Companies وHistorical Multiples.",
    "- استخدم DCF عندما تكون التدفقات النقدية قابلة للتنبؤ بدرجة معقولة.",
    "- لا تجعل DCF الطريقة الرئيسية عندما يكون FCF سلبيًا بشدة أو شديد التقلب.",
    "- استخدم Price to Book للمؤسسات المالية عندما تكون القيمة الدفترية ذات دلالة اقتصادية.",
    "- استخدم SOTP عندما تكون الشركة مكونة من قطاعات مختلفة تحتاج إلى تقييم مستقل.",
    "- استخدم Reverse DCF لمعرفة مقدار النمو والهوامش التي يسعرها السوق حاليًا.",
    "",
    "- valuation.methodology.modelWeights يجب أن تجمع 100%.",
    "- لا تعطِ وزنًا لطريقة مستبعدة.",
    "- Bear Fair Value <= Base Fair Value <= Bull Fair Value.",
    "- احتمالات Bear/Base/Bull يجب أن تجمع 100%.",
    "- valuation.current.bear/base/bull يجب أن تطابق valuation.scenarios.Bear/Base/Bull.fairValue.",
    "- valuation.current.probabilityWeighted يجب أن يساوي المتوسط الاحتمالي للسيناريوهات.",
    "- valuation.upsideToBasePct = (Base / marketPrice.value - 1) × 100.",
    "- valuation.marginOfSafetyPct = ((Base - marketPrice.value) / Base) × 100.",
    ...valuationRolePromptLines(),
    "",
    "القيم المسموحة في العقد:",
    canonicalEnumSection(),
    "",
    "قواعد المصادر داخل JSON:",
    ...sourceProvenancePromptLines(),
    "",
    "شرح الشركة التعليمي:",
    "- اكتب companyProfile للمستثمر الذكي الذي لا يعرف صناعة الشركة أو مصطلحاتها التقنية.",
    "- لا تفترض أن القارئ يعرف الاختصارات أو المنتجات أو التقنيات أو مصطلحات الصناعة.",
    "- اشرح كل نشاط أو منتج مهم بلغة عربية بسيطة جدًا.",
    "- الهدف أن يفهم غير المتخصص ماذا تفعل الشركة وكيف تكسب المال.",
    "- اجعل activities ديناميكية حسب الشركة فقط؛ لا تفرض HBM أو Cloud أو Loans على كل الشركات.",
    "- لكل activity اكتب name وarabicName وdescription وimportance.",
    "",
    "نقاط القوة والضعف:",
    "- أنشئ strengths من 3 إلى 7 نقاط فعلية مع title وexplanation وevidence وimportance وdurability وvaluationImpact وconfidence.",
    "- أنشئ weaknesses من 3 إلى 7 نقاط فعلية مع title وexplanation وevidence وseverity وpersistence وvaluationImpact وmonitoringIndicator وconfidence.",
    "- ميّز بين weaknesses كنقاط ضعف حالية وrisks كأحداث مستقبلية محتملة.",
    "",
    "متطلبات الربع القادم:",
    "- nextRequirements يجب أن تحتوي 4 إلى 8 متطلبات فقط.",
    "- nextRequirements.requirementSetId يجب أن يكون null. لا تخترع ID دائمًا لمجموعة المتطلبات.",
    "- أوزان المتطلبات الجديدة يجب أن تجمع 100%.",
    "- كل status في nextRequirements.requirements يجب أن يكون NOT_REPORTED.",
    "- nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base دائمًا.",
    "- اختر mode من: ADVANCE_TARGET أو DEFEND_BASE أو RECOVERY.",
    "- استخدم متطلبات قابلة للقياس وموضوعية ومادية للتقييم، ولا تستخدم عبارات فضفاضة.",
    "",
    "المراقبة المستقبلية:",
    "- أنشئ monitoringChecklist من 5 إلى 8 عناصر تشمل metric وcurrentValue وexpectedRange وupgradeTrigger وdowngradeTrigger وthesisBreak.",
    "",
    "اختصار السرد دون تقليل العمق المالي:",
    ...conciseOutputDisciplinePromptLines(),
    "",
    "الأرقام المهمة لا تُحذف:",
    ...materialEvidencePromptLines(),
    "",
    "صيغة الإخراج:",
    "- أخرج EXACTLY ONE fenced JSON code block فقط، مطابقًا للعقد.",
    "- ابدأ الإجابة بسطر ```json ثم كائن JSON ثم أغلق بسطر ```.",
    "- لا تضف أي شرح أو Markdown قبل أو بعد code block.",
    "- ممنوع داخل JSON: Markdown أو تعليقات برمجية أو نصوص خارج الكائن أو NaN أو Infinity أو trailing commas أو undefined.",
    "- استخدم null عند غياب البيانات.",
    "- لا تختصر أسماء الحقول ولا تغيّرها من تحليل إلى آخر.",
    "- يجب أن تكون جميع الشروحات النصية داخل JSON باللغة العربية، مع الإبقاء على المصطلحات المالية القياسية بالإنجليزية مثل DCF وFCF وROIC وEPS وP/E وEV/EBITDA وWACC وSOTP.",
    "",
    "فحص نهائي إلزامي قبل الإخراج:",
    "- JSON صالح تقنيًا.",
    "- رمز السهم واسم الشركة صحيحان.",
    "- reportIdentity والتحليل والسعر الحالي والمصادر موجودة.",
    "- طريقة التقييم الرئيسية وسبب اختيارها موجودان.",
    "- مجموع أوزان طرق التقييم المستخدمة يساوي 100%.",
    "- مجموع احتمالات السيناريوهات يساوي 100%.",
    "- probabilityWeighted وupside وmarginOfSafety متسقة حسابيًا.",
    "- أهم نقاط القوة والضعف موجودة.",
    "- المخاطر منفصلة عن نقاط الضعف.",
    "- nextRequirements.currentJustifiedValue يساوي Base.",
    "- لا توجد بيانات مختلقة.",
    "- كل معلومة غير متوفرة ممثلة بـ null.",
    "- لا تخرج قالبًا فارغًا؛ يجب ملء كل ما يمكن توثيقه فعليًا.",
    "",
    "Prompt self-check قبل إرجاع JSON:",
    ...promptSelfCheckLines(),
    "",
    "مخطط JSON الإلزامي:",
    "",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function buildExternalAnalysisJsonTemplate(options = {}) {
  return JSON.stringify(buildFranklinV3ReportTemplate({ ...options, analysisType: "INITIAL" }), null, 2);
}

export function buildNewEarningsAnalysisPrompt(report = {}, options = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  const companyName = report.company?.name || ticker || "-";
  const requirementsBlock = report.priceTargetRequirements || {};
  const requirements = Array.isArray(requirementsBlock.requirements) ? requirementsBlock.requirements : [];
  const selectedPeriod = earningsPeriodFromOptions(options)?.reportPeriod || null;
  const previous = previousCanonicalState(report);
  const previousInvestmentState = buildPreviousInvestmentState(report);
  const template = buildFranklinV3ReportTemplate({
    tickerHint: ticker,
    analysisType: "EARNINGS_REVALUATION",
    previousReport: report,
    selectedPeriod
  });

  return [
    "أنت تعمل داخل Fair value لتحليل إعلان أرباح جديد بناءً على تقرير سابق محفوظ في Franklin.",
    "",
    "حدود المسؤولية:",
    "- ChatGPT / Fair value هو المحلل المالي الوحيد.",
    "- Franklin لا يحدد القيمة العادلة ولا القرار ولا status لأي requirement.",
    "- Franklin سيقرأ JSON النهائي، يتحقق من الحسابات الثابتة، يحفظ نسخة جديدة، ويربطها بالتقرير السابق.",
    "- لا تغيّر التقرير السابق ولا المتطلبات المجمدة؛ قيّمها فقط.",
    "",
    "بيانات التقرير السابق المحفوظ في Franklin:",
    `- الشركة: ${companyName}`,
    `- الرمز: ${ticker || "-"}`,
    `- previous Analysis ID: ${formatPromptValue(previous.analysisId)}`,
    `- previous Requirement Set ID: ${formatPromptValue(previous.requirementSetId)}`,
    `- تاريخ التحليل السابق: ${formatPromptValue(report.analysisDate)}`,
    `- فترة التقرير السابقة: ${formatPromptValue(report.reportPeriod)}`,
    `- القرار السابق: ${formatPromptValue(report.decision?.action)}`,
    `- Previous Bear Fair Value: ${formatPromptValue(report.fairValueSummary?.fairValueLow)}`,
    `- Previous Base Fair Value: ${formatPromptValue(report.fairValueSummary?.fairValueBase)}`,
    `- Previous Bull Fair Value: ${formatPromptValue(report.fairValueSummary?.fairValueHigh)}`,
    `- Previous probability-weighted Fair Value: ${formatPromptValue(report.fairValueSummary?.probabilityWeightedFairValue)}`,
    `- الربع المستهدف للمتطلبات السابقة: ${formatPromptValue(requirementsBlock.targetQuarter || requirementsBlock.earningsPeriod)}`,
    ...(selectedPeriod ? [
      `- الربع الذي اختاره المستخدم لهذا التحديث: ${selectedPeriod}`,
      `- يجب أن تكون reportIdentity.fiscalQuarter وreportIdentity.fiscalYear مطابقين تمامًا لـ ${selectedPeriod}.`,
      `- حلل مواد ${selectedPeriod} فقط، ولا تستبدلها بربع آخر حتى لو وجدت نتائج أحدث.`
    ] : []),
    "",
    "فرضية الاستثمار المحفوظة:",
    report.thesis?.shortSummary || report.thesis?.fullSummary ? textForPrompt(report.thesis?.shortSummary || report.thesis?.fullSummary) : "- غير متوفرة.",
    "",
    "المخاطر المحفوظة المفيدة للمقارنة:",
    listForPrompt(report.risks, riskForPrompt),
    "",
    "Requirements to Justify Next Price Target المحفوظة سابقًا:",
    requirements.length
      ? requirements.map(requirementForPrompt).join("\n\n")
      : "- لا توجد requirement set سابقة. لا تخترع واحدة. ابدأ دورة المتطلبات Canonical من nextRequirements فقط.",
    "",
    "previousInvestmentState JSON:",
    JSON.stringify(previousInvestmentState, null, 2),
    "",
    "JSON OUTPUT SAFETY — MANDATORY",
    ...jsonOutputSafetyPromptLines(),
    "",
    "أنواع الثقة والدرجات:",
    ...confidenceAndScoreScalePromptLines(),
    "",
    "التسلسل الإلزامي لإعادة التقييم:",
    "1. اقرأ إعلان الأرباح الجديد و10-Q ومكالمة الإدارة أو المواد التي يزوّدك بها المستخدم.",
    "2. اقرأ Revenue وEPS والهوامش وFCF والسيولة والتوجيهات وKPIs الخاصة بالشركة.",
    "3. قيّم فقط requirement set السابقة المجمدة أعلاه.",
    "4. لا تغيّر requiredValue أو requiredDisplay أو weight أو metric أو targetQuarter لأي requirement سابق.",
    "5. لكل requirement سابق املأ actualValue وactualDisplay وstatus وpartialCreditPct عند الحاجة وevaluationNote وsourceId.",
    "6. status يجب أن يكون NOT_REPORTED أو FAILED أو PARTIALLY_PASSED أو PASSED أو EXCEEDED.",
    "7. PARTIALLY_PASSED فقط يستخدم partialCreditPct بين 0 و100. باقي الحالات partialCreditPct = null.",
    "8. احسب assessment كاملًا: coverageWeightPct وachievementOfReportedWeightPct وachievementOfTotalWeightPct وباقي أوزان الحالات.",
    "9. NOT_REPORTED لا يدخل في مقام reported requirements.",
    "10. حدّث Forward View والتوقعات والافتراضات المتغيرة.",
    "11. أعد تقييم Bear/Base/Bull إلزاميًا في كل ربع.",
    "12. valuation.reviewStatus يجب أن يكون UPDATED أو UNCHANGED فقط.",
    "13. UNCHANGED يعني أنك راجعت الأدلة الجديدة وقررت أن التقييم السابق ما زال مبررًا؛ لا يعني أن التقييم تُرك بلا عمل.",
    "14. أنشئ valuation.valuationBridge.whyBaseChangedOrNot إلزاميًا.",
    "15. حدّث thesis.status إلى STRENGTHENED أو UNCHANGED أو WEAKENED أو BROKEN.",
    "16. أصدر decision جديدًا على مستوى السهم.",
    "17. أنشئ nextRequirements جديدة بالكامل للربع القادم.",
    "18. nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base الجديد دائمًا.",
    "19. اختر mode من ADVANCE_TARGET أو DEFEND_BASE أو RECOVERY.",
    "20. أضف 4 إلى 8 متطلبات جديدة قابلة للقياس، أوزانها تجمع 100%.",
    "21. كل متطلبات nextRequirements الجديدة يجب أن تكون status = NOT_REPORTED.",
    "22. nextRequirements.requirementSetId = null دائمًا. Franklin يعيّن Requirement Set ID الدائم عند حفظ التقرير بنجاح.",
    "23. أضف مصادر جديدة خاصة بهذا الربع، ولا تورّث مصادر الربع السابق كدليل للربع الحالي.",
    "",
    "القيم المسموحة في العقد:",
    canonicalEnumSection(),
    "",
    "قواعد المصادر داخل JSON:",
    ...sourceProvenancePromptLines(),
    "",
    "قواعد حساب assessment السابقة:",
    "- totalWeight = sum of ALL original requirement weights.",
    "- reportedWeight = sum of weights where status != NOT_REPORTED.",
    "- earnedWeight = PASSED weights + EXCEEDED weights + Σ(PARTIALLY_PASSED weight × partialCreditPct / 100).",
    "- coverageWeightPct = reportedWeight / totalWeight × 100.",
    "- achievementOfReportedWeightPct = earnedWeight / reportedWeight × 100.",
    "- achievementOfTotalWeightPct = earnedWeight / totalWeight × 100.",
    "- exceededWeightPct = sum original weights with EXCEEDED.",
    "- passedWeightPct = sum original weights with PASSED.",
    "- partialWeightPct = sum original weights with PARTIALLY_PASSED. لا تضع الائتمان المكتسب هنا.",
    "- failedWeightPct = sum original weights with FAILED.",
    "- notReportedWeightPct = sum original weights with NOT_REPORTED.",
    "- exceededWeightPct + passedWeightPct + partialWeightPct + failedWeightPct + notReportedWeightPct يجب أن يساوي 100%.",
    "- EXCEEDED وPASSED يأخذان 100% credit فقط، ولا يأخذ EXCEEDED أكثر من 100%.",
    "- FAILED = 0% credit.",
    "- PARTIALLY_PASSED يستخدم partialCreditPct الذي تحدده أنت.",
    "- NOT_REPORTED مستبعد من مقام achievementOfReportedWeightPct.",
    "- achievement لا يتجاوز 100%.",
    "",
    "قواعد mode وtargetScenario للمتطلبات الجديدة:",
    "- ADVANCE_TARGET يعني أن الربع القادم قد يبرر هدفًا أعلى من Base. targetScenario يجب أن يكون BULL أو INTERMEDIATE.",
    "- إذا كان ADVANCE_TARGET مع BULL: nextRequirements.targetValue يجب أن يساوي valuation.current.bull.",
    "- إذا كان ADVANCE_TARGET مع INTERMEDIATE: targetValue يجب أن يكون أكبر من Base وأقل من Bull، ويجب شرح targetDescription.",
    "- DEFEND_BASE يعني أن المطلوب هو إثبات أن Base الحالي ما زال مبررًا. targetScenario يجب أن يكون BASE_DEFENSE وtargetValue يجب أن يساوي valuation.current.base.",
    "- RECOVERY يعني أن السهم يحتاج دلائل تعافٍ بعد ضعف أو كسر في الفرضية. targetScenario يجب أن يكون RECOVERY وtargetValue يجب أن يكون أكبر من أو يساوي Base مع شرح recovery logic في targetDescription.",
    ...valuationRolePromptLines(),
    "",
    "قواعد مالية ممنوعة:",
    "- لا تستخدم beat/miss بطريقة ميكانيكية مثل EPS beat 10% إذن القيمة ترتفع 10%.",
    "- أي تغير في Fair Value يجب أن يمر عبر الأدلة الجديدة ثم افتراضات الإيراد/EPS/الهوامش/FCF والمخاطر والتوجيهات.",
    "- Franklin لا يرفع الهدف آليًا ولا يحسب targetValue. أنت وحدك تحدد ذلك داخل JSON.",
    "",
    "صيغة JSON النهائية:",
    `- أخرج EXACTLY ONE fenced JSON code block يحتوي JSON واحدًا فقط بصيغة ${FRANKLIN_FAIR_VALUE_SCHEMA_VERSION}.`,
    "- ابدأ الإجابة بسطر ```json ثم كائن JSON ثم أغلق بسطر ```.",
    "- analysisType يجب أن يكون EARNINGS_REVALUATION.",
    "- reportIdentity.previousAnalysisId يجب أن يطابق previous Analysis ID أعلاه حرفيًا.",
    "- reportIdentity.previousRequirementSetId يجب أن يطابق previous Requirement Set ID أعلاه إذا كان موجودًا.",
    "- previousRequirementsEvaluation يجب أن يقيّم المتطلبات السابقة كما هي دون تعديل IDs أو thresholds أو weights.",
    "- nextRequirements.requirementSetId = null، مع الحفاظ على IDs فريدة داخل nextRequirements.requirements[].",
    "- valuation.reviewStatus يجب أن يكون UPDATED أو UNCHANGED بعد إعادة underwriting فعلية لـ Bear/Base/Bull.",
    "- لا تكرر companyProfile السابق كاملًا إلا إذا تغير ماديًا.",
    "- اجعل valuationBridge مختصرًا لكنه محدد بالأسباب والأرقام المهمة.",
    "- لا تضف أي شرح أو Markdown قبل أو بعد code block.",
    "- استخدم null لأي معلومة غير متوفرة.",
    "",
    "اختصار السرد دون تقليل العمق المالي:",
    ...conciseOutputDisciplinePromptLines(),
    "",
    "الأرقام المهمة لا تُحذف:",
    ...materialEvidencePromptLines(),
    "",
    "Prompt self-check قبل إرجاع JSON:",
    ...promptSelfCheckLines(),
    "",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function analysisContractRequiredFields() {
  return fieldsByPriority(FIELD_PRIORITY.CRITICAL);
}

function fieldsByPriority(priority) {
  return FIELD_REQUIREMENTS.filter((field) => field.priority === priority);
}

function fieldLines(fields) {
  return fields.map((field, index) => `${index + 1}. ${field.path} - ${field.labelAr} - ${field.expectedType}`);
}

function canonicalEnumSection() {
  return Object.entries(FRANKLIN_V3_CANONICAL_ENUMS).map(([key, value]) => {
    if (Array.isArray(value)) return `- ${key}: ${value.join(" | ")}`;
    return `- ${key}: ${Object.entries(value).map(([field, values]) => `${field} = ${values.join(" | ")}`).join("; ")}`;
  }).join("\n");
}

function sourceProvenancePromptLines() {
  return [
    '- مصدر سعر السوق: sources[].usedFor يجب أن يحتوي "marketPrice".',
    '- مصدر أرباح الربع الحالي: sources[].usedFor يجب أن يحتوي واحدًا على الأقل من "latestQuarter" أو "previousRequirementsEvaluation" أو "currentQuarterEarnings".',
    "- إذا كان المصدر يدعم أكثر من جزء، يمكن أن يحتوي usedFor على عدة tokens.",
    "- كل sources[].id يجب أن يكون فريدًا، وكل usedFor يجب أن يكون array غير فارغ.",
    "- كل sourceId أو sourceIds غير null في التقرير يجب أن يطابق sources[].id موجودًا.",
    "- كل latestQuarter.coreMetrics.*.actualValue غير null يحتاج sourceId موثقًا.",
    "- source.type يجب أن يكون من sourceType في القيم المسموحة أعلاه.",
    "- User Provided يمكن أن يكون url = null.",
    "- المصادر الرسمية أو الويب يجب أن تحفظ URL الفعلي عند توفره."
  ];
}

function jsonOutputSafetyPromptLines() {
  return [
    "- Return exactly one fenced JSON code block.",
    "- The first non-whitespace characters of the answer must be: ```json",
    "- The last non-whitespace characters of the answer must be: ```",
    "- Inside the fenced block, the first non-whitespace character must be: {",
    "- Inside the fenced block, the last non-whitespace character before the closing fence must be: }",
    "- Do not write any prose before or after the fenced JSON block.",
    "- Do not output Markdown except the required opening ```json fence and closing ``` fence.",
    "- After removing only the opening ```json fence and closing ``` fence, the result must be valid JSON that can be parsed by JSON.parse() without modification.",
    "- NEVER escape underscores.",
    "Correct enum strings:",
    '"LAST_CLOSE"',
    '"STOCK_LEVEL"',
    '"NOT_REPORTED"',
    '"DEFEND_BASE"',
    '"BASE_DEFENSE"',
    '"analyst_assumption"',
    "Wrong enum strings:",
    '"LAST\\_CLOSE"',
    '"STOCK\\_LEVEL"',
    '"NOT\\_REPORTED"',
    '"DEFEND\\_BASE"',
    '"BASE\\_DEFENSE"',
    '"analyst\\_assumption"',
    "- Do not add backslashes except when required by valid JSON escaping.",
    "Valid JSON escapes are limited to legitimate JSON escapes such as:",
    '\\"',
    "\\\\",
    "\\/",
    "\\b",
    "\\f",
    "\\n",
    "\\r",
    "\\t",
    "\\uXXXX",
    "- Do not use Markdown escaping inside JSON strings.",
    "- URL fields must contain raw URLs only.",
    'Correct URL field: "url": "https://example.com/report"',
    'Wrong URL field: "url": "[https://example.com/report](https://example.com/report)"',
    "- Never use Markdown links inside JSON.",
    "- Every enum must exactly match the canonical franklin-fair-value/v3 enum supplied in this prompt.",
    "- Preserve field types exactly. Do not replace a numeric field with HIGH/MEDIUM/LOW or vice versa.",
    "- Use null when a field is genuinely unavailable.",
    "FINAL TECHNICAL CHECK BEFORE OUTPUT:",
    "1. JSON.parse() would succeed.",
    '2. No "\\_" exists anywhere.',
    "3. No Markdown link syntax exists in any url field.",
    "4. Exactly one opening ```json fence and one closing ``` fence exist.",
    "5. Every enum exactly matches the v3 contract.",
    "6. Every field type matches the v3 contract.",
    "7. No trailing commas.",
    "8. No NaN.",
    "9. No Infinity.",
    "10. No undefined."
  ];
}

function confidenceAndScoreScalePromptLines() {
  return [
    "- valuation.current.confidence is a qualitative enum only: HIGH أو MEDIUM أو LOW.",
    "- decision.confidence is NOT an enum. decision.confidence must be a number from 0 to 100 or null.",
    '- Correct: "decision": { "confidence": 76 }',
    '- Wrong: "decision": { "confidence": "MEDIUM" }',
    "- decision.investmentScore must be a number from 0 to 100 or null.",
    "- The following score fields use a 0-100 scale, NOT 0-10:",
    "dataQuality.score",
    "businessQuality.score",
    "businessQuality.components.growth",
    "businessQuality.components.profitability",
    "businessQuality.components.cashFlow",
    "businessQuality.components.balanceSheet",
    "businessQuality.components.capitalAllocation",
    "businessQuality.components.competitiveAdvantage",
    "businessQuality.components.management",
    "decision.confidence",
    "decision.investmentScore",
    "Correct numeric scores: 83, 88, 92.",
    "Wrong numeric scores: 8.3, 8.8, 9.2.",
    "- Do not convert qualitative confidence enums HIGH / MEDIUM / LOW into numeric scores where the schema expects qualitative confidence."
  ];
}

function valuationRolePromptLines() {
  return [
    "- إذا كان valuation method له modelWeight إيجابي ويساهم مباشرة في weighted valuation result، فالدور يجب عادة أن يكون PRIMARY أو SECONDARY.",
    "- استخدم CROSS_CHECK فقط للطريقة التي تكون مراجعة مساندة فعلية ولا تساهم بوزن إيجابي في Fair Value النهائي.",
    "- لا تصف طريقة بأنها CROSS_CHECK وفي نفس الوقت تعطيها weighted contribution إيجابيًا في final Fair Value.",
    "- Franklin لا يختار valuation role؛ ChatGPT / Fair value يختاره داخل JSON."
  ];
}

function conciseOutputDisciplinePromptLines() {
  return [
    "GENERAL:",
    "- Prefer concise financial statements.",
    "- Do not repeat the same fact in multiple sections unless it serves a different financial purpose.",
    "- Keep numeric evidence.",
    "- Remove rhetorical filler.",
    "- Do not restate the full company story in strengths, risks, thesis, catalysts, and monitoring repeatedly.",
    "companyProfile:",
    "- summary: maximum approximately 3 concise sentences.",
    "- businessModel: maximum approximately 4 concise sentences.",
    "- activities: only economically material activities, normally 3-5 activities.",
    "strengths:",
    "- normally 4-5, maximum 6.",
    "- each explanation should normally be 1-2 sentences.",
    "- evidence: maximum 2 strongest evidence items per strength.",
    "weaknesses:",
    "- normally 4-5, maximum 6.",
    "- maximum 2 evidence items per weakness.",
    "risks:",
    "- normally 4-6.",
    "- avoid repeating a weakness word-for-word.",
    "catalysts:",
    "- normally 3-5.",
    "- include only catalysts that can materially affect valuation/thesis.",
    "monitoringChecklist:",
    "- normally 5-7.",
    "- do not duplicate nextRequirements verbatim.",
    "scenario assumptions:",
    "- maximum 4 material assumptions per scenario.",
    "scenario requiredOutcomes:",
    "- maximum 3.",
    "scenario keyRisks:",
    "- maximum 3.",
    "decision.rationale:",
    "- maximum 4 material reasons.",
    "decision.whyNot:",
    "- maximum 3.",
    "decision.upgradeTriggers:",
    "- maximum 4.",
    "decision.downgradeTriggers:",
    "- maximum 4.",
    "limitations:",
    "- normally maximum 5 material limitations.",
    "sources:",
    "- prefer the smallest set of high-quality sources needed to support the report.",
    "- prioritize official sources.",
    "- avoid redundant secondary sources covering the same fact.",
    "- normally target 5-8 sources; more are allowed only when financially necessary."
  ];
}

function materialEvidencePromptLines() {
  return [
    "- Conciseness must NOT remove reported Revenue, EPS, important margins, cash/debt where material, company-specific KPIs, Guidance, forecast estimates used in valuation, valuation multiple inputs, scenario probabilities, Fair Values, requirement thresholds, requirement weights, requirement actuals/statuses after earnings, or source provenance.",
    "- For latestQuarter metrics, BEAT means actualValue > consensusValue, MISS means actualValue < consensusValue, and INLINE means equal; use NA when no comparable consensus exists.",
    "- When yoyPct is supplied, it must reconcile to actualValue and priorYearValue within ordinary reported rounding.",
    "- The goal is less repeated prose, NOT less financial evidence."
  ];
}

function promptSelfCheckLines() {
  return [
    "[ ] exactly one fenced ```json code block only",
    "[ ] JSON.parse() succeeds after removing only the opening and closing fences",
    "[ ] no escaped underscores",
    "[ ] no Markdown URLs",
    "[ ] correct v3 enums",
    "[ ] correct v3 field types",
    "[ ] all numeric scores use 0-100 where required",
    "[ ] decision.confidence is numeric or null",
    "[ ] nextRequirements.requirementSetId is null",
    "[ ] probabilities = 100%",
    "[ ] valuation method weights = 100%",
    "[ ] requirement weights = 100%",
    "[ ] currentJustifiedValue = Base",
    "[ ] quarterly BEAT/MISS/INLINE agrees with actual and consensus values",
    "[ ] source ids are unique and every reported quarterly metric has a sourceId",
    "[ ] concise narrative without deleting material financial evidence"
  ];
}

function buildPreviousInvestmentState(report = {}) {
  const canonical = isFranklinV3Report(report?.metadata?.franklinV3Report)
    ? report.metadata.franklinV3Report
    : null;
  if (canonical) {
    return pickObject(canonical, {
      reportIdentity: true,
      company: ["reportingCurrency", "tradingCurrency", "securityUnit"],
      latestQuarter: ["companySpecificKpis", "guidance", "forwardOutlook"],
      forecast: ["yearlyForecast", "estimateRevisions", "changedAssumptions", "wacc", "terminalGrowth", "sensitivity", "summary"],
      valuation: ["current", "methodology", "valuationResults", "scenarios", "valuationBridge"],
      thesis: true,
      decision: true,
      risks: true,
      catalysts: true,
      monitoringChecklist: true,
      nextRequirements: true
    });
  }
  return compactObject({
    reportIdentity: compactObject({
      ticker: report.company?.ticker || null,
      companyName: report.company?.name || null,
      reportPeriod: report.reportPeriod || null,
      analysisDate: report.analysisDate || null
    }),
    company: compactObject({
      reportingCurrency: report.metadata?.franklinV3?.reportingCurrency || null,
      tradingCurrency: report.company?.currency || report.metadata?.franklinV3?.tradingCurrency || null,
      securityUnit: report.metadata?.franklinV3?.securityUnit || null
    }),
    valuation: compactObject({
      current: compactObject({
        bear: report.fairValueSummary?.fairValueLow ?? null,
        base: report.fairValueSummary?.fairValueBase ?? null,
        bull: report.fairValueSummary?.fairValueHigh ?? null,
        probabilityWeighted: report.fairValueSummary?.probabilityWeightedFairValue ?? null,
        currency: report.company?.currency || null,
        securityUnit: report.metadata?.franklinV3?.securityUnit || null
      }),
      methodology: report.valuationMethodology || null,
      valuationResults: report.valuationResults || null,
      scenarios: report.scenarios || null
    }),
    thesis: report.thesis || null,
    decision: report.decision || null,
    risks: report.risks || null,
    catalysts: report.catalysts || null,
    monitoringChecklist: report.monitoringChecklist || null,
    nextRequirements: report.priceTargetRequirements || null
  });
}

function pickObject(source = {}, shape = {}) {
  const result = {};
  for (const [key, selector] of Object.entries(shape)) {
    if (selector === true) {
      result[key] = source?.[key] ?? null;
    } else if (Array.isArray(selector)) {
      result[key] = compactObject(Object.fromEntries(selector.map((field) => [field, source?.[key]?.[field] ?? null])));
    }
  }
  return compactObject(result);
}

function compactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (entry === null || entry === undefined) return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return Object.keys(entry).length > 0;
    return true;
  }));
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!clean || ["TICKER", "SYMBOL"].includes(clean)) return "";
  return clean.slice(0, 12);
}

function requirementForPrompt(item = {}, index = 0) {
  return [
    `${index + 1}. ${item.arabicName || item.name || item.metric || "Requirement"}`,
    `   - requirement ID: ${formatPromptValue(item.id || `requirement_${index + 1}`)}`,
    `   - metric: ${formatPromptValue(item.metric || item.name)}`,
    `   - Arabic metric name: ${formatPromptValue(item.arabicName)}`,
    `   - English metric name: ${formatPromptValue(item.name || item.metric)}`,
    `   - previousValue: ${formatPromptValue(item.previousValue ?? item.currentLevel)}`,
    `   - previousDisplay: ${formatPromptValue(item.previousDisplay)}`,
    `   - requiredValue: ${formatPromptValue(item.requiredValue)}`,
    `   - requiredDisplay: ${formatPromptValue(item.requiredDisplay)}`,
    `   - currentLevel: ${formatPromptValue(item.currentLevel ?? item.previousValue)}`,
    `   - unit: ${formatPromptValue(item.unit)}`,
    `   - type: ${formatPromptValue(item.type)}`,
    `   - importance: ${formatPromptValue(item.importance)}`,
    `   - weight: ${formatPromptValue(item.weight)}`,
    `   - why it matters: ${textForPrompt(item.whyItMatters) || "-"}`
  ].join("\n");
}

function riskForPrompt(item = {}) {
  if (typeof item === "string") return `- ${item}`;
  return `- ${textForPrompt(item.title || item.name || item.explanation || item.whatToMonitor || item.thesisBreaker) || "-"}`;
}

function listForPrompt(items = [], mapper = (item) => `- ${textForPrompt(item)}`) {
  return Array.isArray(items) && items.length ? items.map(mapper).join("\n") : "- غير متوفر.";
}

function textForPrompt(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return value.ar || value.arabic || value.arabicText || value.textAr || value.summaryAr || value.explanationAr || value.interpretationAr || value.noteAr || value.rationaleAr || value.reasonAr
      || value.text || value.summary || value.explanation || value.interpretation || value.note || value.rationale || value.reason
      || value.en || value.english || value.englishText || value.textEn || value.summaryEn || value.explanationEn || value.interpretationEn || value.noteEn || "";
  }
  return String(value).trim();
}

function formatPromptValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return textForPrompt(value) || JSON.stringify(value);
  return String(value);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
