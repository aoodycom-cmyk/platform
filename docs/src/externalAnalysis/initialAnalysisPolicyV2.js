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
    "company.securityUnit وvaluation.current.securityUnit: استخدم فقط share أو ADS أو ADR أو unit؛ للسهم العادي استخدم share.",
    "أي enum في القالب يجب أن يستخدم القيم المحددة حرفيًا، ولا تستبدله بوصف بشري جديد."
  ].join("\n");

  const markerIndex = basePrompt.indexOf(EXECUTION_MARKER);
  if (markerIndex < 0) return `${canonicalRules}\n\n${basePrompt}`;
  return `${basePrompt.slice(0, markerIndex)}${canonicalRules}\n\n${basePrompt.slice(markerIndex)}`;
}
