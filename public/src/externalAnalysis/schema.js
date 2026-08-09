import { fairValueAnalysisToExternalReport, isFairValueAnalysisReport } from "./fairValueAdapter.js";
import { setByPath } from "./fieldPaths.js";
import {
  normalizeCompanySpecificKpis,
  normalizeExternalRecommendation,
  normalizeExternalScenarios,
  normalizeGuidance,
  normalizeNextQuarterGuidance,
  normalizePriceTargetRequirements,
  normalizePreviousRequirementsEvaluation,
  normalizeRequirementsAssessment
} from "./requirements.js";

export const EXTERNAL_ANALYSIS_SCHEMA_VERSION = "external-analysis-report/v1";
export const EXTERNAL_ANALYSIS_ORIGIN = "external_chatgpt";
export const EXTERNAL_ANALYSIS_PARSER_VERSION = "external-parser-v1";

export const VALUATION_METHOD_KEYS = ["dcf", "pe", "evEbitda", "ps", "peg", "sotp", "other"];

export function createEmptyExternalAnalysisReport(rawAnalysis = "", now = new Date()) {
  const timestamp = now.toISOString();
  return {
    schemaVersion: EXTERNAL_ANALYSIS_SCHEMA_VERSION,
    analysisOrigin: EXTERNAL_ANALYSIS_ORIGIN,
    source: "ChatGPT",
    sourceModel: null,
    sourceConversation: null,
    analysisDate: null,
    reportPeriod: null,
    company: {
      ticker: null,
      name: null,
      sector: null,
      industry: null,
      currency: "USD"
    },
    companyProfile: null,
    market: {
      priceAtAnalysis: null,
      userAverageCost: null
    },
    scores: {
      quality: null,
      growth: null,
      valuation: null,
      risk: null,
      overall: null,
      moat: null,
      management: null
    },
    fairValue: {
      bear: null,
      base: null,
      bull: null,
      weightedFairValue: null,
      analystFairValue: null,
      upsideToBasePct: null,
      downsideToBearPct: null,
      upsideToBullPct: null
    },
    valuationMethods: {
      dcf: null,
      pe: null,
      evEbitda: null,
      ps: null,
      peg: null,
      sotp: null,
      other: null
    },
    financialHighlights: {
      revenue: null,
      revenueGrowthPct: null,
      operatingIncome: null,
      operatingIncomeGrowthPct: null,
      operatingMarginPct: null,
      epsReported: null,
      epsNormalized: null,
      operatingCashFlow: null,
      freeCashFlow: null,
      capex: null,
      cash: null,
      debt: null
    },
    growthHighlights: {
      revenueGrowth: null,
      epsGrowth: null,
      fcfGrowth: null,
      majorSegmentGrowth: null,
      marginTrend: null,
      marketShareTrend: null,
      tamComment: null
    },
    quality: {
      summary: null,
      strengths: [],
      weaknesses: [],
      moat: null,
      profitability: null,
      balanceSheet: null,
      capitalAllocation: null,
      earningsQuality: null
    },
    risks: [],
    catalysts: [],
    thesis: {
      shortSummary: null,
      fullSummary: null
    },
    earningsQuality: {
      status: null,
      reportedVsNormalizedExplanation: null,
      oneOffItems: []
    },
    watchItems: [],
    decision: {
      verdict: null,
      rationale: null,
      buyZone: null,
      fairZone: null,
      expensiveZone: null
    },
    recommendation: {
      action: null,
      confidence: null,
      reason: null,
      whatWouldUpgrade: [],
      whatWouldDowngrade: []
    },
    guidance: [],
    nextQuarterGuidance: {
      quarter: null,
      items: []
    },
    companySpecificKpis: [],
    priceTargetRequirements: {
      requirementSetId: null,
      status: null,
      createdFromAnalysisId: null,
      evaluatedByAnalysisId: null,
      evaluatedAt: null,
      currentJustifiedValue: null,
      targetValue: null,
      nextTargetValue: null,
      targetScenario: null,
      targetDescription: null,
      summary: null,
      createdAt: null,
      previousQuarter: null,
      targetQuarter: null,
      earningsPeriod: null,
      requirements: []
    },
    previousRequirementsEvaluation: {
      requirementSetId: null,
      ticker: null,
      earningsPeriod: null,
      createdAt: null,
      createdFromAnalysisId: null,
      targetValue: null,
      targetScenario: null,
      targetDescription: null,
      summary: null,
      matchType: null,
      previousQuarter: null,
      targetQuarter: null,
      requirements: [],
      requirementsAssessment: null
    },
    requirementsAssessment: {
      weightedAchievement: null,
      reportedRequirements: null,
      totalRequirements: null,
      passed: null,
      failed: null,
      exceeded: null,
      partiallyPassed: null,
      notReported: null,
      overallStatus: null,
      summary: null,
      calculatedAt: null
    },
    scenarios: {},
    primaryValuationMethod: null,
    valuationSelectionReason: null,
    sources: [],
    rawAnalysis,
    rawAnalysisOriginal: rawAnalysis,
    supplements: [],
    completionStatus: {
      status: "incomplete",
      requiredTotal: 0,
      requiredComplete: 0,
      recommendedTotal: 0,
      recommendedComplete: 0,
      completionPct: 0,
      missingRequiredPaths: [],
      missingRecommendedPaths: [],
      conflictingPaths: [],
      lastValidatedAt: null
    },
    userEditedFields: {},
    metadata: {
      importedAt: timestamp,
      updatedAt: timestamp,
      importMethod: null,
      parserVersion: EXTERNAL_ANALYSIS_PARSER_VERSION,
      rawHash: rawAnalysis ? hashText(rawAnalysis) : null
    }
  };
}

export function normalizeExternalAnalysisReport(input = {}, rawAnalysis = "", options = {}) {
  const originalInput = input && typeof input === "object" ? input : {};
  if (isFairValueAnalysisReport(originalInput)) {
    input = fairValueAnalysisToExternalReport(originalInput);
  }
  const now = options.now || new Date();
  const base = createEmptyExternalAnalysisReport(rawAnalysis || input.rawAnalysisOriginal || input.rawAnalysis || "", now);
  const source = input.source ?? input.metadata?.source ?? base.source;
  const companyInput = input.company || {};
  const marketInput = input.market || {};
  const scoresInput = input.scores || {};
  const fairValueInput = input.fairValue || input.fairValues || {};
  const priceTargetRequirements = normalizePriceTargetRequirements(input.priceTargetRequirements ?? input.priceTargetMonitoring);
  const requirementsAssessment = normalizeRequirementsAssessment(input.requirementsAssessment || {});
  const recommendation = normalizeExternalRecommendation(input.recommendation, input.decision?.verdict ?? input.verdict ?? input.recommendation, input.decision?.rationale ?? input.rationale);
  const recommendationVerdict = recommendation.action || (typeof input.recommendation === "string" ? input.recommendation : null);
  const report = {
    ...base,
    id: input.id || null,
    schemaVersion: input.schemaVersion || EXTERNAL_ANALYSIS_SCHEMA_VERSION,
    analysisOrigin: EXTERNAL_ANALYSIS_ORIGIN,
    source: nullableString(source) || "ChatGPT",
    sourceModel: nullableString(input.sourceModel ?? input.model ?? input.metadata?.sourceModel),
    sourceConversation: nullableString(input.sourceConversation),
    analysisDate: normalizeDate(input.analysisDate ?? input.date),
    reportPeriod: nullableString(input.reportPeriod ?? input.period),
    company: {
      ticker: normalizeTicker(companyInput.ticker ?? input.ticker ?? input.symbol),
      name: nullableString(companyInput.name ?? input.companyName ?? input.name),
      sector: nullableString(companyInput.sector ?? input.sector),
      industry: nullableString(companyInput.industry ?? input.industry),
      currency: nullableString(companyInput.currency ?? input.currency) || "USD"
    },
    companyProfile: normalizeCompanyProfile(input.companyProfile),
    market: {
      priceAtAnalysis: toNullableNumber(marketInput.priceAtAnalysis ?? input.priceAtAnalysis ?? input.currentPrice),
      userAverageCost: toNullableNumber(marketInput.userAverageCost ?? input.userAverageCost)
    },
    scores: {
      quality: toNullableNumber(scoresInput.quality ?? input.qualityScore),
      growth: toNullableNumber(scoresInput.growth ?? input.growthScore),
      valuation: toNullableNumber(scoresInput.valuation ?? input.valuationScore),
      risk: toNullableNumber(scoresInput.risk ?? input.riskScore),
      overall: toNullableNumber(scoresInput.overall ?? input.overallScore ?? input.investmentScore),
      moat: toNullableNumber(scoresInput.moat ?? input.moatScore),
      management: toNullableNumber(scoresInput.management ?? input.managementScore)
    },
    fairValue: {
      bear: toNullableNumber(fairValueInput.bear ?? input.bearFairValue),
      base: toNullableNumber(fairValueInput.base ?? input.baseFairValue),
      bull: toNullableNumber(fairValueInput.bull ?? input.bullFairValue),
      weightedFairValue: toNullableNumber(fairValueInput.weightedFairValue ?? input.weightedFairValue),
      analystFairValue: toNullableNumber(fairValueInput.analystFairValue ?? input.analystFairValue),
      upsideToBasePct: toNullableNumber(fairValueInput.upsideToBasePct ?? input.upsideToBasePct),
      downsideToBearPct: toNullableNumber(fairValueInput.downsideToBearPct ?? input.downsideToBearPct),
      upsideToBullPct: toNullableNumber(fairValueInput.upsideToBullPct ?? input.upsideToBullPct)
    },
    valuationMethods: normalizeValuationMethods(input.valuationMethods),
    financialHighlights: normalizeObject(base.financialHighlights, input.financialHighlights || {}),
    growthHighlights: normalizeObject(base.growthHighlights, input.growthHighlights || {}),
    quality: {
      ...base.quality,
      ...(input.quality && typeof input.quality === "object" ? input.quality : {}),
      strengths: normalizeStringArray(input.quality?.strengths),
      weaknesses: normalizeStringArray(input.quality?.weaknesses)
    },
    risks: normalizeItems(input.risks ?? input.mainRisks, ["title", "severity", "explanation", "whatToMonitor", "thesisBreaker"]),
    catalysts: normalizeItems(input.catalysts, ["title", "explanation"]),
    thesis: {
      shortSummary: nullableString(input.thesis?.shortSummary ?? input.shortSummary ?? input.thesisSummary),
      fullSummary: nullableString(input.thesis?.fullSummary ?? input.fullSummary)
    },
    earningsQuality: {
      status: nullableString(input.earningsQuality?.status),
      reportedVsNormalizedExplanation: nullableString(input.earningsQuality?.reportedVsNormalizedExplanation),
      oneOffItems: normalizeStringArray(input.earningsQuality?.oneOffItems)
    },
    watchItems: normalizeStringArray(input.watchItems),
    decision: {
      verdict: nullableString(input.decision?.verdict ?? input.verdict ?? recommendationVerdict),
      rationale: nullableString(input.decision?.rationale ?? input.rationale ?? recommendation.reason),
      buyZone: nullableString(input.decision?.buyZone),
      fairZone: nullableString(input.decision?.fairZone),
      expensiveZone: nullableString(input.decision?.expensiveZone)
    },
    recommendation,
    guidance: normalizeGuidance(input.guidance),
    nextQuarterGuidance: normalizeNextQuarterGuidance(input.nextQuarterGuidance),
    companySpecificKpis: normalizeCompanySpecificKpis(input.companySpecificKpis),
    priceTargetRequirements,
    previousRequirementsEvaluation: normalizePreviousRequirementsEvaluation(input.previousRequirementsEvaluation),
    requirementsAssessment,
    scenarios: normalizeExternalScenarios(input.scenarios),
    primaryValuationMethod: nullableString(input.primaryValuationMethod ?? input.metadata?.primaryValuationMethod),
    valuationSelectionReason: nullableString(input.valuationSelectionReason ?? input.metadata?.valuationSelectionReason),
    sources: normalizeItems(input.sources, ["title", "url", "sourceType"]),
    rawAnalysis: String(rawAnalysis || input.rawAnalysis || input.rawAnalysisOriginal || ""),
    rawAnalysisOriginal: String(input.rawAnalysisOriginal || rawAnalysis || input.rawAnalysis || ""),
    supplements: normalizeSupplements(input.supplements),
    completionStatus: input.completionStatus && typeof input.completionStatus === "object" ? preserveNulls(input.completionStatus) : base.completionStatus,
    userEditedFields: input.userEditedFields && typeof input.userEditedFields === "object" ? input.userEditedFields : {},
    metadata: {
      importedAt: input.metadata?.importedAt || base.metadata.importedAt,
      updatedAt: input.metadata?.updatedAt || base.metadata.updatedAt,
      importMethod: input.metadata?.importMethod || options.importMethod || null,
      parserVersion: input.metadata?.parserVersion || EXTERNAL_ANALYSIS_PARSER_VERSION,
      rawHash: input.metadata?.rawHash || hashText(String(rawAnalysis || input.rawAnalysisOriginal || input.rawAnalysis || "")),
      nativeSchemaVersion: input.metadata?.nativeSchemaVersion || originalInput.schemaVersion || null,
      nativeMethodologyVersion: input.metadata?.nativeMethodologyVersion || originalInput.methodologyVersion || null,
      fairValueDataQualityScore: input.metadata?.fairValueDataQualityScore ?? null,
      fairValueDataConfidence: input.metadata?.fairValueDataConfidence ?? null,
      primaryValuationMethod: input.metadata?.primaryValuationMethod ?? null,
      valuationSelectionReason: input.metadata?.valuationSelectionReason ?? null,
      fairValueLimitations: Array.isArray(input.metadata?.fairValueLimitations) ? input.metadata.fairValueLimitations : []
    }
  };
  return preserveNulls(report);
}

export function updateExternalAnalysisField(report, path, value, now = new Date()) {
  const next = structuredCloneSafe(report);
  setByPath(next, path, coercePathValue(path, value));
  next.userEditedFields = {
    ...(next.userEditedFields || {}),
    [path]: true
  };
  next.metadata = {
    ...(next.metadata || {}),
    updatedAt: now.toISOString()
  };
  next.analysisOrigin = EXTERNAL_ANALYSIS_ORIGIN;
  return preserveNulls(next);
}

export function hashText(text = "") {
  let hash = 2166136261;
  const clean = String(text);
  for (let index = 0; index < clean.length; index += 1) {
    hash ^= clean.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeValuationMethods(methods = {}) {
  const result = {};
  for (const key of VALUATION_METHOD_KEYS) {
    const value = methods?.[key];
    result[key] = value === undefined ? null : preserveNulls(value);
  }
  return result;
}

function normalizeObject(template, value = {}) {
  const result = {};
  for (const key of Object.keys(template)) {
    result[key] = toMaybeNumberOrString(value[key]);
  }
  return result;
}

function normalizeItems(value, keys) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return Object.fromEntries(keys.map((key, index) => [key, index === 0 ? item : null]));
    }
    if (!item || typeof item !== "object") return null;
    return Object.fromEntries(keys.map((key) => [key, toMaybeNumberOrString(aliasValue(item, key))]));
  }).filter(Boolean);
}

function normalizeCompanyProfile(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const activities = Array.isArray(value.activities)
    ? value.activities.map((activity) => {
      if (typeof activity === "string") {
        return { name: activity, arabicName: null, description: null, importance: null };
      }
      if (!activity || typeof activity !== "object") return null;
      return {
        name: narrativeValue(activity.name),
        arabicName: narrativeValue(activity.arabicName),
        description: narrativeValue(activity.description),
        importance: narrativeValue(activity.importance)
      };
    }).filter(Boolean)
    : [];
  return preserveNulls({
    summary: narrativeValue(value.summary),
    businessModel: narrativeValue(value.businessModel),
    activities,
    customers: narrativeValue(value.customers),
    mainGrowthDrivers: normalizeNarrativeArray(value.mainGrowthDrivers)
  });
}

function aliasValue(item, key) {
  if (key === "title") return item.title ?? item.name ?? item.topic;
  if (key === "sourceType") return item.sourceType ?? item.type;
  return item[key];
}

function normalizeSupplements(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map(preserveNulls);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => nullableString(item)).filter((item) => item !== null);
}

function normalizeNarrativeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => narrativeValue(item)).filter((item) => item !== null);
}

function narrativeValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return preserveNulls(value);
  return nullableString(value);
}

function preserveNulls(value) {
  if (Array.isArray(value)) return value.map(preserveNulls);
  if (!value || typeof value !== "object") return value === undefined ? null : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, preserveNulls(item)]));
}

function toMaybeNumberOrString(value) {
  if (value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value === null ? null : value;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[%,$\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  const clean = String(value).trim();
  return clean ? clean : null;
}

function normalizeTicker(value) {
  const clean = nullableString(value);
  return clean ? clean.toUpperCase() : null;
}

function normalizeDate(value) {
  const clean = nullableString(value);
  if (!clean) return null;
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) return clean.slice(0, 10);
  return clean;
}

function coercePathValue(path, value) {
  const numericPath = /(^scores\.|^fairValue\.|^market\.|Pct$|price|Price|value|Value|revenue|Income|cash|debt|capex|eps|flow|Flow)/i.test(path);
  if (numericPath) return toNullableNumber(value);
  return nullableString(value);
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value || {}));
}
