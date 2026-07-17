import { calculateRangeFairValue, calculateUpside, highestValue } from "../domain/evaluatedCompanies.js";
import { clamp, safeDiv, toNumber, weightedAverage } from "../domain/financialMetrics.js";
import { ANALYST_BRAIN_VERSION } from "./methodology.js";

export const CANONICAL_METHODOLOGY_VERSION = "investment-analyst-brain-v1.1-canonical";

export const SUPPORTED_MODELS = [
  "DCF",
  "P/E",
  "PEG",
  "EV/EBITDA",
  "EV/Sales",
  "Forward EV/Sales",
  "Price/FCF",
  "Morningstar Fair Value",
  "Analyst Consensus"
];

export const UNSUPPORTED_MODELS = [
  "P/B",
  "Residual Income",
  "DDM",
  "AFFO",
  "NAV",
  "Dividend Yield",
  "Cap Rate",
  "Sum of the Parts"
];

const SOURCE_PRIORITY = [
  "Company guidance",
  "Analyst estimates",
  "Historical trends",
  "Backlog, contracts, unit economics",
  "Sector assumptions",
  "Methodology defaults"
];

const CLASS_DEFAULTS = {
  "High Growth — Profitable": { growth: 0.12, margin: 0.24, capex: 0.055, terminalGrowth: 0.03, wacc: [0.085, 0.105], multiple: { pe: 28, peg: 1.45, evEbitda: 18, evSales: 8, fcf: 28 } },
  "High Growth — Transition to Profitability": { growth: 0.16, margin: 0.06, capex: 0.06, terminalGrowth: 0.025, wacc: [0.1, 0.13], multiple: { evSales: 6, forwardEvSales: 7 } },
  "Mature Cash Generator": { growth: 0.04, margin: 0.18, capex: 0.045, terminalGrowth: 0.025, wacc: [0.075, 0.095], multiple: { pe: 18, evEbitda: 11, evSales: 3.2, fcf: 20 } },
  Cyclical: { growth: 0.035, margin: 0.12, capex: 0.065, terminalGrowth: 0.02, wacc: [0.095, 0.13], multiple: { pe: 13, evEbitda: 8, evSales: 1.6, fcf: 14 } },
  "Capital Intensive": { growth: 0.045, margin: 0.13, capex: 0.12, terminalGrowth: 0.02, wacc: [0.09, 0.12], multiple: { pe: 14, evEbitda: 8, evSales: 1.8, fcf: 13 } },
  "Financial Institution": { growth: 0.035, margin: 0.18, capex: 0.02, terminalGrowth: 0.02, wacc: [0.085, 0.115], multiple: {} },
  REIT: { growth: 0.03, margin: 0.2, capex: 0.08, terminalGrowth: 0.02, wacc: [0.08, 0.105], multiple: {} },
  "Early Stage / Pre-Profit": { growth: 0.18, margin: 0.02, capex: 0.06, terminalGrowth: 0.02, wacc: [0.12, 0.16], multiple: { evSales: 4, forwardEvSales: 5 } },
  Commodity: { growth: 0.025, margin: 0.11, capex: 0.09, terminalGrowth: 0.015, wacc: [0.095, 0.13], multiple: { evEbitda: 6, evSales: 1.2, fcf: 10 } },
  "Holding Company": { growth: 0.035, margin: 0.12, capex: 0.055, terminalGrowth: 0.02, wacc: [0.085, 0.11], multiple: {} }
};

const MODEL_BASE_WEIGHTS = {
  DCF: 0.34,
  "P/E": 0.12,
  PEG: 0.08,
  "EV/EBITDA": 0.13,
  "EV/Sales": 0.09,
  "Forward EV/Sales": 0.1,
  "Price/FCF": 0.12,
  "Morningstar Fair Value": 0.08,
  "Analyst Consensus": 0.06
};

export function runAnalystBrainEngine(workspace, options = {}) {
  const language = options.language || "ar";
  const evidence = normalizeEvidence(workspace);
  const valuationDate = new Date().toISOString().slice(0, 10);
  const classification = classifyCompany(evidence, language);
  const businessQuality = scoreBusinessQuality(evidence, classification, language);
  const forecastPolicy = buildForecastPolicy(evidence, classification, language);
  const scenarios = buildScenarios(evidence, classification, forecastPolicy, language);
  const modelSelection = selectAndValueModels(evidence, classification, forecastPolicy, scenarios, language);
  const dataQuality = buildDataQuality(evidence, modelSelection);
  const recommendation = buildRecommendation({ evidence, classification, businessQuality, forecastPolicy, scenarios, modelSelection, dataQuality, language });
  const monitoringChecklist = buildMonitoringChecklist(evidence, classification, forecastPolicy, language);
  const report = buildReport({
    workspace,
    evidence,
    classification,
    businessQuality,
    forecastPolicy,
    scenarios,
    modelSelection,
    dataQuality,
    recommendation,
    monitoringChecklist,
    language,
    valuationDate
  });
  return {
    report,
    errors: report.validation?.valid === false ? report.validation.errors : []
  };
}

export function normalizeEvidence(workspace) {
  const fields = workspace?.inputs || {};
  const values = {};
  const sources = {};
  for (const [fieldId, item] of Object.entries(fields)) {
    if (!usable(item)) continue;
    values[fieldId] = numericField(fieldId) ? toNumber(item.value) : item.value;
    sources[fieldId] = {
      source: item.source || "User Paste",
      sourceDate: item.sourceDate || "",
      confidence: clamp(toNumber(item.confidence) ?? 0.65, 0, 1),
      originalTextReference: item.originalTextReference || ""
    };
  }
  const shares = values.dilutedShares;
  const marketCap = values.marketCap || (positive(values.currentPrice) && positive(shares) ? values.currentPrice * shares : null);
  const enterpriseValue = values.enterpriseValue || (positive(marketCap) ? marketCap + (values.totalDebt || 0) - (values.cash || 0) : null);
  return {
    values: {
      ...values,
      marketCap,
      enterpriseValue,
      currency: values.currency || "USD",
      currentDate: values.currentDate || new Date().toISOString().slice(0, 10)
    },
    sources,
    present: new Set(Object.keys(values)),
    review: workspace?.dataReview || null
  };
}

function classifyCompany(evidence, language) {
  const v = evidence.values;
  const sector = String(v.sector || "").toLowerCase();
  const industry = String(v.industry || "").toLowerCase();
  const notes = `${v.businessModel || ""} ${v.userNotes || ""} ${v.managementGrowthGuidance || ""} ${v.annualPeriods || ""}`.toLowerCase();
  const revenue = v.revenue;
  const operatingMargin = safeDiv(v.operatingIncome, revenue);
  const fcfMargin = safeDiv(v.freeCashFlow, revenue);
  const capexRatio = safeDiv(Math.abs(v.capex || 0), revenue);
  const debtToRevenue = safeDiv(v.totalDebt, revenue);
  const revenueGrowth = inferredRevenueGrowth(v);
  const profitable = positive(v.operatingIncome) || positive(v.netIncome) || positive(v.eps);
  const fcfPositive = positive(v.freeCashFlow);
  const evidenceItems = [];
  let classification = "Mature Cash Generator";

  if (/bank|insurance|financial|asset management|broker/.test(`${sector} ${industry}`)) {
    classification = "Financial Institution";
    evidenceItems.push("Sector/industry indicates a financial institution.");
  } else if (/reit|real estate investment trust/.test(`${sector} ${industry}`)) {
    classification = "REIT";
    evidenceItems.push("Industry indicates REIT economics.");
  } else if (/holding|conglomerate/.test(`${industry} ${notes}`)) {
    classification = "Holding Company";
    evidenceItems.push("Business description indicates holding-company or conglomerate structure.");
  } else if (/commodity|oil|gas|mining|metals|energy/.test(`${sector} ${industry}`)) {
    classification = "Commodity";
    evidenceItems.push("Sector/industry indicates commodity exposure.");
  } else if (Number.isFinite(capexRatio) && capexRatio >= 0.1 || Number.isFinite(debtToRevenue) && debtToRevenue > 0.8 || /utility|telecom|infrastructure|industrial/.test(industry)) {
    classification = "Capital Intensive";
    evidenceItems.push("CapEx intensity, leverage, or industry structure points to capital intensity.");
  } else if (!profitable && positive(revenue)) {
    classification = positive(revenueGrowth) && revenueGrowth > 0.08 ? "High Growth — Transition to Profitability" : "Early Stage / Pre-Profit";
    evidenceItems.push("Revenue exists but profitability is not yet established.");
  } else if (/cyclical|airline|auto|semiconductor|construction|housing/.test(`${industry} ${notes}`)) {
    classification = "Cyclical";
    evidenceItems.push("Industry or supplied evidence points to cyclicality.");
  } else if ((Number.isFinite(revenueGrowth) && revenueGrowth >= 0.08 || /software|cloud|platform|ai|subscription/.test(`${industry} ${notes}`)) && profitable) {
    classification = "High Growth — Profitable";
    evidenceItems.push("Growth evidence plus profitability supports profitable growth classification.");
  } else if (fcfPositive || Number.isFinite(fcfMargin)) {
    classification = "Mature Cash Generator";
    evidenceItems.push("Positive FCF profile supports mature cash-generator classification.");
  }

  if (Number.isFinite(operatingMargin)) evidenceItems.push(`Operating Margin evidence: ${formatPercent(operatingMargin)}.`);
  if (Number.isFinite(fcfMargin)) evidenceItems.push(`FCF Margin evidence: ${formatPercent(fcfMargin)}.`);
  if (Number.isFinite(revenueGrowth)) evidenceItems.push(`Growth evidence: ${formatPercent(revenueGrowth)}.`);

  const suitableModels = suitableModelsFor(classification, v);
  const excludedModels = SUPPORTED_MODELS
    .filter((method) => !suitableModels.includes(method))
    .map((method) => ({ method, why: exclusionReason(method, classification, v) }));
  const confidence = Math.round(clamp(50 + evidenceItems.length * 8 + (v.sector ? 8 : 0) + (v.industry ? 8 : 0), 35, 94));
  return {
    classification,
    evidence: evidenceItems,
    suitableModels,
    excludedModels,
    unsupportedModels: UNSUPPORTED_MODELS.map((method) => ({ method, why: "Unsupported in Version 9 until deterministic implementation and required inputs are added." })),
    confidence,
    reason: evidenceItems.join(" ")
  };
}

function suitableModelsFor(classification, v) {
  const models = [];
  if (!["Financial Institution", "REIT", "Holding Company"].includes(classification) && positive(v.freeCashFlow) && positive(v.dilutedShares)) models.push("DCF", "Price/FCF");
  if (positive(v.eps)) models.push("P/E");
  if (positive(v.eps) && classification === "High Growth — Profitable") models.push("PEG");
  if (positive(v.ebitda) && positive(v.dilutedShares) && !["Financial Institution", "REIT"].includes(classification)) models.push("EV/EBITDA");
  if (positive(v.revenue) && positive(v.dilutedShares) && !["Financial Institution", "REIT", "Holding Company"].includes(classification)) models.push(classification.includes("Transition") ? "Forward EV/Sales" : "EV/Sales");
  if (positive(v.morningstarFairValue)) models.push("Morningstar Fair Value");
  if (positive(v.analystTargetAverage)) models.push("Analyst Consensus");
  return [...new Set(models)];
}

function scoreBusinessQuality(evidence, classification, language) {
  const v = evidence.values;
  const revenue = v.revenue;
  const grossMargin = safeDiv(v.grossProfit, revenue);
  const operatingMargin = safeDiv(v.operatingIncome, revenue);
  const fcfMargin = safeDiv(v.freeCashFlow, revenue);
  const netCash = (v.cash || 0) - (v.totalDebt || 0);
  const debtToEbitda = safeDiv(v.totalDebt, v.ebitda);
  const components = [
    qualityComponent("Business model", 10, scoreBusinessModel(v, classification)),
    qualityComponent("Revenue quality", 10, scoreRevenueQuality(v)),
    qualityComponent("Moat", 15, scoreMoat(v)),
    qualityComponent("Growth visibility", 10, scoreGrowthVisibility(v)),
    qualityComponent("Profitability", 10, ratioScore(operatingMargin, [-0.05, 0.05, 0.15, 0.25])),
    qualityComponent("Cash generation", 15, ratioScore(fcfMargin, [-0.05, 0.03, 0.1, 0.18])),
    qualityComponent("Balance sheet", 10, netCash >= 0 ? 8.5 : Number.isFinite(debtToEbitda) ? clamp(8 - debtToEbitda, 2, 8) : 4),
    qualityComponent("Management", 8, scoreManagement(v)),
    qualityComponent("Capital allocation", 7, scoreCapitalAllocation(v)),
    qualityComponent("Risk resilience", 5, scoreRiskResilience(v))
  ];
  const score = Math.round(components.reduce((sum, item) => sum + item.points, 0));
  const evidenceCount = components.filter((item) => item.evidence.length).length;
  return {
    score,
    rating: qualityRating(score),
    confidence: Math.round(clamp(35 + evidenceCount * 5 + dataCoverage(evidence) * 35, 20, 94)),
    components,
    explanation: text(language, "Business Quality تقيس جودة الشركة من الأدلة المالية والتشغيلية، وليس من حركة السعر.", "Business Quality scores the company from financial and operating evidence, not price movement.")
  };
}

function buildForecastPolicy(evidence, classification, language) {
  const v = evidence.values;
  const defaults = CLASS_DEFAULTS[classification.classification] || CLASS_DEFAULTS["Mature Cash Generator"];
  const revenueGrowthStart = selectRevenueGrowth(v, defaults);
  const marginStart = selectOperatingMargin(v, defaults);
  const taxRate = selectAssumption(v.taxRate, 0.21, "Tax Rate", "Methodology default", 0.55);
  const daToRevenue = selectDaToRevenue(v);
  const capexToRevenue = selectCapex(v, defaults, language);
  const workingCapitalToRevenueGrowth = selectAssumption(v.workingCapitalToRevenueGrowth, 0.01, "Working Capital", "Methodology default", 0.5);
  const dilution = selectDilution(v, classification.classification);
  const wacc = buildWacc(evidence, classification, defaults, language);
  const yearlyForecast = buildYearlyForecast({
    v,
    revenueGrowthStart,
    marginStart,
    taxRate,
    daToRevenue,
    capexToRevenue,
    workingCapitalToRevenueGrowth,
    dilution,
    terminalGrowth: defaults.terminalGrowth
  });
  const confidence = Math.round(clamp(35
    + revenueGrowthStart.confidence * 18
    + marginStart.confidence * 14
    + capexToRevenue.confidence * 12
    + wacc.confidence * 0.22
    + (positive(v.dilutedShares) ? 8 : 0), 20, 94));
  return {
    sourcePriority: SOURCE_PRIORITY,
    yearlyForecast,
    revenueGrowth: revenueGrowthStart,
    operatingMargin: marginStart,
    taxRate,
    daToRevenue,
    capex: capexToRevenue,
    workingCapital: workingCapitalToRevenueGrowth,
    dilution,
    terminalGrowth: selectAssumption(defaults.terminalGrowth, defaults.terminalGrowth, "Terminal Growth", `Classification default: ${classification.classification}`, 0.62),
    wacc,
    sensitivity: buildWaccSensitivity(wacc.finalWacc),
    confidence
  };
}

function buildWacc(evidence, classification, defaults, language) {
  const v = evidence.values;
  const [low, high] = defaults.wacc;
  let adjustment = 0;
  const reasons = [];
  const netCash = (v.cash || 0) - (v.totalDebt || 0);
  if (classification.classification.includes("Transition") || classification.classification === "Early Stage / Pre-Profit") {
    adjustment += 0.0125;
    reasons.push("pre-profit or transition status");
  }
  if (classification.classification === "Cyclical" || classification.classification === "Commodity") {
    adjustment += 0.0075;
    reasons.push("cyclicality");
  }
  if (String(v.customerConcentration || "").trim()) {
    adjustment += 0.005;
    reasons.push("customer concentration");
  }
  if (String(v.regulatoryRisks || "").trim()) {
    adjustment += 0.005;
    reasons.push("regulatory risk");
  }
  if (negative(netCash)) {
    adjustment += 0.004;
    reasons.push("net debt");
  } else if (positive(netCash)) {
    adjustment -= 0.004;
    reasons.push("net cash");
  }
  if (/wide|switching|network|brand|scale/i.test(`${v.morningstarMoat || ""} ${v.competitiveAdvantages || ""}`)) {
    adjustment -= 0.005;
    reasons.push("moat evidence");
  }
  const midpoint = (low + high) / 2;
  const finalWacc = clamp(midpoint + adjustment, low, high);
  const confidence = Math.round(clamp(72 + (positive(v.marketCap) ? 8 : -8) + (positive(v.totalDebt) || positive(v.cash) ? 6 : -6), 35, 92));
  return {
    riskFreeRate: 0.045,
    equityRiskPremium: 0.055,
    betaOrBusinessRiskProxy: classification.classification,
    costOfEquity: finalWacc + 0.012,
    costOfDebt: 0.055 + Math.max(0, adjustment / 2),
    taxRate: 0.21,
    capitalWeights: {
      debtWeight: capitalWeight(v, "debt"),
      equityWeight: capitalWeight(v, "equity")
    },
    finalWacc,
    guardrail: [low, high],
    confidence,
    why: text(language,
      `تم اختيار WACC ضمن نطاق ${classification.classification} مع تعديلات بسبب ${reasons.join("، ") || "طبيعة النشاط وجودة البيانات"}.`,
      `WACC was selected inside the ${classification.classification} guardrail with adjustments for ${reasons.join(", ") || "business risk and data quality"}.`),
    sensitivity: buildWaccSensitivity(finalWacc)
  };
}

function buildYearlyForecast({ v, revenueGrowthStart, marginStart, taxRate, daToRevenue, capexToRevenue, workingCapitalToRevenueGrowth, dilution, terminalGrowth }) {
  const rows = [];
  let revenue = positive(v.revenue) ? v.revenue : 0;
  let priorFcf = positive(v.freeCashFlow) ? v.freeCashFlow : null;
  let shares = positive(v.dilutedShares) ? v.dilutedShares : null;
  for (let year = 1; year <= 5; year += 1) {
    const fade = (year - 1) / 4;
    const revenueGrowth = clamp(revenueGrowthStart.value * (1 - fade) + terminalGrowth * fade, -0.15, 0.35);
    const operatingMargin = clamp(marginStart.value + (marginStart.target - marginStart.value) * fade, -0.2, 0.45);
    const previousRevenue = revenue;
    revenue = revenue * (1 + revenueGrowth);
    const operatingIncome = revenue * operatingMargin;
    const tax = Math.max(0, operatingIncome * taxRate.value);
    const nopat = operatingIncome - tax;
    const depreciationAmortization = revenue * daToRevenue.value;
    const capex = revenue * capexToRevenue.value;
    const workingCapitalChange = Math.max(0, revenue - previousRevenue) * workingCapitalToRevenueGrowth.value;
    if (shares) shares *= 1 + dilution.value;
    const freeCashFlow = nopat + depreciationAmortization - capex - workingCapitalChange;
    rows.push({
      year,
      revenue,
      revenueGrowth,
      operatingMargin,
      operatingIncome,
      taxRate: taxRate.value,
      tax,
      nopat,
      daToRevenue: daToRevenue.value,
      depreciationAmortization,
      capexToRevenue: capexToRevenue.value,
      capex,
      workingCapitalToRevenueGrowth: workingCapitalToRevenueGrowth.value,
      workingCapitalChange,
      dilution: dilution.value,
      dilutedShares: shares,
      freeCashFlow,
      fcfGrowth: priorFcf ? (freeCashFlow - priorFcf) / Math.abs(priorFcf) : null,
      source: revenueGrowthStart.source,
      confidence: Math.min(revenueGrowthStart.confidence, marginStart.confidence, capexToRevenue.confidence)
    });
    priorFcf = freeCashFlow;
  }
  return rows;
}

function buildScenarios(evidence, classification, forecastPolicy, language) {
  const v = evidence.values;
  const adjustments = {
    Conservative: { probability: 0.25, growth: -0.03, margin: -0.025, wacc: 0.01, terminalGrowth: -0.005, capex: 0.01 },
    Base: { probability: 0.5, growth: 0, margin: 0, wacc: 0, terminalGrowth: 0, capex: 0 },
    Optimistic: { probability: 0.25, growth: 0.025, margin: 0.02, wacc: -0.0075, terminalGrowth: 0.005, capex: -0.006 }
  };
  const built = Object.fromEntries(Object.entries(adjustments).map(([name, adjustment]) => {
    const forecast = adjustForecast(forecastPolicy, adjustment);
    const wacc = clamp(forecastPolicy.wacc.finalWacc + adjustment.wacc, 0.045, 0.18);
    const terminalGrowth = clamp(forecastPolicy.terminalGrowth.value + adjustment.terminalGrowth, 0.005, Math.min(0.04, wacc - 0.015));
    const fairValue = dcfFairValuePerShare({ forecast, terminalGrowth, wacc, cash: v.cash, debt: v.totalDebt, shares: lastForecastShares(forecast) || v.dilutedShares });
    return [name, {
      name,
      probability: adjustment.probability,
      fairValue,
      revenuePath: forecast.map((row) => row.revenueGrowth),
      margins: forecast.map((row) => row.operatingMargin),
      fcf: forecast.map((row) => row.freeCashFlow),
      capex: forecast.map((row) => row.capexToRevenue),
      wacc,
      terminalGrowth,
      forecast,
      requiredConditions: scenarioConditions(name, fairValue, language),
      mainRisk: scenarioRisk(name, classification.classification, language),
      keyCatalysts: scenarioCatalysts(name, language)
    }];
  }));
  built.Exceptional = exceptionalScenario(evidence, built.Optimistic, language);
  return built;
}

function selectAndValueModels(evidence, classification, forecastPolicy, scenarios, language) {
  const v = evidence.values;
  const excludedModels = [];
  const unsupportedModels = classification.unsupportedModels;
  const candidates = [];
  addModel(candidates, excludedModels, valueDcf(v, classification, forecastPolicy, scenarios.Base, language));
  addModel(candidates, excludedModels, valuePe(v, classification, language));
  addModel(candidates, excludedModels, valuePeg(v, classification, forecastPolicy, language));
  addModel(candidates, excludedModels, valueEvEbitda(v, classification, language));
  addModel(candidates, excludedModels, valueEvSales(v, classification, language));
  addModel(candidates, excludedModels, valueForwardEvSales(v, classification, forecastPolicy, language));
  addModel(candidates, excludedModels, valuePriceFcf(v, classification, language));
  addModel(candidates, excludedModels, externalReference("Morningstar Fair Value", v.morningstarFairValue, v.currentPrice, language));
  addModel(candidates, excludedModels, externalReference("Analyst Consensus", v.analystTargetAverage, v.currentPrice, language));

  const selectedModels = applyModelWeights(candidates);
  const fairValue = weightedAverage(selectedModels.map((model) => ({
    value: model.fairValue,
    weight: model.weight * model.confidence
  })));
  const externalReferenceWeight = selectedModels.filter((model) => model.role === "external_reference").reduce((sum, model) => sum + model.weight, 0);
  const weightChecks = {
    maxModelWeight: Math.max(0, ...selectedModels.map((model) => model.weight)),
    externalReferenceWeight,
    valid: selectedModels.every((model) => model.weight <= 0.450001) && externalReferenceWeight <= 0.250001
  };
  return {
    selectedModels,
    excludedModels: [...excludedModels, ...classification.excludedModels],
    unsupportedModels,
    fairValue,
    externalReferenceWeight,
    weightChecks
  };
}

function buildDataQuality(evidence, modelSelection) {
  const required = ["ticker", "companyName", "currentPrice"];
  const financialCore = ["revenue", "dilutedShares", "cash", "totalDebt"];
  const confirmedRequired = required.filter((key) => evidence.present.has(key)).length;
  const confirmedFinancial = financialCore.filter((key) => evidence.present.has(key)).length;
  const selectedModels = modelSelection.selectedModels.length;
  const completeness = Math.round(clamp(confirmedRequired / required.length * 35 + confirmedFinancial / financialCore.length * 25 + Math.min(25, selectedModels * 6) + dataCoverage(evidence) * 15, 0, 100));
  return {
    completeness,
    confirmedSources: Object.entries(evidence.sources).map(([fieldId, source]) => `${fieldId}: ${source.source}`).slice(0, 20),
    missingData: [...required, ...financialCore].filter((key) => !evidence.present.has(key)),
    conflictingData: [],
    importantLimitations: modelSelection.excludedModels.map((item) => `${item.method}: ${item.why}`).slice(0, 10)
  };
}

function buildRecommendation({ evidence, businessQuality, forecastPolicy, scenarios, modelSelection, dataQuality, language }) {
  const v = evidence.values;
  const currentPrice = v.currentPrice;
  const rangeFairValue = scenarioExpectedValue(scenarios);
  const modelFairValue = modelSelection.fairValue;
  const fairValue = positive(modelFairValue) && positive(rangeFairValue) ? (modelFairValue * 0.65 + rangeFairValue * 0.35) : modelFairValue || rangeFairValue;
  const upside = calculateUpside(fairValue, currentPrice);
  const conservativeUpside = calculateUpside(scenarios.Conservative?.fairValue, currentPrice);
  const optimisticUpside = calculateUpside(scenarios.Optimistic?.fairValue, currentPrice);
  const netCash = (v.cash || 0) - (v.totalDebt || 0);
  const dilution = forecastPolicy.dilution.value;
  const riskScore = riskScoreFrom(evidence, forecastPolicy, scenarios);
  const gates = {
    hasPrice: positive(currentPrice),
    hasValuation: positive(fairValue),
    hasInternalValuation: modelSelection.selectedModels.some((model) => model.role !== "external_reference"),
    dataQuality: dataQuality.completeness >= 60,
    businessQuality: businessQuality.score >= 55,
    forecastConfidence: forecastPolicy.confidence >= 55,
    riskAcceptable: riskScore <= 68,
    balanceSheetAcceptable: netCash >= 0 || safeDiv(v.totalDebt, v.ebitda) <= 3,
    dilutionAcceptable: dilution <= 0.03,
    scenarioAsymmetryPositive: Number.isFinite(optimisticUpside) && Number.isFinite(conservativeUpside) ? Math.abs(optimisticUpside) >= Math.abs(conservativeUpside) * 0.8 : true
  };
  let decision = "HOLD";
  let status = "ACTIONABLE";
  if (!gates.hasPrice || !gates.hasValuation || !gates.hasInternalValuation || modelSelection.selectedModels.length === 0 || dataQuality.completeness < 45) {
    decision = "INSUFFICIENT_DATA";
    status = "INSUFFICIENT_DATA";
  } else if (upside <= -0.15 || businessQuality.score < 40 || riskScore > 78) {
    decision = "SELL";
  } else if (upside >= 0.22 && gates.businessQuality && gates.forecastConfidence && gates.riskAcceptable && gates.dilutionAcceptable && gates.scenarioAsymmetryPositive) {
    decision = "BUY";
  }
  const confidence = Math.round(clamp(dataQuality.completeness * 0.3 + businessQuality.confidence * 0.18 + forecastPolicy.confidence * 0.22 + (100 - riskScore) * 0.15 + (modelSelection.selectedModels.length * 5), 15, 94));
  const upsideScore = Number.isFinite(upside) ? clamp(50 + upside * 150, 0, 100) : 25;
  const investmentScore = Math.round(clamp(upsideScore * 0.38 + businessQuality.score * 0.22 + dataQuality.completeness * 0.18 + forecastPolicy.confidence * 0.12 + (100 - riskScore) * 0.1, 0, 100));
  return {
    recommendation: decision,
    status,
    confidence,
    investmentScore,
    fairValue,
    upside,
    conservativeUpside,
    optimisticUpside,
    riskScore,
    policyGates: gates,
    why: recommendationWhy(decision, upside, businessQuality, forecastPolicy, dataQuality, riskScore, language),
    whyNot: recommendationWhyNot(decision, gates, language)
  };
}

function buildMonitoringChecklist(evidence, classification, forecastPolicy, language) {
  const v = evidence.values;
  const baseRevenueGrowth = forecastPolicy.yearlyForecast[0]?.revenueGrowth ?? null;
  const baseMargin = forecastPolicy.yearlyForecast[0]?.operatingMargin ?? null;
  const baseFcf = forecastPolicy.yearlyForecast[0]?.freeCashFlow ?? null;
  const common = [
    monitorItem("Revenue", v.revenue, rangeAroundGrowth(v.revenue, baseRevenueGrowth), "Revenue beats Base case by 3%+", "Revenue misses Base case by 3%+", "Two consecutive Revenue misses", "Quarterly results"),
    monitorItem("Operating Margin", safeDiv(v.operatingIncome, v.revenue), rangeAround(baseMargin, 0.015), "Operating Margin expands above Base", "Operating Margin compresses below Conservative", "Permanent margin reset", "Margin guidance update"),
    monitorItem("FCF", v.freeCashFlow, rangeAround(baseFcf, Math.abs(baseFcf || 0) * 0.12), "FCF conversion improves", "FCF falls below Conservative", "FCF turns structurally negative", "Cash flow statement"),
    monitorItem("CapEx", v.capex, rangeAround(v.capex, Math.abs(v.capex || 0) * 0.15), "CapEx discipline improves FCF", "CapEx intensity rises without growth", "Investment cycle consumes FCF", "CapEx guidance"),
    monitorItem("Cash / Debt", (v.cash || 0) - (v.totalDebt || 0), null, "Net cash improves", "Net debt rises faster than EBITDA", "Financing risk becomes material", "Balance sheet update"),
    monitorItem("Diluted Shares", v.dilutedShares, rangeAround(v.dilutedShares, (v.dilutedShares || 0) * 0.02), "Buybacks reduce share count", "Dilution exceeds Base", "Dilution becomes structural", "Share count update")
  ];
  if (classification.classification.includes("Growth") || classification.classification === "Early Stage / Pre-Profit") {
    common.push(monitorItem("Guidance / bookings", v.revenueGuidance || v.managementGrowthGuidance || null, null, "Guidance raised", "Guidance cut", "Growth thesis breaks", "Earnings call"));
  } else if (classification.classification === "Financial Institution") {
    common.push(monitorItem("Credit / ROE evidence", v.equity || null, null, "ROE and credit improve", "Credit costs rise", "Capital adequacy weakens", "Quarterly financials"));
  } else if (classification.classification === "REIT") {
    common.push(monitorItem("Occupancy / rent evidence", v.userNotes || null, null, "Occupancy or rent spreads improve", "Debt cost or occupancy worsens", "Distribution coverage breaks", "Quarterly REIT update"));
  } else {
    common.push(monitorItem("Competitive position", v.competitiveAdvantages || null, null, "Moat evidence strengthens", "Market share or pricing weakens", "Competitive advantage erodes", "Research update"));
  }
  return common.slice(0, 8).map((item) => ({
    ...item,
    focus: text(language, `${item.metric}: راقب الانحراف عن Base case.`, `${item.metric}: monitor variance versus Base case.`)
  }));
}

function buildReport({ workspace, evidence, classification, businessQuality, forecastPolicy, scenarios, modelSelection, dataQuality, recommendation, monitoringChecklist, language, valuationDate }) {
  const v = evidence.values;
  const rangeFairValue = scenarioExpectedValue(scenarios);
  const fairValue = recommendation.fairValue;
  const expectedUpside = recommendation.upside;
  const maximumUpside = calculateUpside(highestValue([scenarios.Conservative?.fairValue, scenarios.Base?.fairValue, scenarios.Optimistic?.fairValue, v.morningstarFairValue, v.analystTargetAverage]), v.currentPrice);
  const valuationResults = modelSelection.selectedModels.map((model) => ({
    method: model.method,
    role: model.role,
    value: model.fairValue,
    weight: model.weight,
    confidence: model.confidence,
    source: model.source,
    assumptions: model.assumptions,
    fairValue: model.fairValue,
    explanation: model.explanation
  }));
  const changeTriggers = whatChangesMyMind(forecastPolicy, recommendation, language);
  const finalDecision = {
    decision: recommendation.recommendation,
    why: recommendation.why,
    whyNot: recommendation.whyNot,
    mainPositiveDrivers: positiveDrivers(modelSelection, businessQuality, expectedUpside, language),
    mainNegativeDrivers: negativeDrivers(dataQuality, recommendation, language),
    dataLimitations: dataQuality.missingData,
    biggestAssumption: biggestAssumption(forecastPolicy, language),
    whatChangesTheDecision: changeTriggers.items,
    policyGates: recommendation.policyGates
  };
  const report = {
    schemaVersion: "analyst-brain-output-schema-1.1.0",
    methodologyVersion: CANONICAL_METHODOLOGY_VERSION,
    analystBrainVersion: ANALYST_BRAIN_VERSION,
    language,
    company: {
      ticker: v.ticker || workspace.ticker || "",
      name: v.companyName || workspace.companyName || "",
      valuationDate,
      currentPrice: v.currentPrice ?? null,
      currency: v.currency || "USD",
      sector: v.sector || "",
      industry: v.industry || ""
    },
    companyAndValuationDate: {
      ticker: v.ticker || workspace.ticker || "",
      companyName: v.companyName || workspace.companyName || "",
      valuationDate,
      currentPrice: v.currentPrice ?? null,
      currency: v.currency || "USD"
    },
    executiveDecision: {
      recommendation: recommendation.recommendation,
      confidence: recommendation.confidence,
      investmentScore: recommendation.investmentScore,
      currentPrice: v.currentPrice ?? null,
      fairValue,
      upsideDownside: expectedUpside,
      why: recommendation.why
    },
    executiveConclusion: {
      recommendation: recommendation.recommendation,
      confidence: recommendation.confidence,
      currentPrice: v.currentPrice ?? null,
      bearFairValue: scenarios.Conservative?.fairValue ?? null,
      baseFairValue: scenarios.Base?.fairValue ?? null,
      bullFairValue: scenarios.Optimistic?.fairValue ?? null,
      morningstarFairValue: v.morningstarFairValue ?? null,
      rangeFairValue: fairValue,
      expectedUpside,
      maximumUpside,
      investmentScore: recommendation.investmentScore,
      why: recommendation.why
    },
    dataQuality,
    classification,
    companyClassification: {
      classification: classification.classification,
      reason: classification.reason,
      suitableValuationModels: classification.suitableModels,
      excludedModels: [...classification.excludedModels, ...classification.unsupportedModels]
    },
    businessQuality,
    financialPerformanceReview: financialPerformanceReview(evidence, language),
    modelSelection,
    forecastAssumptions: {
      sourcePriority: SOURCE_PRIORITY,
      yearlyForecast: forecastPolicy.yearlyForecast,
      wacc: forecastPolicy.wacc,
      sensitivity: forecastPolicy.sensitivity,
      confidence: forecastPolicy.confidence,
      revenueGrowth: forecastPolicy.revenueGrowth,
      marginForecast: forecastPolicy.operatingMargin,
      capex: forecastPolicy.capex,
      workingCapital: forecastPolicy.workingCapital,
      taxRate: forecastPolicy.taxRate,
      terminalGrowth: forecastPolicy.terminalGrowth,
      dilution: forecastPolicy.dilution
    },
    assumptionRationale: assumptionRationale(forecastPolicy, language),
    valuationResults,
    valuationModels: valuationResults.map((model) => ({
      method: model.method,
      assumptions: model.assumptions,
      weight: model.weight,
      confidence: model.confidence,
      fairValue: model.fairValue,
      explanation: model.explanation
    })),
    scenarios,
    bearScenario: legacyScenario(scenarios.Conservative),
    baseScenario: legacyScenario(scenarios.Base),
    bullScenario: legacyScenario(scenarios.Optimistic),
    catalysts: catalystsFrom(evidence, classification, language),
    risks: risksFrom(evidence, classification, recommendation, language),
    whatChangesMyMind: changeTriggers,
    whatWouldChangeTheValuation: changeTriggers.items,
    finalDecision,
    finalInvestmentDecision: finalDecision,
    monitoringChecklist,
    dashboardExport: {
      approvedOnly: true,
      exported: false,
      ticker: v.ticker || workspace.ticker || "",
      recommendation: recommendation.recommendation,
      currentPrice: v.currentPrice ?? null,
      fairValue,
      rangeFairValue,
      upsideDownside: expectedUpside,
      investmentScore: recommendation.investmentScore,
      confidence: recommendation.confidence,
      dataQuality: dataQuality.completeness
    }
  };
  report.validation = validateCanonicalReport(report);
  return report;
}

export function validateCanonicalReport(report) {
  const errors = [];
  if (report.methodologyVersion !== CANONICAL_METHODOLOGY_VERSION) errors.push("Invalid canonical methodology version.");
  const scenarioTotal = ["Conservative", "Base", "Optimistic"].reduce((sum, key) => sum + (toNumber(report.scenarios?.[key]?.probability) || 0), 0);
  if (Math.abs(scenarioTotal - 1) > 0.0001) errors.push("Conservative + Base + Optimistic probabilities must total 100%.");
  const models = report.modelSelection?.selectedModels || [];
  for (const model of models) {
    if (!SUPPORTED_MODELS.includes(model.method)) errors.push(`Unsupported selected model: ${model.method}.`);
    if (!Number.isFinite(toNumber(model.fairValue))) errors.push(`Selected model lacks fair value: ${model.method}.`);
    if (!model.source) errors.push(`Selected model lacks source: ${model.method}.`);
    if (!model.assumptions) errors.push(`Selected model lacks assumptions: ${model.method}.`);
    if ((toNumber(model.weight) || 0) > 0.450001 && !model.overrideReason) errors.push(`Model weight exceeds 45% without override: ${model.method}.`);
  }
  const externalWeight = models.filter((model) => model.role === "external_reference").reduce((sum, model) => sum + (toNumber(model.weight) || 0), 0);
  if (externalWeight > 0.250001) errors.push("External references exceed 25% combined weight.");
  const forecast = report.forecastAssumptions?.yearlyForecast || [];
  if (forecast.length !== 5) errors.push("Year 1-5 forecast is required.");
  for (const row of forecast) {
    for (const key of ["year", "revenueGrowth", "revenue", "operatingMargin", "taxRate", "daToRevenue", "capexToRevenue", "workingCapitalToRevenueGrowth", "dilution", "freeCashFlow"]) {
      if (!Number.isFinite(toNumber(row[key]))) errors.push(`Forecast year ${row.year || "?"} missing ${key}.`);
    }
  }
  if (report.scenarios?.Exceptional?.included === false && Number.isFinite(toNumber(report.scenarios.Exceptional.fairValue))) errors.push("Exceptional fair value must be omitted when not supported.");
  if (!["BUY", "HOLD", "SELL", "INSUFFICIENT_DATA"].includes(report.finalDecision?.decision)) errors.push("Invalid recommendation.");
  if ((report.monitoringChecklist || []).length < 5 || (report.monitoringChecklist || []).length > 8) errors.push("Monitoring checklist must contain 5-8 items.");
  return { valid: errors.length === 0, errors };
}

function addModel(candidates, excluded, result) {
  if (result?.selected) candidates.push(result.model);
  else if (result?.excluded) excluded.push(result.excluded);
}

function valueDcf(v, classification, forecastPolicy, baseScenario, language) {
  if (!positive(v.freeCashFlow) || !positive(v.dilutedShares)) return excluded("DCF", "DCF requires positive FCF and diluted shares.");
  if (["Financial Institution", "REIT", "Holding Company"].includes(classification.classification)) return excluded("DCF", "DCF is not selected for this company type.");
  return selectedModel("DCF", baseScenario.fairValue, "valuation_model", {
    forecast: "Year 1-5 FCF bridge",
    wacc: baseScenario.wacc,
    terminalGrowth: baseScenario.terminalGrowth
  }, forecastPolicy.wacc.confidence / 100, "Deterministic DCF from yearly FCF forecast", language);
}

function valuePe(v, classification, language) {
  if (!positive(v.eps)) return excluded("P/E", "P/E requires positive normalized EPS.");
  const multiple = multipleAssumption(v, classification.classification, "pe", "peerPeMultiple", "P/E");
  return selectedModel("P/E", v.eps * multiple.value, "valuation_model", { eps: v.eps, multiple: multiple.value }, multiple.confidence, multiple.source, language);
}

function valuePeg(v, classification, forecastPolicy, language) {
  if (classification.classification !== "High Growth — Profitable") return excluded("PEG", "PEG is a supporting check only for profitable growth companies.");
  if (!positive(v.eps)) return excluded("PEG", "PEG requires positive normalized EPS.");
  const multiple = multipleAssumption(v, classification.classification, "peg", "peerPegMultiple", "PEG");
  const growthPercent = Math.max(4, (forecastPolicy.yearlyForecast[0]?.revenueGrowth || 0.04) * 100);
  return selectedModel("PEG", v.eps * growthPercent * multiple.value, "valuation_model", { eps: v.eps, growthPercent, peg: multiple.value }, multiple.confidence, multiple.source, language);
}

function valueEvEbitda(v, classification, language) {
  if (["Financial Institution", "REIT"].includes(classification.classification)) return excluded("EV/EBITDA", "EV/EBITDA is not selected for this company type.");
  if (!positive(v.ebitda) || !positive(v.dilutedShares)) return excluded("EV/EBITDA", "EV/EBITDA requires EBITDA and diluted shares.");
  const multiple = multipleAssumption(v, classification.classification, "evEbitda", "peerEvEbitdaMultiple", "EV/EBITDA");
  return selectedModel("EV/EBITDA", equityValueFromEv(v.ebitda * multiple.value, v), "valuation_model", { ebitda: v.ebitda, multiple: multiple.value }, multiple.confidence, multiple.source, language);
}

function valueEvSales(v, classification, language) {
  if (["Financial Institution", "REIT", "Holding Company"].includes(classification.classification)) return excluded("EV/Sales", "EV/Sales is not selected for this company type.");
  if (!positive(v.revenue) || !positive(v.dilutedShares)) return excluded("EV/Sales", "EV/Sales requires Revenue and diluted shares.");
  const multiple = multipleAssumption(v, classification.classification, "evSales", "peerEvSalesMultiple", "EV/Sales");
  return selectedModel("EV/Sales", equityValueFromEv(v.revenue * multiple.value, v), "valuation_model", { revenue: v.revenue, multiple: multiple.value }, multiple.confidence, multiple.source, language);
}

function valueForwardEvSales(v, classification, forecastPolicy, language) {
  if (!classification.classification.includes("Transition") && classification.classification !== "Early Stage / Pre-Profit") return excluded("Forward EV/Sales", "Forward EV/Sales is reserved for transition or early-stage companies.");
  const forwardRevenue = positive(v.revenueEstimates) ? v.revenueEstimates : forecastPolicy.yearlyForecast[0]?.revenue;
  if (!positive(forwardRevenue) || !positive(v.dilutedShares)) return excluded("Forward EV/Sales", "Forward EV/Sales requires forward Revenue and diluted shares.");
  const multiple = multipleAssumption(v, classification.classification, "forwardEvSales", "peerForwardEvSalesMultiple", "Forward EV/Sales");
  return selectedModel("Forward EV/Sales", equityValueFromEv(forwardRevenue * multiple.value, v), "valuation_model", { forwardRevenue, multiple: multiple.value }, multiple.confidence, multiple.source, language);
}

function valuePriceFcf(v, classification, language) {
  if (!positive(v.freeCashFlow) || !positive(v.dilutedShares)) return excluded("Price/FCF", "Price/FCF requires positive FCF and diluted shares.");
  const multiple = multipleAssumption(v, classification.classification, "fcf", "peerPriceFcfMultiple", "Price/FCF");
  return selectedModel("Price/FCF", v.freeCashFlow * multiple.value / v.dilutedShares, "valuation_model", { freeCashFlow: v.freeCashFlow, multiple: multiple.value }, multiple.confidence, multiple.source, language);
}

function externalReference(method, value, currentPrice, language) {
  if (!positive(value)) return excluded(method, `${method} was not supplied.`);
  return selectedModel(method, value, "external_reference", { currentPrice }, 0.75, `${method} supplied by investor/provider`, language);
}

function selectedModel(method, fairValue, role, assumptions, confidence, source, language) {
  if (!positive(fairValue)) return excluded(method, `${method} calculation did not produce a positive fair value.`);
  return {
    selected: true,
    model: {
      method,
      role,
      fairValue,
      value: fairValue,
      baseWeight: MODEL_BASE_WEIGHTS[method] || 0.05,
      weight: 0,
      confidence: clamp(confidence, 0.25, 0.95),
      source,
      assumptions,
      explanation: text(language, `${method} محسوب من مدخلات مؤكدة ومصدر الافتراض ظاهر في التقرير.`, `${method} is calculated from confirmed inputs and the assumption source is visible in the report.`)
    }
  };
}

function excluded(method, why) {
  return { excluded: { method, why } };
}

function applyModelWeights(models) {
  if (!models.length) return [];
  const raw = models.map((model) => ({ ...model, rawWeight: (model.baseWeight || 0.05) * model.confidence }));
  const rawTotal = raw.reduce((sum, model) => sum + model.rawWeight, 0);
  const external = raw.filter((model) => model.role === "external_reference");
  const internal = raw.filter((model) => model.role !== "external_reference");
  const externalRawShare = rawTotal ? external.reduce((sum, model) => sum + model.rawWeight, 0) / rawTotal : 0;
  const externalTarget = external.length ? Math.min(0.25, externalRawShare || 0.25) : 0;
  const internalTarget = internal.length ? 1 - externalTarget : 0;
  return [
    ...distributeWeights(internal, internalTarget, 0.45),
    ...distributeWeights(external, externalTarget, 0.25)
  ].map(({ rawWeight, baseWeight, ...model }) => model);
}

function distributeWeights(models, requestedTotal, cap) {
  if (!models.length || requestedTotal <= 0) return [];
  const targetTotal = Math.min(requestedTotal, models.length * cap);
  const remaining = models.map((model) => ({ ...model, weight: 0, locked: false }));
  let remainingTarget = targetTotal;
  for (let i = 0; i < 8; i += 1) {
    const open = remaining.filter((model) => !model.locked);
    if (!open.length || remainingTarget <= 0) break;
    const openRawTotal = open.reduce((sum, model) => sum + model.rawWeight, 0) || open.length;
    let lockedThisRound = false;
    for (const model of open) {
      const rawShare = model.rawWeight ? model.rawWeight / openRawTotal : 1 / open.length;
      const proposed = remainingTarget * rawShare;
      if (proposed > cap) {
        model.weight = cap;
        model.locked = true;
        remainingTarget -= cap;
        lockedThisRound = true;
      }
    }
    if (!lockedThisRound) {
      for (const model of open) {
        const rawShare = model.rawWeight ? model.rawWeight / openRawTotal : 1 / open.length;
        model.weight = remainingTarget * rawShare;
        model.locked = true;
      }
      break;
    }
  }
  return remaining.map(({ locked, ...model }) => model);
}

function multipleAssumption(v, classification, key, fieldId, label) {
  const supplied = toNumber(v[fieldId]);
  if (Number.isFinite(supplied) && supplied > 0) {
    return { value: supplied, source: `User supplied ${label} peer/historical multiple`, confidence: 0.82 };
  }
  const value = CLASS_DEFAULTS[classification]?.multiple?.[key];
  return { value: value || 1, source: `Methodology default ${label} for ${classification}`, confidence: 0.48 };
}

function assumptionRationale(forecastPolicy, language) {
  return {
    wacc: { value: forecastPolicy.wacc.finalWacc, why: forecastPolicy.wacc.why, source: forecastPolicy.wacc },
    revenueGrowth: { value: forecastPolicy.yearlyForecast[0]?.revenueGrowth ?? null, why: assumptionWhy(forecastPolicy.revenueGrowth, language) },
    fcfGrowth: { value: forecastPolicy.yearlyForecast[0]?.fcfGrowth ?? null, why: text(language, "FCF Growth ينتج من Revenue وOperating Margin وCapEx وWorking Capital سنويًا.", "FCF Growth is produced from yearly Revenue, Operating Margin, CapEx, and Working Capital.") },
    marginForecast: { value: forecastPolicy.yearlyForecast[0]?.operatingMargin ?? null, why: assumptionWhy(forecastPolicy.operatingMargin, language) },
    capex: { value: forecastPolicy.capex.value, why: assumptionWhy(forecastPolicy.capex, language), source: forecastPolicy.capex.source },
    workingCapital: { value: forecastPolicy.workingCapital.value, why: assumptionWhy(forecastPolicy.workingCapital, language) },
    taxRate: { value: forecastPolicy.taxRate.value, why: assumptionWhy(forecastPolicy.taxRate, language) },
    terminalGrowth: { value: forecastPolicy.terminalGrowth.value, why: assumptionWhy(forecastPolicy.terminalGrowth, language) },
    exitMultiple: { value: null, why: text(language, "Exit Multiple لا يستخدم في DCF الحالي إلا إذا كان النموذج مدعومًا بمدخلات كافية.", "Exit Multiple is not used in the current DCF unless the model is supported by sufficient inputs.") },
    dilution: { value: forecastPolicy.dilution.value, why: assumptionWhy(forecastPolicy.dilution, language) }
  };
}

function financialPerformanceReview(evidence, language) {
  const v = evidence.values;
  return {
    revenue: performanceLine(v.revenue, "Revenue", language),
    eps: performanceLine(v.eps, "EPS", language),
    fcf: performanceLine(v.freeCashFlow, "FCF", language),
    margins: performanceLine(safeDiv(v.operatingIncome, v.revenue), "Operating Margin", language),
    roic: performanceLine(null, "ROIC", language),
    balanceSheet: performanceLine((v.cash || 0) - (v.totalDebt || 0), "Net cash / debt", language),
    dilution: performanceLine(v.dilutedShares, "Diluted shares", language),
    capex: performanceLine(v.capex, "CapEx", language)
  };
}

function legacyScenario(scenario) {
  return {
    probability: scenario?.probability ?? null,
    fairValue: scenario?.fairValue ?? null,
    revenueAssumptions: scenario?.revenuePath?.[0] ?? null,
    marginAssumptions: scenario?.margins?.[0] ?? null,
    fcfAssumptions: firstFiniteGrowth(scenario?.forecast, "fcfGrowth"),
    capexAssumptions: scenario?.capex?.[0] ?? null,
    wacc: scenario?.wacc ?? null,
    terminalGrowth: scenario?.terminalGrowth ?? null,
    forecast: scenario?.forecast || [],
    keyRisks: scenario?.mainRisk ? [scenario.mainRisk] : [],
    keyCatalysts: scenario?.keyCatalysts || []
  };
}

function adjustForecast(forecastPolicy, adjustment) {
  return forecastPolicy.yearlyForecast.map((row) => {
    const revenueGrowth = clamp(row.revenueGrowth + adjustment.growth, -0.2, 0.4);
    const operatingMargin = clamp(row.operatingMargin + adjustment.margin, -0.25, 0.5);
    const capexToRevenue = clamp(row.capexToRevenue + adjustment.capex, 0.005, 0.25);
    const revenue = row.year === 1 ? row.revenue / (1 + row.revenueGrowth) * (1 + revenueGrowth) : null;
    return { ...row, revenueGrowth, operatingMargin, capexToRevenue, revenue };
  }).reduce((rows, row, index) => {
    const previousRevenue = index === 0
      ? forecastPolicy.yearlyForecast[0].revenue / (1 + forecastPolicy.yearlyForecast[0].revenueGrowth)
      : rows[index - 1].revenue;
    const revenue = previousRevenue * (1 + row.revenueGrowth);
    const operatingIncome = revenue * row.operatingMargin;
    const tax = Math.max(0, operatingIncome * row.taxRate);
    const nopat = operatingIncome - tax;
    const depreciationAmortization = revenue * row.daToRevenue;
    const capex = revenue * row.capexToRevenue;
    const workingCapitalChange = Math.max(0, revenue - previousRevenue) * row.workingCapitalToRevenueGrowth;
    const freeCashFlow = nopat + depreciationAmortization - capex - workingCapitalChange;
    rows.push({
      ...row,
      revenue,
      operatingIncome,
      tax,
      nopat,
      depreciationAmortization,
      capex,
      workingCapitalChange,
      freeCashFlow,
      fcfGrowth: index > 0 ? (freeCashFlow - rows[index - 1].freeCashFlow) / Math.abs(rows[index - 1].freeCashFlow) : row.fcfGrowth
    });
    return rows;
  }, []);
}

function dcfFairValuePerShare({ forecast, terminalGrowth, wacc, cash, debt, shares }) {
  if (!forecast?.length || !positive(shares)) return null;
  let pv = 0;
  for (const row of forecast) {
    pv += row.freeCashFlow / Math.pow(1 + wacc, row.year);
  }
  const terminalFcf = forecast[forecast.length - 1].freeCashFlow * (1 + terminalGrowth);
  const terminalValue = terminalFcf / Math.max(wacc - terminalGrowth, 0.01);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, forecast.length);
  return (pv + pvTerminal + (cash || 0) - (debt || 0)) / shares;
}

function equityValueFromEv(enterpriseValue, v) {
  if (!positive(enterpriseValue) || !positive(v.dilutedShares)) return null;
  return (enterpriseValue + (v.cash || 0) - (v.totalDebt || 0)) / v.dilutedShares;
}

function selectRevenueGrowth(v, defaults) {
  if (positive(v.revenueEstimates) && positive(v.revenue)) return selectAssumption(clamp(v.revenueEstimates / v.revenue - 1, -0.15, 0.35), defaults.growth, "Revenue Growth", "Analyst estimates", 0.82);
  const guidance = numericGuidance(v.revenueGuidance || v.managementGrowthGuidance);
  if (Number.isFinite(guidance)) return selectAssumption(clamp(guidance, -0.15, 0.35), defaults.growth, "Revenue Growth", "Company guidance", 0.78);
  const inferred = inferredRevenueGrowth(v);
  if (Number.isFinite(inferred)) return selectAssumption(clamp(inferred, -0.15, 0.35), defaults.growth, "Revenue Growth", "Historical/current evidence", 0.62);
  return selectAssumption(defaults.growth, defaults.growth, "Revenue Growth", "Methodology default", 0.48);
}

function selectOperatingMargin(v, defaults) {
  const current = safeDiv(v.operatingIncome, v.revenue);
  const value = Number.isFinite(current) ? clamp(current, -0.2, 0.45) : defaults.margin;
  return {
    value,
    target: Number.isFinite(current) ? clamp((current + defaults.margin) / 2, -0.2, 0.45) : defaults.margin,
    label: "Operating Margin",
    source: Number.isFinite(current) ? "Current Operating Margin" : "Methodology default",
    confidence: Number.isFinite(current) ? 0.72 : 0.48
  };
}

function selectCapex(v, defaults, language) {
  const guidance = numericGuidance(v.capexGuidance);
  if (Number.isFinite(guidance) && positive(v.revenue)) return selectAssumption(Math.abs(guidance) > 1 ? Math.abs(guidance) / v.revenue : Math.abs(guidance), defaults.capex, "CapEx / Revenue", "Company guidance", 0.8);
  const historical = positive(v.capex) && positive(v.revenue) ? Math.abs(v.capex) / v.revenue : null;
  if (Number.isFinite(historical)) return selectAssumption(clamp(historical, 0.005, 0.25), defaults.capex, "CapEx / Revenue", "Historical CapEx / Revenue", 0.76);
  return selectAssumption(defaults.capex, defaults.capex, "CapEx / Revenue", "Methodology default", 0.48);
}

function selectDaToRevenue(v) {
  if (positive(v.ebitda) && Number.isFinite(v.operatingIncome) && positive(v.revenue)) return selectAssumption(clamp((v.ebitda - v.operatingIncome) / v.revenue, 0, 0.12), 0.035, "D&A / Revenue", "EBITDA minus Operating Income", 0.72);
  return selectAssumption(0.035, 0.035, "D&A / Revenue", "Methodology default", 0.45);
}

function selectDilution(v, classification) {
  if (positive(v.stockBasedCompensation) && positive(v.marketCap)) return selectAssumption(clamp(v.stockBasedCompensation / v.marketCap, 0, 0.08), 0.01, "Dilution", "SBC / Market Cap proxy", 0.58);
  const defaultDilution = classification.includes("Transition") || classification === "Early Stage / Pre-Profit" ? 0.02 : 0.004;
  return selectAssumption(defaultDilution, defaultDilution, "Dilution", "Methodology default", 0.45);
}

function selectAssumption(value, fallback, label, source, confidence) {
  const finalValue = Number.isFinite(toNumber(value)) ? toNumber(value) : fallback;
  return { label, value: finalValue, source, confidence };
}

function buildWaccSensitivity(wacc) {
  return [
    { change: -0.01, wacc: Math.max(0.04, wacc - 0.01) },
    { change: 0, wacc },
    { change: 0.01, wacc: wacc + 0.01 }
  ];
}

function scenarioExpectedValue(scenarios) {
  return calculateRangeFairValue({
    bearFairValue: scenarios.Conservative?.fairValue,
    bearProbability: scenarios.Conservative?.probability,
    baseFairValue: scenarios.Base?.fairValue,
    baseProbability: scenarios.Base?.probability,
    bullFairValue: scenarios.Optimistic?.fairValue,
    bullProbability: scenarios.Optimistic?.probability
  });
}

function exceptionalScenario(evidence, optimistic, language) {
  const v = evidence.values;
  const textEvidence = `${v.userNotes || ""} ${v.managementGrowthGuidance || ""} ${v.revenueGuidance || ""} ${v.businessModel || ""}`.toLowerCase();
  const supported = /exceptional|breakthrough|signed backlog|major contract|regulatory approval|monopoly|winner-take-most/.test(textEvidence);
  if (!supported) {
    return {
      included: false,
      fairValue: null,
      probability: 0,
      requiredConditions: text(language, "لا يوجد Exceptional scenario لأن الأدلة لا تدعم حالة استثنائية منفصلة.", "No Exceptional scenario is included because evidence does not support a separate exceptional case."),
      mainRisk: ""
    };
  }
  return {
    included: true,
    fairValue: null,
    probability: 0,
    requiredConditions: text(language, "يوجد دليل استثنائي، لكنه لا يتحول إلى Fair Value حتى يقدم المستثمر افتراضات كمية صريحة ويوافق عليها.", "Exceptional evidence exists, but it does not become a Fair Value until explicit quantitative assumptions are supplied and approved."),
    mainRisk: text(language, "استخدام Exceptional بلا افتراضات كمية معتمدة قد يبالغ في القيمة.", "Using Exceptional without approved quantitative assumptions can overstate value.")
  };
}

function riskScoreFrom(evidence, forecastPolicy, scenarios) {
  const v = evidence.values;
  let score = 35;
  if ((v.totalDebt || 0) > (v.cash || 0)) score += 8;
  if (String(v.customerConcentration || "").trim()) score += 8;
  if (String(v.regulatoryRisks || "").trim()) score += 8;
  if (forecastPolicy.wacc.finalWacc > 0.11) score += 8;
  if ((forecastPolicy.dilution.value || 0) > 0.03) score += 8;
  const downside = calculateUpside(scenarios.Conservative?.fairValue, v.currentPrice);
  if (Number.isFinite(downside) && downside < -0.25) score += 10;
  return clamp(score, 0, 100);
}

function qualityComponent(name, weight, rawScore, evidence = []) {
  const score = clamp(rawScore, 0, 10);
  return { name, weight, score: Math.round(score * 10), points: score / 10 * weight, evidence };
}

function scoreBusinessModel(v, classification) {
  if (/subscription|recurring|platform|mission critical/i.test(`${v.businessModel || ""} ${v.userNotes || ""}`)) return 8;
  if (classification.classification === "Commodity" || classification.classification === "Cyclical") return 5;
  return v.businessModel ? 6 : 4;
}

function scoreRevenueQuality(v) {
  if (!positive(v.revenue)) return 2;
  if (/recurring|subscription|contract/i.test(`${v.businessModel || ""} ${v.revenueGuidance || ""}`)) return 8;
  return 6;
}

function scoreMoat(v) {
  const moatText = `${v.morningstarMoat || ""} ${v.competitiveAdvantages || ""}`.toLowerCase();
  if (/wide|network|switching|brand|scale/.test(moatText)) return 8.5;
  if (/narrow|patent|cost advantage|advantage/.test(moatText)) return 6.5;
  return 4;
}

function scoreGrowthVisibility(v) {
  if (v.revenueGuidance || v.revenueEstimates || v.managementGrowthGuidance) return 7.5;
  if (positive(v.revenue)) return 5;
  return 2;
}

function scoreManagement(v) {
  const textValue = `${v.managementNotes || ""} ${v.capitalAllocation || ""}`.toLowerCase();
  if (/excellent|strong|disciplined|shareholder|exemplary/.test(textValue)) return 8;
  if (textValue) return 6;
  return 4.5;
}

function scoreCapitalAllocation(v) {
  if (positive(v.shareBuybacks) || /exemplary|disciplined|shareholder/i.test(`${v.capitalAllocation || ""}`)) return 7.5;
  if (positive(v.dividends)) return 6.5;
  return 4.5;
}

function scoreRiskResilience(v) {
  if (v.customerConcentration || v.regulatoryRisks) return 4;
  if ((v.cash || 0) > (v.totalDebt || 0)) return 7;
  return 5;
}

function ratioScore(value, levels) {
  if (!Number.isFinite(value)) return 3;
  const [poor, weak, good, excellent] = levels;
  if (value >= excellent) return 9;
  if (value >= good) return 7;
  if (value >= weak) return 5;
  if (value >= poor) return 3;
  return 1;
}

function qualityRating(score) {
  if (score >= 85) return "Exceptional";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Acceptable";
  if (score >= 40) return "Weak";
  return "Poor";
}

function dataCoverage(evidence) {
  const useful = ["ticker", "companyName", "currentPrice", "revenue", "operatingIncome", "freeCashFlow", "dilutedShares", "cash", "totalDebt", "eps", "ebitda", "grossProfit"];
  return useful.filter((key) => evidence.present.has(key)).length / useful.length;
}

function inferredRevenueGrowth(v) {
  const guidance = numericGuidance(v.revenueGuidance || v.managementGrowthGuidance);
  if (Number.isFinite(guidance)) return guidance;
  if (positive(v.revenueEstimates) && positive(v.revenue)) return v.revenueEstimates / v.revenue - 1;
  return null;
}

function numericGuidance(value) {
  if (value === null || value === undefined || value === "") return null;
  const textValue = String(value);
  const percentMatch = textValue.match(/(-?\d+(?:\.\d+)?)\s?%/);
  if (percentMatch) return Number(percentMatch[1]) / 100;
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) > 1 ? null : parsed;
}

function capitalWeight(v, type) {
  const marketCap = v.marketCap || (positive(v.currentPrice) && positive(v.dilutedShares) ? v.currentPrice * v.dilutedShares : null);
  const debt = positive(v.totalDebt) ? v.totalDebt : 0;
  const capital = (marketCap || 0) + debt;
  if (!capital) return type === "debt" ? 0.08 : 0.92;
  return type === "debt" ? debt / capital : (marketCap || 0) / capital;
}

function lastForecastShares(forecast) {
  return forecast?.[forecast.length - 1]?.dilutedShares || null;
}

function firstFiniteGrowth(forecast = [], key) {
  return forecast.map((row) => row[key]).find(Number.isFinite) ?? null;
}

function performanceLine(value, label, language) {
  if (!Number.isFinite(toNumber(value))) return text(language, `${label}: غير متوفر من بيانات مؤكدة.`, `${label}: not available from confirmed data.`);
  return `${label}: ${formatNumber(value)}`;
}

function assumptionWhy(item, language) {
  return text(language, `${item.label} مصدره ${item.source} بثقة ${Math.round(item.confidence * 100)}%.`, `${item.label} comes from ${item.source} with ${Math.round(item.confidence * 100)}% confidence.`);
}

function recommendationWhy(decision, upside, businessQuality, forecastPolicy, dataQuality, riskScore, language) {
  const upsideText = Number.isFinite(upside) ? formatPercent(upside) : "غير متوفر";
  if (decision === "INSUFFICIENT_DATA") return text(language, "البيانات أو النماذج الصالحة لا تكفي لإصدار توصية قابلة للتنفيذ.", "Data or valid models are insufficient for an actionable recommendation.");
  return text(language,
    `${decision} لأن هامش الأمان ${upsideText}، Business Quality ${businessQuality.score}/100، Forecast Confidence ${forecastPolicy.confidence}%، Data Quality ${dataQuality.completeness}/100، وRisk Score ${Math.round(riskScore)}/100.`,
    `${decision} because margin of safety is ${upsideText}, Business Quality is ${businessQuality.score}/100, Forecast Confidence is ${forecastPolicy.confidence}%, Data Quality is ${dataQuality.completeness}/100, and Risk Score is ${Math.round(riskScore)}/100.`);
}

function recommendationWhyNot(decision, gates, language) {
  const failed = Object.entries(gates).filter(([, value]) => !value).map(([key]) => key);
  if (decision === "BUY") return text(language, "ليست توصية شراء غير مشروطة؛ تعتمد على تحقق الافتراضات ومراقبة مؤشرات المتابعة.", "This is not an unconditional Buy; it depends on assumptions holding and monitoring indicators.");
  if (decision === "SELL") return text(language, "قد يتغير القرار إذا تحسن FCF أو انخفض WACC أو ظهرت أدلة جودة أقوى.", "The decision can change if FCF improves, WACC falls, or stronger quality evidence appears.");
  if (decision === "INSUFFICIENT_DATA") return text(language, `القيود الأساسية: ${failed.join(", ") || "missing model evidence"}.`, `Primary blockers: ${failed.join(", ") || "missing model evidence"}.`);
  return text(language, `HOLD لأن بعض بوابات السياسة لم تعط إشارة كافية: ${failed.join(", ") || "margin of safety"}.`, `HOLD because some policy gates are not strong enough: ${failed.join(", ") || "margin of safety"}.`);
}

function whatChangesMyMind(forecastPolicy, recommendation, language) {
  return {
    items: [
      text(language, "تغير WACC بأكثر من 100 نقطة أساس.", "WACC changes by more than 100 bps."),
      text(language, "Revenue Growth أو Operating Margin يبتعدان عن Base case.", "Revenue Growth or Operating Margin diverges from Base case."),
      text(language, "FCF أو CapEx يخالفان مسار Year 1-5.", "FCF or CapEx diverges from the Year 1-5 path."),
      text(language, "Dilution أو Balance Sheet يضعفان بشكل جوهري.", "Dilution or Balance Sheet weakens materially.")
    ],
    biggestAssumption: biggestAssumption(forecastPolicy, language),
    upgradeTrigger: text(language, "يرتفع القرار إذا تحسن هامش الأمان مع ثبات Business Quality وForecast Confidence.", "Upgrade if margin of safety improves while Business Quality and Forecast Confidence hold."),
    downgradeTrigger: text(language, "ينخفض القرار إذا ضغطت الهوامش أو ارتفع WACC أو تدهور FCF.", "Downgrade if margins compress, WACC rises, or FCF deteriorates."),
    thesisBreak: text(language, "تنكسر الفرضية إذا أصبحت افتراضات Base غير قابلة للتحقق.", "Thesis breaks if Base assumptions become unachievable."),
    revaluationRequired: text(language, "أعد التقييم بعد النتائج الفصلية أو Guidance جديدة أو تغير سعر كبير.", "Revalue after quarterly results, new Guidance, or a major price change.")
  };
}

function biggestAssumption(forecastPolicy, language) {
  return text(language, "أكبر افتراض هو تفاعل Revenue Growth وOperating Margin مع WACC في نموذج DCF.", "The biggest assumption is the interaction of Revenue Growth and Operating Margin with WACC in DCF.");
}

function positiveDrivers(modelSelection, businessQuality, upside, language) {
  return [
    modelSelection.selectedModels.length >= 2 ? text(language, "أكثر من نموذج صالح يدعم التقييم.", "Multiple valid models support the valuation.") : "",
    businessQuality.score >= 70 ? "Business Quality" : "",
    Number.isFinite(upside) && upside > 0 ? "Margin of Safety" : ""
  ].filter(Boolean);
}

function negativeDrivers(dataQuality, recommendation, language) {
  return [
    dataQuality.missingData.length ? text(language, `بيانات ناقصة: ${dataQuality.missingData.join(", ")}.`, `Missing data: ${dataQuality.missingData.join(", ")}.`) : "",
    recommendation.riskScore > 60 ? "Risk" : "",
    recommendation.recommendation === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : ""
  ].filter(Boolean);
}

function catalystsFrom(evidence, classification, language) {
  const v = evidence.values;
  return [
    text(language, "تحقق Revenue Growth وGuidance يدعم Fair Value.", "Revenue Growth and Guidance delivery support Fair Value."),
    positive(v.freeCashFlow) ? "FCF conversion" : "",
    classification.classification.includes("Growth") ? text(language, "تحسن الهوامش مع النمو يرفع السيناريو.", "Margin improvement with growth lifts the scenario.") : ""
  ].filter(Boolean);
}

function risksFrom(evidence, classification, recommendation, language) {
  const v = evidence.values;
  return [
    text(language, "ارتفاع WACC أو ضغط Operating Margin يخفض Fair Value.", "Higher WACC or Operating Margin pressure lowers Fair Value."),
    (v.totalDebt || 0) > (v.cash || 0) ? text(language, "صافي الدين يزيد حساسية التقييم.", "Net debt increases valuation sensitivity.") : "",
    v.customerConcentration ? "Customer concentration" : "",
    v.regulatoryRisks ? "Regulation" : ""
  ].filter(Boolean);
}

function monitorItem(metric, currentValue, expectedRange, upgradeTrigger, downgradeTrigger, thesisBreak, revaluationEvent) {
  return { metric, currentValue: currentValue ?? null, expectedRange, upgradeTrigger, downgradeTrigger, thesisBreak, revaluationEvent };
}

function rangeAround(value, delta) {
  if (!Number.isFinite(toNumber(value))) return null;
  const spread = Number.isFinite(delta) && delta !== 0 ? Math.abs(delta) : Math.abs(value) * 0.1;
  return [value - spread, value + spread];
}

function rangeAroundGrowth(value, growth) {
  if (!Number.isFinite(toNumber(value)) || !Number.isFinite(growth)) return null;
  const target = value * (1 + growth);
  return rangeAround(target, Math.abs(target) * 0.03);
}

function scenarioConditions(name, fairValue, language) {
  const value = Number.isFinite(fairValue) ? formatNumber(fairValue) : "-";
  if (name === "Conservative") return text(language, `لتبرير ${value} يجب أن تصمد Revenue وFCF رغم ضغط الهوامش وارتفاع WACC.`, `To justify ${value}, Revenue and FCF must hold despite margin pressure and higher WACC.`);
  if (name === "Optimistic") return text(language, `لتبرير ${value} يجب أن يتحسن Growth وOperating Margin مع انضباط CapEx.`, `To justify ${value}, Growth and Operating Margin must improve with disciplined CapEx.`);
  return text(language, `لتبرير ${value} يجب أن تتحقق افتراضات Base في Revenue وFCF وWACC.`, `To justify ${value}, Base assumptions for Revenue, FCF, and WACC must be delivered.`);
}

function scenarioRisk(name, classification, language) {
  if (name === "Conservative") return text(language, `الخطر الرئيسي هو ضغط الهوامش أو ارتفاع WACC في تصنيف ${classification}.`, `The main risk is margin pressure or higher WACC for ${classification}.`);
  return text(language, "الخطر الرئيسي هو فشل الافتراضات التشغيلية مقابل Base case.", "The main risk is operating assumptions failing versus Base case.");
}

function scenarioCatalysts(name, language) {
  if (name === "Optimistic") return [text(language, "تحسن الهوامش واستدامة FCF يرفعان Fair Value.", "Margin improvement and durable FCF lift Fair Value.")];
  return [text(language, "تحقق Guidance واستقرار الهوامش يدعمان السيناريو.", "Guidance delivery and margin stability support the scenario.")];
}

function exclusionReason(method, classification, v) {
  if (method === "DCF" && !positive(v.freeCashFlow)) return "DCF requires positive FCF.";
  if (method === "P/E" && !positive(v.eps)) return "P/E requires positive normalized EPS.";
  if (method === "PEG" && (!positive(v.eps) || classification !== "High Growth — Profitable")) return "PEG requires profitable growth evidence.";
  if (method === "EV/EBITDA" && !positive(v.ebitda)) return "EV/EBITDA requires EBITDA.";
  if ((method === "EV/Sales" || method === "Forward EV/Sales") && !positive(v.revenue)) return `${method} requires Revenue.`;
  if (method === "Price/FCF" && !positive(v.freeCashFlow)) return "Price/FCF requires positive FCF.";
  if (method === "Morningstar Fair Value" && !positive(v.morningstarFairValue)) return "Morningstar Fair Value was not supplied.";
  if (method === "Analyst Consensus" && !positive(v.analystTargetAverage)) return "Analyst Consensus was not supplied.";
  return `${method} is not suitable for ${classification}.`;
}

function numericField(fieldId) {
  return !["ticker", "companyName", "currency", "sector", "industry", "currentDate", "annualPeriods", "quarterlyPeriods", "revenueGuidance", "epsGuidance", "marginGuidance", "capexGuidance", "managementGrowthGuidance", "otherGuidance", "estimateRange", "morningstarMoat", "capitalAllocation", "uncertaintyRating", "starRating", "morningstarBullCase", "morningstarBaseCase", "morningstarBearCase", "morningstarKeyRisks", "analystResearchSummary", "researchDate", "businessModel", "competitiveAdvantages", "mainCompetitors", "customerConcentration", "geographicExposure", "regulatoryRisks", "managementNotes", "userNotes"].includes(fieldId);
}

function usable(item) {
  return Boolean(item && !item.rejected && !item.notAvailable && item.userConfirmed && item.value !== null && item.value !== undefined && item.value !== "");
}

function positive(value) {
  return Number.isFinite(toNumber(value)) && toNumber(value) > 0;
}

function negative(value) {
  return Number.isFinite(toNumber(value)) && toNumber(value) < 0;
}

function text(language, ar, en) {
  return language === "ar" ? ar : en;
}

function formatNumber(value) {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return "-";
  return Math.abs(parsed) >= 1000 ? parsed.toLocaleString("en-US", { maximumFractionDigits: 0 }) : parsed.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-";
}
