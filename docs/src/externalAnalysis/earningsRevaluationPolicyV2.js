import {
  buildEarningsRevaluationPrompt as buildBaseEarningsRevaluationPrompt,
  FRANKLIN_EARNINGS_PROMPT_VERSION
} from "./earningsRevaluationPrompt.js";

const REQUEST_MARKER = "نفّذ الطلب التالي كاملًا ثم أخرج عقد V3 فقط:";

export { FRANKLIN_EARNINGS_PROMPT_VERSION };

export function buildEarningsRevaluationPrompt(report = {}, options = {}) {
  const basePrompt = buildBaseEarningsRevaluationPrompt(report, options);
  const markerIndex = basePrompt.lastIndexOf(REQUEST_MARKER);
  if (markerIndex < 0) return basePrompt;

  const prefix = basePrompt.slice(0, markerIndex + REQUEST_MARKER.length);
  const requestText = basePrompt.slice(markerIndex + REQUEST_MARKER.length).trim();
  let request;
  try {
    request = JSON.parse(requestText);
  } catch {
    return basePrompt;
  }

  const existingRules = Array.isArray(request.revaluationScope?.nextRequirements)
    ? request.revaluationScope.nextRequirements
    : [];

  request.revaluationScope = request.revaluationScope || {};
  request.revaluationScope.nextRequirements = [
    ...existingRules,
    "لكل requirement رقمي جديد، املأ baselineValue وbaselineDisplay من أحدث Actual في الربع الذي تحلله عندما يكون نفس KPI ونفس الوحدة/العملة ونفس basis المحاسبي ونفس أساس السهم/ADS قابلة للمقارنة مباشرة.",
    "في ADVANCE_TARGET، لا تجعل minimum requirement أدنى من أحدث baseline قابل للمقارنة، ولا تجعل maximum requirement أرخى من أحدث baseline، إلا إذا كان هناك سبب تحليلي صريح مثل الموسمية أو Guidance أو تطبيع ربع استثنائي أو اختلاف basis.",
    "إذا كان threshold الجديد مستوفى أصلًا بواسطة أحدث Actual، فاعتبره maintenance/defense floor فقط، واشرح الاستثناء في nextRequirements.summary أو targetDescription وفي audit.consistencyNotes؛ ولا تقدمه كدليل incremental يبرر انتقال Fair Value إلى INTERMEDIATE أو BULL.",
    "في ADVANCE_TARGET يجب أن تحتوي المجموعة ككل على أدلة تقدم مستقبلية مادية لم تتحقق كلها مسبقًا؛ أما DEFEND_BASE فيجوز أن يستخدم حدود محافظة دون latest Actual إذا كان الهدف الحفاظ على Base ومبررًا تحليليًا، وRECOVERY يتبع recovery logic المعلن.",
    "Franklin لا يرفع requirement آليًا ولا يقرر comparability أو seasonality؛ أنت كمحلل Fair Value تختار الأرقام وتبرر أي استثناء."
  ];

  request.revaluationScope.nextRequirementsBaselinePolicy = {
    baselineSource: "latest reported actual from the earnings period being analyzed when directly comparable",
    comparableDimensions: ["same metric", "same unit/currency", "same accounting basis", "same share/ADS/ADR basis"],
    advanceTargetRule: "minimum >= comparable baseline and maximum <= comparable baseline unless an explicit analytical exception is documented",
    alreadyClearedRule: "an already-cleared threshold is a maintenance floor, not incremental evidence for a higher valuation target",
    exceptionDocumentation: ["nextRequirements.summary or targetDescription", "audit.consistencyNotes"],
    authority: "Fair Value / ChatGPT sets targets; Franklin validates consistency only"
  };

  request.outputContract = request.outputContract || {};
  const outputRules = Array.isArray(request.outputContract.rules) ? request.outputContract.rules : [];
  request.outputContract.rules = [
    ...outputRules,
    "عند توفر Actual قابل للمقارنة، nextRequirements.requirements[].baselineValue/baselineDisplay يعكسان الربع الجديد نفسه، وليس هدف requirement القديم.",
    "ADVANCE_TARGET لا يعتمد على requirement رقمي مستوفى مسبقًا كدليل وحيد أو أساسي لتبرير targetValue أعلى؛ أي استثناء يجب أن يكون موثقًا صراحةً."
  ];

  return `${prefix}\n${JSON.stringify(request)}`;
}
