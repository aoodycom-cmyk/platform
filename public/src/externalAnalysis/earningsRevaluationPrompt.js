import { earningsPeriodFromOptions } from "./earningsPeriod.js";
import {
  buildFranklinV3ReportTemplate,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
  previousCanonicalState
} from "./v3Contract.js";

export const FRANKLIN_EARNINGS_PROMPT_VERSION = "franklin-earnings-revaluation-prompt/v1";

export function buildEarningsRevaluationPrompt(report = {}, options = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  const selected = earningsPeriodFromOptions(options);
  const selectedPeriod = selected?.reportPeriod || null;
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
    reportPeriod: report.reportPeriod || null,
    selectedEarningsPeriod: selectedPeriod,
    decision: report.decision?.action || null,
    valuation: {
      bear: previous.valuation?.bear ?? report.fairValueSummary?.fairValueLow ?? null,
      base: previous.valuation?.base ?? report.fairValueSummary?.fairValueBase ?? null,
      bull: previous.valuation?.bull ?? report.fairValueSummary?.fairValueHigh ?? null,
      probabilityWeighted: previous.valuation?.probabilityWeighted ?? report.fairValueSummary?.probabilityWeightedFairValue ?? null
    },
    thesis: report.thesis?.shortSummary || report.thesis?.fullSummary || previous.thesisSummary || null,
    targetQuarter: previous.requirementTargetQuarter || report.priceTargetRequirements?.targetQuarter || report.priceTargetRequirements?.earningsPeriod || null,
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
        "اقرأ تعليقات الإدارة عن الطلب والتسعير والقدرة والتنفيذ والمنافسة والحصة السوقية، ولا تكتفِ بالـ beat/miss.",
        "اقرأ ما تغير في الصناعة والدورة والمنافسة والتنظيم والعوامل الكلية فقط إذا كان أثره ماديًا على الفرضية أو التقييم.",
        "افصل بين reported data وconsensus وanalyst assumptions، ولا تخترع رقمًا غير متاح."
      ],
      frozenRequirementsEvaluation: [
        "إذا لم توجد requirement set سابقة فلا تخترع واحدة؛ اترك previousRequirementsEvaluation وفق القالب وأنشئ الدورة الجديدة من nextRequirements فقط.",
        "إذا وُجدت requirement set فقيّم فقط المجموعة السابقة المجمدة في previousInvestmentState.frozenRequirements.",
        "لا تغيّر id أو metric أو type أو requiredValue أو requiredDisplay أو weight أو targetQuarter لأي requirement سابق.",
        "لكل requirement املأ actualValue وactualDisplay وstatus وpartialCreditPct عند الحاجة وevaluationNote وsourceId.",
        "إذا لم تُفصح الشركة عن المعلومة: status = NOT_REPORTED وactualValue = null. لا تعتبرها FAILED.",
        "status يجب أن يكون NOT_REPORTED أو FAILED أو PARTIALLY_PASSED أو PASSED أو EXCEEDED.",
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
        "حدد changedAssumptions بوضوح واربطها بالأدلة الجديدة."
      ],
      valuationAndThesis: [
        "أعد تقييم Bear/Base/Bull إلزاميًا في كل ربع؛ لا تورثها آليًا.",
        "valuation.reviewStatus يجب أن يكون UPDATED أو UNCHANGED فقط بعد مراجعة فعلية.",
        "UNCHANGED يعني أنك أعدت underwriting وقررت أن التقييم السابق ما زال مبررًا.",
        "أي تغير في Fair Value يجب أن يمر عبر أثر الأدلة الجديدة على الإيراد/EPS/الهوامش/FCF/المخاطر/التوجيهات، وليس معادلة beat/miss ميكانيكية.",
        "املأ valuation.valuationBridge.whyBaseChangedOrNot بسبب محدد ومادي.",
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
        "كل sourceId غير null يجب أن يطابق sources[].id موجودًا."
      ]
    },
    outputContract: {
      schemaVersion: FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
      methodologyVersion: FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
      analysisType: "EARNINGS_REVALUATION",
      format: "EXACTLY_ONE_FENCED_JSON_BLOCK",
      lineage: {
        previousAnalysisId: previous.analysisId,
        previousRequirementSetId: previous.requirementSetId
      },
      requiredReviewStatus: "UPDATED أو UNCHANGED",
      rules: [
        "reportIdentity.previousAnalysisId يطابق previousInvestmentState.analysisId حرفيًا.",
        "reportIdentity.previousRequirementSetId يطابق previousInvestmentState.requirementSetId إذا كان موجودًا.",
        "previousRequirementsEvaluation يحافظ على تعريفات المتطلبات السابقة المجمدة إذا كانت موجودة.",
        "nextRequirements.requirementSetId = null.",
        "Bear <= Base <= Bull والاحتمالات تجمع 100%.",
        "valuation.current.probabilityWeighted يطابق المتوسط الاحتمالي للسيناريوهات.",
        "valuation.methodology.modelWeights تجمع 100%.",
        "marketPrice.currency وvaluation.current.currency يساويان company.tradingCurrency."
      ],
      missingValue: null,
      language: "العربية للنصوص، مع إبقاء المصطلحات المالية القياسية بالإنجليزية عند الحاجة"
    },
    jsonTemplate: template
  };

  return [
    "أنت نظام Fair value داخل ChatGPT، وأنت المحلل المالي المسؤول عن تحليل إعلان أرباح جديد وإعادة التقييم.",
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
    "nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base.",
    "أضف مصادر جديدة خاصة بهذا الربع.",
    "Franklin لا يرفع الهدف آليًا ولا يحسب targetValue. أنت وحدك تحدد ذلك داخل JSON.",
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
