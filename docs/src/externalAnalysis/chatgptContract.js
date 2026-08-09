import { buildFairValueAnalysisJsonObject } from "./fairValueAdapter.js";
import { FIELD_PRIORITY, FIELD_REQUIREMENTS } from "./missingFields.js";

export function buildFullAnalysisPrompt(options = {}) {
  const ticker = normalizeTicker(options.tickerHint);
  const requiredFields = fieldsByPriority(FIELD_PRIORITY.CRITICAL);
  const recommendedFields = fieldsByPriority(FIELD_PRIORITY.RECOMMENDED);
  const template = buildFairValueAnalysisJsonObject({ tickerHint: ticker });

  return [
    "أنت نظام متخصص في تحليل وتقييم الأسهم الأمريكية. اسم النظام هو Fair value.",
    "",
    "تعريف المصطلحات:",
    "- النظام: مشروع Fair value داخل ChatGPT، وهو المسؤول عن البحث والتحليل المالي واختيار طرق التقييم وحساب القيمة العادلة وإصدار القرار الاستثماري.",
    "- التطبيق: واجهة خارجية مستقلة مخصصة لاستعراض نتيجة التحليل فقط.",
    "- التطبيق لا يقوم بالتحليل ولا يعيد حساب الأرقام.",
    "- بعد اكتمال التحليل داخل النظام، سينسخ المستخدم مخرجات JSON ويلصقها داخل التطبيق.",
    "",
    "الهدف الأساسي:",
    "- عند طلب تحليل أي شركة أو سهم، نفّذ تحليلًا ماليًا واستثماريًا متكاملًا.",
    "- قدّم تحليلًا عربيًا مفهومًا للمستخدم.",
    "- أخرج ملف JSON نهائيًا منظمًا يستطيع تطبيق استعراض الأسهم قراءته واستيراده.",
    "- وضّح طرق التقييم المستخدمة ولماذا تم اختيار كل طريقة.",
    "- اذكر أهم نقاط قوة الشركة وأهم نقاط ضعفها.",
    "- اذكر القيمة العادلة والسيناريوهات والتوصية النهائية.",
    "- أضف Guidance إذا أعلنت الإدارة توجيهات أو تعليقات مستقبلية مهمة.",
    "- أضف companySpecificKpis فقط للمقاييس الخاصة بهذه الشركة، ولا تفرض نفس KPIs على كل الشركات.",
    "- أضف companyProfile كشرح تعليمي مبسط للشركة داخل نفس JSON، وليس في برومبت منفصل.",
    "- أضف priceTargetRequirements لتحديد ما يجب أن تحققه الشركة لتبرير الانتقال إلى السيناريو الأعلى.",
    "- إذا كان التحليل بعد إعلان أرباح، أضف actualValue وstatus لكل requirement سابق إذا توفر.",
    "",
    ticker ? `رمز السهم المطلوب: ${ticker}` : "رمز السهم: حدده من الشركة محل التحليل إذا كان معروفًا، وإلا ضع null.",
    "",
    "قواعد البحث والبيانات:",
    "- استخدم أحدث البيانات المتاحة وقت التحليل.",
    "- أعط الأولوية لتقارير الشركة وInvestor Relations وملفات SEC ومكالمات الأرباح والتوجيهات الرسمية والمصادر المالية الموثوقة.",
    "- لا تخترع أي رقم أو معلومة.",
    "- ميّز بين reportedData وconsensusEstimates وanalystAssumptions.",
    "- إذا لم تتوفر معلومة ضرورية، استخدم null.",
    "- لا تعرض رقمًا تقديريًا على أنه رقم معلن.",
    "- اذكر تاريخ التقييم وسعر السهم المستخدم في التقييم.",
    "- حافظ على عملة الشركة الأساسية، ولا تخلط بين العملات.",
    "",
    "اختيار طريقة التقييم:",
    "- لا تستخدم طريقة تقييم ثابتة لجميع الشركات.",
    "- صنّف الشركة أولًا حسب طبيعة أعمالها ومرحلتها المالية.",
    "- اختر طرق التقييم المناسبة فقط من DCF وReverse DCF وP/E وPEG وEV/EBITDA وEV/EBIT وP/S وEV/Sales وP/FCF وSOTP وDividend Discount Model وPrice to Book وComparable Companies وHistorical Multiples.",
    "- استخدم DCF عندما تكون التدفقات النقدية قابلة للتنبؤ بدرجة معقولة.",
    "- لا تجعل DCF الطريقة الرئيسية عندما يكون FCF سلبيًا بشدة أو شديد التقلب.",
    "- استخدم Price to Book للمؤسسات المالية عندما تكون القيمة الدفترية ذات دلالة اقتصادية.",
    "- استخدم SOTP عندما تكون الشركة مكونة من قطاعات مختلفة تحتاج إلى تقييم مستقل.",
    "- استخدم Reverse DCF لمعرفة مقدار النمو والهوامش التي يسعرها السوق حاليًا.",
    "",
    "يجب أن يحتوي valuationMethodology على primaryMethod وsecondaryMethods وexcludedMethods وselectionReason وmethodExplanations وexclusionReasons وmodelWeights وweightReasoning وlimitations.",
    "لكل طريقة تقييم مستخدمة اذكر الدور، سبب الملاءمة، الافتراضات، المدخلات، Fair Value، الوزن، الثقة، ونقطة الضعف.",
    "",
    "تحليل جودة الشركة:",
    "- حلل Revenue وEPS وFCF وGross Margin وOperating Margin وFCF Margin وROIC وCash Conversion وCapEx intensity والميزانية وStock-based Compensation وتخصيص رأس المال والميزة التنافسية والإدارة واستدامة النمو وحساسية الدورة الاقتصادية.",
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
    "السيناريوهات:",
    "- أنشئ Conservative وBase وOptimistic وExceptional.",
    "- Exceptional يكون enabled=false إلا إذا كان له مبرر واقعي.",
    "- لكل سيناريو اذكر probability وfairValue وupsideDownsidePercent والافتراضات وrequiredOutcomes وthesis وkeyRisks.",
    "- يجب أن يكون مجموع احتمالات السيناريوهات المفعلة 100%.",
    "",
    "متطلبات السعر التالي:",
    "- priceTargetRequirements يحدد متطلبات كانت معروفة قبل الأرباح لتبرير Target أعلى.",
    "- لا تغيّر المتطلبات القديمة بأثر رجعي؛ إذا كان التحليل بعد أرباح، املأ actualValue وstatus فقط.",
    "- status يجب أن يكون: NOT_REPORTED أو PASSED أو PARTIALLY_PASSED أو FAILED أو EXCEEDED.",
    "- NOT_REPORTED لا يدخل في مقام Weighted Achievement.",
    "- requirementsAssessment يمكن أن يحتوي summary وoverallStatus، لكن لا تجعل التوصية مبنية على هذه النسبة وحدها.",
    "",
    "القيمة العادلة والقرار:",
    "- احسب fairValueLow وfairValueBase وfairValueHigh وprobabilityWeightedFairValue وcurrentPrice وupsideDownsidePercent وmarginOfSafety وconfidenceLevel.",
    "- لا تستخدم متوسطًا بسيطًا لطرق التقييم إلا إذا كان ذلك مبررًا.",
    "- استخدم recommendation.action لمسار Franklin الخارجي بقيمة واحدة فقط: BUY أو ADD أو HOLD أو WATCH أو REDUCE أو SELL.",
    "- معنى ADD: زيادة مركز قائم. معنى WATCH: المراقبة دون شراء حتى تتحقق الشروط.",
    "- finalDecision.decision يمكن أن يبقى متوافقًا مع التحليل، لكن recommendation.action هو القرار المختصر للتطبيق.",
    "- لا تجعل جودة الشركة وحدها سببًا للشراء؛ يجب مراعاة السعر الحالي مقارنة بالقيمة العادلة.",
    "",
    "المراقبة المستقبلية:",
    "- أنشئ monitoringChecklist من 5 إلى 8 عناصر تشمل metric وcurrentValue وexpectedRange وupgradeTrigger وdowngradeTrigger وthesisBreak وrevaluationEvent.",
    "",
    "صيغة الإخراج:",
    "- بعد انتهاء التحليل، اعرض للمستخدم أولًا ملخصًا عربيًا واضحًا، ثم ضع ملف JSON كاملًا في مربع كود مستقل.",
    "- يجب أن يكون JSON صالحًا للنسخ واللصق مباشرة في التطبيق.",
    "- ممنوع داخل JSON: Markdown أو تعليقات برمجية أو نصوص خارج الكائن أو NaN أو Infinity أو trailing commas أو undefined.",
    "- استخدم null عند غياب البيانات.",
    "- لا تختصر أسماء الحقول ولا تغيّرها من تحليل إلى آخر.",
    "- يجب أن تكون جميع الشروحات النصية داخل JSON باللغة العربية، مع الإبقاء على المصطلحات المالية القياسية بالإنجليزية مثل DCF وFCF وROIC وEPS وP/E وEV/EBITDA وWACC وSOTP.",
    "",
    "الحد الأدنى الذي يحتاجه التطبيق لاعتبار التقرير مكتملًا:",
    ...fieldLines(requiredFields),
    "",
    "حقول مستحسنة ترفع جودة العرض لكنها لا تمنع الحفظ:",
    ...fieldLines(recommendedFields),
    "",
    "فحص نهائي إلزامي قبل الإخراج:",
    "- JSON صالح تقنيًا.",
    "- رمز السهم واسم الشركة صحيحان.",
    "- تاريخ التحليل والسعر الحالي موجودان.",
    "- طريقة التقييم الرئيسية وسبب اختيارها موجودان.",
    "- أسباب استبعاد الطرق غير الملائمة موجودة.",
    "- مجموع أوزان طرق التقييم المستخدمة يساوي 100%.",
    "- مجموع احتمالات السيناريوهات المفعلة يساوي 100%.",
    "- أهم نقاط القوة والضعف موجودة.",
    "- المخاطر منفصلة عن نقاط الضعف.",
    "- القيمة العادلة متسقة في جميع الأقسام.",
    "- نسبة الصعود أو الهبوط محسوبة من السعر المستخدم في التحليل.",
    "- لا توجد بيانات مختلقة.",
    "- كل معلومة غير متوفرة ممثلة بـ null.",
    "- لا يتعارض القرار النهائي مع القيمة العادلة أو بوابات المخاطر.",
    "- لا تخرج قالبًا فارغًا؛ يجب ملء كل ما يمكن توثيقه فعليًا.",
    "",
    "مخطط JSON الإلزامي:",
    "",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function buildExternalAnalysisJsonTemplate(options = {}) {
  return JSON.stringify(buildFairValueAnalysisJsonObject(options), null, 2);
}

export function buildNewEarningsAnalysisPrompt(report = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  const companyName = report.company?.name || ticker || "-";
  const requirementsBlock = report.priceTargetRequirements || {};
  const requirements = Array.isArray(requirementsBlock.requirements) ? requirementsBlock.requirements : [];
  const template = buildNewEarningsOutputTemplate(report, requirements);

  return [
    "أنت تعمل داخل مشروع Fair value لتحليل إعلان أرباح جديد بناءً على تقرير محفوظ سابقًا في Franklin.",
    "",
    "مهم جدًا:",
    "- ChatGPT هو المسؤول عن التحليل الاستثماري وقراءة مواد الأرباح الجديدة.",
    "- Franklin لا يحسب ولا يفسر النتائج؛ Franklin سيستورد JSON النهائي فقط.",
    "- لا تغيّر المتطلبات الأصلية المحفوظة أدناه.",
    "- قارِن النتائج الفعلية مع المتطلبات السابقة فقط.",
    "- إذا لم تُفصح الشركة عن معلومة، استخدم status = NOT_REPORTED وضع actualValue = null.",
    "- لا تخترع أرقامًا أو توجيهات.",
    "- اجعل كل الشروحات والسرد باللغة العربية، مع إبقاء المصطلحات المالية القياسية بالإنجليزية عند الحاجة.",
    "",
    "بيانات التقرير الحالي المحفوظ في Franklin:",
    `- الشركة: ${companyName}`,
    `- الرمز: ${ticker || "-"}`,
    `- تاريخ التحليل الحالي: ${formatPromptValue(report.analysisDate)}`,
    `- فترة التقرير الحالية: ${formatPromptValue(report.reportPeriod)}`,
    `- التوصية الحالية: ${formatPromptValue(report.recommendation?.action || report.decision?.verdict)}`,
    `- Bear Fair Value الحالي: ${formatPromptValue(report.fairValue?.bear)}`,
    `- Base Fair Value الحالي: ${formatPromptValue(report.fairValue?.base)}`,
    `- Bull Fair Value الحالي: ${formatPromptValue(report.fairValue?.bull)}`,
    `- القيمة المبررة الحالية: ${formatPromptValue(requirementsBlock.currentJustifiedValue)}`,
    `- الهدف التالي: ${formatPromptValue(requirementsBlock.targetValue)}`,
    `- السيناريو المستهدف: ${formatPromptValue(requirementsBlock.targetScenario)}`,
    `- فترة الأرباح المطلوب تقييمها: ${formatPromptValue(requirementsBlock.earningsPeriod)}`,
    "",
    "فرضية الاستثمار المحفوظة:",
    report.thesis?.shortSummary || report.thesis?.fullSummary ? textForPrompt(report.thesis?.shortSummary || report.thesis?.fullSummary) : "- غير متوفرة.",
    "",
    "المخاطر المحفوظة المفيدة للمقارنة:",
    listForPrompt(report.risks, riskForPrompt),
    "",
    "Requirements to Justify Next Price Target المحفوظة سابقًا:",
    requirements.length ? requirements.map(requirementForPrompt).join("\n\n") : "- لا توجد متطلبات محفوظة في هذا التقرير.",
    "",
    "المطلوب منك بعد أن يزوّدك المستخدم بمواد الأرباح الجديدة / 10-Q / مكالمة الإدارة:",
    "1. اقرأ مواد الأرباح الجديدة.",
    "2. قارن النتائج الفعلية ضد PREVIOUSLY SAVED requirements أعلاه.",
    "3. لا تعدّل requiredValue أو وزن المتطلب القديم.",
    "4. لكل requirement أعد:",
    "   - requirement ID",
    "   - actual result",
    "   - status: NOT_REPORTED أو PASSED أو PARTIALLY_PASSED أو FAILED أو EXCEEDED",
    "   - Arabic evaluation note",
    "5. أعد weightedAchievement وoverallStatus وsummary كما تراها أنت بناءً على التحليل.",
    "6. أعد earnings summary باللغة العربية.",
    "7. أعد updated guidance إذا تغيرت التوجيهات.",
    "8. أعد updated company-specific KPIs عند الحاجة.",
    "9. أعد updated risks إذا تغيرت ماديًا.",
    "10. أعد updated recommendation.",
    "11. أعد Bear/Base/Bull valuation فقط إذا كانت نتائج الأرباح تبرر تغييرًا جوهريًا؛ وإلا اشرح لماذا بقيت كما هي.",
    "12. أضف priceTargetRequirements جديدة للفترة القادمة إذا كان ذلك مناسبًا.",
    "13. استخدم حكمًا تحليليًا مناسبًا للشركة والقطاع، ولا تطبق معادلة موحدة على كل الشركات.",
    "",
    "صيغة JSON النهائية التي يعرف Franklin استيرادها:",
    "- أخرج JSON صالحًا فقط داخل كائن واحد.",
    "- لا تستخدم Markdown داخل JSON.",
    "- لا تضف نصًا خارج JSON النهائي.",
    "- املأ previousRequirementsEvaluation بنتائج تقييم المتطلبات السابقة.",
    "- املأ priceTargetRequirements فقط إذا كان هناك متطلبات جديدة للفترة القادمة.",
    "- استخدم null لأي معلومة غير متوفرة.",
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

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!clean || ["TICKER", "SYMBOL"].includes(clean)) return "";
  return clean.slice(0, 12);
}

function buildNewEarningsOutputTemplate(report = {}, requirements = []) {
  const ticker = normalizeTicker(report.company?.ticker);
  const requirementsBlock = report.priceTargetRequirements || {};
  const template = buildFairValueAnalysisJsonObject({ tickerHint: ticker });
  template.analysisDate = "YYYY-MM-DD";
  template.company.name = report.company?.name || null;
  template.company.currency = report.company?.currency || "USD";
  template.company.currentPrice = null;
  template.fairValueSummary.fairValueLow = numberOrNull(report.fairValue?.bear);
  template.fairValueSummary.fairValueBase = numberOrNull(report.fairValue?.base);
  template.fairValueSummary.fairValueHigh = numberOrNull(report.fairValue?.bull);
  template.recommendation.action = report.recommendation?.action || report.decision?.verdict || null;
  template.previousRequirementsEvaluation = {
    requirementSetId: requirementsBlock.requirementSetId || null,
    ticker: ticker || null,
    earningsPeriod: requirementsBlock.earningsPeriod || null,
    createdAt: requirementsBlock.createdAt || null,
    createdFromAnalysisId: requirementsBlock.createdFromAnalysisId || report.id || null,
    targetValue: numberOrNull(requirementsBlock.targetValue),
    targetScenario: requirementsBlock.targetScenario || null,
    targetDescription: requirementsBlock.targetDescription || null,
    matchType: "external_chatgpt_supplied",
    requirements: requirements.map((item, index) => ({
      id: item.id || `requirement_${index + 1}`,
      name: item.name || item.metric || null,
      arabicName: item.arabicName || null,
      metric: item.metric || item.name || null,
      type: item.type || "text",
      currentLevel: item.currentLevel ?? null,
      requiredValue: item.requiredValue ?? null,
      unit: item.unit || null,
      importance: item.importance || "medium",
      weight: numberOrNull(item.weight),
      whyItMatters: item.whyItMatters || null,
      actualValue: null,
      actualRaw: null,
      status: "NOT_REPORTED",
      evaluationNote: null
    })),
    requirementsAssessment: {
      weightedAchievement: null,
      reportedRequirements: null,
      totalRequirements: requirements.length || null,
      passed: null,
      failed: null,
      exceeded: null,
      partiallyPassed: null,
      notReported: null,
      overallStatus: null,
      summary: null
    }
  };
  template.priceTargetRequirements = {
    currentJustifiedValue: null,
    targetValue: null,
    targetScenario: null,
    targetDescription: null,
    createdAt: null,
    earningsPeriod: null,
    requirements: []
  };
  template.requirementsAssessment = {
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
  };
  return template;
}

function requirementForPrompt(item = {}, index = 0) {
  return [
    `${index + 1}. ${item.arabicName || item.name || item.metric || "Requirement"}`,
    `   - requirement ID: ${formatPromptValue(item.id || `requirement_${index + 1}`)}`,
    `   - metric: ${formatPromptValue(item.metric || item.name)}`,
    `   - requiredValue: ${formatPromptValue(item.requiredValue)}`,
    `   - currentLevel: ${formatPromptValue(item.currentLevel)}`,
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
