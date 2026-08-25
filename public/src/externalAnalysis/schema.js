import { fairValueAnalysisToExternalReport, isFairValueAnalysisReport } from "./fairValueAdapter.js";
import { setByPath } from "./fieldPaths.js";
import { franklinV3ToExternalReport } from "./v3Adapter.js";
import { isFranklinV3Report } from "./v3Contract.js";
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

export const EXTERNAL_ANALYSIS_SCHEMA_VERSION = "external-analysis-report/v2";
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
      userAverageCost: null
    },
    scores: {
      quality: null,
      growth: null,
      valuation: null,
      risk: null,
      moat: null,
      management: null
    },
    fairValueSummary: {
      fairValueLow: null,
      fairValueBase: null,
      fairValueHigh: null,
      probabilityWeightedFairValue: null,
      currentPrice: null,
      upsideDownsidePercent: null,
      marginOfSafetyPercent: null,
      confidenceLevel: null
    },
    valuationMethodology: null,
    valuationResults: [],
    forecastAssumptions: null,
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
    decision: {
      action: null,
      confidence: null,
      investmentScore: null,
      rationale: [],
      whyNot: [],
      upgradeTriggers: [],
      downgradeTriggers: [],
      biggestAssumption: null,
      mainRisk: null,
      buyZone: null,
      fairZone: null,
      expensiveZone: null
    },
    guidance: [],
    monitoringChecklist: [],
    estimateRevisions: null,
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
      mode: null,
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
  if (isFranklinV3Report(originalInput)) {
    input = franklinV3ToExternalReport(originalInput, rawAnalysis);
  }
  if (isFairValueAnalysisReport(originalInput)) {
    input = fairValueAnalysisToExternalReport(originalInput);
  }
  const now = options.now || new Date();
  const base = createEmptyExternalAnalysisReport(rawAnalysis || input.rawAnalysisOriginal || input.rawAnalysis || "", now);
  const source = input.source ?? input.metadata?.source ?? base.source;
  const companyInput = input.company || {};
  const marketInput = input.market || {};
  const scoresInput = input.scores || {};
  const fairValueSummary = normalizeFairValueSummary(input);
  const priceTargetRequirements = normalizePriceTargetRequirements(input.priceTargetRequirements ?? input.priceTargetMonitoring);
  const requirementsAssessment = normalizeRequirementsAssessment(input.requirementsAssessment || {});
  const decision = normalizeCanonicalDecision(input);
  const report = {
    ...base,
    id: input.id || null,
    schemaVersion: EXTERNAL_ANALYSIS_SCHEMA_VERSION,
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
    presentation: normalizePresentation(input.presentation),
    companyProfile: normalizeCompanyProfile(input.companyProfile),
    market: {
      userAverageCost: toNullableNumber(marketInput.userAverageCost ?? input.userAverageCost)
    },
    scores: {
      quality: toNullableNumber(scoresInput.quality ?? input.qualityScore),
      growth: toNullableNumber(scoresInput.growth ?? input.growthScore),
      valuation: toNullableNumber(scoresInput.valuation ?? input.valuationScore),
      risk: toNullableNumber(scoresInput.risk ?? input.riskScore),
      moat: toNullableNumber(scoresInput.moat ?? input.moatScore),
      management: toNullableNumber(scoresInput.management ?? input.managementScore)
    },
    fairValueSummary,
    valuationMethodology: normalizeOptionalObject(input.valuationMethodology),
    valuationResults: normalizeValuationResults(input.valuationResults, input.valuationMethods),
    forecastAssumptions: normalizeOptionalObject(input.forecastAssumptions),
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
    decision,
    guidance: normalizeCanonicalGuidance(input.guidance, input.nextQuarterGuidance),
    monitoringChecklist: normalizeMonitoringChecklist(input.monitoringChecklist, input.whatChangesMyMind, input.watchItems),
    estimateRevisions: normalizeEstimateRevisions(input.estimateRevisions),
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
      fairValueLimitations: Array.isArray(input.metadata?.fairValueLimitations) ? input.metadata.fairValueLimitations : [],
      analysisType: input.metadata?.analysisType ?? null,
      franklinV3Report: input.metadata?.franklinV3Report ?? null,
      franklinV3: input.metadata?.franklinV3 ?? null
    }
  };
  return attachLegacyReadAliases(preserveNulls(report));
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

export function canonicalExternalAnalysisReport(report = {}) {
  return preserveNulls(normalizeExternalAnalysisReport(report, report.rawAnalysisOriginal || report.rawAnalysis || ""));
}

function normalizeFairValueSummary(input = {}) {
  const canonical = input.fairValueSummary || {};
  const legacy = input.fairValue || input.fairValues || {};
  const executive = input.executiveDecision || {};
  const dashboard = input.dashboardExport || {};
  const scenarios = input.scenarios || {};
  return {
    // Priority: canonical v2 -> legacy external report -> Fair Value decision/scenarios -> top-level aliases.
    fairValueLow: firstNumber(canonical.fairValueLow, legacy.bear, input.bearFairValue, executive.fairValueLow, scenarioFairValue(scenarios, "Conservative", "Bear")),
    fairValueBase: firstNumber(canonical.fairValueBase, legacy.base, input.baseFairValue, executive.fairValue, dashboard.fairValue, scenarioFairValue(scenarios, "Base")),
    fairValueHigh: firstNumber(canonical.fairValueHigh, legacy.bull, input.bullFairValue, executive.fairValueHigh, scenarioFairValue(scenarios, "Optimistic", "Bull")),
    probabilityWeightedFairValue: firstNumber(canonical.probabilityWeightedFairValue, legacy.weightedFairValue, input.weightedFairValue),
    currentPrice: firstNumber(canonical.currentPrice, input.market?.currentPrice, input.market?.priceAtAnalysis, input.priceAtAnalysis, input.currentPrice, input.company?.currentPrice, executive.currentPrice, dashboard.currentPrice),
    upsideDownsidePercent: firstNumber(canonical.upsideDownsidePercent, legacy.upsideToBasePct, input.upsideToBasePct, executive.upsideDownsidePercent, dashboard.upsideDownsidePercent),
    marginOfSafetyPercent: firstNumber(canonical.marginOfSafetyPercent, legacy.marginOfSafetyPercent, input.marginOfSafetyPercent, executive.marginOfSafetyPercent),
    confidenceLevel: nullableString(canonical.confidenceLevel ?? input.confidenceLevel)
  };
}

function normalizePresentation(value = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    companyLogoDataUrl: nullableString(input.companyLogoDataUrl),
    morningstarFairValue: toNullableNumber(input.morningstarFairValue)
  };
}

function normalizeCanonicalDecision(input = {}) {
  const decision = input.decision && typeof input.decision === "object" ? input.decision : {};
  const recommendation = normalizeExternalRecommendation(
    input.recommendation,
    decision.verdict ?? input.finalDecision?.decision ?? input.executiveDecision?.recommendation ?? input.verdict,
    decision.rationale ?? input.rationale
  );
  const finalDecision = input.finalDecision || {};
  const executive = input.executiveDecision || {};
  const whatChanges = input.whatChangesMyMind || {};
  const rawAction = decision.action ?? decision.verdict ?? recommendation.action ?? finalDecision.decision ?? executive.recommendation ?? input.verdict;
  const action = normalizeDecisionAction(rawAction);
  const rationale = normalizeNarrativeList(decision.rationale ?? decision.why ?? recommendation.reason ?? finalDecision.why ?? executive.why ?? input.rationale);
  const detailedLegacyAction = nullableString(rawAction);
  if (detailedLegacyAction && action && detailedLegacyAction.toUpperCase() !== action && !rationale.includes(detailedLegacyAction)) {
    rationale.push(detailedLegacyAction);
  }
  return {
    // Priority: canonical decision.action -> legacy decision.verdict -> recommendation -> final/executive decision.
    action,
    confidence: normalizeConfidence(decision.confidence ?? recommendation.confidence ?? executive.confidence ?? input.dashboardExport?.confidence),
    investmentScore: firstNumber(decision.investmentScore, executive.investmentScore, input.dashboardExport?.investmentScore, input.scores?.overall, input.overallScore, input.investmentScore),
    rationale,
    whyNot: normalizeNarrativeList(decision.whyNot ?? finalDecision.whyNot),
    upgradeTriggers: normalizeTextList(decision.upgradeTriggers ?? recommendation.whatWouldUpgrade ?? whatChanges.upgradeTrigger),
    downgradeTriggers: normalizeTextList(decision.downgradeTriggers ?? recommendation.whatWouldDowngrade ?? whatChanges.downgradeTrigger),
    biggestAssumption: nullableString(decision.biggestAssumption ?? finalDecision.biggestAssumption ?? whatChanges.biggestAssumption),
    mainRisk: nullableString(decision.mainRisk ?? finalDecision.mainRisk),
    buyZone: nullableString(decision.buyZone),
    fairZone: nullableString(decision.fairZone),
    expensiveZone: nullableString(decision.expensiveZone)
  };
}

function normalizeCanonicalGuidance(guidanceInput, nextQuarterInput) {
  const canonical = normalizeGuidance(guidanceInput).map((item) => ({
    ...item,
    period: nullableString(item.period)
  }));
  const next = normalizeNextQuarterGuidance(nextQuarterInput);
  for (const item of next.items || []) {
    const normalized = {
      period: next.quarter,
      topic: item.topic,
      arabicTopic: item.arabicTopic,
      currentGuidance: item.guidance,
      previousGuidance: item.previousGuidance,
      direction: item.direction,
      type: "text",
      interpretation: item.interpretation,
      importance: item.importance
    };
    if (!canonical.some((entry) => guidanceIdentity(entry) === guidanceIdentity(normalized))) canonical.push(normalized);
  }
  return canonical;
}

function normalizeMonitoringChecklist(checklist, whatChanges, watchItems) {
  const result = [];
  const append = (item) => {
    const normalized = normalizeMonitoringItem(item);
    if (!normalized?.metric) return;
    if (!result.some((entry) => entry.metric.toLowerCase() === normalized.metric.toLowerCase())) result.push(normalized);
  };
  (Array.isArray(checklist) ? checklist : []).forEach(append);
  (Array.isArray(whatChanges?.items) ? whatChanges.items : []).forEach(append);
  normalizeStringArray(watchItems).forEach(append);
  for (const [metric, value] of [
    ["Upgrade trigger", whatChanges?.upgradeTrigger],
    ["Downgrade trigger", whatChanges?.downgradeTrigger],
    ["Thesis break", whatChanges?.thesisBreak]
  ]) {
    if (value) append({ metric, currentValue: value });
  }
  return result;
}

function normalizeMonitoringItem(item) {
  if (typeof item === "string") return { metric: nullableString(item), currentValue: null, expectedRange: null, upgradeTrigger: null, downgradeTrigger: null, thesisBreak: null, revaluationEvent: null };
  if (!item || typeof item !== "object") return null;
  return {
    metric: nullableString(item.metric ?? item.name ?? item.title),
    currentValue: toMaybeNumberOrString(item.currentValue),
    expectedRange: toMaybeNumberOrString(item.expectedRange),
    upgradeTrigger: nullableString(item.upgradeTrigger),
    downgradeTrigger: nullableString(item.downgradeTrigger),
    thesisBreak: nullableString(item.thesisBreak),
    revaluationEvent: nullableString(item.revaluationEvent)
  };
}

function normalizeEstimateRevisions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    periodDays: toNullableNumber(value.periodDays),
    asOfDate: normalizeDate(value.asOfDate),
    revenue: normalizeRevisionMetric(value.revenue),
    eps: normalizeRevisionMetric(value.eps),
    ebitda: normalizeRevisionMetric(value.ebitda),
    overallDirection: normalizeRevisionDirection(value.overallDirection),
    interpretation: narrativeValue(value.interpretation),
    confidence: nullableString(value.confidence),
    source: nullableString(value.source)
  };
}

function normalizeRevisionMetric(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const trend = String(value.trend || "").trim().toLowerCase();
  return {
    trend: ["up", "flat", "down"].includes(trend) ? trend : null,
    currentEstimate: toMaybeNumberOrString(value.currentEstimate),
    previousEstimate: toMaybeNumberOrString(value.previousEstimate),
    changePercent: toNullableNumber(value.changePercent)
  };
}

function normalizeRevisionDirection(value) {
  const clean = String(value || "unknown").trim().toLowerCase();
  return ["positive", "neutral", "negative", "mixed", "unknown"].includes(clean) ? clean : "unknown";
}

function normalizeValuationResults(results, legacyMethods) {
  if (Array.isArray(results)) return results.filter((item) => item && typeof item === "object").map(preserveNulls);
  return Object.entries(normalizeValuationMethods(legacyMethods))
    .filter(([, item]) => item && typeof item === "object")
    .map(([key, item]) => preserveNulls({ method: item.method || key, ...item }));
}

function normalizeOptionalObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? preserveNulls(value) : null;
}

function normalizeNarrativeList(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.map(narrativeValue).filter((item) => item !== null);
}

function normalizeTextList(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.map(nullableString).filter(Boolean);
}

function normalizeDecisionAction(value) {
  const clean = String(value || "").trim().toUpperCase();
  return ["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"].find((action) => clean.split(/[\s/|-]+/).includes(action)) || nullableString(value);
}

function normalizeConfidence(value) {
  const numeric = toNullableNumber(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : nullableString(value);
}

function guidanceIdentity(item = {}) {
  return [item.period, item.topic, item.arabicTopic, item.currentGuidance].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function scenarioFairValue(scenarios, ...keys) {
  for (const key of keys) {
    const scenario = scenarios?.[key];
    if (scenario?.enabled === false) continue;
    if (scenario?.fairValue !== undefined) return scenario.fairValue;
  }
  return null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = toNullableNumber(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function attachLegacyReadAliases(report) {
  defineReadAlias(report, "fairValue", () => legacyFairValueView(report.fairValueSummary));
  defineReadAlias(report, "recommendation", () => ({
    action: report.decision?.action || null,
    confidence: report.decision?.confidence ?? null,
    reason: report.decision?.rationale?.[0] || null,
    whatWouldUpgrade: report.decision?.upgradeTriggers || [],
    whatWouldDowngrade: report.decision?.downgradeTriggers || []
  }));
  defineReadAlias(report, "watchItems", () => (report.monitoringChecklist || []).map((item) => item.metric).filter(Boolean));
  defineReadAlias(report, "nextQuarterGuidance", () => legacyNextQuarterGuidanceView(report.guidance));
  defineReadAlias(report, "valuationMethods", () => legacyValuationMethodsView(report.valuationResults));
  defineReadAlias(report.market, "priceAtAnalysis", () => report.fairValueSummary?.currentPrice ?? null);
  defineReadAlias(report.market, "currentPrice", () => report.fairValueSummary?.currentPrice ?? null);
  defineReadAlias(report.scores, "overall", () => report.decision?.investmentScore ?? null);
  defineReadAlias(report.decision, "verdict", () => report.decision?.action ?? null);
  return report;
}

function defineReadAlias(object, key, getter) {
  if (!object || Object.prototype.hasOwnProperty.call(object, key)) return;
  Object.defineProperty(object, key, { enumerable: false, configurable: true, get: getter });
}

function legacyFairValueView(summary = {}) {
  const current = summary.currentPrice;
  return {
    bear: summary.fairValueLow,
    base: summary.fairValueBase,
    bull: summary.fairValueHigh,
    weightedFairValue: summary.probabilityWeightedFairValue,
    analystFairValue: summary.fairValueBase,
    upsideToBasePct: summary.upsideDownsidePercent,
    downsideToBearPct: derivedUpside(summary.fairValueLow, current),
    upsideToBullPct: derivedUpside(summary.fairValueHigh, current)
  };
}

function legacyNextQuarterGuidanceView(guidance = []) {
  const period = guidance.find((item) => item?.period)?.period || null;
  const items = guidance.filter((item) => !period || item.period === period).map((item) => ({ ...item, guidance: item.currentGuidance }));
  return { quarter: period, items };
}

function legacyValuationMethodsView(results = []) {
  return Object.fromEntries((results || []).map((item, index) => [valuationResultKey(item?.method, index), item]));
}

function valuationResultKey(method, index) {
  const clean = String(method || "other").toLowerCase();
  if (clean.includes("dcf")) return "dcf";
  if (clean.includes("ev/ebitda")) return "evEbitda";
  if (clean.includes("peg")) return "peg";
  if (clean.includes("sotp")) return "sotp";
  if (clean.includes("sales") || clean.includes("p/s")) return "ps";
  if (clean.includes("p/e") || clean === "pe") return "pe";
  return index ? `other${index + 1}` : "other";
}

function derivedUpside(value, current) {
  return Number.isFinite(value) && Number.isFinite(current) && current > 0 ? ((value - current) / current) * 100 : null;
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
