export const FAIR_VALUE_ANALYSIS_SCHEMA_VERSION = "fair-value-analysis/v2";
export const LEGACY_FAIR_VALUE_ANALYSIS_SCHEMA_VERSION = "fair-value-analysis/v1";
export const FAIR_VALUE_METHODOLOGY_VERSION = "fair-value-system/v1";

export function isFairValueAnalysisReport(input = {}) {
  return Boolean(input && typeof input === "object" && (
    input.schemaVersion === FAIR_VALUE_ANALYSIS_SCHEMA_VERSION
    || input.schemaVersion === LEGACY_FAIR_VALUE_ANALYSIS_SCHEMA_VERSION
    || input.methodologyVersion === FAIR_VALUE_METHODOLOGY_VERSION
  ));
}

export function buildFairValueAnalysisJsonObject(options = {}) {
  const ticker = normalizeTicker(options.tickerHint);
  return {
    schemaVersion: FAIR_VALUE_ANALYSIS_SCHEMA_VERSION,
    methodologyVersion: FAIR_VALUE_METHODOLOGY_VERSION,
    language: "ar",
    analysisDate: "YYYY-MM-DD",
    company: {
      ticker: ticker || null,
      name: null,
      sector: null,
      industry: null,
      currency: "USD",
      priceTimestamp: null
    },
    companyProfile: {
      summary: null,
      businessModel: null,
      activities: [
        {
          name: null,
          arabicName: null,
          description: null,
          importance: null
        }
      ],
      customers: null,
      mainGrowthDrivers: []
    },
    dataQuality: {
      score: null,
      confidence: null,
      missingCriticalFields: [],
      reportedDataThrough: null,
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
    strengths: [
      {
        title: null,
        explanation: null,
        evidence: [],
        importance: null,
        durability: null,
        valuationImpact: null,
        confidence: null
      }
    ],
    weaknesses: [
      {
        title: null,
        explanation: null,
        evidence: [],
        severity: null,
        persistence: null,
        valuationImpact: null,
        monitoringIndicator: null,
        confidence: null
      }
    ],
    valuationMethodology: {
      primaryMethod: null,
      secondaryMethods: [],
      excludedMethods: [],
      selectionReason: null,
      methodExplanations: [],
      exclusionReasons: [],
      modelWeights: [],
      weightReasoning: null,
      limitations: []
    },
    valuationResults: [
      {
        method: null,
        role: null,
        whySuitable: null,
        assumptions: {},
        inputs: {},
        fairValue: null,
        weight: null,
        confidence: null,
        source: null,
        explanation: null,
        limitation: null
      }
    ],
    forecastAssumptions: {
      sourcePriority: [],
      yearlyForecast: [],
      wacc: {
        value: null,
        reason: null,
        rangeLow: null,
        rangeHigh: null
      },
      terminalGrowth: {
        value: null,
        reason: null
      },
      sensitivity: [],
      confidence: null
    },
    scenarios: {
      Conservative: scenarioTemplate(true),
      Base: scenarioTemplate(true),
      Optimistic: scenarioTemplate(true),
      Exceptional: scenarioTemplate(false)
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
    decision: {
      action: null,
      confidence: null,
      investmentScore: null,
      rationale: [],
      whyNot: [],
      upgradeTriggers: [],
      downgradeTriggers: [],
      biggestAssumption: null,
      mainRisk: null
    },
    catalysts: [],
    risks: [],
    guidance: [
      {
        period: null,
        topic: null,
        arabicTopic: null,
        currentGuidance: null,
        previousGuidance: null,
        direction: "not_applicable",
        type: "text",
        interpretation: null,
        importance: "medium"
      }
    ],
    estimateRevisions: {
      periodDays: 90,
      asOfDate: null,
      revenue: revisionTemplate(),
      eps: revisionTemplate(),
      ebitda: revisionTemplate(),
      overallDirection: "unknown",
      interpretation: null,
      confidence: null,
      source: null
    },
    companySpecificKpis: [
      {
        name: null,
        arabicName: null,
        category: "other",
        currentValue: null,
        unit: "text",
        trend: "unknown",
        importance: "medium",
        interpretation: null
      }
    ],
    priceTargetRequirements: {
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
      requirements: [
        {
          id: null,
          name: null,
          arabicName: null,
          metric: null,
          type: "minimum",
          previousValue: null,
          previousDisplay: null,
          currentLevel: null,
          requiredValue: null,
          requiredDisplay: null,
          unit: null,
          importance: "medium",
          weight: null,
          whyItMatters: null,
          actualValue: null,
          actualDisplay: null,
          actualRaw: null,
          direction: "unknown",
          impact: "unknown",
          status: "NOT_REPORTED",
          evaluationNote: null
        }
      ]
    },
    previousRequirementsEvaluation: {
      requirementSetId: null,
      ticker: ticker || null,
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
      requirements: [
        {
          id: null,
          name: null,
          arabicName: null,
          metric: null,
          type: "minimum",
          previousValue: null,
          previousDisplay: null,
          currentLevel: null,
          requiredValue: null,
          requiredDisplay: null,
          unit: null,
          importance: "medium",
          weight: null,
          whyItMatters: null,
          actualValue: null,
          actualDisplay: null,
          actualRaw: null,
          direction: "unknown",
          impact: "unknown",
          status: "NOT_REPORTED",
          evaluationNote: null
        }
      ],
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
        summary: null
      }
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
      summary: null
    },
    monitoringChecklist: [
      {
        metric: null,
        currentValue: null,
        expectedRange: null,
        upgradeTrigger: null,
        downgradeTrigger: null,
        thesisBreak: null,
        revaluationEvent: null
      }
    ],
    sources: [
      {
        name: null,
        type: null,
        date: null,
        url: null,
        usedFor: []
      }
    ]
  };
}

export function fairValueAnalysisToExternalReport(input = {}) {
  const company = input.company || {};
  const dataQuality = input.dataQuality || {};
  const classification = input.classification || {};
  const executive = input.executiveDecision || {};
  const businessQuality = input.businessQuality || {};
  const components = businessQuality.components || {};
  const valuationMethodology = input.valuationMethodology || {};
  const fairSummary = input.fairValueSummary || {};
  const scenarios = input.scenarios || {};
  const finalDecision = input.finalDecision || {};
  const recommendation = input.recommendation || {};
  const dashboardExport = input.dashboardExport || {};
  const whatChanges = input.whatChangesMyMind || {};
  const valuationResults = Array.isArray(input.valuationResults) ? input.valuationResults : [];
  // Priority: canonical Fair Value v2 summary, then legacy company/executive/dashboard copies.
  const currentPrice = firstNumber(fairSummary.currentPrice, company.currentPrice, executive.currentPrice, dashboardExport.currentPrice);

  return {
    schemaVersion: "external-analysis-report/v2",
    analysisOrigin: "external_chatgpt",
    source: "ChatGPT",
    sourceModel: null,
    sourceConversation: null,
    analysisDate: input.analysisDate,
    reportPeriod: dataQuality.reportedDataThrough,
    company: {
      ticker: company.ticker || dashboardExport.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry || classification.companyType,
      currency: company.currency || "USD"
    },
    companyProfile: input.companyProfile || null,
    market: {
      userAverageCost: null
    },
    scores: {
      quality: normalizedScore(businessQuality.score),
      growth: normalizedScore(components.growth),
      valuation: normalizedScore(input.scores?.valuation ?? input.valuationScore),
      risk: normalizedScore(input.scores?.risk ?? input.riskScore),
      moat: normalizedScore(components.competitiveAdvantage),
      management: normalizedScore(components.management)
    },
    fairValueSummary: {
      fairValueLow: firstNumber(fairSummary.fairValueLow, executive.fairValueLow, scenarioValue(scenarios.Conservative)),
      fairValueBase: firstNumber(fairSummary.fairValueBase, executive.fairValue, dashboardExport.fairValue, scenarioValue(scenarios.Base)),
      fairValueHigh: firstNumber(fairSummary.fairValueHigh, executive.fairValueHigh, scenarioValue(scenarios.Optimistic)),
      probabilityWeightedFairValue: firstNumber(fairSummary.probabilityWeightedFairValue),
      currentPrice,
      upsideDownsidePercent: firstNumber(fairSummary.upsideDownsidePercent, executive.upsideDownsidePercent, dashboardExport.upsideDownsidePercent),
      marginOfSafetyPercent: firstNumber(fairSummary.marginOfSafetyPercent, executive.marginOfSafetyPercent),
      confidenceLevel: fairSummary.confidenceLevel || null
    },
    valuationMethodology,
    valuationResults,
    forecastAssumptions: input.forecastAssumptions || null,
    financialHighlights: {},
    growthHighlights: {
      revenueGrowth: scenarioAssumption(scenarios.Base, "revenueGrowth"),
      epsGrowth: null,
      fcfGrowth: scenarioAssumption(scenarios.Base, "FCF assumptions") || scenarioAssumption(scenarios.Base, "fcfAssumptions"),
      majorSegmentGrowth: null,
      marginTrend: scenarioAssumption(scenarios.Base, "marginAssumptions"),
      marketShareTrend: null,
      tamComment: null
    },
    quality: {
      summary: businessQuality.explanation,
      strengths: normalizeNarrativeItems(input.strengths),
      weaknesses: normalizeNarrativeItems(input.weaknesses),
      moat: componentText("Competitive Advantage", components.competitiveAdvantage),
      profitability: componentText("Profitability", components.profitability),
      balanceSheet: componentText("Balance Sheet", components.balanceSheet),
      capitalAllocation: componentText("Capital Allocation", components.capitalAllocation),
      earningsQuality: null
    },
    risks: normalizeRiskItems(input.risks, finalDecision.mainRisk),
    catalysts: normalizeCatalystItems(input.catalysts),
    thesis: {
      shortSummary: firstText(arraySentence(executive.why), arraySentence(finalDecision.why), scenarios.Base?.thesis),
      fullSummary: compactSentences([
        arraySentence(executive.why),
        arraySentence(finalDecision.why),
        arraySentence(finalDecision.whyNot),
        whatChanges.biggestAssumption ? `أهم افتراض: ${whatChanges.biggestAssumption}` : null,
        finalDecision.mainRisk ? `الخطر الرئيسي: ${finalDecision.mainRisk}` : null
      ])
    },
    earningsQuality: {
      status: null,
      reportedVsNormalizedExplanation: null,
      oneOffItems: []
    },
    decision: {
      action: firstText(input.decision?.action, recommendation.action, finalDecision.decision, executive.recommendation, dashboardExport.recommendation),
      confidence: firstNumber(input.decision?.confidence, recommendation.confidence, executive.confidence, dashboardExport.confidence),
      investmentScore: firstNumber(input.decision?.investmentScore, executive.investmentScore, dashboardExport.investmentScore),
      rationale: [compactSentences([
        ...(Array.isArray(input.decision?.rationale) ? input.decision.rationale : []),
        recommendation.reason,
        arraySentence(finalDecision.why),
        arraySentence(executive.why),
        finalDecision.biggestAssumption ? `أهم افتراض: ${finalDecision.biggestAssumption}` : null,
        finalDecision.mainRisk ? `الخطر الرئيسي: ${finalDecision.mainRisk}` : null
      ])].filter(Boolean),
      whyNot: Array.isArray(input.decision?.whyNot) ? input.decision.whyNot : (Array.isArray(finalDecision.whyNot) ? finalDecision.whyNot : []),
      upgradeTriggers: input.decision?.upgradeTriggers || recommendation.whatWouldUpgrade || [],
      downgradeTriggers: input.decision?.downgradeTriggers || recommendation.whatWouldDowngrade || [],
      biggestAssumption: firstText(input.decision?.biggestAssumption, finalDecision.biggestAssumption, whatChanges.biggestAssumption),
      mainRisk: firstText(input.decision?.mainRisk, finalDecision.mainRisk),
      buyZone: null,
      fairZone: null,
      expensiveZone: null
    },
    guidance: mergeGuidanceForAdapter(input.guidance, input.nextQuarterGuidance),
    monitoringChecklist: mergeMonitoringForAdapter(input.monitoringChecklist, whatChanges),
    estimateRevisions: input.estimateRevisions || null,
    companySpecificKpis: Array.isArray(input.companySpecificKpis) ? input.companySpecificKpis : [],
    priceTargetRequirements: input.priceTargetRequirements || input.priceTargetMonitoring || {},
    previousRequirementsEvaluation: input.previousRequirementsEvaluation || {},
    requirementsAssessment: input.requirementsAssessment || {},
    scenarios: {
      Bear: scenarioForExternal(scenarios.Conservative),
      Base: scenarioForExternal(scenarios.Base),
      Bull: scenarioForExternal(scenarios.Optimistic),
      Exceptional: scenarioForExternal(scenarios.Exceptional)
    },
    primaryValuationMethod: valuationMethodology.primaryMethod || dashboardExport.primaryValuationMethod || null,
    valuationSelectionReason: valuationMethodology.selectionReason || null,
    sources: normalizeSources(input.sources),
    metadata: {
      nativeSchemaVersion: input.schemaVersion || FAIR_VALUE_ANALYSIS_SCHEMA_VERSION,
      nativeMethodologyVersion: input.methodologyVersion || FAIR_VALUE_METHODOLOGY_VERSION,
      fairValueDataQualityScore: dataQuality.score ?? null,
      fairValueDataConfidence: dataQuality.confidence ?? null,
      primaryValuationMethod: valuationMethodology.primaryMethod || dashboardExport.primaryValuationMethod || null,
      valuationSelectionReason: valuationMethodology.selectionReason || null,
      fairValueLimitations: Array.isArray(valuationMethodology.limitations) ? valuationMethodology.limitations : []
    }
  };
}

function scenarioForExternal(scenario) {
  if (!scenario || scenario.enabled === false) return null;
  return {
    fairValue: scenario.fairValue ?? null,
    valuationMethod: scenario.valuationMethod ?? null,
    assumptions: scenario.assumptions || {},
    revenueAssumption: scenario.revenueAssumption ?? scenario.revenueGrowth ?? null,
    marginAssumption: scenario.marginAssumption ?? scenario.marginAssumptions ?? null,
    epsAssumption: scenario.epsAssumption ?? null,
    ebitdaAssumption: scenario.ebitdaAssumption ?? null,
    fcfAssumption: scenario.fcfAssumption ?? scenario["FCF assumptions"] ?? null,
    multipleUsed: scenario.multipleUsed ?? scenario.valuationMultiple ?? null,
    timeHorizon: scenario.timeHorizon ?? null,
    probability: scenario.probability ?? null,
    upsideDownsidePercent: scenario.upsideDownsidePercent ?? null,
    thesis: scenario.thesis ?? null,
    keyRisks: scenario.keyRisks || [],
    requiredOutcomes: scenario.requiredOutcomes || []
  };
}

function scenarioTemplate(enabled) {
  return {
    enabled,
    probability: enabled ? null : 0,
    fairValue: null,
    upsideDownsidePercent: null,
    assumptions: {},
    requiredOutcomes: [],
    thesis: null,
    keyRisks: []
  };
}

function revisionTemplate() {
  return {
    trend: null,
    currentEstimate: null,
    previousEstimate: null,
    changePercent: null
  };
}

function valuationResultsToMethods(results, methodology = {}) {
  const output = {
    dcf: null,
    pe: null,
    evEbitda: null,
    ps: null,
    peg: null,
    sotp: null,
    other: null
  };
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const key = valuationMethodKey(result.method);
    const normalized = {
      method: result.method || null,
      role: result.role || null,
      fairValue: toNumber(result.fairValue),
      weight: toNumber(result.weight),
      confidence: toNumber(result.confidence),
      explanation: result.explanation || result.whySuitable || null,
      limitation: result.limitation || null,
      assumptions: result.assumptions || {},
      inputs: result.inputs || {},
      source: result.source || null
    };
    output[key] = output[key] || normalized;
  }
  if (!output.other && methodology.primaryMethod) {
    output.other = {
      method: methodology.primaryMethod,
      role: "primary",
      fairValue: null,
      weight: null,
      confidence: null,
      explanation: methodology.selectionReason || methodology.weightReasoning || null,
      limitation: Array.isArray(methodology.limitations) ? methodology.limitations.join(" ") : null,
      assumptions: {},
      inputs: {},
      source: null
    };
  }
  return output;
}

function valuationMethodKey(method) {
  const text = String(method || "").toLowerCase();
  if (text.includes("dcf")) return "dcf";
  if (text.includes("p/e") || text.includes("pe") || text.includes("earnings")) return "pe";
  if (text.includes("ev/ebitda") || text.includes("ebitda")) return "evEbitda";
  if (text.includes("peg")) return "peg";
  if (text.includes("sotp")) return "sotp";
  if (text.includes("p/s") || text.includes("sales")) return "ps";
  return "other";
}

function normalizeNarrativeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return null;
    return compactSentences([
      item.title,
      item.explanation,
      Array.isArray(item.evidence) && item.evidence.length ? `الدليل: ${item.evidence.join("؛ ")}` : null,
      item.valuationImpact ? `الأثر على القيمة: ${item.valuationImpact}` : null
    ]);
  }).filter(Boolean);
}

function normalizeRiskItems(risks, mainRisk) {
  const list = Array.isArray(risks) ? risks : [];
  const normalized = list.map((item) => {
    if (typeof item === "string") return { title: item, severity: null, explanation: null };
    if (!item || typeof item !== "object") return null;
    return {
      title: firstText(item.title, item.metric, item.name),
      severity: item.severity ?? item.importance ?? null,
      explanation: firstText(item.explanation, item.thesisBreak, item.downgradeTrigger, item.valuationImpact)
    };
  }).filter(Boolean);
  if (!normalized.length && mainRisk) normalized.push({ title: mainRisk, severity: null, explanation: null });
  return normalized;
}

function normalizeCatalystItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === "string") return { title: item, explanation: null };
    if (!item || typeof item !== "object") return null;
    return {
      title: firstText(item.title, item.metric, item.name),
      explanation: firstText(item.explanation, item.upgradeTrigger, item.revaluationEvent)
    };
  }).filter(Boolean);
}

function normalizeWatchItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return null;
    return compactSentences([
      item.metric,
      item.currentValue ? `الحالي: ${item.currentValue}` : null,
      item.expectedRange ? `النطاق المتوقع: ${item.expectedRange}` : null,
      item.thesisBreak ? `كسر الفرضية: ${item.thesisBreak}` : null
    ]);
  }).filter(Boolean);
}

function mergeGuidanceForAdapter(guidance, nextQuarterGuidance) {
  const result = Array.isArray(guidance) ? guidance.map((item) => ({ ...item })) : [];
  const quarter = nextQuarterGuidance?.quarter || null;
  for (const item of Array.isArray(nextQuarterGuidance?.items) ? nextQuarterGuidance.items : []) {
    result.push({
      period: quarter,
      topic: item.topic || null,
      arabicTopic: item.arabicTopic || null,
      currentGuidance: item.currentGuidance ?? item.guidance ?? null,
      previousGuidance: item.previousGuidance ?? null,
      direction: item.direction || "not_applicable",
      type: item.type || "text",
      interpretation: item.interpretation || null,
      importance: item.importance || "medium"
    });
  }
  return result;
}

function mergeMonitoringForAdapter(checklist, whatChanges = {}) {
  const result = Array.isArray(checklist) ? checklist.map((item) => ({ ...item })) : [];
  for (const item of Array.isArray(whatChanges.items) ? whatChanges.items : []) {
    result.push(typeof item === "string" ? { metric: item } : item);
  }
  return result;
}

function normalizeSources(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === "string") return { title: item, url: null, sourceType: null };
    if (!item || typeof item !== "object") return null;
    return {
      title: firstText(item.name, item.title),
      url: firstText(item.url),
      sourceType: firstText(item.type, item.sourceType)
    };
  }).filter(Boolean);
}

function scenarioValue(scenario) {
  return scenario?.enabled === false ? null : scenario?.fairValue;
}

function scenarioUpside(scenario) {
  return scenario?.enabled === false ? null : scenario?.upsideDownsidePercent;
}

function scenarioAssumption(scenario, key) {
  return scenario?.assumptions?.[key] ?? scenario?.[key] ?? null;
}

function componentText(label, value) {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${value}`;
}

function normalizedScore(value) {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return null;
  if (number >= 0 && number <= 10) return roundOne(number);
  if (number > 10 && number <= 100) return roundOne(number / 10);
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const clean = String(value).replace(/[%,$\s,]/g, "");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = toNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstText(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function arraySentence(value) {
  if (!Array.isArray(value)) return null;
  const parts = value.map((item) => String(item || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function compactSentences(parts) {
  return parts.map((item) => String(item || "").trim()).filter(Boolean).join(" ");
}

function roundOne(number) {
  return Math.round(number * 10) / 10;
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!clean || ["TICKER", "SYMBOL"].includes(clean)) return "";
  return clean.slice(0, 12);
}
