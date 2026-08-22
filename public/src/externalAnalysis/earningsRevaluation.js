import { normalizeQuarterlyForwardOutlook, upsertQuarterlyForwardOutlookSupplement } from "./quarterlyForwardOutlook.js";
import { normalizeRequirementsAssessment } from "./requirements.js";
import { validateQuarterlyAssessmentIntegrity } from "./quarterlyEarningsLite.js";

export const EARNINGS_REVALUATION_SCHEMA = "earnings-revaluation/v1";

const DECISIONS = new Set(["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"]);
const REQUIREMENT_STATUSES = new Set(["EXCEEDED", "PASSED", "PARTIALLY_PASSED", "FAILED", "NOT_REPORTED"]);
const GUIDANCE_DIRECTIONS = new Set(["raised", "maintained", "lowered", "new", "not_applicable"]);

export function isEarningsRevaluationPayload(value) {
  return Boolean(value && typeof value === "object" && value.schemaVersion === EARNINGS_REVALUATION_SCHEMA);
}

export function buildEarningsRevaluationPrompt(report = {}, options = {}) {
  const ticker = normalizeTicker(report.company?.ticker);
  const companyName = report.company?.name || ticker || "-";
  const quarter = Number(options.quarter);
  const year = Number(options.year);
  if (![1, 2, 3, 4].includes(quarter) || !Number.isInteger(year)) {
    throw new Error("Quarter and year are required for earnings revaluation.");
  }

  const reportPeriod = `Q${quarter} ${year}`;
  const nextPeriod = nextQuarterPeriod(reportPeriod);
  const requirementBlock = report.priceTargetRequirements || {};
  const requirements = compactRequirements(requirementBlock.requirements || []);
  const earningsText = trimText(options.earningsText, 12000);
  const priorFairValue = report.fairValueSummary || {};

  const template = {
    schemaVersion: EARNINGS_REVALUATION_SCHEMA,
    ticker: ticker || null,
    quarter: `Q${quarter}`,
    year,
    reportDate: "YYYY-MM-DD",
    previousAnalysisId: report.id || null,
    evaluatedRequirementSetId: requirementBlock.requirementSetId || null,
    summary: "ملخص تنفيذي من سطرين كحد أقصى",
    marketPrice: {
      value: null,
      asOf: "YYYY-MM-DD أو YYYY-MM-DDTHH:mm:ssZ",
      sourceTitle: null,
      sourceUrl: null
    },
    metrics: {
      revenue: metricTemplate(),
      revenueGrowthPct: metricTemplate(),
      eps: metricTemplate(),
      grossMarginPct: metricTemplate(),
      operatingMarginPct: metricTemplate(),
      freeCashFlow: metricTemplate(),
      cash: metricTemplate(),
      debt: metricTemplate()
    },
    companyKpis: [
      { name: "KPI خاص بالشركة", actualDisplay: null, result: "BEAT|MISS|INLINE|NA" }
    ],
    guidance: [
      { topic: "", currentGuidance: "", direction: "raised|maintained|lowered|new|not_applicable", interpretation: "" }
    ],
    forwardOutlook: {
      growthOutlook: "accelerating|stable|slowing|unclear",
      marginOutlook: "improving|stable|pressured|unclear",
      guidanceTrend: "raised|maintained|lowered|mixed|new|not_reported",
      managementTone: "positive|neutral|cautious|mixed|unclear",
      thesisImpact: "supports|neutral|weakens|unclear",
      summary: null
    },
    previousRequirementsEvaluation: {
      requirementSetId: requirementBlock.requirementSetId || null,
      requirements: requirements.map((item) => ({
        id: item.id,
        actualValue: null,
        actualDisplay: null,
        status: "NOT_REPORTED",
        evaluationNote: ""
      })),
      requirementsAssessment: {
        weightedAchievement: null,
        reportedRequirements: null,
        totalRequirements: requirements.length || null,
        passed: null,
        failed: null,
        exceeded: null,
        partiallyPassed: null,
        notReported: null,
        overallStatus: null,
        summary: null
      }
    },
    revaluation: {
      status: "UPDATED|UNCHANGED",
      fairValue: {
        bear: null,
        base: null,
        bull: null,
        probabilityWeighted: null,
        upsideToBasePct: null,
        marginOfSafetyPct: null,
        confidenceLevel: null
      },
      scenarios: {
        Bear: scenarioTemplate(),
        Base: scenarioTemplate(),
        Bull: scenarioTemplate()
      },
      valuationMethodology: {
        primaryMethod: null,
        selectionReason: null,
        modelWeights: []
      },
      valuationResults: [
        { method: "", fairValue: null, weight: null, confidence: null, rationale: "" }
      ],
      decision: {
        action: "BUY|ADD|HOLD|WATCH|REDUCE|SELL",
        confidence: null,
        investmentScore: null,
        rationale: [],
        whyNot: [],
        upgradeTriggers: [],
        downgradeTriggers: [],
        biggestAssumption: null,
        mainRisk: null
      },
      thesis: {
        shortSummary: "",
        change: "strengthened|unchanged|weakened|broken",
        changeReason: ""
      },
      risks: [],
      catalysts: [],
      changeDrivers: {
        positive: [],
        negative: []
      }
    },
    nextRequirements: {
      previousQuarter: reportPeriod,
      targetQuarter: nextPeriod,
      currentJustifiedValue: null,
      targetValue: null,
      targetScenario: "Bull",
      targetDescription: "",
      summary: "",
      requirements: [
        {
          id: `${ticker || "TICKER"}-${nextPeriod.replace(/\s+/g, "")}-METRIC-1`,
          name: "",
          arabicName: "",
          metric: "",
          type: "minimum|maximum|range|qualitative",
          previousValue: null,
          previousDisplay: null,
          requiredValue: null,
          requiredDisplay: null,
          unit: null,
          importance: "high|medium|low",
          weight: null,
          whyItMatters: "",
          status: "NOT_REPORTED"
        }
      ]
    },
    sources: [
      { title: "", url: "https://...", sourceType: "Investor Relations|SEC|Market Data|Trusted Financial News" }
    ]
  };

  return [
    `أنت تعمل داخل مشروع Fair value لتحديث تقييم ${companyName} (${ticker || "-"}) بعد إعلان ${reportPeriod}.`,
    "",
    "هذه ليست قراءة أرباح مختصرة فقط. المطلوب إغلاق دورة الاستثمار كاملة بعد كل إعلان أرباح:",
    "1) تقييم المتطلبات التي حُددت قبل الإعلان.",
    "2) إعادة تقييم Bear / Base / Bull باستخدام المعلومات الجديدة.",
    "3) إصدار decision محدث بعد الإعلان.",
    "4) تحديث thesis فقط بالقدر الذي تبرره النتائج.",
    `5) إنشاء متطلبات جديدة تلقائيًا للربع القادم ${nextPeriod}.`,
    "",
    "قواعد جوهرية:",
    "- ChatGPT هو المسؤول عن التحليل المالي وإعادة التقييم. Franklin لا يحسب Fair Value ولا يفسر النتائج نيابة عنك.",
    "- أعد تشغيل التقييم بعد الإعلان حتى لو انتهيت إلى أن Fair Value لم يتغير. إذا بقي كما هو استخدم revaluation.status = UNCHANGED واشرح السبب.",
    "- لا تورّث Bear/Base/Bull أو decision ميكانيكيًا من التقرير السابق. يجب أن تكون القيم في revaluation نتيجة حكمك بعد قراءة الإعلان الجديد.",
    "- لا تجعل Beat/Miss واحدًا يغيّر Fair Value وحده. حدّث توقعات النمو/الهوامش/الأرباح/FCF/المخاطر ثم أعد التقييم بالطريقة المناسبة للشركة.",
    "- لا تغيّر المتطلبات السابقة أو أوزانها أو requiredValue. قيّمها فقط.",
    "- إذا لم تفصح الشركة عن معلومة لمتطلب سابق، استخدم status = NOT_REPORTED وactualValue = null.",
    "- عند وصول الربع المستهدف يجب تعبئة requirementsAssessment بالكامل وبشكل مطابق حرفيًا لحالات المتطلبات الفردية.",
    "- NOT_REPORTED لا يعتبر FAILED ولا PASSED.",
    "- nextRequirements هي مجموعة جديدة تمامًا للربع القادم، وجميع status فيها NOT_REPORTED.",
    "- اجعل مجموع أوزان nextRequirements.requirements = 100%. استخدم 4 إلى 8 متطلبات فقط، وكلها قابلة للقياس أو الحكم بوضوح.",
    "- currentJustifiedValue في nextRequirements يجب أن يساوي Base Fair Value الجديد.",
    "- targetValue في nextRequirements يجب أن يساوي Bull Fair Value الجديد، إلا إذا شرحت بوضوح سبب اختيار Target مختلف داخل targetDescription.",
    "- لا تنشئ متطلبات عامة مثل «استمرار النمو». استخدم Revenue/EPS/Margin/FCF/KPI/Guidance أو شرطًا نوعيًا محددًا يمكن الحكم عليه لاحقًا.",
    "- استخدم المصادر الرسمية للشركة وSEC أولًا، ومصدرًا موثقًا لسعر السوق المستخدم في القرار.",
    "- لا تخترع رقمًا. استخدم null عند عدم التوفر.",
    "- أخرج JSON واحدًا فقط، بلا Markdown وبلا شرح خارجي.",
    "",
    "هوية التقرير السابق التي يجب البناء عليها:",
    `- previousAnalysisId: ${report.id || "-"}`,
    `- previous analysis date: ${report.analysisDate || "-"}`,
    `- previous report period: ${report.reportPeriod || "-"}`,
    `- previous decision: ${report.decision?.action || "-"}`,
    `- previous Bear/Base/Bull: ${priorFairValue.fairValueLow ?? "-"} / ${priorFairValue.fairValueBase ?? "-"} / ${priorFairValue.fairValueHigh ?? "-"}`,
    "",
    "الفرضية السابقة:",
    trimText(report.thesis?.shortSummary || report.thesis?.fullSummary, 700) || "-",
    "",
    "المتطلبات السابقة التي يجب تقييمها فقط:",
    JSON.stringify(requirements),
    "",
    earningsText
      ? `مواد إعلان الأرباح التي ألصقها المستخدم:\n${earningsText}`
      : `لا توجد مواد مرفقة. ابحث عن إعلان ${reportPeriod} من Investor Relations / SEC ثم أكمل التقييم.`,
    "",
    "أخرج النتيجة بنفس البنية التالية:",
    JSON.stringify(template, null, 2)
  ].join("\n");
}

export function inflateEarningsRevaluationPayload(currentReport = {}, payload = {}, rawText = "", now = new Date()) {
  if (!isEarningsRevaluationPayload(payload)) throw new Error("Unsupported earnings revaluation payload.");

  const currentTicker = normalizeTicker(currentReport.company?.ticker);
  const incomingTicker = normalizeTicker(payload.ticker);
  if (!currentTicker || !incomingTicker || currentTicker !== incomingTicker) {
    throw new Error(`Ticker mismatch. Expected ${currentTicker || "-"}, received ${incomingTicker || "-"}.`);
  }

  const quarter = normalizeQuarter(payload.quarter);
  const year = Number(payload.year);
  if (!quarter || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Quarter/year are required for earnings revaluation.");
  }
  const reportPeriod = `${quarter} ${year}`;
  const reportDate = validDate(payload.reportDate) || now.toISOString().slice(0, 10);

  if (payload.previousAnalysisId && currentReport.id && payload.previousAnalysisId !== currentReport.id) {
    throw new Error("previousAnalysisId does not match the report currently being updated.");
  }

  const requirementBlock = currentReport.priceTargetRequirements || {};
  if (
    payload.evaluatedRequirementSetId
    && requirementBlock.requirementSetId
    && payload.evaluatedRequirementSetId !== requirementBlock.requirementSetId
  ) {
    throw new Error("evaluatedRequirementSetId does not match the active requirement set.");
  }

  const evaluationInput = payload.previousRequirementsEvaluation || {};
  const requirements = mergeRequirementResults(requirementBlock.requirements, evaluationInput.requirements);
  const requirementsAssessment = evaluationInput.requirementsAssessment && typeof evaluationInput.requirementsAssessment === "object"
    ? normalizeRequirementsAssessment(evaluationInput.requirementsAssessment)
    : null;

  validateQuarterlyAssessmentIntegrity({
    reportPeriod,
    targetPeriod: requirementBlock.targetQuarter || requirementBlock.earningsPeriod || reportPeriod,
    requirements,
    requirementsAssessment
  });

  const revaluation = normalizeRevaluation(payload.revaluation);
  validateRevaluation(revaluation);

  const nextPeriod = nextQuarterPeriod(reportPeriod);
  const nextRequirements = normalizeNextRequirements(payload.nextRequirements, nextPeriod, revaluation.fairValue);
  validateNextRequirements(nextRequirements, nextPeriod, revaluation.fairValue);

  const sources = normalizeSources(payload.sources);
  if (!sources.length) throw new Error("At least one source is required for earnings revaluation.");

  const metrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {};
  const guidance = normalizeGuidance(payload.guidance).slice(0, 5);
  const companyKpis = normalizeKpis(payload.companyKpis).slice(0, 6);
  const forwardOutlook = normalizeQuarterlyForwardOutlook(payload.forwardOutlook);
  const marketPrice = normalizeMarketPrice(payload.marketPrice);
  if (!Number.isFinite(marketPrice.value) || marketPrice.value <= 0) {
    throw new Error("A positive marketPrice.value is required for the post-earnings decision.");
  }

  const raw = String(rawText || JSON.stringify(payload));
  const oldMetadata = currentReport.metadata || {};

  return {
    ...currentReport,
    id: null,
    analysisDate: reportDate,
    reportPeriod,
    fairValueSummary: {
      fairValueLow: revaluation.fairValue.bear,
      fairValueBase: revaluation.fairValue.base,
      fairValueHigh: revaluation.fairValue.bull,
      probabilityWeightedFairValue: revaluation.fairValue.probabilityWeighted,
      currentPrice: marketPrice.value,
      upsideDownsidePercent: revaluation.fairValue.upsideToBasePct,
      marginOfSafetyPercent: revaluation.fairValue.marginOfSafetyPct,
      confidenceLevel: revaluation.fairValue.confidenceLevel
    },
    scenarios: revaluation.scenarios,
    valuationMethodology: revaluation.valuationMethodology || currentReport.valuationMethodology || null,
    valuationResults: revaluation.valuationResults,
    decision: revaluation.decision,
    thesis: {
      ...(currentReport.thesis || {}),
      shortSummary: revaluation.thesis.shortSummary
    },
    risks: revaluation.risks.length ? revaluation.risks : currentReport.risks || [],
    catalysts: revaluation.catalysts.length ? revaluation.catalysts : currentReport.catalysts || [],
    financialHighlights: {
      revenue: metricNumber(metrics.revenue),
      revenueGrowthPct: metricNumber(metrics.revenueGrowthPct),
      operatingIncome: null,
      operatingIncomeGrowthPct: null,
      operatingMarginPct: metricNumber(metrics.operatingMarginPct),
      epsReported: metricNumber(metrics.eps),
      epsNormalized: null,
      operatingCashFlow: null,
      freeCashFlow: metricNumber(metrics.freeCashFlow),
      capex: null,
      cash: metricNumber(metrics.cash),
      debt: metricNumber(metrics.debt)
    },
    growthHighlights: {
      revenueGrowth: metricDisplay(metrics.revenueGrowthPct),
      epsGrowth: null,
      fcfGrowth: null,
      majorSegmentGrowth: null,
      marginTrend: metricDisplay(metrics.grossMarginPct) || metricDisplay(metrics.operatingMarginPct),
      marketShareTrend: null,
      tamComment: null
    },
    guidance,
    companySpecificKpis: enrichMetricsAsKpis(companyKpis, metrics),
    supplements: upsertQuarterlyForwardOutlookSupplement(currentReport.supplements, reportPeriod, forwardOutlook),
    previousRequirementsEvaluation: {
      requirementSetId: payload.evaluatedRequirementSetId || requirementBlock.requirementSetId || null,
      ticker: currentTicker,
      earningsPeriod: reportPeriod,
      createdAt: requirementBlock.createdAt || null,
      createdFromAnalysisId: requirementBlock.createdFromAnalysisId || currentReport.id || null,
      targetValue: requirementBlock.targetValue ?? null,
      targetScenario: requirementBlock.targetScenario || null,
      targetDescription: requirementBlock.targetDescription || null,
      summary: trimText(payload.summary, 500),
      matchType: "earnings_revaluation_v1",
      previousQuarter: requirementBlock.previousQuarter || null,
      targetQuarter: requirementBlock.targetQuarter || requirementBlock.earningsPeriod || reportPeriod,
      requirements,
      requirementsAssessment
    },
    requirementsAssessment,
    priceTargetRequirements: {
      requirementSetId: null,
      status: "OPEN",
      createdFromAnalysisId: null,
      evaluatedByAnalysisId: null,
      evaluatedAt: null,
      currentJustifiedValue: nextRequirements.currentJustifiedValue,
      targetValue: nextRequirements.targetValue,
      nextTargetValue: nextRequirements.targetValue,
      targetScenario: nextRequirements.targetScenario,
      targetDescription: nextRequirements.targetDescription,
      summary: nextRequirements.summary,
      createdAt: reportDate,
      previousQuarter: reportPeriod,
      targetQuarter: nextRequirements.targetQuarter,
      earningsPeriod: nextRequirements.targetQuarter,
      requirements: nextRequirements.requirements
    },
    sources,
    rawAnalysis: raw,
    rawAnalysisOriginal: raw,
    metadata: {
      ...oldMetadata,
      importedAt: null,
      updatedAt: null,
      rawHash: null,
      importMethod: "earnings_revaluation",
      analysisScope: "earnings_revaluation",
      revaluationSchema: EARNINGS_REVALUATION_SCHEMA,
      previousAnalysisId: currentReport.id || null,
      previousAnalysisDate: currentReport.analysisDate || null,
      previousReportPeriod: currentReport.reportPeriod || null,
      evaluatedRequirementSetId: payload.evaluatedRequirementSetId || requirementBlock.requirementSetId || null,
      earningsReportDate: reportDate,
      valuationAsOfDate: reportDate,
      decisionAsOfDate: reportDate,
      marketPriceAsOf: marketPrice.asOf,
      marketPriceSourceTitle: marketPrice.sourceTitle,
      marketPriceSourceUrl: marketPrice.sourceUrl,
      revaluationStatus: revaluation.status,
      thesisChange: revaluation.thesis.change,
      thesisChangeReason: revaluation.thesis.changeReason,
      revaluationPositiveDrivers: revaluation.changeDrivers.positive,
      revaluationNegativeDrivers: revaluation.changeDrivers.negative
    }
  };
}

function normalizeRevaluation(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const fair = input.fairValue && typeof input.fairValue === "object" ? input.fairValue : {};
  const decision = input.decision && typeof input.decision === "object" ? input.decision : {};
  const thesis = input.thesis && typeof input.thesis === "object" ? input.thesis : {};
  return {
    status: String(input.status || "UPDATED").trim().toUpperCase(),
    fairValue: {
      bear: numberOrNull(fair.bear),
      base: numberOrNull(fair.base),
      bull: numberOrNull(fair.bull),
      probabilityWeighted: numberOrNull(fair.probabilityWeighted),
      upsideToBasePct: numberOrNull(fair.upsideToBasePct),
      marginOfSafetyPct: numberOrNull(fair.marginOfSafetyPct),
      confidenceLevel: trimText(fair.confidenceLevel, 80)
    },
    scenarios: normalizeScenarios(input.scenarios),
    valuationMethodology: normalizeObject(input.valuationMethodology),
    valuationResults: normalizeValuationResults(input.valuationResults),
    decision: {
      action: String(decision.action || "").trim().toUpperCase(),
      confidence: numberOrNull(decision.confidence),
      investmentScore: numberOrNull(decision.investmentScore),
      rationale: stringArray(decision.rationale, 8, 500),
      whyNot: stringArray(decision.whyNot, 6, 400),
      upgradeTriggers: stringArray(decision.upgradeTriggers, 8, 400),
      downgradeTriggers: stringArray(decision.downgradeTriggers, 8, 400),
      biggestAssumption: trimText(decision.biggestAssumption, 500),
      mainRisk: trimText(decision.mainRisk, 500),
      buyZone: null,
      fairZone: null,
      expensiveZone: null
    },
    thesis: {
      shortSummary: trimText(thesis.shortSummary, 700),
      change: String(thesis.change || "unchanged").trim().toLowerCase(),
      changeReason: trimText(thesis.changeReason, 500)
    },
    risks: normalizeNarrativeItems(input.risks, "risk"),
    catalysts: normalizeNarrativeItems(input.catalysts, "catalyst"),
    changeDrivers: {
      positive: stringArray(input.changeDrivers?.positive, 6, 300),
      negative: stringArray(input.changeDrivers?.negative, 6, 300)
    }
  };
}

function validateRevaluation(value) {
  if (!["UPDATED", "UNCHANGED"].includes(value.status)) throw new Error("revaluation.status must be UPDATED or UNCHANGED.");
  const { bear, base, bull, probabilityWeighted } = value.fairValue;
  if (![bear, base, bull].every((item) => Number.isFinite(item) && item > 0)) {
    throw new Error("Positive Bear/Base/Bull fair values are required after earnings.");
  }
  if (!(bear <= base && base <= bull)) throw new Error("Bear/Base/Bull must satisfy Bear <= Base <= Bull.");
  if (!Number.isFinite(probabilityWeighted) || probabilityWeighted <= 0) throw new Error("probabilityWeighted fair value is required.");
  if (!DECISIONS.has(value.decision.action)) throw new Error("A valid post-earnings decision is required.");
  if (!value.thesis.shortSummary) throw new Error("An updated thesis summary is required.");
  if (!["strengthened", "unchanged", "weakened", "broken"].includes(value.thesis.change)) {
    throw new Error("thesis.change must be strengthened, unchanged, weakened, or broken.");
  }
  const scenarioItems = [value.scenarios.Bear, value.scenarios.Base, value.scenarios.Bull];
  if (!scenarioItems.every((item) => item && Number.isFinite(item.fairValue) && Number.isFinite(item.probability))) {
    throw new Error("Bear/Base/Bull scenarios with probabilities are required.");
  }
  const probabilitySum = scenarioItems.reduce((sum, item) => sum + item.probability, 0);
  if (Math.abs(probabilitySum - 100) > 0.01) throw new Error("Scenario probabilities must sum to 100%.");
  if (Math.abs(value.scenarios.Bear.fairValue - bear) > 0.01 || Math.abs(value.scenarios.Base.fairValue - base) > 0.01 || Math.abs(value.scenarios.Bull.fairValue - bull) > 0.01) {
    throw new Error("Scenario fair values must match revaluation.fairValue Bear/Base/Bull.");
  }
}

function normalizeNextRequirements(value = {}, expectedPeriod, fairValue) {
  const input = value && typeof value === "object" ? value : {};
  return {
    previousQuarter: trimText(input.previousQuarter, 40),
    targetQuarter: trimText(input.targetQuarter, 40),
    currentJustifiedValue: numberOrNull(input.currentJustifiedValue),
    targetValue: numberOrNull(input.targetValue),
    targetScenario: trimText(input.targetScenario, 80) || "Bull",
    targetDescription: trimText(input.targetDescription, 700),
    summary: trimText(input.summary, 500),
    requirements: (Array.isArray(input.requirements) ? input.requirements : []).map((item, index) => ({
      id: trimText(item?.id, 100) || `requirement_${index + 1}`,
      name: trimText(item?.name, 120),
      arabicName: trimText(item?.arabicName, 120),
      metric: trimText(item?.metric, 120) || trimText(item?.name, 120),
      type: trimText(item?.type, 40) || "text",
      previousValue: valueOrNull(item?.previousValue),
      previousDisplay: trimText(item?.previousDisplay, 160),
      currentLevel: valueOrNull(item?.previousValue),
      requiredValue: valueOrNull(item?.requiredValue),
      requiredDisplay: trimText(item?.requiredDisplay, 160),
      unit: trimText(item?.unit, 80),
      importance: normalizeImportance(item?.importance),
      weight: numberOrNull(item?.weight),
      whyItMatters: trimText(item?.whyItMatters, 400),
      actualValue: null,
      actualDisplay: null,
      actualRaw: null,
      direction: "unknown",
      impact: "unknown",
      status: "NOT_REPORTED",
      evaluationNote: null
    })),
    expectedPeriod,
    baseFairValue: fairValue.base,
    bullFairValue: fairValue.bull
  };
}

function validateNextRequirements(value, expectedPeriod, fairValue) {
  if (normalizePeriod(value.targetQuarter) !== normalizePeriod(expectedPeriod)) {
    throw new Error(`nextRequirements.targetQuarter must be ${expectedPeriod}.`);
  }
  if (!Number.isFinite(value.currentJustifiedValue) || Math.abs(value.currentJustifiedValue - fairValue.base) > 0.01) {
    throw new Error("nextRequirements.currentJustifiedValue must equal the new Base fair value.");
  }
  if (!Number.isFinite(value.targetValue) || value.targetValue <= 0) throw new Error("nextRequirements.targetValue is required.");
  if (value.requirements.length < 4 || value.requirements.length > 8) throw new Error("Next-quarter requirements must contain 4 to 8 items.");
  const ids = new Set();
  let weightSum = 0;
  for (const requirement of value.requirements) {
    if (ids.has(requirement.id)) throw new Error(`Duplicate next requirement id: ${requirement.id}`);
    ids.add(requirement.id);
    if (!requirement.name && !requirement.metric) throw new Error("Every next requirement needs a name/metric.");
    if (!Number.isFinite(requirement.weight) || requirement.weight <= 0) throw new Error("Every next requirement needs a positive weight.");
    if (requirement.status !== "NOT_REPORTED") throw new Error("New next-quarter requirements must start as NOT_REPORTED.");
    weightSum += requirement.weight;
  }
  if (Math.abs(weightSum - 100) > 0.01) throw new Error("Next-quarter requirement weights must sum to 100%.");
}

function mergeRequirementResults(definitionsInput, resultsInput) {
  const definitions = Array.isArray(definitionsInput) ? definitionsInput : [];
  const results = (Array.isArray(resultsInput) ? resultsInput : []).map(normalizeEvaluationResult);
  const byId = new Map(results.filter((item) => item.id).map((item) => [String(item.id), item]));
  return definitions.map((definition, index) => {
    const result = byId.get(String(definition.id)) || results[index] || normalizeEvaluationResult({ id: definition.id });
    return {
      ...definition,
      actualValue: result.actualValue,
      actualDisplay: result.actualDisplay,
      actualRaw: null,
      direction: "unknown",
      impact: "unknown",
      status: result.status,
      evaluationNote: result.evaluationNote
    };
  });
}

function normalizeEvaluationResult(item = {}) {
  const status = String(item.status || "NOT_REPORTED").trim().toUpperCase();
  return {
    id: item.id || null,
    actualValue: valueOrNull(item.actualValue),
    actualDisplay: trimText(item.actualDisplay, 160),
    status: REQUIREMENT_STATUSES.has(status) ? status : "NOT_REPORTED",
    evaluationNote: trimText(item.evaluationNote, 300)
  };
}

function compactRequirements(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id || null,
    name: item.name || item.metric || null,
    arabicName: item.arabicName || null,
    metric: item.metric || item.name || null,
    type: item.type || null,
    previousValue: item.previousValue ?? item.currentLevel ?? null,
    previousDisplay: item.previousDisplay || null,
    requiredValue: item.requiredValue ?? null,
    requiredDisplay: item.requiredDisplay || null,
    unit: item.unit || null,
    weight: Number.isFinite(item.weight) ? item.weight : null,
    whyItMatters: item.whyItMatters || null
  })).filter((item) => item.id || item.name || item.metric);
}

function normalizeScenarios(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    Bear: normalizeScenario(input.Bear),
    Base: normalizeScenario(input.Base),
    Bull: normalizeScenario(input.Bull),
    Exceptional: null
  };
}

function normalizeScenario(value = {}) {
  if (!value || typeof value !== "object") return null;
  return {
    fairValue: numberOrNull(value.fairValue),
    valuationMethod: trimText(value.valuationMethod, 120),
    assumptions: value.assumptions && typeof value.assumptions === "object" ? value.assumptions : {},
    revenueAssumption: valueOrNull(value.revenueAssumption),
    marginAssumption: valueOrNull(value.marginAssumption),
    epsAssumption: valueOrNull(value.epsAssumption),
    ebitdaAssumption: valueOrNull(value.ebitdaAssumption),
    fcfAssumption: valueOrNull(value.fcfAssumption),
    multipleUsed: valueOrNull(value.multipleUsed),
    timeHorizon: trimText(value.timeHorizon, 100),
    probability: numberOrNull(value.probability),
    upsideDownsidePercent: numberOrNull(value.upsideDownsidePercent),
    thesis: trimText(value.thesis, 600),
    keyRisks: stringArray(value.keyRisks, 6, 300),
    requiredOutcomes: stringArray(value.requiredOutcomes, 6, 300)
  };
}

function scenarioTemplate() {
  return {
    fairValue: null,
    probability: null,
    valuationMethod: null,
    assumptions: {},
    revenueAssumption: null,
    marginAssumption: null,
    epsAssumption: null,
    ebitdaAssumption: null,
    fcfAssumption: null,
    multipleUsed: null,
    timeHorizon: null,
    upsideDownsidePercent: null,
    thesis: "",
    keyRisks: [],
    requiredOutcomes: []
  };
}

function normalizeValuationResults(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    method: trimText(item?.method, 120),
    fairValue: numberOrNull(item?.fairValue),
    weight: numberOrNull(item?.weight),
    confidence: valueOrNull(item?.confidence),
    rationale: trimText(item?.rationale, 400)
  })).filter((item) => item.method && Number.isFinite(item.fairValue));
}

function normalizeGuidance(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const direction = String(item?.direction || "not_applicable").trim().toLowerCase();
    return {
      period: trimText(item?.period, 80),
      topic: trimText(item?.topic, 100),
      arabicTopic: trimText(item?.arabicTopic, 100),
      currentGuidance: valueOrNull(item?.currentGuidance),
      previousGuidance: valueOrNull(item?.previousGuidance),
      direction: GUIDANCE_DIRECTIONS.has(direction) ? direction : "not_applicable",
      type: trimText(item?.type, 40) || "text",
      interpretation: trimText(item?.interpretation, 350),
      importance: normalizeImportance(item?.importance)
    };
  }).filter((item) => item.topic || item.arabicTopic || item.interpretation);
}

function normalizeKpis(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: trimText(item?.name, 120),
    arabicName: trimText(item?.arabicName, 120),
    category: "quarterly",
    currentValue: valueOrNull(item?.actualDisplay ?? item?.currentValue),
    unit: trimText(item?.unit, 60),
    trend: "unknown",
    importance: "high",
    interpretation: normalizeResultText(item?.result)
  })).filter((item) => item.name || item.arabicName || item.currentValue !== null);
}

function enrichMetricsAsKpis(items, metrics) {
  const result = [...items];
  const grossMargin = metricDisplay(metrics.grossMarginPct);
  if (grossMargin && !result.some((item) => /gross margin/i.test(item.name || ""))) {
    result.push({ name: "Gross Margin", arabicName: "الهامش الإجمالي", category: "quarterly", currentValue: grossMargin, unit: "%", trend: "unknown", importance: "high", interpretation: normalizeResultText(metrics.grossMarginPct?.result) });
  }
  return result.slice(0, 6);
}

function normalizeNarrativeItems(items, type) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item === "string") return { title: trimText(item, 180), explanation: null };
    if (!item || typeof item !== "object") return null;
    if (type === "risk") {
      return {
        title: trimText(item.title || item.name, 180),
        severity: trimText(item.severity, 60),
        explanation: trimText(item.explanation, 500),
        whatToMonitor: trimText(item.whatToMonitor, 350),
        thesisBreaker: trimText(item.thesisBreaker, 350)
      };
    }
    return { title: trimText(item.title || item.name, 180), explanation: trimText(item.explanation, 500) };
  }).filter(Boolean);
}

function normalizeSources(items) {
  return (Array.isArray(items) ? items : []).slice(0, 8).map((item) => ({
    title: trimText(item?.title, 200),
    url: trimText(item?.url, 700),
    sourceType: trimText(item?.sourceType, 120)
  })).filter((item) => item.title || item.url);
}

function normalizeMarketPrice(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  return {
    value: numberOrNull(input.value),
    asOf: trimText(input.asOf, 80),
    sourceTitle: trimText(input.sourceTitle, 160),
    sourceUrl: trimText(input.sourceUrl, 700)
  };
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function metricTemplate() {
  return { value: null, display: null, consensusDisplay: null, result: "BEAT|MISS|INLINE|NA" };
}

function metricNumber(item) {
  return Number.isFinite(item?.value) ? item.value : null;
}

function metricDisplay(item) {
  return trimText(item?.display, 160);
}

function normalizeResultText(value) {
  const clean = String(value || "NA").trim().toUpperCase();
  if (clean === "BEAT") return "أفضل من المتوقع";
  if (clean === "MISS") return "أقل من المتوقع";
  if (clean === "INLINE") return "متوافق مع المتوقع";
  return null;
}

function nextQuarterPeriod(period) {
  const match = String(period || "").trim().toUpperCase().match(/^Q([1-4])\s+(20\d{2})$/);
  if (!match) return null;
  const quarter = Number(match[1]);
  const year = Number(match[2]);
  return quarter === 4 ? `Q1 ${year + 1}` : `Q${quarter + 1} ${year}`;
}

function normalizePeriod(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeQuarter(value) {
  const match = String(value || "").trim().toUpperCase().match(/^Q([1-4])$/);
  return match ? `Q${match[1]}` : null;
}

function normalizeTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean) ? clean : null;
}

function validDate(value) {
  const text = String(value || "").trim();
  if (!text || Number.isNaN(new Date(text).getTime())) return null;
  return text.slice(0, 10);
}

function normalizeImportance(value) {
  const clean = String(value || "medium").trim().toLowerCase();
  return ["high", "medium", "low", "critical"].includes(clean) ? clean : "medium";
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

function stringArray(value, maxItems = 8, maxLength = 400) {
  return (Array.isArray(value) ? value : []).map((item) => trimText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function trimText(value, maxLength = 400) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}
