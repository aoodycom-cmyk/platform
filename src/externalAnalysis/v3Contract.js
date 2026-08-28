export const FRANKLIN_FAIR_VALUE_SCHEMA_VERSION = "franklin-fair-value/v3";
export const FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION = "fair-value-methodology/v2";

export const FRANKLIN_V3_ANALYSIS_TYPES = ["INITIAL", "EARNINGS_REVALUATION"];
export const FRANKLIN_V3_REVIEW_STATUSES = ["INITIAL", "UPDATED", "UNCHANGED"];
export const FRANKLIN_V3_REVALUATION_REVIEW_STATUSES = ["UPDATED", "UNCHANGED"];
export const FRANKLIN_V3_INITIAL_REVIEW_STATUS = "INITIAL";
export const FRANKLIN_V3_THESIS_STATUSES = ["INITIAL", "STRENGTHENED", "UNCHANGED", "WEAKENED", "BROKEN"];
export const FRANKLIN_V3_DECISION_SCOPES = ["STOCK_LEVEL"];
export const FRANKLIN_V3_DECISION_ACTIONS = ["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"];
export const FRANKLIN_V3_REQUIREMENT_STATUSES = ["NOT_REPORTED", "FAILED", "PARTIALLY_PASSED", "PASSED", "EXCEEDED"];
export const FRANKLIN_V3_NEXT_REQUIREMENT_MODES = ["ADVANCE_TARGET", "DEFEND_BASE", "RECOVERY"];
export const FRANKLIN_V3_TARGET_SCENARIOS = ["BULL", "INTERMEDIATE", "BASE_DEFENSE", "RECOVERY"];
export const FRANKLIN_V3_SECURITY_UNITS = ["share", "ADS", "ADR", "unit"];
export const FRANKLIN_V3_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"];
export const FRANKLIN_V3_IMPORTANCE_LEVELS = ["critical", "high", "medium", "low"];
export const FRANKLIN_V3_REQUIREMENT_TYPES = ["minimum", "maximum", "range", "qualitative"];
export const FRANKLIN_V3_VALUATION_ROLES = ["PRIMARY", "SECONDARY", "CROSS_CHECK"];
export const FRANKLIN_V3_MARKET_PRICE_TYPES = ["LIVE", "DELAYED", "LAST_CLOSE"];
export const FRANKLIN_V3_GUIDANCE_DIRECTIONS = ["raised", "maintained", "lowered", "new", "not_reported"];
export const FRANKLIN_V3_METRIC_RESULTS = ["BEAT", "MISS", "INLINE", "NA"];
export const FRANKLIN_V3_FORECAST_MATERIALITY = ["MATERIAL", "NON_MATERIAL"];
export const FRANKLIN_V3_FORECAST_BASIS = ["reported", "consensus", "analyst_assumption"];
export const FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS = ["UP", "DOWN", "UNCHANGED"];
export const FRANKLIN_V3_REQUIREMENT_OVERALL_STATUSES = ["EXCEEDED", "PASSED", "MIXED", "FAILED", "INCOMPLETE"];
export const FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS = {
  growthOutlook: ["accelerating", "stable", "slowing", "unclear"],
  marginOutlook: ["improving", "stable", "pressured", "unclear"],
  fcfOutlook: ["improving", "stable", "pressured", "unclear"],
  demandOutlook: ["improving", "stable", "slowing", "unclear"],
  capacityOutlook: ["expanding", "adequate", "constrained", "unclear"],
  executionOutlook: ["improving", "stable", "deteriorating", "unclear"],
  guidanceTrend: ["raised", "maintained", "lowered", "mixed", "new", "not_reported"],
  managementTone: ["positive", "neutral", "cautious", "mixed", "unclear"]
};
export const FRANKLIN_V3_SOURCE_TYPES = [
  "Investor Relations",
  "SEC",
  "Earnings Call",
  "Market Data",
  "Consensus Data",
  "Trusted Financial News",
  "User Provided",
  "Other"
];
export const FRANKLIN_V3_CANONICAL_ENUMS = {
  analysisType: FRANKLIN_V3_ANALYSIS_TYPES,
  reviewStatus: FRANKLIN_V3_REVIEW_STATUSES,
  thesisStatus: FRANKLIN_V3_THESIS_STATUSES,
  decisionScope: FRANKLIN_V3_DECISION_SCOPES,
  decisionAction: FRANKLIN_V3_DECISION_ACTIONS,
  requirementStatus: FRANKLIN_V3_REQUIREMENT_STATUSES,
  nextRequirementMode: FRANKLIN_V3_NEXT_REQUIREMENT_MODES,
  targetScenario: FRANKLIN_V3_TARGET_SCENARIOS,
  securityUnit: FRANKLIN_V3_SECURITY_UNITS,
  confidence: FRANKLIN_V3_CONFIDENCE_LEVELS,
  importanceSeverity: FRANKLIN_V3_IMPORTANCE_LEVELS,
  requirementType: FRANKLIN_V3_REQUIREMENT_TYPES,
  valuationRole: FRANKLIN_V3_VALUATION_ROLES,
  priceType: FRANKLIN_V3_MARKET_PRICE_TYPES,
  guidanceDirection: FRANKLIN_V3_GUIDANCE_DIRECTIONS,
  metricResult: FRANKLIN_V3_METRIC_RESULTS,
  forecastMateriality: FRANKLIN_V3_FORECAST_MATERIALITY,
  forecastBasis: FRANKLIN_V3_FORECAST_BASIS,
  changedAssumptionDirection: FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS,
  requirementOverallStatus: FRANKLIN_V3_REQUIREMENT_OVERALL_STATUSES,
  forwardOutlook: FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS,
  sourceType: FRANKLIN_V3_SOURCE_TYPES
};

export function isFranklinV3Report(input = {}) {
  return Boolean(input && typeof input === "object" && input.schemaVersion === FRANKLIN_FAIR_VALUE_SCHEMA_VERSION);
}

export function buildFranklinV3ReportTemplate(options = {}) {
  const analysisType = FRANKLIN_V3_ANALYSIS_TYPES.includes(options.analysisType)
    ? options.analysisType
    : "INITIAL";
  const ticker = normalizeTicker(options.tickerHint || options.previousReport?.company?.ticker);
  const selectedPeriod = parseReportPeriod(options.selectedPeriod);
  const previous = previousCanonicalState(options.previousReport);
  const isRevaluation = analysisType === "EARNINGS_REVALUATION";
  const hasPreviousRequirementSet = Boolean(previous.requirementSetId && previous.requirements.length);

  return {
    schemaVersion: FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
    methodologyVersion: FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
    analysisType,

    reportIdentity: {
      ticker: ticker || null,
      companyName: previous.companyName || null,
      fiscalQuarter: selectedPeriod.fiscalQuarter,
      fiscalYear: selectedPeriod.fiscalYear,
      periodEndDate: null,
      earningsReleaseDate: null,
      analysisDate: "YYYY-MM-DD",
      previousAnalysisId: isRevaluation ? previous.analysisId : null,
      previousRequirementSetId: isRevaluation ? previous.requirementSetId : null
    },

    company: {
      sector: previous.sector || null,
      industry: previous.industry || null,
      reportingCurrency: null,
      tradingCurrency: previous.tradingCurrency || "USD",
      securityUnit: previous.securityUnit || null
    },

    companyProfile: {
      summary: null,
      businessModel: null,
      activities: [{ name: null, arabicName: null, description: null, importance: null }],
      customers: [],
      mainGrowthDrivers: []
    },

    dataQuality: {
      score: null,
      confidence: null,
      reportedDataThrough: null,
      missingCriticalFields: [],
      notes: []
    },

    classification: {
      companyType: null,
      businessStage: null,
      cyclicality: null,
      capitalIntensity: null,
      evidence: [],
      confidence: null
    },

    businessQuality: {
      score: null,
      rating: null,
      confidence: null,
      components: {
        growth: null,
        profitability: null,
        cashFlow: null,
        balanceSheet: null,
        capitalAllocation: null,
        competitiveAdvantage: null,
        management: null
      },
      explanation: null
    },

    strengths: [strengthTemplate()],
    weaknesses: [weaknessTemplate()],

    marketPrice: {
      value: null,
      currency: previous.tradingCurrency || "USD",
      asOf: null,
      priceType: null,
      sourceId: null
    },

    latestQuarter: {
      summary: null,
      coreMetrics: {
        revenue: quarterMetricTemplate(true),
        eps: epsMetricTemplate(),
        grossMarginPct: marginMetricTemplate(),
        operatingMarginPct: marginMetricTemplate(),
        freeCashFlow: freeCashFlowMetricTemplate(),
        cash: simpleMetricTemplate(),
        debt: simpleMetricTemplate()
      },
      companySpecificKpis: [companyKpiTemplate()],
      guidance: [guidanceTemplate()],
      forwardOutlook: {
        growthOutlook: "unclear",
        marginOutlook: "unclear",
        fcfOutlook: "unclear",
        demandOutlook: "unclear",
        capacityOutlook: "unclear",
        executionOutlook: "unclear",
        guidanceTrend: "not_reported",
        managementTone: "unclear",
        summary: null
      }
    },

    financialNormalization: financialNormalizationTemplate(),

    forecast: {
      materiality: null,
      yearlyForecast: [yearlyForecastTemplate()],
      estimateRevisions: [estimateRevisionTemplate()],
      changedAssumptions: [changedAssumptionTemplate()],
      wacc: { value: null, rangeLow: null, rangeHigh: null, reason: null },
      terminalGrowth: { value: null, reason: null },
      sensitivity: [],
      summary: null
    },

    previousRequirementsEvaluation: isRevaluation && hasPreviousRequirementSet ? previousRequirementsEvaluationTemplate(previous) : null,

    valuation: {
      reviewStatus: isRevaluation ? null : "INITIAL",
      previous: isRevaluation ? previous.valuation : null,
      current: {
        bear: null,
        base: null,
        bull: null,
        probabilityWeighted: null,
        currency: previous.tradingCurrency || "USD",
        securityUnit: previous.securityUnit || null,
        confidence: null
      },
      change: isRevaluation ? { bearPct: null, basePct: null, bullPct: null, summary: null } : null,
      methodology: {
        primaryMethod: null,
        secondaryMethods: [],
        excludedMethods: [{ method: null, reason: null }],
        methodologyChanged: null,
        selectionReason: null,
        modelWeights: [{ method: null, weight: null }],
        weightReasoning: null,
        limitations: []
      },
      valuationResults: [valuationResultTemplate()],
      scenarios: {
        Bear: scenarioTemplate(),
        Base: scenarioTemplate(),
        Bull: scenarioTemplate()
      },
      valuationBridge: {
        positiveDrivers: [],
        negativeDrivers: [],
        whyBaseChangedOrNot: isRevaluation ? null : "Initial valuation.",
        baseChangeBridge: isRevaluation ? baseChangeBridgeTemplate(previous.valuation?.base) : null
      },
      calculationAudit: valuationCalculationAuditTemplate(),
      upsideToBasePct: null,
      marginOfSafetyPct: null
    },

    thesis: {
      status: isRevaluation ? null : "INITIAL",
      previousSummary: isRevaluation ? previous.thesisSummary : null,
      updatedSummary: null,
      changeReason: null,
      keySupports: [],
      keyThreats: []
    },

    decision: {
      scope: "STOCK_LEVEL",
      action: null,
      confidence: null,
      investmentScore: null,
      rationale: [],
      whyNot: [],
      biggestAssumption: null,
      mainRisk: null,
      upgradeTriggers: [],
      downgradeTriggers: []
    },

    nextRequirements: {
      requirementSetId: null,
      mode: null,
      previousQuarter: selectedPeriod.reportPeriod || previous.reportPeriod || null,
      targetQuarter: null,
      currentJustifiedValue: null,
      targetValue: null,
      targetScenario: null,
      targetDescription: null,
      summary: null,
      requirements: [nextRequirementTemplate()]
    },

    risks: [riskTemplate()],
    catalysts: [catalystTemplate()],
    monitoringChecklist: [monitoringItemTemplate()],
    sources: [sourceTemplate()],
    limitations: [],
    audit: {
      scenarioProbabilityTotalPct: 100,
      valuationMethodWeightTotalPct: 100,
      previousRequirementWeightTotalPct: isRevaluation && hasPreviousRequirementSet ? previous.requirementWeightTotal : null,
      nextRequirementWeightTotalPct: 100,
      consistencyNotes: []
    }
  };
}

export function reportPeriodFromV3Identity(identity = {}) {
  const quarter = normalizeFiscalQuarter(identity.fiscalQuarter);
  const year = identity.fiscalYear === null || identity.fiscalYear === undefined ? null : String(identity.fiscalYear).trim();
  if (quarter && year) return `${quarter} ${year}`;
  return quarter || year || null;
}

export function parseReportPeriod(value) {
  const clean = String(value || "").trim().toUpperCase();
  const match = clean.match(/Q\s*([1-4]).*?((?:FY)?\s*20[0-9]{2}|20[0-9]{2})/i);
  if (!match) return { fiscalQuarter: null, fiscalYear: null, reportPeriod: null };
  const fiscalQuarter = `Q${match[1]}`;
  const year = match[2].replace(/[^0-9]/g, "");
  return { fiscalQuarter, fiscalYear: year ? Number(year) : null, reportPeriod: `${fiscalQuarter} ${year}` };
}

export function normalizeFiscalQuarter(value) {
  const clean = String(value || "").trim().toUpperCase();
  const match = clean.match(/^Q?\s*([1-4])$/);
  return match ? `Q${match[1]}` : clean || null;
}

export function previousCanonicalState(report = {}) {
  const canonical = isFranklinV3Report(report?.metadata?.franklinV3Report)
    ? report.metadata.franklinV3Report
    : null;
  const requirementBlock = report?.priceTargetRequirements || {};
  const tradingCurrency = canonical?.company?.tradingCurrency
    || report?.company?.currency
    || report?.market?.currency
    || "USD";
  const securityUnit = canonical?.company?.securityUnit || report?.metadata?.franklinV3?.securityUnit || null;
  const fairValue = report?.fairValueSummary || {};
  const requirements = Array.isArray(requirementBlock.requirements) ? requirementBlock.requirements : [];
  return {
    analysisId: report?.id || canonical?.reportIdentity?.previousAnalysisId || null,
    requirementSetId: requirementBlock.requirementSetId || canonical?.nextRequirements?.requirementSetId || null,
    ticker: normalizeTicker(report?.company?.ticker || canonical?.reportIdentity?.ticker),
    companyName: report?.company?.name || canonical?.reportIdentity?.companyName || null,
    sector: report?.company?.sector || canonical?.company?.sector || null,
    industry: report?.company?.industry || canonical?.company?.industry || null,
    reportPeriod: report?.reportPeriod || reportPeriodFromV3Identity(canonical?.reportIdentity || {}),
    tradingCurrency,
    securityUnit,
    thesisSummary: report?.thesis?.shortSummary || report?.thesis?.fullSummary || canonical?.thesis?.updatedSummary || null,
    requirementTargetQuarter: requirementBlock.targetQuarter || requirementBlock.earningsPeriod || null,
    requirementWeightTotal: sumRequirementWeights(requirements),
    requirements,
    valuation: {
      bear: finiteOrNull(fairValue.fairValueLow ?? canonical?.valuation?.current?.bear),
      base: finiteOrNull(fairValue.fairValueBase ?? canonical?.valuation?.current?.base),
      bull: finiteOrNull(fairValue.fairValueHigh ?? canonical?.valuation?.current?.bull),
      probabilityWeighted: finiteOrNull(fairValue.probabilityWeightedFairValue ?? canonical?.valuation?.current?.probabilityWeighted),
      asOf: report?.analysisDate || canonical?.reportIdentity?.analysisDate || null
    }
  };
}

function previousRequirementsEvaluationTemplate(previous) {
  return {
    requirementSetId: previous.requirementSetId,
    targetQuarter: previous.requirementTargetQuarter,
    requirements: previous.requirements.map(previousRequirementTemplate),
    assessment: {
      reportedRequirements: null,
      totalRequirements: previous.requirements.length || null,
      coverageWeightPct: null,
      achievementOfReportedWeightPct: null,
      achievementOfTotalWeightPct: null,
      exceededWeightPct: 0,
      passedWeightPct: 0,
      partialWeightPct: 0,
      failedWeightPct: 0,
      notReportedWeightPct: null,
      overallStatus: null,
      summary: null
    }
  };
}

function previousRequirementTemplate(item = {}) {
  return {
    id: item.id || null,
    name: item.name || item.metric || null,
    arabicName: item.arabicName || null,
    metric: item.metric || item.name || null,
    weight: finiteOrNull(item.weight),
    requiredValue: item.requiredValue ?? null,
    requiredDisplay: item.requiredDisplay || null,
    actualValue: null,
    actualDisplay: null,
    status: "NOT_REPORTED",
    partialCreditPct: null,
    evaluationNote: null,
    sourceId: null
  };
}

function strengthTemplate() {
  return {
    title: null,
    explanation: null,
    evidence: [],
    importance: null,
    durability: null,
    valuationImpact: null,
    confidence: null,
    sourceIds: []
  };
}

function weaknessTemplate() {
  return {
    title: null,
    explanation: null,
    evidence: [],
    severity: null,
    persistence: null,
    valuationImpact: null,
    monitoringIndicator: null,
    confidence: null,
    sourceIds: []
  };
}

function quarterMetricTemplate(includeUnit) {
  return {
    actualValue: null,
    ...(includeUnit ? { unit: null } : {}),
    consensusValue: null,
    priorYearValue: null,
    yoyPct: null,
    ...(includeUnit ? { qoqPct: null } : {}),
    result: "NA",
    sourceId: null
  };
}

function epsMetricTemplate() {
  return {
    actualValue: null,
    unit: null,
    consensusValue: null,
    priorYearValue: null,
    yoyPct: null,
    result: "NA",
    sourceId: null
  };
}

function marginMetricTemplate() {
  return {
    actualValue: null,
    consensusValue: null,
    priorYearValue: null,
    result: "NA",
    sourceId: null
  };
}

function freeCashFlowMetricTemplate() {
  return {
    actualValue: null,
    unit: null,
    priorYearValue: null,
    yoyPct: null,
    sourceId: null
  };
}

function simpleMetricTemplate() {
  return { actualValue: null, unit: null, sourceId: null };
}

function companyKpiTemplate() {
  return {
    id: null,
    name: null,
    arabicName: null,
    actualValue: null,
    actualDisplay: null,
    priorValue: null,
    yoyPct: null,
    qoqPct: null,
    result: "NA",
    importance: null,
    interpretation: null,
    sourceId: null
  };
}

function guidanceTemplate() {
  return {
    period: null,
    topic: null,
    previousGuidance: null,
    currentGuidance: null,
    previousLow: null,
    previousHigh: null,
    currentLow: null,
    currentHigh: null,
    midpoint: null,
    unit: null,
    currency: null,
    accountingBasis: null,
    direction: "not_reported",
    interpretation: null,
    sourceId: null
  };
}

function yearlyForecastTemplate() {
  const metric = { value: null, basis: null };
  return {
    period: null,
    revenue: { ...metric },
    revenueGrowthPct: { ...metric },
    eps: { ...metric },
    ebitda: { ...metric },
    ebitdaMarginPct: { ...metric },
    freeCashFlow: { ...metric },
    fcfMarginPct: { ...metric }
  };
}

function estimateRevisionTemplate() {
  return {
    metric: null,
    period: null,
    previousEstimate: null,
    updatedEstimate: null,
    unit: null,
    accountingBasis: null,
    previousSnapshotDate: null,
    updatedSnapshotDate: null,
    changePct: null,
    reason: null,
    sourceId: null
  };
}

function changedAssumptionTemplate() {
  return { metric: null, period: null, previousValue: null, updatedValue: null, unit: null, direction: null, reason: null, sourceId: null };
}

function valuationResultTemplate() {
  return {
    method: null,
    role: null,
    fairValue: null,
    weight: null,
    confidence: null,
    inputs: {},
    assumptions: {},
    calculation: {
      formula: null,
      steps: [],
      enterpriseValue: null,
      netDebt: null,
      nonOperatingAdjustments: null,
      equityValue: null,
      dilutedShares: null,
      computedFairValue: null
    },
    rationale: null,
    limitations: null
  };
}

function normalizedMetricTemplate() {
  return {
    value: null,
    unit: null,
    accountingBasis: null,
    period: null,
    sourceId: null
  };
}

function financialNormalizationTemplate() {
  return {
    reportingPeriod: null,
    reportingCurrency: null,
    earningsBasisUsedForValuation: null,
    revenue: normalizedMetricTemplate(),
    gaapNetIncome: normalizedMetricTemplate(),
    adjustedNetIncome: normalizedMetricTemplate(),
    normalizedNetIncome: normalizedMetricTemplate(),
    gaapDilutedEps: normalizedMetricTemplate(),
    adjustedDilutedEps: normalizedMetricTemplate(),
    normalizedDilutedEps: normalizedMetricTemplate(),
    dilutedShares: normalizedMetricTemplate(),
    stockBasedCompensation: normalizedMetricTemplate(),
    operatingCashFlow: normalizedMetricTemplate(),
    capitalExpenditure: normalizedMetricTemplate(),
    workingCapitalChange: normalizedMetricTemplate(),
    freeCashFlow: normalizedMetricTemplate(),
    cash: normalizedMetricTemplate(),
    debt: normalizedMetricTemplate(),
    netDebt: normalizedMetricTemplate(),
    taxRatePct: normalizedMetricTemplate(),
    oneOffItems: [],
    reconciliationNotes: [],
    sourceIds: []
  };
}

function valuationCalculationAuditTemplate() {
  return {
    weightedMethodFairValue: null,
    analystOverlayPct: 0,
    overlayReason: null,
    reconciledBaseFairValue: null,
    gapToReportedBasePct: null
  };
}

function baseChangeBridgeTemplate(previousBase) {
  return {
    previousBase: finiteOrNull(previousBase),
    operatingForecastImpact: null,
    marginAndCashFlowImpact: null,
    balanceSheetImpact: null,
    dilutionImpact: null,
    valuationParametersImpact: null,
    otherImpact: null,
    reconciledCurrentBase: null,
    currentBase: null,
    reconciliationGap: null
  };
}

function scenarioTemplate() {
  return { probability: null, fairValue: null, assumptions: [], requiredOutcomes: [], keyRisks: [] };
}

function nextRequirementTemplate() {
  return {
    id: null,
    name: null,
    arabicName: null,
    metric: null,
    type: null,
    baselineValue: null,
    baselineDisplay: null,
    requiredValue: null,
    requiredDisplay: null,
    unit: null,
    importance: null,
    weight: null,
    whyItMatters: null,
    status: "NOT_REPORTED"
  };
}

function riskTemplate() {
  return { title: null, severity: null, explanation: null, whatToMonitor: null, thesisBreaker: null, sourceIds: [] };
}

function catalystTemplate() {
  return { title: null, explanation: null, timeframe: null, sourceIds: [] };
}

function monitoringItemTemplate() {
  return { metric: null, currentValue: null, expectedRange: null, upgradeTrigger: null, downgradeTrigger: null, thesisBreak: null };
}

function sourceTemplate() {
  return { id: "S1", title: null, type: null, date: null, url: null, usedFor: [] };
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!clean || ["TICKER", "SYMBOL"].includes(clean)) return "";
  return clean.slice(0, 12);
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumRequirementWeights(requirements = []) {
  const total = requirements.reduce((sum, item) => {
    const weight = finiteOrNull(item?.weight);
    return Number.isFinite(weight) ? sum + weight : sum;
  }, 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}
