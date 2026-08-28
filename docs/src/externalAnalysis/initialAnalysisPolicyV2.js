import {
  buildInitialAnalysisPrompt as buildBaseInitialAnalysisPrompt,
  FRANKLIN_INITIAL_PROMPT_VERSION
} from "./initialAnalysisPrompt.js";

const EXECUTION_MARKER = "نفّذ الطلب التالي كما هو. اقرأ كل التعليمات أولًا ثم ابحث وحلل، ولا تبدأ بإخراج JSON قبل اكتمال التحليل والتحقق الداخلي.";

export { FRANKLIN_INITIAL_PROMPT_VERSION };

export function buildInitialAnalysisPrompt(options = {}) {
  const basePrompt = buildBaseInitialAnalysisPrompt(options);
  const canonicalRules = [
    "CANONICAL ENUM VALUES — MANDATORY",
    "dataQuality.confidence وclassification.confidence وbusinessQuality.confidence وvaluation.current.confidence وvaluationResults[].confidence: استخدم HIGH أو MEDIUM أو LOW أو null فقط.",
    "strengths[].importance وweaknesses[].severity وrisks[].severity وlatestQuarter.companySpecificKpis[].importance: استخدم critical أو high أو medium أو low أو null فقط؛ لا تستخدم very high أو strategic أو material أو أوصافًا حرة.",
    "latestQuarter.companySpecificKpis[].result: استخدم BEAT أو MISS أو INLINE أو NA أو null فقط.",
    "latestQuarter.guidance[].direction: استخدم raised أو maintained أو lowered أو new أو not_reported أو null فقط.",
    "latestQuarter.forwardOutlook.growthOutlook: accelerating أو stable أو slowing أو unclear أو null فقط.",
    "latestQuarter.forwardOutlook.marginOutlook وfcfOutlook: improving أو stable أو pressured أو unclear أو null فقط.",
    "latestQuarter.forwardOutlook.demandOutlook: improving أو stable أو slowing أو unclear أو null فقط.",
    "latestQuarter.forwardOutlook.capacityOutlook: expanding أو adequate أو constrained أو unclear أو null فقط.",
    "latestQuarter.forwardOutlook.executionOutlook: improving أو stable أو deteriorating أو unclear أو null فقط.",
    "latestQuarter.forwardOutlook.guidanceTrend: raised أو maintained أو lowered أو mixed أو new أو not_reported أو null فقط.",
    "latestQuarter.forwardOutlook.managementTone: positive أو neutral أو cautious أو mixed أو unclear أو null فقط.",
    "forecast.materiality: استخدم MATERIAL أو NON_MATERIAL أو null فقط.",
    "forecast.yearlyForecast.*.basis: استخدم reported أو consensus أو analyst_assumption أو null فقط.",
    "forecast.changedAssumptions[].direction: استخدم UP أو DOWN أو UNCHANGED أو null فقط.",
    "financialNormalization إلزامي: لا تضع رقمًا بلا period وunit وaccountingBasis وsourceId عندما تكون هذه الأبعاد مادية، واستخدم null للرقم غير المتاح بدل اختراعه.",
    "valuationResults[].calculation يجب أن يحتوي formula وsteps وcomputedFairValue؛ ويجب أن يساوي computedFairValue قيمة fairValue للطريقة.",
    "valuation.calculationAudit.weightedMethodFairValue يجب أن يساوي المتوسط المرجح لنتائج الطرق، وreconciledBaseFairValue يجب أن يساوي valuation.current.base بعد analystOverlayPct موثق.",
    "أي analystOverlayPct غير صفري يحتاج overlayReason اقتصاديًا واضحًا، ولا يستخدم لإخفاء خطأ في الحساب أو لفرض قرار مرغوب.",
    "company.securityUnit وvaluation.current.securityUnit: استخدم فقط share أو ADS أو ADR أو unit؛ للسهم العادي استخدم share.",
    "decision.scope: استخدم STOCK_LEVEL فقط. decision.action: استخدم BUY أو ADD أو HOLD أو WATCH أو REDUCE أو SELL فقط.",
    "valuation.reviewStatus: استخدم INITIAL فقط في التحليل الأولي. thesis.status: استخدم INITIAL فقط في التحليل الأولي.",
    "valuationResults[].role: استخدم PRIMARY أو SECONDARY أو CROSS_CHECK فقط.",
    "marketPrice.priceType: استخدم LIVE أو DELAYED أو LAST_CLOSE فقط.",
    "marketPrice إلزامي بالكامل ولا يجوز ترك أي من value أوcurrency أوasOf أوpriceType أوsourceId بقيمة null.",
    "صيغة marketPrice المطلوبة: value رقم موجب؛ currency رمز العملة؛ asOf تاريخ ISO؛ priceType يساوي LIVE أو DELAYED أو LAST_CLOSE؛ sourceId يطابق معرّف مصدر موجود داخل sources.",
    "ابحث عن السعر قبل بدء التقييم. استخدم LIVE فقط إذا كان المصدر يقدمه بوضوح؛ وإلا استخدم DELAYED أو أحدث LAST_CLOSE موثق. لا تخمّن السعر ولا تنقله من الذاكرة.",
    "إذا تعذر الوصول إلى سعر موثق، لا تُخرج JSON ناقصًا: ابحث في مصدر Market Data موثوق آخر حتى تحصل على السعر وتاريخه ونوعه.",
    "قبل إخراج JSON نفّذ MARKET PRICE GATE: تحقق أن marketPrice.value رقم موجب، وأن asOf تاريخ حقيقي، وأن priceType قيمة معتمدة، وأن sourceId يطابق مصدر Market Data موجودًا داخل sources وله URL خام وusedFor يتضمن marketPrice.",
    "إذا كان marketPrice.sourceId يشير إلى مصدر داخل sources، يجب أن تتضمن sources[].usedFor لذلك المصدر القيمة الحرفية marketPrice.",
    "nextRequirements.mode: استخدم ADVANCE_TARGET أو DEFEND_BASE أو RECOVERY فقط.",
    "nextRequirements.targetScenario: استخدم BULL أو INTERMEDIATE أو BASE_DEFENSE أو RECOVERY فقط، ويجب أن يتوافق مع mode.",
    "nextRequirements.requirements[].type: استخدم minimum أو maximum أو range أو qualitative فقط.",
    "nextRequirements.requirements[].importance: استخدم critical أو high أو medium أو low فقط، وكل status يجب أن يكون NOT_REPORTED.",
    "sources[].type: استخدم Investor Relations أو SEC أو Earnings Call أو Market Data أو Consensus Data أو Trusted Financial News أو User Provided أو Other فقط.",
    "أي enum في القالب يجب أن يستخدم القيم المحددة حرفيًا، ولا تستبدله بوصف بشري جديد."
  ].join("\n");

  const markerIndex = basePrompt.indexOf(EXECUTION_MARKER);
  if (markerIndex < 0) return `${canonicalRules}\n\n${basePrompt}`;
  return `${basePrompt.slice(0, markerIndex)}${canonicalRules}\n\n${basePrompt.slice(markerIndex)}`;
}
