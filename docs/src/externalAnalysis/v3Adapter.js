import { reportPeriodFromV3Identity } from "./v3Contract.js";

export function franklinV3ToExternalReport(input = {}, rawAnalysis = "") {
  const identity = input.reportIdentity || {};
  const company = input.company || {};
  const valuation = input.valuation || {};
  const current = valuation.current || {};
  const latestQuarter = input.latestQuarter || {};
  const businessQuality = input.businessQuality || {};
  const nextRequirements = input.nextRequirements || {};
  const previousEvaluation = input.previousRequirementsEvaluation || null;
  const reportPeriod = reportPeriodFromV3Identity(identity);
  const tradingCurrency = company.tradingCurrency || input.marketPrice?.currency || current.currency || "USD";
  const thesisSummary = input.thesis?.updatedSummary || input.thesis?.changeReason || input.thesis?.previousSummary || null;
  const previousAssessment = assessmentFromV3(previousEvaluation?.assessment, previousEvaluation?.requirements);

  return {
    source: "ChatGPT",
    analysisDate: normalizeDate(identity.analysisDate),
    reportPeriod,
    company: {
      ticker: identity.ticker,
      name: identity.companyName,
      sector: company.sector,
      industry: company.industry,
      currency: tradingCurrency
    },
    companyProfile: normalizeCompanyProfile(input.companyProfile),
    market: {
      priceAtAnalysis: input.marketPrice?.value ?? null
    },
    scores: {
      quality: scoreToTen(businessQuality.score),
      growth: scoreToTen(businessQuality.components?.growth),
      valuation: null,
      risk: null,
      moat: scoreToTen(businessQuality.components?.competitiveAdvantage),
      management: scoreToTen(businessQuality.components?.management)
    },
    fairValueSummary: {
      fairValueLow: current.bear ?? null,
      fairValueBase: current.base ?? null,
      fairValueHigh: current.bull ?? null,
      probabilityWeightedFairValue: current.probabilityWeighted ?? null,
      currentPrice: input.marketPrice?.value ?? null,
      upsideDownsidePercent: valuation.upsideToBasePct ?? null,
      marginOfSafetyPercent: valuation.marginOfSafetyPct ?? null,
      confidenceLevel: current.confidence ?? null
    },
    valuationMethodology: valuation.methodology || null,
    valuationResults: Array.isArray(valuation.valuationResults) ? valuation.valuationResults : [],
    forecastAssumptions: input.forecast || null,
    financialHighlights: financialHighlightsFromLatestQuarter(latestQuarter),
    growthHighlights: growthHighlightsFromLatestQuarter(latestQuarter),
    quality: {
      summary: businessQuality.explanation || null,
      strengths: narrativeBullets(input.strengths),
      weaknesses: narrativeBullets(input.weaknesses),
      moat: businessQuality.components?.competitiveAdvantage ?? null,
      profitability: businessQuality.components?.profitability ?? null,
      balanceSheet: businessQuality.components?.balanceSheet ?? null,
      capitalAllocation: businessQuality.components?.capitalAllocation ?? null,
      earningsQuality: null
    },
    risks: Array.isArray(input.risks) ? input.risks : [],
    catalysts: Array.isArray(input.catalysts) ? input.catalysts : [],
    thesis: {
      shortSummary: thesisSummary,
      fullSummary: input.thesis?.updatedSummary || null
    },
    decision: input.decision || {},
    guidance: Array.isArray(latestQuarter.guidance) ? latestQuarter.guidance : [],
    monitoringChecklist: Array.isArray(input.monitoringChecklist) ? input.monitoringChecklist : [],
    estimateRevisions: estimateRevisionsFromForecast(input.forecast),
    companySpecificKpis: companyKpisFromLatestQuarter(latestQuarter),
    priceTargetRequirements: nextRequirementsFromV3(nextRequirements, reportPeriod, identity),
    previousRequirementsEvaluation: previousEvaluationFromV3(previousEvaluation, input, reportPeriod),
    requirementsAssessment: previousAssessment,
    scenarios: valuation.scenarios || {},
    primaryValuationMethod: valuation.methodology?.primaryMethod || null,
    valuationSelectionReason: valuation.methodology?.selectionReason || null,
    sources: sourcesFromV3(input.sources),
    rawAnalysis,
    rawAnalysisOriginal: rawAnalysis,
    metadata: {
      nativeSchemaVersion: input.schemaVersion,
      nativeMethodologyVersion: input.methodologyVersion,
      analysisType: input.analysisType || null,
      franklinV3Report: input,
      franklinV3: {
        schemaVersion: input.schemaVersion,
        methodologyVersion: input.methodologyVersion,
        analysisType: input.analysisType || null,
        previousAnalysisId: identity.previousAnalysisId || null,
        previousRequirementSetId: identity.previousRequirementSetId || null,
        reviewStatus: valuation.reviewStatus || null,
        thesisStatus: input.thesis?.status || null,
        valuationBridge: valuation.valuationBridge || null,
        fiscalQuarter: identity.fiscalQuarter || null,
        fiscalYear: identity.fiscalYear ?? null,
        periodEndDate: identity.periodEndDate || null,
        earningsReleaseDate: identity.earningsReleaseDate || null,
        reportingCurrency: company.reportingCurrency || null,
        tradingCurrency,
        securityUnit: company.securityUnit || current.securityUnit || null,
        marketPrice: input.marketPrice || null
      }
    }
  };
}

function nextRequirementsFromV3(value = {}, reportPeriod, identity = {}) {
  const targetQuarter = value.targetQuarter || null;
  return {
    requirementSetId: value.requirementSetId || null,
    mode: value.mode || null,
    currentJustifiedValue: value.currentJustifiedValue ?? null,
    targetValue: value.targetValue ?? null,
    nextTargetValue: value.targetValue ?? null,
    targetScenario: value.targetScenario || null,
    targetDescription: value.targetDescription || null,
    summary: value.summary || null,
    createdAt: identity.analysisDate || null,
    previousQuarter: value.previousQuarter || reportPeriod || null,
    targetQuarter,
    earningsPeriod: targetQuarter,
    requirements: requirementsFromV3(value.requirements, { future: true }),
    requirementsAssessment: {
      weightedAchievement: null,
      reportedRequirements: null,
      totalRequirements: Array.isArray(value.requirements) ? value.requirements.length : null,
      passed: null,
      failed: null,
      exceeded: null,
      partiallyPassed: null,
      notReported: Array.isArray(value.requirements) ? value.requirements.length : null,
      overallStatus: "NOT_REPORTED",
      summary: null
    }
  };
}

function previousEvaluationFromV3(value, input = {}, reportPeriod = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const assessment = assessmentFromV3(value.assessment, value.requirements);
  return {
    requirementSetId: value.requirementSetId || input.reportIdentity?.previousRequirementSetId || null,
    ticker: input.reportIdentity?.ticker || null,
    earningsPeriod: reportPeriod,
    createdAt: null,
    createdFromAnalysisId: input.reportIdentity?.previousAnalysisId || null,
    targetValue: null,
    targetScenario: null,
    targetDescription: null,
    summary: value.assessment?.summary || null,
    matchType: "franklin_v3_canonical",
    previousQuarter: null,
    targetQuarter: value.targetQuarter || reportPeriod,
    requirements: requirementsFromV3(value.requirements, { future: false }),
    requirementsAssessment: assessment
  };
}

function requirementsFromV3(value, { future } = {}) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (!item || typeof item !== "object") return null;
    return {
      id: item.id || `requirement_${index + 1}`,
      name: item.name || item.metric || `Requirement ${index + 1}`,
      arabicName: item.arabicName || null,
      metric: item.metric || item.name || null,
      type: item.type || "minimum",
      baselineValue: item.baselineValue ?? null,
      baselineDisplay: item.baselineDisplay || null,
      previousValue: item.baselineValue ?? null,
      previousDisplay: item.baselineDisplay || null,
      currentLevel: item.baselineValue ?? null,
      requiredValue: item.requiredValue ?? null,
      requiredDisplay: item.requiredDisplay || null,
      unit: item.unit || null,
      importance: item.importance || "medium",
      weight: item.weight ?? null,
      whyItMatters: item.whyItMatters || null,
      actualValue: future ? null : item.actualValue ?? null,
      actualDisplay: future ? null : item.actualDisplay || null,
      actualRaw: null,
      direction: "unknown",
      impact: "unknown",
      status: future ? "NOT_REPORTED" : item.status || "NOT_REPORTED",
      partialCreditPct: item.partialCreditPct ?? null,
      evaluationNote: future ? null : item.evaluationNote || null,
      sourceId: item.sourceId || null
    };
  }).filter(Boolean);
}

function assessmentFromV3(value = null, requirements = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const counts = countRequirementStatuses(requirements);
  return {
    weightedAchievement: value.achievementOfReportedWeightPct ?? null,
    reportedRequirements: value.reportedRequirements ?? null,
    totalRequirements: value.totalRequirements ?? null,
    passed: counts.PASSED,
    failed: counts.FAILED,
    exceeded: counts.EXCEEDED,
    partiallyPassed: counts.PARTIALLY_PASSED,
    notReported: counts.NOT_REPORTED,
    coverageWeightPct: value.coverageWeightPct ?? null,
    achievementOfReportedWeightPct: value.achievementOfReportedWeightPct ?? null,
    achievementOfTotalWeightPct: value.achievementOfTotalWeightPct ?? null,
    exceededWeightPct: value.exceededWeightPct ?? null,
    passedWeightPct: value.passedWeightPct ?? null,
    partialWeightPct: value.partialWeightPct ?? null,
    failedWeightPct: value.failedWeightPct ?? null,
    notReportedWeightPct: value.notReportedWeightPct ?? null,
    overallStatus: value.overallStatus || null,
    summary: value.summary || null
  };
}

function countRequirementStatuses(requirements = []) {
  const counts = { EXCEEDED: 0, PASSED: 0, PARTIALLY_PASSED: 0, FAILED: 0, NOT_REPORTED: 0 };
  for (const item of Array.isArray(requirements) ? requirements : []) {
    const status = String(item?.status || "NOT_REPORTED").toUpperCase();
    if (Object.hasOwn(counts, status)) counts[status] += 1;
  }
  return counts;
}

function financialHighlightsFromLatestQuarter(latestQuarter = {}) {
  const metrics = latestQuarter.coreMetrics || {};
  return {
    revenue: metrics.revenue?.actualValue ?? null,
    revenueGrowthPct: metrics.revenue?.yoyPct ?? null,
    operatingIncome: null,
    operatingIncomeGrowthPct: null,
    operatingMarginPct: metrics.operatingMarginPct?.actualValue ?? null,
    epsReported: metrics.eps?.actualValue ?? null,
    epsNormalized: null,
    operatingCashFlow: null,
    freeCashFlow: metrics.freeCashFlow?.actualValue ?? null,
    capex: null,
    cash: metrics.cash?.actualValue ?? null,
    debt: metrics.debt?.actualValue ?? null
  };
}

function growthHighlightsFromLatestQuarter(latestQuarter = {}) {
  const metrics = latestQuarter.coreMetrics || {};
  return {
    revenueGrowth: metrics.revenue?.yoyPct ?? null,
    epsGrowth: metrics.eps?.yoyPct ?? null,
    fcfGrowth: metrics.freeCashFlow?.yoyPct ?? null,
    majorSegmentGrowth: null,
    marginTrend: latestQuarter.forwardOutlook?.marginOutlook || null,
    marketShareTrend: null,
    tamComment: latestQuarter.forwardOutlook?.summary || null
  };
}

function companyKpisFromLatestQuarter(latestQuarter = {}) {
  return (Array.isArray(latestQuarter.companySpecificKpis) ? latestQuarter.companySpecificKpis : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return {
        name: item.name || null,
        arabicName: item.arabicName || null,
        category: "company_specific",
        currentValue: item.actualDisplay || (item.actualValue ?? null),
        unit: "text",
        trend: item.trend || "unknown",
        importance: item.importance || "medium",
        interpretation: item.interpretation || null,
        source: item.sourceId || null,
        sourceName: item.sourceId || null,
        sourceUrl: null,
        sourceType: null,
        sourceDate: null
      };
    }).filter(Boolean);
}

function estimateRevisionsFromForecast(forecast = {}) {
  const revisions = Array.isArray(forecast?.estimateRevisions) ? forecast.estimateRevisions : [];
  if (!revisions.length) return null;
  return {
    periodDays: null,
    asOfDate: null,
    revenue: revisionMetric(revisions, "revenue"),
    eps: revisionMetric(revisions, "eps"),
    ebitda: revisionMetric(revisions, "ebitda"),
    overallDirection: "unknown",
    interpretation: forecast.summary || null,
    confidence: null,
    source: null
  };
}

function revisionMetric(revisions = [], metricName) {
  const item = revisions.find((entry) => String(entry?.metric || "").toLowerCase() === metricName);
  if (!item) return null;
  return {
    trend: trendFromChange(item.changePct),
    currentEstimate: item.updatedEstimate ?? null,
    previousEstimate: item.previousEstimate ?? null,
    changePercent: item.changePct ?? null
  };
}

function sourcesFromV3(value = []) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    title: item?.title || item?.id || null,
    url: item?.url || null,
    sourceType: item?.type || null,
    id: item?.id || null,
    date: item?.date || null,
    usedFor: Array.isArray(item?.usedFor) ? item.usedFor : []
  }));
}

function normalizeCompanyProfile(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    summary: value.summary || null,
    businessModel: value.businessModel || null,
    activities: Array.isArray(value.activities) ? value.activities : [],
    customers: Array.isArray(value.customers) ? value.customers.join(", ") : value.customers || null,
    mainGrowthDrivers: Array.isArray(value.mainGrowthDrivers) ? value.mainGrowthDrivers : []
  };
}

function narrativeBullets(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!item || typeof item !== "object") return String(item || "").trim();
    return [item.title, item.explanation].filter(Boolean).join(": ");
  }).filter(Boolean);
}

function scoreToTen(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number > 10 ? Math.max(0, Math.min(10, number / 10)) : Math.max(0, Math.min(10, number));
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : String(value).slice(0, 10);
}

function trendFromChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 0) return "up";
  if (number < 0) return "down";
  return "flat";
}
