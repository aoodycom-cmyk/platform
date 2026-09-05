import { earningsPeriodFromOptions } from "./earningsPeriod.js";
import { buildDownloadableJsonDeliveryInstructions } from "./downloadableJsonDelivery.js";
import { normalizeFiscalQuarterPeriod } from "./fiscalQuarterPeriod.js";
import {
  buildFranklinV3ReportTemplate,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
  previousCanonicalState
} from "./v3Contract.js";

export const FRANKLIN_EARNINGS_PROMPT_VERSION = "franklin-earnings-revaluation-prompt/v2";

export function buildEarningsRevaluationPrompt(report = {}, options = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  const selected = earningsPeriodFromOptions(options);
  const selectedPeriod = selected?.reportPeriod || null;
  const periodSlug = selectedPeriod ? selectedPeriod.replace(/\s+/g, "-") : "earnings";
  const previous = previousCanonicalState(report);
  const template = buildFranklinV3ReportTemplate({
    tickerHint: ticker,
    previousReport: report,
    analysisType: "EARNINGS_REVALUATION",
    selectedPeriod
  });
  const previousRequirements = Array.isArray(previous.requirements) ? previous.requirements : [];
  const previousInvestmentState = {
    company: {
      ticker: ticker || null,
      name: report.company?.name || previous.companyName || null
    },
    analysisId: previous.analysisId,
    requirementSetId: previous.requirementSetId,
    analysisDate: report.analysisDate || null,
    reportPeriod: normalizeFiscalQuarterPeriod(report.reportPeriod) || null,
    selectedEarningsPeriod: selectedPeriod,
    decision: report.decision?.action || null,
    valuation: {
      bear: previous.valuation?.bear ?? report.fairValueSummary?.fairValueLow ?? null,
      base: previous.valuation?.base ?? report.fairValueSummary?.fairValueBase ?? null,
      bull: previous.valuation?.bull ?? report.fairValueSummary?.fairValueHigh ?? null,
      probabilityWeighted: previous.valuation?.probabilityWeighted ?? report.fairValueSummary?.probabilityWeightedFairValue ?? null
    },
    thesis: report.thesis?.shortSummary || report.thesis?.fullSummary || previous.thesisSummary || null,
    targetQuarter: normalizeFiscalQuarterPeriod(
      previous.requirementTargetQuarter
        || report.priceTargetRequirements?.targetQuarter
        || report.priceTargetRequirements?.earningsPeriod
    ),
    frozenRequirements: previousRequirements
  };

  const request = {
    promptVersion: FRANKLIN_EARNINGS_PROMPT_VERSION,
    requestType: "FRANKLIN_EARNINGS_REVALUATION",
    instruction: "حلل إعلان الأرباح الجديد للربع المحدد، قيّم المتطلبات السابقة المجمدة، ثم أعد underwriting كاملًا للفرضية والتقييم والقرار والمتطلبات القادمة.",
    authority: {
      analyst: "ChatGPT / Fair Value",
      franklinRole: "ينقل الحالة السابقة، يتحقق حسابيًا ويحفظ التاريخ فقط؛ لا يصدر أو يغير الحكم المالي",
      rule: "كل تفسير للنتائج، status للمتطلبات، partialCreditPct، thesis impact، Bear/Base/Bull، الاحتمالات، Fair Value، القرار وnextRequirements يأتي من ChatGPT / Fair Value."
    },
    periodLock: {
      selectedPeriod,
      fiscalQuarter: selected?.quarter ? `Q${selected.quarter}` : null,
      fiscalYear: selected?.year || null,
      rule: selectedPeriod ? `حلل مواد ${selectedPeriod} فقط، ولا تستبدلها بربع آخر حتى لو وجدت نتائج أحدث.` : "استخدم الربع المستهدف المحفوظ إذا لم يحدد المستخدم ربعًا صريحًا."
    },
    previousInvestmentState,
    revaluationScope: {
      quarterReading: [
        "اقرأ Revenue وEPS والهوامش وFCF والسيولة والتوجيهات وKPIs الخاصة بالشركة حيث تكون مادية.",
        "استخدم Earnings Release وSEC filing وEarnings Call للربع المحدد، وتحقق أن كل Actual يعود إلى الربع نفسه لا إلى LTM أو ربع أحدث.",
        "قارن Actual مع consensus فقط عند تطابق GAAP/non-GAAP والوحدة والعملة وأساس share/ADS/ADR؛ وإلا اشرح عدم القابلية للمقارنة ولا تصنع beat/miss.",
        "افصل أثر التشغيل الحقيقي عن FX والبنود غير المتكررة وSBC وتغير رأس المال العامل وCapex والاستحواذات عندما تكون مادية.",
        "حدّث financialNormalization للربع الجديد بأرقام GAAP وadjusted وnormalized وعدد الأسهم وSBC وOCF وCapex وFCF وصافي الدين، مع sourceId وbasis والفترة والوحدة.",
        "حدّث صافي النقد/الدين وعدد الأسهم المخفف والتخفيف المحتمل، لأنها قد تغيّر قيمة السهم حتى لو لم يتغير Enterprise Value.",
        "اقرأ تعليقات الإدارة عن الطلب والتسعير والقدرة والتنفيذ والمنافسة والحصة السوقية، ولا تكتفِ بالـ beat/miss.",
        "اقرأ ما تغير في الصناعة والدورة والمنافسة والتنظيم والعوامل الكلية فقط إذا كان أثره ماديًا على الفرضية أو التقييم.",
        "ميّز بين تغير هيكلي في الفرضية وضوضاء ربع واحد أو توقيت اعتراف بالإيراد، واذكر الدليل على التصنيف.",
        "افصل بين reported data وconsensus وanalyst assumptions، ولا تخترع رقمًا غير متاح."
      ],
      frozenRequirementsEvaluation: [
        "إذا لم توجد requirement set سابقة فلا تخترع واحدة؛ اترك previousRequirementsEvaluation وفق القالب وأنشئ الدورة الجديدة من nextRequirements فقط.",
        "إذا وُجدت requirement set فقيّم فقط المجموعة السابقة المجمدة في previousInvestmentState.frozenRequirements.",
        "لا تغيّر id أو metric أو type أو requiredValue أو requiredDisplay أو weight أو targetQuarter لأي requirement سابق.",
        "لكل requirement املأ actualValue وactualDisplay وstatus وpartialCreditPct عند الحاجة وevaluationNote وsourceId.",
        "إذا لم تُفصح الشركة عن المعلومة: status = NOT_REPORTED وactualValue = null. لا تعتبرها FAILED.",
        "status يجب أن يكون NOT_REPORTED أو FAILED أو PARTIALLY_PASSED أو PASSED أو EXCEEDED.",
        "لـ minimum: أقل من الحد FAILED، ومساواة الحد PASSED، وأعلى منه يكون PASSED أو EXCEEDED فقط إذا كان التفوق ماديًا ومشروحًا. لـ maximum اعكس الاتجاه. لـ range يكون داخل النطاق PASSED، وخارجه FAILED أو PARTIALLY_PASSED بتبرير. للنوع qualitative استخدم الدليل المعلن ولا تحوّله إلى رقم مختلق.",
        "لا تقارن Actual مع requirement إذا اختلفت العملة أو الوحدة أو GAAP/non-GAAP أو share/ADS/ADR أو تعريف KPI؛ استخدم NOT_REPORTED إذا لم يوجد Actual قابل للمقارنة مباشرة واشرح السبب.",
        "PARTIALLY_PASSED فقط يستخدم partialCreditPct من 0 إلى 100؛ باقي الحالات partialCreditPct = null."
      ],
      assessmentMath: {
        totalWeight: "sum of ALL original requirement weights",
        reportedWeight: "sum of weights where status != NOT_REPORTED",
        earnedWeight: "PASSED + EXCEEDED weights + sum(PARTIALLY_PASSED weight * partialCreditPct / 100)",
        coverageWeightPct: "reportedWeight / totalWeight * 100",
        achievementOfReportedWeightPct: "earnedWeight / reportedWeight * 100; NOT_REPORTED excluded from denominator",
        achievementOfTotalWeightPct: "earnedWeight / totalWeight * 100",
        rules: [
          "EXCEEDED وPASSED يأخذان 100% credit فقط.",
          "FAILED = 0% credit.",
          "achievement لا يتجاوز 100%.",
          "exceededWeightPct + passedWeightPct + partialWeightPct + failedWeightPct + notReportedWeightPct = 100%."
        ]
      },
      forwardView: [
        "حدّث Forward Outlook والتوقعات فقط بما تدعمه النتائج الجديدة أو guidance أو تعليق الإدارة.",
        "افصل بين Guidance الإدارة وConsensus بعد النتائج وافتراضات المحلل، وبيّن مراجعات السنوات الأمامية بدل الاكتفاء بالربع التالي.",
        "حوّل Guidance الرقمي إلى previousLow/High وcurrentLow/High وmidpoint والوحدة والعملة والأساس المحاسبي، ولا تكتفِ بالنص عندما تتوفر الأرقام.",
        "لكل Estimate Revision سجّل تاريخ اللقطة السابقة والجديدة والأساس المحاسبي وsourceId، واحسب changePct من القيمتين.",
        "حدد changedAssumptions بوضوح واربطها بالأدلة الجديدة."
      ],
      valuationAndThesis: [
        "أعد تقييم Bear/Base/Bull إلزاميًا في كل ربع؛ لا تورثها آليًا.",
        "valuation.reviewStatus يجب أن يكون UPDATED أو UNCHANGED فقط بعد مراجعة فعلية.",
        "UNCHANGED يعني أنك أعدت underwriting وقررت أن التقييم السابق ما زال مبررًا.",
        "أي تغير في Fair Value يجب أن يمر عبر أثر الأدلة الجديدة على الإيراد/EPS/الهوامش/FCF/المخاطر/التوجيهات، وليس معادلة beat/miss ميكانيكية.",
        "أعد بناء قيمة السهم باستخدام أحدث صافي نقد/دين وعدد أسهم مخفف وأساس share/ADS/ADR، وافصل تغير قيمة النشاط عن تغير الميزانية أو التخفيف.",
        "حافظ على اتساق طرق التقييم مع التقرير السابق، ولا تغيّر المنهجية إلا لسبب اقتصادي؛ إذا تغيرت فاشرح لماذا أصبحت الطريقة القديمة أقل ملاءمة.",
        "املأ valuation.valuationBridge.whyBaseChangedOrNot بسبب محدد ومادي.",
        "املأ valuation.valuationBridge.baseChangeBridge رقميًا: ابدأ من previousBase، ثم آثار التشغيل، الهوامش والتدفقات، الميزانية، التخفيف، معلمات التقييم، وأي أثر آخر؛ يجب أن يتصالح الناتج مع currentBase.",
        "لكل طريقة تقييم املأ formula وsteps وcomputedFairValue، ثم صالِح متوسط الطرق والحكم التحليلي مع Base داخل valuation.calculationAudit.",
        "حدّث thesis.status إلى STRENGTHENED أو UNCHANGED أو WEAKENED أو BROKEN.",
        "أصدر decision جديدًا على مستوى السهم: BUY أو ADD أو HOLD أو WATCH أو REDUCE أو SELL."
      ],
      nextRequirements: [
        "أنشئ nextRequirements جديدة بالكامل للربع القادم؛ لا تنسخ المجموعة القديمة تلقائيًا.",
        "nextRequirements.requirementSetId = null؛ Franklin يعيّن Requirement Set ID الدائم بعد الحفظ.",
        "nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base.",
        "اختر mode من ADVANCE_TARGET أو DEFEND_BASE أو RECOVERY.",
        "ADVANCE_TARGET: targetScenario = BULL أو INTERMEDIATE؛ BULL يساوي current.bull وINTERMEDIATE بين Base وBull مع شرح.",
        "DEFEND_BASE: targetScenario = BASE_DEFENSE وtargetValue = current.base.",
        "RECOVERY: targetScenario = RECOVERY وtargetValue >= current.base مع recovery logic واضح.",
        "أنشئ 4 إلى 8 متطلبات مادية قابلة للقياس، أوزانها تجمع 100%، وكل status فيها NOT_REPORTED."
      ],
      provenance: [
        "أضف مصادر جديدة خاصة بهذا الربع، ولا تورّث مصادر الربع السابق كدليل للنتائج الجديدة.",
        "استخدم Investor Relations أو SEC أو Earnings Call أو مواد الأرباح المرفقة الموثقة أولًا.",
        "أضف مصدر Market Data مستقلًا للسعر الحالي، واربطه بـ marketPrice.sourceId واجعل usedFor يتضمن marketPrice.",
        "كل sourceId غير null يجب أن يطابق sources[].id موجودًا."
      ]
    },
    outputContract: {
      schemaVersion: FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
      methodologyVersion: FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
      analysisType: "EARNINGS_REVALUATION",
      format: "DOWNLOADABLE_UTF8_JSON_FILE",
      lineage: {
        previousAnalysisId: previous.analysisId,
        previousRequirementSetId: previous.requirementSetId
      },
      requiredReviewStatus: "UPDATED أو UNCHANGED",
      rules: [
        "reportIdentity.previousAnalysisId يطابق previousInvestmentState.analysisId حرفيًا.",
        "reportIdentity.previousRequirementSetId يطابق previousInvestmentState.requirementSetId إذا كان موجودًا.",
        "previousRequirementsEvaluation يحافظ على تعريفات المتطلبات السابقة المجمدة إذا كانت موجودة.",
        "كل previousQuarter وtargetQuarter وearningsPeriod يمثل ربعًا ماليًا يجب أن يستخدم الصيغة الحرفية Q{1-4} YYYY.",
        "nextRequirements.previousQuarter يطابق reportIdentity، وnextRequirements.targetQuarter هو الربع المالي التالي مباشرة.",
        "nextRequirements.requirementSetId = null.",
        "Bear <= Base <= Bull والاحتمالات تجمع 100%.",
        "valuation.current.probabilityWeighted يطابق المتوسط الاحتمالي للسيناريوهات.",
        "valuation.methodology.modelWeights تجمع 100%.",
        "valuation.calculationAudit يعيد حساب متوسط الطرق ويتصالح مع Base.",
        "baseChangeBridge يجمع عدديًا من previous Base إلى current Base.",
        "marketPrice.currency وvaluation.current.currency يساويان company.tradingCurrency.",
        "marketPrice.value موجب وasOf تاريخ حقيقي وpriceType يساوي LIVE أو DELAYED أو LAST_CLOSE وsourceId يطابق مصدر Market Data داخل sources.",
        "لا تترك عناصر قالب وهمية كلها null داخل arrays؛ استخدم عناصر حقيقية فقط أو [] عندما يسمح العقد."
      ],
      quarterPeriodRules: {
        exactFormat: "Q{1-4} YYYY",
        correctExamples: ["Q3 2026", "Q4 2026"],
        incorrectExamples: ["FY2026 Q3", "Q3 FY2026"],
        mandatoryPreOutputValidation: "Validate canonical format, current-period equality, and the immediate next-quarter transition before output."
      },
      missingValue: null,
      language: "العربية المبسطة أولًا في جميع النصوص الموجهة للمستثمر. اذكر المصطلح الإنجليزي بين قوسين عند أول ظهور فقط، ولا تكتب جملًا عربية ممزوجة بعبارات إنجليزية غير مشروحة.",
      languageQuality: [
        "outputLanguage يجب أن يساوي ar.",
        "حدّث companyGlossary ليحتوي 4 إلى 12 مصطلحًا فنيًا خاصًا بالشركة والربع.",
        "لكل مصطلح اكتب termAr وtermEn وplainExplanationAr وwhyItMattersAr.",
        "أي مصطلح إنجليزي فني يظهر في السرد يجب أن يكون مشروحًا بالعربية داخل companyGlossary."
      ]
    },
    jsonTemplate: template
  };

  request.completionChecklist = [
    "الربع المقروء يطابق periodLock ولا توجد بيانات من ربع آخر",
    "كل requirement سابق قُيّم مرة واحدة دون تغيير تعريفه أو وزنه",
    "GAAP/non-GAAP والعملات والوحدات وأساس share/ADS/ADR متسقة",
    "Guidance وConsensus وanalyst assumptions منفصلة",
    "Bear/Base/Bull أُعيد underwriting لها وليست منسوخة آليًا",
    "صافي الدين وعدد الأسهم المخفف والتخفيف محدثة عندما تكون مادية",
    "financialNormalization محدث ومربوط بمصادر الربع",
    "Guidance وEstimate Revisions منظمة رقميًا وقابلة للتتبع",
    "جسر تغير Base ومتوسط طرق التقييم متصالحان حسابيًا",
    "marketPrice مكتمل وموثق ومربوط بمصدر Market Data",
    "nextRequirements جديدة وقابلة للقياس وأوزانها 100%",
    "كل فترة ربع سنوية بصيغة Q{1-4} YYYY، وpreviousQuarter يطابق ربع التقرير وtargetQuarter هو الربع التالي مباشرة",
    "JSON صالح ويطابق القالب دون عناصر وهمية"
  ];

  return [
    "أنت نظام Fair value داخل ChatGPT، وأنت المحلل المالي المسؤول عن تحليل إعلان أرباح جديد وإعادة التقييم.",
    "قبل إعادة التقييم: ابحث عن سعر السوق الموثق الحالي. إذا لم يتوفر LIVE موثق، استخدم DELAYED أو أحدث LAST_CLOSE موثق. لا تستخدم الذاكرة ولا تترك marketPrice ناقصًا.",
    "MARKET PRICE GATE — لا تُخرج JSON قبل تعبئة marketPrice.value وcurrency وasOf وpriceType وsourceId وربط sourceId بمصدر Market Data داخل sources وusedFor يتضمن marketPrice.",
    ticker ? `رمز السهم: ${ticker}` : "رمز السهم غير متوفر؛ لا تخترعه.",
    ticker ? `قيمة ticker داخل القالب: \"ticker\": \"${ticker}\"` : "قيمة ticker داخل القالب يجب أن تكون null.",
    `previous Analysis ID: ${format(previous.analysisId)}`,
    `previous Requirement Set ID: ${format(previous.requirementSetId)}`,
    `Previous Bear Fair Value: ${format(previousInvestmentState.valuation.bear)}`,
    `Previous Base Fair Value: ${format(previousInvestmentState.valuation.base)}`,
    `Previous Bull Fair Value: ${format(previousInvestmentState.valuation.bull)}`,
    `فرضية الاستثمار: ${format(previousInvestmentState.thesis)}`,
    selectedPeriod ? `الربع الذي اختاره المستخدم لهذا التحديث: ${selectedPeriod}` : "الربع المحدد غير متوفر.",
    selected?.quarter ? `\"fiscalQuarter\": \"Q${selected.quarter}\"` : "\"fiscalQuarter\": null",
    selected?.year ? `\"fiscalYear\": ${selected.year}` : "\"fiscalYear\": null",
    selectedPeriod ? `حلل مواد ${selectedPeriod} فقط، ولا تستبدلها بربع آخر حتى لو وجدت نتائج أحدث.` : "لا تستخدم ربعًا غير متوافق مع متطلبات التقرير السابق.",
    previousRequirements.length ? `متطلبات سابقة مجمدة: ${previousRequirements.length}` : "لا توجد requirement set سابقة. لا تخترع واحدة.",
    "previousInvestmentState JSON",
    JSON.stringify(previousInvestmentState),
    "أعد تقييم Bear/Base/Bull إلزاميًا في كل ربع.",
    "valuation.reviewStatus يجب أن يكون UPDATED أو UNCHANGED فقط.",
    "أنشئ nextRequirements جديدة بالكامل للربع القادم.",
    "QUARTER FORMAT GATE — استخدم فقط Q1-Q4 ثم مسافة ثم YYYY لكل previousQuarter وtargetQuarter وearningsPeriod ربعي. صحيح: \"Q3 2026\" و\"Q4 2026\". خطأ: \"FY2026 Q3\" و\"Q3 FY2026\".",
    "قبل إخراج JSON تحقق إلزاميًا أن nextRequirements.previousQuarter يساوي فترة reportIdentity وأن targetQuarter هو الربع المالي التالي مباشرة، إلا إذا فرضت دورة Franklin هدفًا مختلفًا مقصودًا.",
    "nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base.",
    "أضف مصادر جديدة خاصة بهذا الربع.",
    "LANGUAGE GATE — outputLanguage = ar. اكتب السرد بالعربية المبسطة، واجعل المصطلح العربي أولًا ثم الإنجليزي بين قوسين عند أول ظهور فقط.",
    "حدّث companyGlossary ليضم أهم 4 إلى 12 مصطلحًا فنيًا خاصًا بالشركة والربع، ولا تترك مصطلحًا إنجليزيًا فنيًا في السرد بلا شرح عربي.",
    "Franklin لا يرفع الهدف آليًا ولا يحسب targetValue. أنت وحدك تحدد ذلك داخل JSON.",
    "JSON OUTPUT SAFETY — MANDATORY",
    ...buildDownloadableJsonDeliveryInstructions({
      fileName: `franklin-${ticker || "TICKER"}-${periodSlug}-earnings-update.json`
    }),
    "NEVER escape underscores in JSON enum values or keys.",
    "Invalid example: \"LAST\\_CLOSE\". Correct value: \"LAST_CLOSE\".",
    "URL fields must contain raw URLs only.",
    "Never use Markdown links inside JSON.",
    "decision.confidence must be a number from 0 to 100 or null.",
    "businessQuality.score and all score fields use a 0-100 scale, NOT 0-10.",
    "احذف عناصر القالب الوهمية التي بقيت كلها null من arrays، ولا تخترع بيانات لملئها.",
    "nextRequirements.requirementSetId = null. Franklin يعيّن Requirement Set ID الدائم بعد نجاح الحفظ.",
    "Prefer concise financial statements and avoid duplicated narrative.",
    "Target: less repeated prose, NOT less financial evidence.",
    "نفّذ الطلب التالي كاملًا ثم أخرج عقد V3 فقط:",
    JSON.stringify(request)
  ].join("\n\n");
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return clean && clean !== "TICKER" ? clean : "";
}

function format(value) {
  if (value === null || value === undefined || value === "") return "null";
  return typeof value === "string" ? value : String(value);
}
