export const REQUIREMENT_STATUSES = ["NOT_REPORTED", "PASSED", "PARTIALLY_PASSED", "FAILED", "EXCEEDED"];
export const RECOMMENDATION_ACTIONS = ["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"];
export const REQUIREMENT_DIRECTIONS = ["up", "down", "flat", "unknown"];
export const REQUIREMENT_IMPACTS = ["positive", "negative", "mixed", "neutral", "unknown"];

export function calculateRequirementsAssessment(requirementsInput = {}, suppliedAssessment = {}) {
  return normalizeRequirementsAssessment(suppliedAssessment);
}

export function normalizeRequirementsAssessment(value = {}) {
  const suppliedAssessment = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    weightedAchievement: numberOrNull(suppliedAssessment.weightedAchievement),
    reportedRequirements: numberOrNull(suppliedAssessment.reportedRequirements),
    totalRequirements: numberOrNull(suppliedAssessment.totalRequirements),
    passed: numberOrNull(suppliedAssessment.passed ?? suppliedAssessment.passedRequirements),
    failed: numberOrNull(suppliedAssessment.failed ?? suppliedAssessment.failedRequirements),
    exceeded: numberOrNull(suppliedAssessment.exceeded ?? suppliedAssessment.exceededRequirements),
    partiallyPassed: numberOrNull(suppliedAssessment.partiallyPassed ?? suppliedAssessment.partiallyPassedRequirements),
    notReported: numberOrNull(suppliedAssessment.notReported ?? suppliedAssessment.notReportedRequirements),
    overallStatus: normalizeStatusText(suppliedAssessment.overallStatus),
    summary: normalizeText(suppliedAssessment.summary),
    calculatedAt: normalizeText(suppliedAssessment.calculatedAt)
  };
}

export function normalizePriceTargetRequirements(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
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
    };
  }
  const targetQuarter = normalizeText(value.targetQuarter ?? value.earningsPeriod);
  return {
    requirementSetId: normalizeText(value.requirementSetId),
    status: normalizeRequirementSetStatus(value.status),
    createdFromAnalysisId: normalizeText(value.createdFromAnalysisId),
    evaluatedByAnalysisId: normalizeText(value.evaluatedByAnalysisId),
    evaluatedAt: normalizeText(value.evaluatedAt),
    currentJustifiedValue: numberOrNull(value.currentJustifiedValue),
    targetValue: numberOrNull(value.targetValue ?? value.nextTargetValue),
    nextTargetValue: numberOrNull(value.nextTargetValue ?? value.targetValue),
    targetScenario: normalizeText(value.targetScenario),
    targetDescription: normalizeText(value.targetDescription),
    summary: normalizeText(value.summary),
    createdAt: normalizeText(value.createdAt),
    previousQuarter: normalizeText(value.previousQuarter ?? value.currentQuarter),
    targetQuarter,
    earningsPeriod: targetQuarter,
    requirements: normalizeRequirementList(value.requirements),
    requirementsAssessment: value.requirementsAssessment && typeof value.requirementsAssessment === "object"
      ? normalizeRequirementsAssessment(value.requirementsAssessment)
      : null
  };
}

export function normalizePreviousRequirementsEvaluation(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
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
    };
  }
  const requirements = normalizeRequirementList(value.requirements);
  const targetQuarter = normalizeText(value.targetQuarter ?? value.earningsPeriod);
  return {
    requirementSetId: normalizeText(value.requirementSetId),
    ticker: normalizeText(value.ticker)?.toUpperCase() || null,
    createdAt: normalizeText(value.createdAt),
    createdFromAnalysisId: normalizeText(value.createdFromAnalysisId),
    targetValue: numberOrNull(value.targetValue),
    targetScenario: normalizeText(value.targetScenario),
    targetDescription: normalizeText(value.targetDescription),
    summary: normalizeText(value.summary),
    matchType: normalizeText(value.matchType),
    previousQuarter: normalizeText(value.previousQuarter ?? value.currentQuarter),
    targetQuarter,
    earningsPeriod: targetQuarter,
    requirements,
    requirementsAssessment: value.requirementsAssessment && typeof value.requirementsAssessment === "object"
      ? normalizeRequirementsAssessment(value.requirementsAssessment)
      : null
  };
}

export function normalizeRequirementList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => normalizeRequirement(item, index)).filter(Boolean);
}

export function normalizeRequirement(item, index = 0) {
  if (!item || typeof item !== "object") return null;
  const weight = numberOrNull(item.weight);
  return {
    id: normalizeText(item.id) || `requirement_${index + 1}`,
    name: normalizeText(item.name) || normalizeText(item.metric) || `Requirement ${index + 1}`,
    arabicName: normalizeText(item.arabicName),
    metric: normalizeText(item.metric) || normalizeText(item.name),
    type: normalizeText(item.type) || "text",
    previousValue: valueOrNull(item.previousValue ?? item.currentLevel),
    previousDisplay: normalizeText(item.previousDisplay ?? item.currentDisplay),
    currentLevel: valueOrNull(item.currentLevel ?? item.previousValue),
    requiredValue: valueOrNull(item.requiredValue),
    requiredDisplay: normalizeText(item.requiredDisplay),
    unit: normalizeText(item.unit),
    importance: normalizeImportance(item.importance),
    weight: Number.isFinite(weight) ? weight : null,
    whyItMatters: normalizeText(item.whyItMatters),
    actualValue: valueOrNull(item.actualValue),
    actualDisplay: normalizeText(item.actualDisplay),
    actualRaw: valueOrNull(item.actualRaw),
    direction: normalizeRequirementDirection(item.direction),
    impact: normalizeRequirementImpact(item.impact),
    status: normalizeRequirementStatus(item.status),
    evaluationNote: normalizeText(item.evaluationNote)
  };
}

export function normalizeNextQuarterGuidance(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      quarter: null,
      items: []
    };
  }
  return {
    quarter: normalizeText(value.quarter),
    items: Array.isArray(value.items)
      ? value.items.map(normalizeNextQuarterGuidanceItem).filter(Boolean)
      : []
  };
}

function normalizeNextQuarterGuidanceItem(item) {
  if (typeof item === "string") {
    return {
      topic: item,
      arabicTopic: null,
      guidance: item,
      previousGuidance: null,
      direction: "not_applicable",
      interpretation: item,
      importance: "medium"
    };
  }
  if (!item || typeof item !== "object") return null;
  return {
    topic: normalizeText(item.topic),
    arabicTopic: normalizeText(item.arabicTopic),
    guidance: valueOrNull(item.guidance ?? item.currentGuidance),
    previousGuidance: valueOrNull(item.previousGuidance),
    direction: normalizeGuidanceDirection(item.direction),
    interpretation: normalizeText(item.interpretation),
    importance: normalizeImportance(item.importance)
  };
}

export function normalizeGuidance(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return {
        topic: item,
        arabicTopic: null,
        currentGuidance: null,
        previousGuidance: null,
        direction: "not_applicable",
        type: "text",
        interpretation: item,
        importance: "medium"
      };
    }
    if (!item || typeof item !== "object") return null;
    return {
      topic: normalizeText(item.topic),
      arabicTopic: normalizeText(item.arabicTopic),
      currentGuidance: valueOrNull(item.currentGuidance),
      previousGuidance: valueOrNull(item.previousGuidance),
      direction: normalizeGuidanceDirection(item.direction),
      type: normalizeText(item.type) || "text",
      interpretation: normalizeText(item.interpretation),
      importance: normalizeImportance(item.importance)
    };
  }).filter((item) => item && (item.topic || item.arabicTopic || item.interpretation));
}

export function normalizeCompanySpecificKpis(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return {
        name: item,
        arabicName: null,
        category: "other",
        currentValue: null,
        unit: "text",
        trend: "unknown",
        importance: "medium",
        interpretation: null,
        source: null,
        sourceName: null,
        sourceUrl: null,
        sourceType: null,
        sourceDate: null
      };
    }
    if (!item || typeof item !== "object") return null;
    return {
      name: normalizeText(item.name),
      arabicName: normalizeText(item.arabicName),
      category: normalizeText(item.category) || "other",
      currentValue: valueOrNull(item.currentValue),
      unit: normalizeText(item.unit) || "text",
      trend: normalizeTrend(item.trend),
      importance: normalizeImportance(item.importance),
      interpretation: normalizeText(item.interpretation),
      source: normalizeText(item.source),
      sourceName: normalizeText(item.sourceName),
      sourceUrl: normalizeText(item.sourceUrl),
      sourceType: normalizeText(item.sourceType),
      sourceDate: normalizeText(item.sourceDate)
    };
  }).filter((item) => item && (item.name || item.arabicName));
}

export function normalizeExternalRecommendation(value = {}, fallbackVerdict = null, fallbackRationale = null) {
  if (typeof value === "string") {
    return {
      action: normalizeRecommendationAction(value),
      confidence: null,
      reason: fallbackRationale || null,
      whatWouldUpgrade: [],
      whatWouldDowngrade: []
    };
  }
  const input = value && typeof value === "object" ? value : {};
  return {
    action: normalizeRecommendationAction(input.action ?? input.recommendation ?? fallbackVerdict),
    confidence: boundedNumber(input.confidence, 0, 100),
    reason: normalizeText(input.reason ?? input.rationale ?? fallbackRationale),
    whatWouldUpgrade: normalizeStringArray(input.whatWouldUpgrade),
    whatWouldDowngrade: normalizeStringArray(input.whatWouldDowngrade)
  };
}

export function normalizeExternalScenarios(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, scenario]) => [
    key,
    normalizeScenario(scenario)
  ]));
}

function normalizeScenario(value = {}) {
  if (!value || typeof value !== "object") return null;
  return {
    fairValue: numberOrNull(value.fairValue),
    valuationMethod: normalizeText(value.valuationMethod),
    assumptions: value.assumptions && typeof value.assumptions === "object" ? value.assumptions : {},
    revenueAssumption: valueOrNull(value.revenueAssumption ?? value.revenueGrowth),
    marginAssumption: valueOrNull(value.marginAssumption ?? value.marginAssumptions),
    epsAssumption: valueOrNull(value.epsAssumption ?? value.EPS),
    ebitdaAssumption: valueOrNull(value.ebitdaAssumption ?? value.EBITDA),
    fcfAssumption: valueOrNull(value.fcfAssumption ?? value.FCF ?? value["FCF assumptions"]),
    multipleUsed: valueOrNull(value.multipleUsed ?? value.valuationMultiple),
    timeHorizon: normalizeText(value.timeHorizon),
    probability: numberOrNull(value.probability),
    upsideDownsidePercent: numberOrNull(value.upsideDownsidePercent),
    thesis: normalizeText(value.thesis),
    keyRisks: normalizeStringArray(value.keyRisks),
    requiredOutcomes: normalizeStringArray(value.requiredOutcomes)
  };
}

function normalizeRequirementStatus(value) {
  const clean = String(value || "NOT_REPORTED").trim().toUpperCase();
  return REQUIREMENT_STATUSES.includes(clean) ? clean : "NOT_REPORTED";
}

function normalizeRequirementDirection(value) {
  const clean = String(value || "unknown").trim().toLowerCase();
  return REQUIREMENT_DIRECTIONS.includes(clean) ? clean : "unknown";
}

function normalizeRequirementImpact(value) {
  const clean = String(value || "unknown").trim().toLowerCase();
  return REQUIREMENT_IMPACTS.includes(clean) ? clean : "unknown";
}

function normalizeRequirementSetStatus(value) {
  const clean = String(value || "").trim().toUpperCase();
  return ["OPEN", "EVALUATED", "SUPERSEDED", "CANCELLED"].includes(clean) ? clean : null;
}

function normalizeRecommendationAction(value) {
  const clean = String(value || "").trim().toUpperCase();
  const direct = clean.split(/[\s/|-]+/).find((part) => RECOMMENDATION_ACTIONS.includes(part));
  return direct || null;
}

function normalizeGuidanceDirection(value) {
  const clean = String(value || "not_applicable").trim().toLowerCase();
  return ["raised", "maintained", "lowered", "new", "not_applicable"].includes(clean) ? clean : "not_applicable";
}

function normalizeTrend(value) {
  const clean = String(value || "unknown").trim().toLowerCase();
  return ["improving", "stable", "deteriorating", "unknown"].includes(clean) ? clean : "unknown";
}

function normalizeImportance(value) {
  const clean = String(value || "medium").trim().toLowerCase();
  return ["critical", "high", "medium", "low"].includes(clean) ? clean : "medium";
}

function normalizeStatusText(value) {
  return normalizeText(value);
}

function boundedNumber(value, min, max) {
  const number = numberOrNull(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(min, Math.min(max, number));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[%,$\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function valueOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") return value;
  return String(value).trim() || null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const clean = String(value).trim();
  return clean || null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter(Boolean);
}
