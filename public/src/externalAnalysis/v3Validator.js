import {
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_V3_ANALYSIS_TYPES,
  FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS,
  FRANKLIN_V3_CONFIDENCE_LEVELS,
  FRANKLIN_V3_DECISION_ACTIONS,
  FRANKLIN_V3_DECISION_SCOPES,
  FRANKLIN_V3_FORECAST_BASIS,
  FRANKLIN_V3_FORECAST_MATERIALITY,
  FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS,
  FRANKLIN_V3_GUIDANCE_DIRECTIONS,
  FRANKLIN_V3_IMPORTANCE_LEVELS,
  FRANKLIN_V3_INITIAL_REVIEW_STATUS,
  FRANKLIN_V3_MARKET_PRICE_TYPES,
  FRANKLIN_V3_METRIC_RESULTS,
  FRANKLIN_V3_NEXT_REQUIREMENT_MODES,
  FRANKLIN_V3_REQUIREMENT_OVERALL_STATUSES,
  FRANKLIN_V3_REQUIREMENT_STATUSES,
  FRANKLIN_V3_REQUIREMENT_TYPES,
  FRANKLIN_V3_REVALUATION_REVIEW_STATUSES,
  FRANKLIN_V3_SECURITY_UNITS,
  FRANKLIN_V3_SOURCE_TYPES,
  FRANKLIN_V3_TARGET_SCENARIOS,
  FRANKLIN_V3_THESIS_STATUSES,
  FRANKLIN_V3_VALUATION_ROLES,
  isFranklinV3Report,
  reportPeriodFromV3Identity
} from "./v3Contract.js";
import { validateArabicNarrativeQuality } from "./arabicNarrativeQuality.js";
import {
  FRANKLIN_FISCAL_QUARTER_FORMAT,
  fiscalQuarterPeriodsEqual,
  isCanonicalFiscalQuarterPeriod,
  nextFiscalQuarterPeriod,
  normalizeFiscalQuarterPeriod
} from "./fiscalQuarterPeriod.js";

const WEIGHT_TOLERANCE = 0.01;
const ASSESSMENT_TOLERANCE = 0.1;
const REPORTED_PERCENTAGE_TOLERANCE = 0.5;
const V3_TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "methodologyVersion",
  "analysisType",
  "outputLanguage",
  "companyGlossary",
  "reportIdentity",
  "company",
  "companyProfile",
  "dataQuality",
  "classification",
  "businessQuality",
  "strengths",
  "weaknesses",
  "marketPrice",
  "latestQuarter",
  "financialNormalization",
  "forecast",
  "previousRequirementsEvaluation",
  "valuation",
  "thesis",
  "decision",
  "nextRequirements",
  "risks",
  "catalysts",
  "monitoringChecklist",
  "sources",
  "limitations",
  "audit"
]);

export function validateFranklinV3Report(input = {}, context = {}) {
  const errors = [];
  const warnings = [];
  if (!isFranklinV3Report(input)) {
    errors.push(fieldError("schemaVersion", `schemaVersion must be ${FRANKLIN_FAIR_VALUE_SCHEMA_VERSION}.`));
    return { valid: false, errors, warnings };
  }
  if (input.methodologyVersion !== FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION) {
    errors.push(fieldError("methodologyVersion", `methodologyVersion must be ${FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION}.`));
  }
  if (!FRANKLIN_V3_ANALYSIS_TYPES.includes(input.analysisType)) {
    errors.push(fieldError("analysisType", "analysisType must be INITIAL or EARNINGS_REVALUATION."));
  }

  validateUnknownTopLevelFields(input, errors);
  validateRequiredSections(input, errors);
  validateFiscalIdentity(input, context, errors);
  validateDateChronology(input, errors);
  validateQualityAndClassification(input, errors);
  validateLatestQuarter(input, errors);
  validateFinancialNormalization(input, errors, warnings);
  validateForecast(input, errors);
  validateCompanyAndMarket(input, errors);
  validateValuation(input, errors, warnings);
  validateDecisionAndThesis(input, errors);
  validateNextRequirements(input, errors);
  validateAuditTotals(input, errors);
  validateSources(input, errors);
  const languageQuality = validateArabicNarrativeQuality(input);
  errors.push(...languageQuality.errors);
  warnings.push(...languageQuality.warnings);

  if (input.analysisType === "INITIAL") validateInitialRules(input, errors);
  if (input.analysisType === "EARNINGS_REVALUATION") validateEarningsRevaluationRules(input, context, errors, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

function validateUnknownTopLevelFields(input, errors) {
  for (const key of Object.keys(input || {})) {
    if (!V3_TOP_LEVEL_FIELDS.has(key)) {
      errors.push(fieldError(key, `Unknown top-level property ${key} is not allowed by ${FRANKLIN_FAIR_VALUE_SCHEMA_VERSION}.`));
    }
  }
}

export function calculateV3RequirementAssessment(requirements = []) {
  const items = Array.isArray(requirements) ? requirements : [];
  const totalRequirements = items.length;
  const totalWeight = sumWeights(items);
  let reportedRequirements = 0;
  let reportedWeight = 0;
  let earnedWeight = 0;
  const buckets = {
    EXCEEDED: 0,
    PASSED: 0,
    PARTIALLY_PASSED: 0,
    FAILED: 0,
    NOT_REPORTED: 0
  };

  for (const item of items) {
    const status = String(item?.status || "NOT_REPORTED").toUpperCase();
    const weight = numberOrNull(item?.weight) || 0;
    if (Object.hasOwn(buckets, status)) buckets[status] += weight;
    if (status === "NOT_REPORTED") continue;
    reportedRequirements += 1;
    reportedWeight += weight;
    if (status === "PASSED" || status === "EXCEEDED") earnedWeight += weight;
    if (status === "PARTIALLY_PASSED") earnedWeight += weight * ((numberOrNull(item?.partialCreditPct) || 0) / 100);
  }

  return {
    reportedRequirements,
    totalRequirements,
    coverageWeightPct: totalWeight > 0 ? (reportedWeight / totalWeight) * 100 : null,
    achievementOfReportedWeightPct: reportedWeight > 0 ? (earnedWeight / reportedWeight) * 100 : null,
    achievementOfTotalWeightPct: totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : null,
    exceededWeightPct: buckets.EXCEEDED,
    passedWeightPct: buckets.PASSED,
    partialWeightPct: buckets.PARTIALLY_PASSED,
    failedWeightPct: buckets.FAILED,
    notReportedWeightPct: buckets.NOT_REPORTED
  };
}

function validateRequiredSections(input, errors) {
  for (const section of [
    "reportIdentity",
    "company",
    "companyProfile",
    "dataQuality",
    "classification",
    "businessQuality",
    "marketPrice",
    "latestQuarter",
    "forecast",
    "valuation",
    "thesis",
    "decision",
    "nextRequirements",
    "audit"
  ]) {
    if (!input[section] || typeof input[section] !== "object" || Array.isArray(input[section])) {
      errors.push(fieldError(section, `${section} is required in the v3 canonical report.`));
    }
  }
  for (const section of ["strengths", "weaknesses", "risks", "catalysts", "monitoringChecklist", "sources", "limitations"]) {
    if (!Array.isArray(input[section])) errors.push(fieldError(section, `${section} must be an array.`));
  }
}

function validateFiscalIdentity(input, context, errors) {
  const identity = input.reportIdentity || {};
  if (!validTicker(identity.ticker)) errors.push(fieldError("reportIdentity.ticker", "Ticker is required."));
  if (!["Q1", "Q2", "Q3", "Q4"].includes(identity.fiscalQuarter)) errors.push(fieldError("reportIdentity.fiscalQuarter", "fiscalQuarter must be exactly Q1, Q2, Q3, or Q4."));
  if (!Number.isInteger(identity.fiscalYear) || identity.fiscalYear < 2000 || identity.fiscalYear > 2100) errors.push(fieldError("reportIdentity.fiscalYear", "fiscalYear must be an integer between 2000 and 2100."));
  if (!validDate(identity.analysisDate)) errors.push(fieldError("reportIdentity.analysisDate", "analysisDate is required."));
  if (identity.periodEndDate && !validDate(identity.periodEndDate)) errors.push(fieldError("reportIdentity.periodEndDate", "periodEndDate must be valid when present."));
  if (identity.earningsReleaseDate && !validDate(identity.earningsReleaseDate)) errors.push(fieldError("reportIdentity.earningsReleaseDate", "earningsReleaseDate must be valid when present."));

  if (context.expectedTicker && normalizeTicker(identity.ticker) !== normalizeTicker(context.expectedTicker)) {
    errors.push(fieldError("reportIdentity.ticker", `Ticker mismatch. Expected ${context.expectedTicker}, received ${identity.ticker}.`));
  }
  const expectedPeriod = context.expectedReportPeriod || null;
  if (expectedPeriod && !fiscalQuarterPeriodsEqual(reportPeriodFromV3Identity(identity), expectedPeriod)) {
    errors.push(fieldError("reportIdentity", `Fiscal identity mismatch. Expected ${expectedPeriod}, received ${reportPeriodFromV3Identity(identity) || "unspecified"}.`));
  }
}

function validateDateChronology(input, errors) {
  const identity = input.reportIdentity || {};
  const analysisTime = dateTime(identity.analysisDate);
  const periodEndTime = dateTime(identity.periodEndDate);
  const releaseTime = dateTime(identity.earningsReleaseDate);
  const marketTime = dateTime(input.marketPrice?.asOf);

  if (input.analysisType === "EARNINGS_REVALUATION") {
    if (!validDate(identity.periodEndDate)) errors.push(fieldError("reportIdentity.periodEndDate", "periodEndDate is required for EARNINGS_REVALUATION."));
    if (!validDate(identity.earningsReleaseDate)) errors.push(fieldError("reportIdentity.earningsReleaseDate", "earningsReleaseDate is required for EARNINGS_REVALUATION."));
    if (!validDate(identity.analysisDate)) errors.push(fieldError("reportIdentity.analysisDate", "analysisDate is required for EARNINGS_REVALUATION."));
  }
  if (periodEndTime && releaseTime && periodEndTime > releaseTime) {
    errors.push(fieldError("reportIdentity.earningsReleaseDate", "earningsReleaseDate must be on or after periodEndDate."));
  }
  if (releaseTime && analysisTime && isAfterAnalysisDate(identity.earningsReleaseDate, identity.analysisDate)) {
    errors.push(fieldError("reportIdentity.analysisDate", "analysisDate must be on or after earningsReleaseDate."));
  }
  if (marketTime && analysisTime && isAfterAnalysisDate(input.marketPrice?.asOf, identity.analysisDate)) {
    errors.push(fieldError("marketPrice.asOf", "marketPrice.asOf must not be later than analysisDate."));
  }
}

function validateQualityAndClassification(input, errors) {
  const dataQuality = input.dataQuality || {};
  const classification = input.classification || {};
  const businessQuality = input.businessQuality || {};
  validateScore("dataQuality.score", dataQuality.score, errors);
  validateEnum("dataQuality.confidence", dataQuality.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS, errors, { optional: true });
  validateEnum("classification.confidence", classification.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS, errors, { optional: true });
  validateScore("businessQuality.score", businessQuality.score, errors);
  validateEnum("businessQuality.confidence", businessQuality.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS, errors, { optional: true });
  for (const [key, value] of Object.entries(businessQuality.components || {})) {
    validateScore(`businessQuality.components.${key}`, value, errors);
  }
  validateNarrativeEnums(input, errors);
}

function validateNarrativeEnums(input, errors) {
  for (const [section, items] of [
    ["strengths", input.strengths],
    ["weaknesses", input.weaknesses]
  ]) {
    for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
      validateEnum(`${section}.${index}.confidence`, item?.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS, errors, { optional: true });
      if (item?.importance !== undefined) validateEnum(`${section}.${index}.importance`, item.importance, FRANKLIN_V3_IMPORTANCE_LEVELS, errors, { optional: true, lowercase: true });
      if (item?.severity !== undefined) validateEnum(`${section}.${index}.severity`, item.severity, FRANKLIN_V3_IMPORTANCE_LEVELS, errors, { optional: true, lowercase: true });
    }
  }
  for (const [index, item] of (Array.isArray(input.risks) ? input.risks : []).entries()) {
    validateEnum(`risks.${index}.severity`, item?.severity, FRANKLIN_V3_IMPORTANCE_LEVELS, errors, { optional: true, lowercase: true });
  }
}

function validateLatestQuarter(input, errors) {
  const latestQuarter = input.latestQuarter || {};
  const metrics = latestQuarter.coreMetrics || {};
  validateExactMetricShape("latestQuarter.coreMetrics.revenue", metrics.revenue, ["actualValue", "unit", "consensusValue", "priorYearValue", "yoyPct", "qoqPct", "result", "sourceId"], errors);
  validateExactMetricShape("latestQuarter.coreMetrics.eps", metrics.eps, ["actualValue", "unit", "consensusValue", "priorYearValue", "yoyPct", "result", "sourceId"], errors);
  validateExactMetricShape("latestQuarter.coreMetrics.grossMarginPct", metrics.grossMarginPct, ["actualValue", "consensusValue", "priorYearValue", "result", "sourceId"], errors);
  validateExactMetricShape("latestQuarter.coreMetrics.operatingMarginPct", metrics.operatingMarginPct, ["actualValue", "consensusValue", "priorYearValue", "result", "sourceId"], errors);
  validateExactMetricShape("latestQuarter.coreMetrics.freeCashFlow", metrics.freeCashFlow, ["actualValue", "unit", "priorYearValue", "yoyPct", "sourceId"], errors);
  validateExactMetricShape("latestQuarter.coreMetrics.cash", metrics.cash, ["actualValue", "unit", "sourceId"], errors);
  validateExactMetricShape("latestQuarter.coreMetrics.debt", metrics.debt, ["actualValue", "unit", "sourceId"], errors);
  validateQuarterMetric("latestQuarter.coreMetrics.revenue", metrics.revenue, ["actualValue", "consensusValue", "priorYearValue", "yoyPct", "qoqPct"], errors, { comparable: true, reconcileYoy: true });
  validateQuarterMetric("latestQuarter.coreMetrics.eps", metrics.eps, ["actualValue", "consensusValue", "priorYearValue", "yoyPct"], errors, { comparable: true, reconcileYoy: true });
  validateQuarterMetric("latestQuarter.coreMetrics.grossMarginPct", metrics.grossMarginPct, ["actualValue", "consensusValue", "priorYearValue"], errors, { comparable: true });
  validateQuarterMetric("latestQuarter.coreMetrics.operatingMarginPct", metrics.operatingMarginPct, ["actualValue", "consensusValue", "priorYearValue"], errors, { comparable: true });
  validateQuarterMetric("latestQuarter.coreMetrics.freeCashFlow", metrics.freeCashFlow, ["actualValue", "priorYearValue", "yoyPct"], errors, { reconcileYoy: true });
  validateQuarterMetric("latestQuarter.coreMetrics.cash", metrics.cash, ["actualValue"], errors);
  validateQuarterMetric("latestQuarter.coreMetrics.debt", metrics.debt, ["actualValue"], errors);
  for (const [index, item] of (Array.isArray(latestQuarter.guidance) ? latestQuarter.guidance : []).entries()) {
    validateEnum(`latestQuarter.guidance.${index}.direction`, item?.direction, FRANKLIN_V3_GUIDANCE_DIRECTIONS, errors, { optional: true, lowercase: true });
  }
  for (const [metric, value] of Object.entries(metrics)) {
    if (value && Object.hasOwn(value, "result")) validateEnum(`latestQuarter.coreMetrics.${metric}.result`, value.result, FRANKLIN_V3_METRIC_RESULTS, errors);
  }
  for (const [index, item] of (Array.isArray(latestQuarter.companySpecificKpis) ? latestQuarter.companySpecificKpis : []).entries()) {
    validateEnum(`latestQuarter.companySpecificKpis.${index}.result`, item?.result, FRANKLIN_V3_METRIC_RESULTS, errors, { optional: true });
    validateEnum(`latestQuarter.companySpecificKpis.${index}.importance`, item?.importance, FRANKLIN_V3_IMPORTANCE_LEVELS, errors, { optional: true, lowercase: true });
  }
  const outlook = latestQuarter.forwardOutlook || {};
  for (const [field, allowed] of Object.entries(FRANKLIN_V3_FORWARD_OUTLOOK_ENUMS)) {
    validateEnum(`latestQuarter.forwardOutlook.${field}`, outlook[field], allowed, errors, { optional: true, lowercase: true });
  }
}

function validateForecast(input, errors) {
  const forecast = input.forecast || {};
  validateEnum("forecast.materiality", forecast.materiality, FRANKLIN_V3_FORECAST_MATERIALITY, errors, { optional: true });
  for (const [index, row] of (Array.isArray(forecast.yearlyForecast) ? forecast.yearlyForecast : []).entries()) {
    for (const metric of ["revenue", "revenueGrowthPct", "eps", "ebitda", "ebitdaMarginPct", "freeCashFlow", "fcfMarginPct"]) {
      validateEnum(`forecast.yearlyForecast.${index}.${metric}.basis`, row?.[metric]?.basis, FRANKLIN_V3_FORECAST_BASIS, errors, { optional: true, lowercase: true });
    }
  }
  for (const [index, item] of (Array.isArray(forecast.changedAssumptions) ? forecast.changedAssumptions : []).entries()) {
    validateEnum(`forecast.changedAssumptions.${index}.direction`, item?.direction, FRANKLIN_V3_CHANGED_ASSUMPTION_DIRECTIONS, errors, { optional: true });
  }
  for (const [index, item] of (Array.isArray(forecast.estimateRevisions) ? forecast.estimateRevisions : []).entries()) {
    if (item?.previousSnapshotDate && !validDate(item.previousSnapshotDate)) errors.push(fieldError(`forecast.estimateRevisions.${index}.previousSnapshotDate`, "previousSnapshotDate must be a valid date."));
    if (item?.updatedSnapshotDate && !validDate(item.updatedSnapshotDate)) errors.push(fieldError(`forecast.estimateRevisions.${index}.updatedSnapshotDate`, "updatedSnapshotDate must be a valid date."));
    const previous = numberOrNull(item?.previousEstimate);
    const updated = numberOrNull(item?.updatedEstimate);
    const suppliedChange = numberOrNull(item?.changePct);
    if (Number.isFinite(previous) && previous !== 0 && Number.isFinite(updated) && Number.isFinite(suppliedChange)) {
      const expectedChange = ((updated / previous) - 1) * 100;
      if (!within(expectedChange, suppliedChange, ASSESSMENT_TOLERANCE)) errors.push(fieldError(`forecast.estimateRevisions.${index}.changePct`, "Estimate revision changePct is arithmetically inconsistent."));
    }
  }
}

function validateFinancialNormalization(input, errors, warnings) {
  const normalization = input.financialNormalization;
  if (!normalization || typeof normalization !== "object" || Array.isArray(normalization)) {
    warnings.push(fieldError("financialNormalization", "Structured financial normalization is missing; valuation reproducibility is reduced."));
    return;
  }
  if (normalization.reportingCurrency && input.company?.reportingCurrency && normalization.reportingCurrency !== input.company.reportingCurrency) {
    errors.push(fieldError("financialNormalization.reportingCurrency", "Financial normalization currency must equal company.reportingCurrency."));
  }
  for (const field of ["revenue", "gaapNetIncome", "adjustedNetIncome", "normalizedNetIncome", "gaapDilutedEps", "adjustedDilutedEps", "normalizedDilutedEps", "dilutedShares", "stockBasedCompensation", "operatingCashFlow", "capitalExpenditure", "workingCapitalChange", "freeCashFlow", "cash", "debt", "netDebt", "taxRatePct"]) {
    const metric = normalization[field];
    if (!metric || typeof metric !== "object" || Array.isArray(metric)) continue;
    if (metric.value !== null && metric.value !== undefined && !Number.isFinite(numberOrNull(metric.value))) {
      errors.push(fieldError(`financialNormalization.${field}.value`, `${field} value must be numeric or null.`));
    }
  }
  const cash = numberOrNull(normalization.cash?.value);
  const debt = numberOrNull(normalization.debt?.value);
  const netDebt = numberOrNull(normalization.netDebt?.value);
  if ([cash, debt, netDebt].every(Number.isFinite) && !within(debt - cash, netDebt, materialAmountTolerance(debt - cash))) {
    errors.push(fieldError("financialNormalization.netDebt.value", "netDebt must equal debt minus cash when the three values use the same basis."));
  }
  const operatingCashFlow = numberOrNull(normalization.operatingCashFlow?.value);
  const capex = numberOrNull(normalization.capitalExpenditure?.value);
  const freeCashFlow = numberOrNull(normalization.freeCashFlow?.value);
  if ([operatingCashFlow, capex, freeCashFlow].every(Number.isFinite) && !within(operatingCashFlow - Math.abs(capex), freeCashFlow, materialAmountTolerance(freeCashFlow))) {
    warnings.push(fieldError("financialNormalization.freeCashFlow.value", "FCF does not reconcile to operating cash flow less absolute capex; explain the definition in reconciliationNotes."));
  }
}

function validateCompanyAndMarket(input, errors) {
  const company = input.company || {};
  const market = input.marketPrice || {};
  const current = input.valuation?.current || {};
  if (!company.reportingCurrency) errors.push(fieldError("company.reportingCurrency", "reportingCurrency is required."));
  if (!company.tradingCurrency) errors.push(fieldError("company.tradingCurrency", "tradingCurrency is required."));
  if (!FRANKLIN_V3_SECURITY_UNITS.includes(company.securityUnit)) errors.push(fieldError("company.securityUnit", "securityUnit is not supported."));
  if (!positiveNumber(market.value)) errors.push(fieldError("marketPrice.value", "marketPrice.value is required and must be positive."));
  if (!market.currency) errors.push(fieldError("marketPrice.currency", "marketPrice.currency is required."));
  if (!validDate(market.asOf)) errors.push(fieldError("marketPrice.asOf", "marketPrice.asOf is required."));
  validateEnum("marketPrice.priceType", market.priceType, FRANKLIN_V3_MARKET_PRICE_TYPES, errors);
  if (!market.sourceId) errors.push(fieldError("marketPrice.sourceId", "marketPrice.sourceId is required."));
  if (!current.currency) errors.push(fieldError("valuation.current.currency", "valuation.current.currency is required."));
  if (!FRANKLIN_V3_SECURITY_UNITS.includes(current.securityUnit)) errors.push(fieldError("valuation.current.securityUnit", "valuation.current.securityUnit is required and must be supported."));
  if (market.currency && company.tradingCurrency && market.currency !== company.tradingCurrency) {
    errors.push(fieldError("marketPrice.currency", "marketPrice.currency must equal company.tradingCurrency."));
  }
  if (current.currency && company.tradingCurrency && current.currency !== company.tradingCurrency) {
    errors.push(fieldError("valuation.current.currency", "valuation.current.currency must equal company.tradingCurrency."));
  }
  if (current.securityUnit && company.securityUnit && current.securityUnit !== company.securityUnit) {
    errors.push(fieldError("valuation.current.securityUnit", "valuation.current.securityUnit must equal company.securityUnit."));
  }
}

function validateValuation(input, errors, warnings) {
  const valuation = input.valuation || {};
  const current = valuation.current || {};
  const bear = numberOrNull(current.bear);
  const base = numberOrNull(current.base);
  const bull = numberOrNull(current.bull);
  if (!Number.isFinite(bear) || bear < 0) errors.push(fieldError("valuation.current.bear", "Bear Fair Value is required and must be >= 0."));
  if (!positiveNumber(base)) errors.push(fieldError("valuation.current.base", "Base Fair Value is required and must be > 0."));
  if (!positiveNumber(bull)) errors.push(fieldError("valuation.current.bull", "Bull Fair Value is required and must be > 0."));
  if (!Number.isFinite(numberOrNull(current.probabilityWeighted))) errors.push(fieldError("valuation.current.probabilityWeighted", "probabilityWeighted Fair Value is required."));
  if ([bear, base, bull].every(Number.isFinite) && !(bear <= base && base <= bull)) {
    errors.push(fieldError("valuation.current", "Bear/Base/Bull Fair Value must be ordered as Bear <= Base <= Bull."));
  }
  if (current.confidence && !FRANKLIN_V3_CONFIDENCE_LEVELS.includes(current.confidence)) {
    errors.push(fieldError("valuation.current.confidence", "valuation.current.confidence is not supported."));
  }

  const scenarios = valuation.scenarios || {};
  const scenarioKeys = Object.keys(scenarios || {});
  const extras = scenarioKeys.filter((key) => !["Bear", "Base", "Bull"].includes(key));
  if (extras.length) errors.push(fieldError("valuation.scenarios", "Scenario set must contain exactly Bear, Base, and Bull."));
  for (const key of ["Bear", "Base", "Bull"]) {
    if (!scenarios[key] || typeof scenarios[key] !== "object") errors.push(fieldError(`valuation.scenarios.${key}`, `${key} scenario is required.`));
    const probability = numberOrNull(scenarios[key]?.probability);
    if (!Number.isFinite(probability) || probability < 0) errors.push(fieldError(`valuation.scenarios.${key}.probability`, `${key} scenario probability must be numeric and >= 0.`));
    if (!Number.isFinite(numberOrNull(scenarios[key]?.fairValue))) errors.push(fieldError(`valuation.scenarios.${key}.fairValue`, `${key} scenario fairValue is required.`));
  }
  if (Number.isFinite(bear) && numberOrNull(scenarios.Bear?.fairValue) !== bear) errors.push(fieldError("valuation.scenarios.Bear.fairValue", "Bear scenario fairValue must match valuation.current.bear."));
  if (Number.isFinite(base) && numberOrNull(scenarios.Base?.fairValue) !== base) errors.push(fieldError("valuation.scenarios.Base.fairValue", "Base scenario fairValue must match valuation.current.base."));
  if (Number.isFinite(bull) && numberOrNull(scenarios.Bull?.fairValue) !== bull) errors.push(fieldError("valuation.scenarios.Bull.fairValue", "Bull scenario fairValue must match valuation.current.bull."));
  assertWeightTotal("valuation.scenarios", ["Bear", "Base", "Bull"].map((key) => scenarios[key]?.probability), errors, "Scenario probabilities must sum to 100%.", { requirePositive: false });

  const weighted = calculateProbabilityWeighted(scenarios);
  const suppliedWeighted = numberOrNull(current.probabilityWeighted);
  if (Number.isFinite(weighted) && Number.isFinite(suppliedWeighted) && !within(weighted, suppliedWeighted, probabilityWeightedTolerance(weighted))) {
    errors.push(fieldError("valuation.current.probabilityWeighted", "probabilityWeighted Fair Value arithmetic is inconsistent."));
  }

  validateValuationMethodology(valuation, errors, warnings);
  validateValuationCalculationAudit(valuation, errors, warnings);
  validateUpsideAndMargin(input, errors);
}

function validateValuationMethodology(valuation = {}, errors, warnings) {
  const methodology = valuation.methodology || {};
  const weights = Array.isArray(methodology.modelWeights) ? methodology.modelWeights : [];
  if (!weights.length) errors.push(fieldError("valuation.methodology.modelWeights", "Valuation method weights must be supplied."));
  assertWeightTotal("valuation.methodology.modelWeights", weights.map((item) => item?.weight), errors, "Valuation method weights must sum to 100%.");

  const weightedMethods = new Map();
  for (const [index, item] of weights.entries()) {
    const method = normalizeMethodName(item?.method);
    const weight = numberOrNull(item?.weight);
    if (!method) errors.push(fieldError(`valuation.methodology.modelWeights.${index}.method`, "Weighted valuation method name is required."));
    if (!Number.isFinite(weight) || weight <= 0) errors.push(fieldError(`valuation.methodology.modelWeights.${index}.weight`, "Weighted valuation method weight must be numeric and positive."));
    if (method && Number.isFinite(weight) && weight > 0) weightedMethods.set(method, { raw: item.method, weight });
  }
  assertUniqueValues("valuation.methodology.modelWeights.method", weights.map((item) => normalizeMethodName(item?.method)).filter(Boolean), errors);
  const excluded = new Set((Array.isArray(methodology.excludedMethods) ? methodology.excludedMethods : [])
    .map((item) => normalizeMethodName(item?.method))
    .filter(Boolean));
  for (const method of weightedMethods.keys()) {
    if (excluded.has(method)) errors.push(fieldError("valuation.methodology.excludedMethods", `Weighted method ${weightedMethods.get(method).raw} cannot also be excluded.`));
  }

  const results = Array.isArray(valuation.valuationResults) ? valuation.valuationResults : [];
  if (!results.length) errors.push(fieldError("valuation.valuationResults", "valuationResults must represent every positively weighted valuation method."));
  const represented = new Map();
  for (const [index, result] of results.entries()) {
    const method = normalizeMethodName(result?.method);
    const weight = numberOrNull(result?.weight);
    if (!method) errors.push(fieldError(`valuation.valuationResults.${index}.method`, "valuationResult method is required."));
    if (!Number.isFinite(numberOrNull(result?.fairValue))) errors.push(fieldError(`valuation.valuationResults.${index}.fairValue`, "valuationResult fairValue is required."));
    validateEnum(`valuation.valuationResults.${index}.role`, result?.role, FRANKLIN_V3_VALUATION_ROLES, errors);
    validateEnum(`valuation.valuationResults.${index}.confidence`, result?.confidence, FRANKLIN_V3_CONFIDENCE_LEVELS, errors, { optional: true });
    const computedFairValue = numberOrNull(result?.calculation?.computedFairValue);
    const statedFairValue = numberOrNull(result?.fairValue);
    if (Number.isFinite(computedFairValue) && Number.isFinite(statedFairValue) && !within(computedFairValue, statedFairValue, materialAmountTolerance(statedFairValue))) {
      errors.push(fieldError(`valuation.valuationResults.${index}.calculation.computedFairValue`, "computedFairValue must reconcile to valuationResult fairValue."));
    }
    if (!hasText(result?.calculation?.formula)) {
      warnings.push(fieldError(`valuation.valuationResults.${index}.calculation.formula`, "A formula is recommended so the valuation method can be independently reproduced."));
    }

    const weighted = weightedMethods.get(method);
    if (weighted) {
      if (!Number.isFinite(weight) || !within(weighted.weight, weight, WEIGHT_TOLERANCE)) {
        errors.push(fieldError(`valuation.valuationResults.${index}.weight`, "valuationResult weight must match valuation.methodology.modelWeights."));
      }
      if (represented.has(method)) errors.push(fieldError(`valuation.valuationResults.${index}.method`, "Every positively weighted method must have exactly one weighted valuationResult."));
      represented.set(method, true);
    } else if (Number.isFinite(weight) && weight > 0) {
      errors.push(fieldError(`valuation.valuationResults.${index}.method`, "Positively weighted valuationResult method must appear in modelWeights."));
    } else if (result?.role && result.role !== "CROSS_CHECK") {
      errors.push(fieldError(`valuation.valuationResults.${index}.role`, "Unweighted valuationResult must be a CROSS_CHECK."));
    }
  }

  for (const method of weightedMethods.keys()) {
    if (!represented.has(method)) {
      errors.push(fieldError("valuation.valuationResults", `Missing valuationResult for weighted method ${weightedMethods.get(method).raw}.`));
    }
  }
  const primary = normalizeMethodName(methodology.primaryMethod);
  if (!primary || !weightedMethods.has(primary)) {
    errors.push(fieldError("valuation.methodology.primaryMethod", "primaryMethod must correspond to a positively weighted valuation method."));
  }
  for (const [index, method] of (Array.isArray(methodology.secondaryMethods) ? methodology.secondaryMethods : []).entries()) {
    const normalized = normalizeMethodName(method);
    if (normalized && !weightedMethods.has(normalized)) {
      errors.push(fieldError(`valuation.methodology.secondaryMethods.${index}`, "secondaryMethods must not contradict the weighted methods."));
    }
  }
}

function validateValuationCalculationAudit(valuation = {}, errors, warnings) {
  const results = Array.isArray(valuation.valuationResults) ? valuation.valuationResults : [];
  const weighted = results
    .filter((item) => Number.isFinite(numberOrNull(item?.weight)) && numberOrNull(item?.weight) > 0 && Number.isFinite(numberOrNull(item?.fairValue)))
    .reduce((sum, item) => sum + numberOrNull(item.fairValue) * numberOrNull(item.weight) / 100, 0);
  const audit = valuation.calculationAudit;
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    warnings.push(fieldError("valuation.calculationAudit", "Valuation calculation audit is missing."));
    return;
  }
  const suppliedWeighted = numberOrNull(audit.weightedMethodFairValue);
  if (Number.isFinite(suppliedWeighted) && !within(weighted, suppliedWeighted, materialAmountTolerance(weighted))) {
    errors.push(fieldError("valuation.calculationAudit.weightedMethodFairValue", "weightedMethodFairValue is inconsistent with valuationResults and model weights."));
  }
  const overlay = numberOrNull(audit.analystOverlayPct);
  const reconciled = numberOrNull(audit.reconciledBaseFairValue);
  if (Number.isFinite(suppliedWeighted) && Number.isFinite(overlay) && Number.isFinite(reconciled)) {
    const expected = suppliedWeighted * (1 + overlay / 100);
    if (!within(expected, reconciled, materialAmountTolerance(expected))) {
      errors.push(fieldError("valuation.calculationAudit.reconciledBaseFairValue", "reconciledBaseFairValue must equal weightedMethodFairValue adjusted by analystOverlayPct."));
    }
  }
  const base = numberOrNull(valuation.current?.base);
  const gap = numberOrNull(audit.gapToReportedBasePct);
  if (Number.isFinite(base) && Number.isFinite(reconciled)) {
    const expectedGap = base === 0 ? null : ((reconciled / base) - 1) * 100;
    if (Number.isFinite(gap) && Number.isFinite(expectedGap) && !within(expectedGap, gap, ASSESSMENT_TOLERANCE)) {
      errors.push(fieldError("valuation.calculationAudit.gapToReportedBasePct", "gapToReportedBasePct is arithmetically inconsistent."));
    }
    if (!within(base, reconciled, materialAmountTolerance(base))) {
      errors.push(fieldError("valuation.calculationAudit.reconciledBaseFairValue", "Reconciled method value and analyst overlay must equal valuation.current.base."));
    }
  }
  if (Number.isFinite(overlay) && Math.abs(overlay) > 0.01 && !hasText(audit.overlayReason)) {
    errors.push(fieldError("valuation.calculationAudit.overlayReason", "A non-zero analyst overlay requires an explicit reason."));
  }
}

function validateUpsideAndMargin(input, errors) {
  const price = numberOrNull(input.marketPrice?.value);
  const base = numberOrNull(input.valuation?.current?.base);
  const suppliedUpside = numberOrNull(input.valuation?.upsideToBasePct);
  const suppliedMargin = numberOrNull(input.valuation?.marginOfSafetyPct);
  if (!Number.isFinite(suppliedUpside)) errors.push(fieldError("valuation.upsideToBasePct", "upsideToBasePct is required."));
  if (!Number.isFinite(suppliedMargin)) errors.push(fieldError("valuation.marginOfSafetyPct", "marginOfSafetyPct is required."));
  if (!(price > 0 && base > 0)) return;
  const expectedUpside = (base / price - 1) * 100;
  const expectedMargin = ((base - price) / base) * 100;
  if (Number.isFinite(suppliedUpside) && !within(expectedUpside, suppliedUpside, ASSESSMENT_TOLERANCE)) {
    errors.push(fieldError("valuation.upsideToBasePct", "upsideToBasePct arithmetic is inconsistent."));
  }
  if (Number.isFinite(suppliedMargin) && !within(expectedMargin, suppliedMargin, ASSESSMENT_TOLERANCE)) {
    errors.push(fieldError("valuation.marginOfSafetyPct", "marginOfSafetyPct arithmetic is inconsistent."));
  }
}

function validateDecisionAndThesis(input, errors) {
  const decision = input.decision || {};
  const thesis = input.thesis || {};
  validateEnum("decision.scope", decision.scope, FRANKLIN_V3_DECISION_SCOPES, errors);
  if (!FRANKLIN_V3_DECISION_ACTIONS.includes(decision.action)) errors.push(fieldError("decision.action", "decision.action is not supported."));
  if (decision.confidence !== null && decision.confidence !== undefined && !boundedNumber(decision.confidence, 0, 100)) {
    errors.push(fieldError("decision.confidence", "decision.confidence must be between 0 and 100 when present."));
  }
  if (decision.investmentScore !== null && decision.investmentScore !== undefined && !boundedNumber(decision.investmentScore, 0, 100)) {
    errors.push(fieldError("decision.investmentScore", "decision.investmentScore must be between 0 and 100 when present."));
  }
  if (!FRANKLIN_V3_THESIS_STATUSES.includes(thesis.status)) errors.push(fieldError("thesis.status", "thesis.status is not supported."));
  if (!hasText(thesis.updatedSummary)) errors.push(fieldError("thesis.updatedSummary", "thesis.updatedSummary is required."));
}

function validateNextRequirements(input, errors) {
  const next = input.nextRequirements || {};
  const requirements = Array.isArray(next.requirements) ? next.requirements : [];
  if (!FRANKLIN_V3_NEXT_REQUIREMENT_MODES.includes(next.mode)) errors.push(fieldError("nextRequirements.mode", "nextRequirements.mode is not supported."));
  if (!FRANKLIN_V3_TARGET_SCENARIOS.includes(next.targetScenario)) errors.push(fieldError("nextRequirements.targetScenario", "nextRequirements.targetScenario is not supported."));
  validateCanonicalQuarterField("nextRequirements.previousQuarter", next.previousQuarter, errors, { required: true });
  validateCanonicalQuarterField("nextRequirements.targetQuarter", next.targetQuarter, errors, { required: true });
  if (hasText(next.earningsPeriod)) validateCanonicalQuarterField("nextRequirements.earningsPeriod", next.earningsPeriod, errors);
  if (!Number.isFinite(numberOrNull(next.currentJustifiedValue))) errors.push(fieldError("nextRequirements.currentJustifiedValue", "nextRequirements.currentJustifiedValue is required."));
  if (!Number.isFinite(numberOrNull(next.targetValue))) errors.push(fieldError("nextRequirements.targetValue", "nextRequirements.targetValue is required."));
  if (requirements.length < 4) errors.push(fieldError("nextRequirements.requirements", "New requirement set must contain at least 4 requirements."));
  if (requirements.length > 8) errors.push(fieldError("nextRequirements.requirements", "New requirement set must contain no more than 8 requirements."));
  assertWeightTotal("nextRequirements.requirements.weight", requirements.map((item) => item?.weight), errors, "New requirement weights must sum to 100%.");
  assertUniqueValues("nextRequirements.requirements.id", requirements.map((item) => item?.id), errors);
  for (const [index, item] of requirements.entries()) {
    if (item?.status !== "NOT_REPORTED") errors.push(fieldError(`nextRequirements.requirements.${index}.status`, "New requirement statuses must be NOT_REPORTED."));
    if (!item?.id) errors.push(fieldError(`nextRequirements.requirements.${index}.id`, "New requirement id is required."));
    if (!item?.metric) errors.push(fieldError(`nextRequirements.requirements.${index}.metric`, "New requirement metric is required."));
    validateEnum(`nextRequirements.requirements.${index}.type`, item?.type, FRANKLIN_V3_REQUIREMENT_TYPES, errors, { lowercase: true });
    validateEnum(`nextRequirements.requirements.${index}.importance`, item?.importance, FRANKLIN_V3_IMPORTANCE_LEVELS, errors, { lowercase: true });
    if (!Number.isFinite(numberOrNull(item?.weight)) || numberOrNull(item?.weight) <= 0) errors.push(fieldError(`nextRequirements.requirements.${index}.weight`, "New requirement weight must be numeric and > 0."));
    if (!hasText(item?.whyItMatters)) errors.push(fieldError(`nextRequirements.requirements.${index}.whyItMatters`, "whyItMatters is required."));
    if ((item?.requiredValue === null || item?.requiredValue === undefined || item?.requiredValue === "") && !hasText(item?.requiredDisplay)) {
      errors.push(fieldError(`nextRequirements.requirements.${index}.requiredValue`, "requiredValue or requiredDisplay is required."));
    }
  }
  const base = numberOrNull(input.valuation?.current?.base);
  const bull = numberOrNull(input.valuation?.current?.bull);
  const justified = numberOrNull(next.currentJustifiedValue);
  if (Number.isFinite(base) && Number.isFinite(justified) && !within(base, justified, 0.000001)) {
    errors.push(fieldError("nextRequirements.currentJustifiedValue", "nextRequirements.currentJustifiedValue must equal valuation.current.base."));
  }
  validateNextQuarterProgression(input, errors);
  validateNextRequirementTargetSemantics(next, { base, bull }, errors);
}

function validateInitialRules(input, errors) {
  const identity = input.reportIdentity || {};
  const valuation = input.valuation || {};
  const thesis = input.thesis || {};
  if (identity.previousAnalysisId !== null) errors.push(fieldError("reportIdentity.previousAnalysisId", "INITIAL report must not link to a previous analysis."));
  if (identity.previousRequirementSetId !== null) errors.push(fieldError("reportIdentity.previousRequirementSetId", "INITIAL report must not link to a previous requirement set."));
  if (input.previousRequirementsEvaluation !== null) errors.push(fieldError("previousRequirementsEvaluation", "INITIAL report must not evaluate previous requirements."));
  if (valuation.reviewStatus !== FRANKLIN_V3_INITIAL_REVIEW_STATUS) errors.push(fieldError("valuation.reviewStatus", "INITIAL valuation.reviewStatus must be INITIAL."));
  if (valuation.previous !== null) errors.push(fieldError("valuation.previous", "INITIAL valuation.previous must be null."));
  if (valuation.change !== null) errors.push(fieldError("valuation.change", "INITIAL valuation.change must be null."));
  if (thesis.status !== "INITIAL") errors.push(fieldError("thesis.status", "INITIAL thesis.status must be INITIAL."));
  if (thesis.previousSummary !== null) errors.push(fieldError("thesis.previousSummary", "INITIAL thesis.previousSummary must be null."));
}

function validateEarningsRevaluationRules(input, context, errors, warnings) {
  const identity = input.reportIdentity || {};
  const valuation = input.valuation || {};
  const previous = context.currentReport || {};
  if (!FRANKLIN_V3_REVALUATION_REVIEW_STATUSES.includes(valuation.reviewStatus)) {
    errors.push(fieldError("valuation.reviewStatus", "EARNINGS_REVALUATION reviewStatus must be UPDATED or UNCHANGED."));
  }
  if (!valuation.previous || typeof valuation.previous !== "object" || Array.isArray(valuation.previous)) {
    errors.push(fieldError("valuation.previous", "EARNINGS_REVALUATION must include previous valuation."));
  }
  if (!valuation.change || typeof valuation.change !== "object" || Array.isArray(valuation.change)) {
    errors.push(fieldError("valuation.change", "EARNINGS_REVALUATION must include valuation.change."));
  }
  if (!hasText(valuation.valuationBridge?.whyBaseChangedOrNot)) {
    errors.push(fieldError("valuation.valuationBridge.whyBaseChangedOrNot", "Valuation bridge explanation is required for every earnings revaluation."));
  }
  validateBaseChangeBridge(valuation, errors, warnings);
  if (input.thesis?.status === "INITIAL" || !["STRENGTHENED", "UNCHANGED", "WEAKENED", "BROKEN"].includes(input.thesis?.status)) {
    errors.push(fieldError("thesis.status", "EARNINGS_REVALUATION thesis.status must be STRENGTHENED, UNCHANGED, WEAKENED, or BROKEN."));
  }
  if (!hasText(input.thesis?.previousSummary)) errors.push(fieldError("thesis.previousSummary", "EARNINGS_REVALUATION must include previous thesis summary."));
  if (!hasText(input.thesis?.changeReason)) errors.push(fieldError("thesis.changeReason", "EARNINGS_REVALUATION must explain thesis transition."));

  if (previous?.id && identity.previousAnalysisId !== previous.id) {
    errors.push(fieldError("reportIdentity.previousAnalysisId", `previousAnalysisId mismatch. Expected ${previous.id}.`));
  }
  const previousSet = previous?.priceTargetRequirements || {};
  const hasPreviousSet = hasCanonicalPreviousRequirementSet(previousSet);
  if (hasPreviousSet && identity.previousRequirementSetId !== previousSet.requirementSetId) {
    errors.push(fieldError("reportIdentity.previousRequirementSetId", `previousRequirementSetId mismatch. Expected ${previousSet.requirementSetId}.`));
  }
  if (hasPreviousSet && !input.previousRequirementsEvaluation) errors.push(fieldError("previousRequirementsEvaluation", "EARNINGS_REVALUATION must evaluate the previous requirement set."));
  if (!hasPreviousSet && input.previousRequirementsEvaluation !== null) errors.push(fieldError("previousRequirementsEvaluation", "No previous requirement set exists; previousRequirementsEvaluation must be null."));
  validatePreviousValuation(input, previous, errors);
  validateRevaluationStatusAndChanges(input, errors);
  if (hasPreviousSet) validatePreviousRequirements(input, previousSet, errors);
  validateFreshEarningsSources(input, errors, warnings);
}

function validateBaseChangeBridge(valuation = {}, errors, warnings) {
  const bridge = valuation.valuationBridge?.baseChangeBridge;
  if (!bridge || typeof bridge !== "object" || Array.isArray(bridge)) {
    warnings.push(fieldError("valuation.valuationBridge.baseChangeBridge", "A numeric base-value bridge is recommended for earnings revaluation."));
    return;
  }
  const previousBase = numberOrNull(bridge.previousBase);
  const currentBase = numberOrNull(bridge.currentBase);
  const expectedPrevious = numberOrNull(valuation.previous?.base);
  const expectedCurrent = numberOrNull(valuation.current?.base);
  if (Number.isFinite(previousBase) && Number.isFinite(expectedPrevious) && !within(previousBase, expectedPrevious, materialAmountTolerance(expectedPrevious))) {
    errors.push(fieldError("valuation.valuationBridge.baseChangeBridge.previousBase", "Bridge previousBase must equal valuation.previous.base."));
  }
  if (Number.isFinite(currentBase) && Number.isFinite(expectedCurrent) && !within(currentBase, expectedCurrent, materialAmountTolerance(expectedCurrent))) {
    errors.push(fieldError("valuation.valuationBridge.baseChangeBridge.currentBase", "Bridge currentBase must equal valuation.current.base."));
  }
  const impacts = ["operatingForecastImpact", "marginAndCashFlowImpact", "balanceSheetImpact", "dilutionImpact", "valuationParametersImpact", "otherImpact"]
    .map((field) => numberOrNull(bridge[field]));
  if (Number.isFinite(previousBase) && impacts.every(Number.isFinite)) {
    const expectedReconciled = previousBase + impacts.reduce((sum, value) => sum + value, 0);
    const reconciled = numberOrNull(bridge.reconciledCurrentBase);
    if (!Number.isFinite(reconciled) || !within(expectedReconciled, reconciled, materialAmountTolerance(expectedReconciled))) {
      errors.push(fieldError("valuation.valuationBridge.baseChangeBridge.reconciledCurrentBase", "Numeric bridge impacts do not reconcile to reconciledCurrentBase."));
    }
    if (Number.isFinite(reconciled) && Number.isFinite(currentBase)) {
      const expectedGap = currentBase - reconciled;
      const gap = numberOrNull(bridge.reconciliationGap);
      if (!Number.isFinite(gap) || !within(expectedGap, gap, materialAmountTolerance(expectedGap))) {
        errors.push(fieldError("valuation.valuationBridge.baseChangeBridge.reconciliationGap", "reconciliationGap must equal currentBase minus reconciledCurrentBase."));
      }
    }
  } else {
    warnings.push(fieldError("valuation.valuationBridge.baseChangeBridge", "Complete all six numeric impact buckets to make the Fair Value change reproducible."));
  }
}

function validatePreviousValuation(input, previous, errors) {
  if (!previous?.fairValueSummary) return;
  const previousValuation = input.valuation?.previous || {};
  for (const [field, path] of [
    ["bear", "fairValueLow"],
    ["base", "fairValueBase"],
    ["bull", "fairValueHigh"],
    ["probabilityWeighted", "probabilityWeightedFairValue"]
  ]) {
    const expected = numberOrNull(previous.fairValueSummary?.[path]);
    const supplied = numberOrNull(previousValuation[field]);
    if (Number.isFinite(expected) && Number.isFinite(supplied) && !within(expected, supplied, 0.000001)) {
      errors.push(fieldError(`valuation.previous.${field}`, `Previous ${field} valuation must match the saved report.`));
    }
  }
}

function validatePreviousRequirements(input, previousSet = {}, errors) {
  const evaluation = input.previousRequirementsEvaluation || {};
  const previousRequirements = Array.isArray(previousSet.requirements) ? previousSet.requirements : [];
  const evaluated = Array.isArray(evaluation.requirements) ? evaluation.requirements : [];
  if (previousSet.requirementSetId && evaluation.requirementSetId !== previousSet.requirementSetId) {
    errors.push(fieldError("previousRequirementsEvaluation.requirementSetId", "Previous requirementSetId mismatch."));
  }
  if (hasText(evaluation.previousQuarter)) {
    validateCanonicalQuarterField("previousRequirementsEvaluation.previousQuarter", evaluation.previousQuarter, errors);
    const expectedPrevious = normalizeFiscalQuarterPeriod(previousSet.previousQuarter);
    const actualPrevious = normalizeFiscalQuarterPeriod(evaluation.previousQuarter);
    if (expectedPrevious && actualPrevious && actualPrevious !== expectedPrevious) {
      errors.push(fieldError("previousRequirementsEvaluation.previousQuarter", `Previous previousQuarter mismatch. Expected "${expectedPrevious}".`));
    }
  }
  if (hasText(evaluation.earningsPeriod)) {
    validateCanonicalQuarterField("previousRequirementsEvaluation.earningsPeriod", evaluation.earningsPeriod, errors);
    const reportPeriod = reportPeriodFromV3Identity(input.reportIdentity || {});
    if (normalizeFiscalQuarterPeriod(evaluation.earningsPeriod) !== reportPeriod) {
      errors.push(fieldError("previousRequirementsEvaluation.earningsPeriod", `previousRequirementsEvaluation.earningsPeriod must match reportIdentity fiscal period. Expected "${reportPeriod}".`));
    }
  }
  if (previousSet.targetQuarter || previousSet.earningsPeriod) {
    const expectedTarget = normalizeFiscalQuarterPeriod(previousSet.targetQuarter || previousSet.earningsPeriod);
    validateCanonicalQuarterField("previousRequirementsEvaluation.targetQuarter", evaluation.targetQuarter, errors, { required: true });
    if (normalizeFiscalQuarterPeriod(evaluation.targetQuarter) !== expectedTarget) {
      errors.push(fieldError("previousRequirementsEvaluation.targetQuarter", `Previous targetQuarter mismatch. Expected "${expectedTarget || previousSet.targetQuarter || previousSet.earningsPeriod}".`));
    }
    const reportPeriod = reportPeriodFromV3Identity(input.reportIdentity || {});
    if (!fiscalQuarterPeriodsEqual(reportPeriod, expectedTarget)) {
      errors.push(fieldError("reportIdentity.fiscalQuarter", "This earnings revaluation cannot evaluate an OPEN requirement set for a different fiscal quarter."));
    }
  }
  if (previousRequirements.length && evaluated.length !== previousRequirements.length) {
    errors.push(fieldError("previousRequirementsEvaluation.requirements", "Every previous requirement must be evaluated exactly once."));
  }
  assertUniqueValues("previousRequirementsEvaluation.requirements.id", evaluated.map((item) => item?.id), errors);

  for (const previous of previousRequirements) {
    const current = evaluated.find((item) => String(item?.id || "") === String(previous.id || ""));
    if (!current) {
      errors.push(fieldError("previousRequirementsEvaluation.requirements", `Missing previous requirement id ${previous.id}.`));
      continue;
    }
    if (!sameValue(current.requiredValue, previous.requiredValue)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${current.id}.requiredValue`, "Old requiredValue cannot change."));
    if (!sameValue(current.requiredDisplay, previous.requiredDisplay)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${current.id}.requiredDisplay`, "Old requiredDisplay cannot change."));
    if (!sameNumber(current.weight, previous.weight)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${current.id}.weight`, "Old weight cannot change."));
    if (!sameText(current.metric, previous.metric || previous.name)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${current.id}.metric`, "Old metric cannot change."));
  }

  for (const [index, item] of evaluated.entries()) {
    validateEvaluatedRequirementStatus(item, `previousRequirementsEvaluation.requirements.${index}`, errors);
    if (!Number.isFinite(numberOrNull(item?.weight)) || numberOrNull(item?.weight) <= 0) {
      errors.push(fieldError(`previousRequirementsEvaluation.requirements.${index}.weight`, "Evaluated requirement weight must be numeric and > 0."));
    }
  }
  validatePreviousRequirementsAssessment(evaluation, errors);
}

function validateEvaluatedRequirementStatus(item, path, errors) {
  const status = String(item?.status || "").toUpperCase();
  if (!FRANKLIN_V3_REQUIREMENT_STATUSES.includes(status)) errors.push(fieldError(`${path}.status`, "Requirement status is not supported."));
  const partial = numberOrNull(item?.partialCreditPct);
  if (status === "PARTIALLY_PASSED") {
    if (!Number.isFinite(partial) || partial < 0 || partial > 100) errors.push(fieldError(`${path}.partialCreditPct`, "PARTIALLY_PASSED requires partialCreditPct between 0 and 100."));
    return;
  }
  if (item?.partialCreditPct !== null && item?.partialCreditPct !== undefined) {
    errors.push(fieldError(`${path}.partialCreditPct`, "partialCreditPct must be null unless status is PARTIALLY_PASSED."));
  }
}

function validatePreviousRequirementsAssessment(evaluation = {}, errors) {
  if (!evaluation.assessment || typeof evaluation.assessment !== "object") {
    errors.push(fieldError("previousRequirementsEvaluation.assessment", "Previous requirement assessment is required."));
    return;
  }
  const expected = calculateV3RequirementAssessment(evaluation.requirements || []);
  validateEnum("previousRequirementsEvaluation.assessment.overallStatus", evaluation.assessment.overallStatus, FRANKLIN_V3_REQUIREMENT_OVERALL_STATUSES, errors);
  for (const key of [
    "reportedRequirements",
    "totalRequirements",
    "coverageWeightPct",
    "achievementOfReportedWeightPct",
    "achievementOfTotalWeightPct",
    "exceededWeightPct",
    "passedWeightPct",
    "partialWeightPct",
    "failedWeightPct",
    "notReportedWeightPct"
  ]) {
    const supplied = evaluation.assessment[key];
    const calculated = expected[key];
    if (calculated === null) {
      if (supplied !== null && supplied !== undefined) errors.push(fieldError(`previousRequirementsEvaluation.assessment.${key}`, `${key} should be null.`));
      continue;
    }
    if (!Number.isFinite(numberOrNull(supplied)) || !within(calculated, numberOrNull(supplied), ASSESSMENT_TOLERANCE)) {
      errors.push(fieldError(`previousRequirementsEvaluation.assessment.${key}`, `${key} arithmetic is inconsistent.`));
    }
  }
  const achievement = numberOrNull(evaluation.assessment.achievementOfReportedWeightPct);
  if (Number.isFinite(achievement) && achievement > 100 + ASSESSMENT_TOLERANCE) {
    errors.push(fieldError("previousRequirementsEvaluation.assessment.achievementOfReportedWeightPct", "Requirement achievement cannot exceed 100%."));
  }
  const bucketTotal = [
    evaluation.assessment.exceededWeightPct,
    evaluation.assessment.passedWeightPct,
    evaluation.assessment.partialWeightPct,
    evaluation.assessment.failedWeightPct,
    evaluation.assessment.notReportedWeightPct
  ].map(numberOrNull).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  if (!within(bucketTotal, 100, ASSESSMENT_TOLERANCE)) {
    errors.push(fieldError("previousRequirementsEvaluation.assessment", "Requirement status weight buckets must sum to 100%."));
  }
  const notReportedWeight = numberOrNull(evaluation.assessment.notReportedWeightPct);
  const overallStatus = String(evaluation.assessment.overallStatus || "").toUpperCase();
  if (Number.isFinite(notReportedWeight) && notReportedWeight > ASSESSMENT_TOLERANCE && overallStatus !== "INCOMPLETE") {
    errors.push(fieldError("previousRequirementsEvaluation.assessment.overallStatus", "overallStatus must be INCOMPLETE when notReportedWeightPct is greater than zero."));
  }
  if (Number.isFinite(notReportedWeight) && within(notReportedWeight, 0, ASSESSMENT_TOLERANCE) && overallStatus === "INCOMPLETE") {
    errors.push(fieldError("previousRequirementsEvaluation.assessment.overallStatus", "overallStatus must not be INCOMPLETE when all previous requirements are reported."));
  }
}

function validateRevaluationStatusAndChanges(input, errors) {
  const valuation = input.valuation || {};
  const current = valuation.current || {};
  const previous = valuation.previous || {};
  const status = valuation.reviewStatus;
  const changed = ["bear", "base", "bull"].map((field) => {
    const before = numberOrNull(previous[field]);
    const after = numberOrNull(current[field]);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
    return !within(before, after, ASSESSMENT_TOLERANCE);
  });

  if (status === "UNCHANGED" && changed.some(Boolean)) {
    errors.push(fieldError("valuation.reviewStatus", "UNCHANGED requires current Bear/Base/Bull to match previous Bear/Base/Bull."));
  }
  if (status === "UPDATED" && !changed.some(Boolean)) {
    errors.push(fieldError("valuation.reviewStatus", "UPDATED requires at least one Bear/Base/Bull Fair Value to materially differ from previous valuation."));
  }
  for (const field of ["bear", "base", "bull"]) {
    const before = numberOrNull(previous[field]);
    const after = numberOrNull(current[field]);
    const supplied = numberOrNull(valuation.change?.[`${field}Pct`]);
    const expected = pctChange(after, before);
    const undefinedBearPct = field === "bear" && before === 0 && after > 0 && valuation.change?.bearPct === null;
    if (!Number.isFinite(supplied) && !undefinedBearPct) {
      errors.push(fieldError(`valuation.change.${field}Pct`, `${field}Pct is required.`));
      continue;
    }
    if (undefinedBearPct && !hasText(valuation.change?.summary)) {
      errors.push(fieldError("valuation.change.summary", "change.summary must explain Bear Fair Value movement from zero."));
    }
    if (Number.isFinite(expected) && !within(expected, supplied, ASSESSMENT_TOLERANCE)) {
      errors.push(fieldError(`valuation.change.${field}Pct`, `${field}Pct arithmetic is inconsistent.`));
    }
    if (status === "UNCHANGED" && Number.isFinite(supplied) && !within(supplied, 0, ASSESSMENT_TOLERANCE)) {
      errors.push(fieldError(`valuation.change.${field}Pct`, `${field}Pct must be zero for UNCHANGED reviewStatus.`));
    }
  }
}

function validateNextQuarterProgression(input, errors) {
  const currentPeriod = reportPeriodFromV3Identity(input.reportIdentity || {});
  const next = input.nextRequirements || {};
  const previousQuarter = normalizeFiscalQuarterPeriod(next.previousQuarter);
  if (currentPeriod && previousQuarter && previousQuarter !== currentPeriod) {
    errors.push(fieldError("nextRequirements.previousQuarter", `nextRequirements.previousQuarter must match reportIdentity fiscal period. Expected "${currentPeriod}".`));
  }
  const expectedTarget = nextFiscalQuarterPeriod(currentPeriod);
  const targetQuarter = normalizeFiscalQuarterPeriod(next.targetQuarter);
  if (expectedTarget && targetQuarter && targetQuarter !== expectedTarget) {
    errors.push(fieldError("nextRequirements.targetQuarter", `nextRequirements.targetQuarter must be the immediately following fiscal quarter. Expected "${expectedTarget}".`));
  }
}

function validateNextRequirementTargetSemantics(next = {}, values = {}, errors) {
  const base = numberOrNull(values.base);
  const bull = numberOrNull(values.bull);
  const targetValue = numberOrNull(next.targetValue);
  if (next.mode === "ADVANCE_TARGET") {
    if (!["BULL", "INTERMEDIATE"].includes(next.targetScenario)) {
      errors.push(fieldError("nextRequirements.targetScenario", "ADVANCE_TARGET requires BULL or INTERMEDIATE targetScenario."));
      return;
    }
    if (next.targetScenario === "BULL" && Number.isFinite(targetValue) && Number.isFinite(bull) && !within(targetValue, bull, 0.000001)) {
      errors.push(fieldError("nextRequirements.targetValue", "BULL targetValue must equal valuation.current.bull."));
    }
    if (next.targetScenario === "INTERMEDIATE") {
      if (!(Number.isFinite(targetValue) && Number.isFinite(base) && Number.isFinite(bull) && targetValue > base && targetValue < bull)) {
        errors.push(fieldError("nextRequirements.targetValue", "INTERMEDIATE targetValue must be > Base and < Bull."));
      }
      if (!hasText(next.targetDescription)) errors.push(fieldError("nextRequirements.targetDescription", "INTERMEDIATE targetDescription must explain the target."));
    }
  }
  if (next.mode === "DEFEND_BASE") {
    if (next.targetScenario !== "BASE_DEFENSE") errors.push(fieldError("nextRequirements.targetScenario", "DEFEND_BASE requires BASE_DEFENSE targetScenario."));
    if (Number.isFinite(targetValue) && Number.isFinite(base) && !within(targetValue, base, 0.000001)) {
      errors.push(fieldError("nextRequirements.targetValue", "BASE_DEFENSE targetValue must equal valuation.current.base."));
    }
  }
  if (next.mode === "RECOVERY") {
    if (next.targetScenario !== "RECOVERY") errors.push(fieldError("nextRequirements.targetScenario", "RECOVERY requires RECOVERY targetScenario."));
    if (Number.isFinite(targetValue) && Number.isFinite(base) && targetValue < base) {
      errors.push(fieldError("nextRequirements.targetValue", "RECOVERY targetValue must be >= valuation.current.base."));
    }
    if (!hasText(next.targetDescription)) errors.push(fieldError("nextRequirements.targetDescription", "RECOVERY targetDescription must explain the recovery logic."));
  }
}

function validateAuditTotals(input, errors) {
  const audit = input.audit || {};
  const scenarios = input.valuation?.scenarios || {};
  const scenarioTotal = ["Bear", "Base", "Bull"].reduce((sum, key) => sum + (numberOrNull(scenarios[key]?.probability) || 0), 0);
  assertAuditValue("audit.scenarioProbabilityTotalPct", audit.scenarioProbabilityTotalPct, scenarioTotal, errors);
  const methodTotal = sumWeights(input.valuation?.methodology?.modelWeights || []);
  assertAuditValue("audit.valuationMethodWeightTotalPct", audit.valuationMethodWeightTotalPct, methodTotal, errors);
  const nextRequirementTotal = sumWeights(input.nextRequirements?.requirements || []);
  assertAuditValue("audit.nextRequirementWeightTotalPct", audit.nextRequirementWeightTotalPct, nextRequirementTotal, errors);
  if (input.analysisType === "EARNINGS_REVALUATION") {
    if (input.previousRequirementsEvaluation) {
      const previousRequirementTotal = sumWeights(input.previousRequirementsEvaluation.requirements || []);
      assertAuditValue("audit.previousRequirementWeightTotalPct", audit.previousRequirementWeightTotalPct, previousRequirementTotal, errors);
    } else if (audit.previousRequirementWeightTotalPct !== null && audit.previousRequirementWeightTotalPct !== undefined) {
      errors.push(fieldError("audit.previousRequirementWeightTotalPct", "previousRequirementWeightTotalPct must be null when no previous requirement set exists."));
    }
  }
}

function validateSources(input, errors) {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (!sources.length) errors.push(fieldError("sources", "At least one traceable source is required."));
  const sourceIds = new Set(sources.map((source) => source?.id).filter(hasText));
  assertUniqueValues("sources.id", sources.map((source) => source?.id), errors);
  if (input.marketPrice?.sourceId && !sourceIds.has(input.marketPrice.sourceId)) {
    errors.push(fieldError("marketPrice.sourceId", "marketPrice.sourceId must reference a source in sources."));
  }
  for (const [index, source] of sources.entries()) {
    if (!hasText(source?.id)) errors.push(fieldError(`sources.${index}.id`, "Source id must be a non-empty string."));
    if (!hasText(source?.title)) errors.push(fieldError(`sources.${index}.title`, "Source title must be a non-empty string."));
    validateEnum(`sources.${index}.type`, source?.type, FRANKLIN_V3_SOURCE_TYPES, errors, { exact: true });
    if (!validDate(source?.date)) errors.push(fieldError(`sources.${index}.date`, "Source date is required."));
    if (source?.url !== null && source?.url !== undefined && !validHttpUrl(source.url)) {
      errors.push(fieldError(`sources.${index}.url`, "Source URL must be a valid http(s) URL or null."));
    }
    if (!Array.isArray(source?.usedFor) || !source.usedFor.length || source.usedFor.some((item) => !hasText(item))) {
      errors.push(fieldError(`sources.${index}.usedFor`, "Source usedFor must be a non-empty string array."));
    }
  }
  const marketSource = sources.find((source) => source?.id && source.id === input.marketPrice?.sourceId);
  if (input.marketPrice?.sourceId && !sourceUsedFor(marketSource, "marketPrice")) {
    errors.push(fieldError("marketPrice.sourceId", "Market-price source must include marketPrice in usedFor."));
  }
  validateAllSourceReferences(input, sourceIds, errors);
}

function validateFreshEarningsSources(input, errors, warnings) {
  const releaseDate = dateTime(input.reportIdentity?.earningsReleaseDate);
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const hasEarningsSource = sources.some((source) => {
    const currentQuarterUsage = ["latestQuarter", "previousRequirementsEvaluation", "currentQuarterEarnings"].some((value) => sourceUsedFor(source, value));
    if (!currentQuarterUsage) return false;
    if (!releaseDate) return true;
    const sourceDate = dateTime(source?.date);
    return Boolean(sourceDate && sourceDate >= releaseDate);
  });
  if (!hasEarningsSource) {
    errors.push(fieldError("sources", "Earnings revaluation requires fresh quarterly source provenance."));
  }
}

function validateAllSourceReferences(input, sourceIds, errors) {
  const refs = [];
  collectSourceRef(refs, "marketPrice.sourceId", input.marketPrice?.sourceId);
  const metrics = input.latestQuarter?.coreMetrics || {};
  for (const [metric, value] of Object.entries(metrics)) {
    collectSourceRef(refs, `latestQuarter.coreMetrics.${metric}.sourceId`, value?.sourceId);
  }
  for (const [index, item] of (Array.isArray(input.latestQuarter?.companySpecificKpis) ? input.latestQuarter.companySpecificKpis : []).entries()) {
    collectSourceRef(refs, `latestQuarter.companySpecificKpis.${index}.sourceId`, item?.sourceId);
  }
  for (const [index, item] of (Array.isArray(input.latestQuarter?.guidance) ? input.latestQuarter.guidance : []).entries()) {
    collectSourceRef(refs, `latestQuarter.guidance.${index}.sourceId`, item?.sourceId);
  }
  for (const [section, items] of [
    ["strengths", input.strengths],
    ["weaknesses", input.weaknesses],
    ["risks", input.risks],
    ["catalysts", input.catalysts]
  ]) {
    for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
      collectSourceRef(refs, `${section}.${index}.sourceId`, item?.sourceId);
      collectSourceRefs(refs, `${section}.${index}.sourceIds`, item?.sourceIds);
    }
  }
  for (const [index, item] of (Array.isArray(input.previousRequirementsEvaluation?.requirements) ? input.previousRequirementsEvaluation.requirements : []).entries()) {
    collectSourceRef(refs, `previousRequirementsEvaluation.requirements.${index}.sourceId`, item?.sourceId);
  }
  for (const [index, item] of (Array.isArray(input.forecast?.changedAssumptions) ? input.forecast.changedAssumptions : []).entries()) {
    collectSourceRef(refs, `forecast.changedAssumptions.${index}.sourceId`, item?.sourceId);
  }
  for (const [index, item] of (Array.isArray(input.forecast?.estimateRevisions) ? input.forecast.estimateRevisions : []).entries()) {
    collectSourceRef(refs, `forecast.estimateRevisions.${index}.sourceId`, item?.sourceId);
  }
  const normalization = input.financialNormalization || {};
  for (const [field, metric] of Object.entries(normalization)) {
    if (metric && typeof metric === "object" && !Array.isArray(metric)) {
      collectSourceRef(refs, `financialNormalization.${field}.sourceId`, metric.sourceId);
    }
  }
  collectSourceRefs(refs, "financialNormalization.sourceIds", normalization.sourceIds);
  for (const { path, id } of refs) {
    if (!sourceIds.has(id)) errors.push(fieldError(path, `sourceId ${id} must reference an actual source in sources[].`));
  }
}

function collectSourceRef(refs, path, id) {
  if (id === null || id === undefined || id === "") return;
  refs.push({ path, id: String(id) });
}

function collectSourceRefs(refs, path, ids) {
  if (!Array.isArray(ids)) return;
  ids.forEach((id, index) => collectSourceRef(refs, `${path}.${index}`, id));
}

function sourceUsedFor(source, expected) {
  if (!source || !Array.isArray(source.usedFor)) return false;
  const target = normalizeToken(expected);
  return source.usedFor.some((item) => normalizeToken(item) === target);
}

function assertWeightTotal(path, values = [], errors, message, options = {}) {
  const numbers = values.map(numberOrNull);
  if (!numbers.length || numbers.some((value) => !Number.isFinite(value))) {
    errors.push(fieldError(path, message));
    return;
  }
  if (options.requirePositive !== false && numbers.some((value) => value <= 0)) {
    errors.push(fieldError(path, message));
    return;
  }
  if (options.requirePositive === false && numbers.some((value) => value < 0)) {
    errors.push(fieldError(path, message));
    return;
  }
  const total = numbers.reduce((sum, value) => sum + value, 0);
  if (!within(total, 100, WEIGHT_TOLERANCE)) errors.push(fieldError(path, message));
}

function calculateProbabilityWeighted(scenarios = {}) {
  const pairs = ["Bear", "Base", "Bull"].map((key) => ({
    fairValue: numberOrNull(scenarios[key]?.fairValue),
    probability: numberOrNull(scenarios[key]?.probability)
  }));
  if (!pairs.every((item) => Number.isFinite(item.fairValue) && Number.isFinite(item.probability))) return null;
  return pairs.reduce((sum, item) => sum + (item.fairValue * item.probability / 100), 0);
}

function probabilityWeightedTolerance(value) {
  return Math.max(0.01, Math.abs(value) * 0.001);
}

function materialAmountTolerance(value) {
  return Math.max(0.01, Math.abs(Number(value) || 0) * 0.001);
}

function sumWeights(items = []) {
  return items.reduce((sum, item) => {
    const value = numberOrNull(item?.weight);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function validateScore(path, value, errors) {
  if (value === null || value === undefined) return;
  if (!boundedNumber(value, 0, 100)) errors.push(fieldError(path, `${path} must be between 0 and 100.`));
}

function validateEnum(path, value, allowed, errors, options = {}) {
  if ((value === null || value === undefined || value === "") && options.optional) return;
  if (options.exact) {
    if (!allowed.includes(String(value || "").trim())) errors.push(fieldError(path, `${path} is not supported.`));
    return;
  }
  const normalized = options.lowercase ? String(value || "").trim().toLowerCase() : normalizeEnum(value);
  const expected = options.lowercase ? allowed.map((item) => String(item).toLowerCase()) : allowed.map(normalizeEnum);
  if (!expected.includes(normalized)) errors.push(fieldError(path, `${path} is not supported.`));
}

function assertUniqueValues(path, values = [], errors) {
  const clean = values.map((value) => String(value || "").trim()).filter(Boolean);
  if (clean.length !== new Set(clean).size) errors.push(fieldError(path, `${path} must be unique.`));
}

function validateExactMetricShape(path, value, expectedKeys, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(fieldError(path, `${path} is required.`));
    return;
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(fieldError(path, `${path} must use the approved v3 metric shape.`));
  }
}

function validateQuarterMetric(path, value, numericFields, errors, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const field of numericFields) {
    const supplied = value[field];
    if (supplied !== null && supplied !== undefined && !Number.isFinite(supplied)) {
      errors.push(fieldError(`${path}.${field}`, `${path}.${field} must be a finite JSON number or null.`));
    }
  }

  const actual = Number.isFinite(value.actualValue) ? value.actualValue : null;
  const consensus = Number.isFinite(value.consensusValue) ? value.consensusValue : null;
  if (Number.isFinite(actual) && !hasText(value.sourceId)) {
    errors.push(fieldError(`${path}.sourceId`, "A reported quarterly metric requires sourceId."));
  }

  if (options.comparable) {
    const suppliedResult = normalizeEnum(value.result);
    if (Number.isFinite(consensus) && !Number.isFinite(actual)) {
      errors.push(fieldError(`${path}.actualValue`, "consensusValue cannot be supplied without actualValue."));
    }
    if (Number.isFinite(actual) && Number.isFinite(consensus)) {
      const expectedResult = comparisonResult(actual, consensus);
      if (suppliedResult !== expectedResult) {
        errors.push(fieldError(`${path}.result`, `${path}.result must be ${expectedResult} for actualValue ${actual} versus consensusValue ${consensus}.`));
      }
    } else if (suppliedResult !== "NA") {
      errors.push(fieldError(`${path}.result`, "BEAT, MISS, or INLINE requires both actualValue and consensusValue; otherwise result must be NA."));
    }
  }

  if (options.reconcileYoy && value.yoyPct !== null && value.yoyPct !== undefined) {
    const prior = Number.isFinite(value.priorYearValue) ? value.priorYearValue : null;
    if (!Number.isFinite(actual) || !Number.isFinite(prior) || prior === 0) {
      errors.push(fieldError(`${path}.yoyPct`, "yoyPct requires numeric actualValue and non-zero priorYearValue."));
    } else {
      const expectedYoy = ((actual / prior) - 1) * 100;
      if (!within(expectedYoy, value.yoyPct, REPORTED_PERCENTAGE_TOLERANCE)) {
        errors.push(fieldError(`${path}.yoyPct`, `${path}.yoyPct is arithmetically inconsistent with actualValue and priorYearValue.`));
      }
    }
  }
}

function comparisonResult(actual, consensus) {
  const tolerance = Math.max(1e-9, Math.abs(consensus) * 1e-9);
  if (Math.abs(actual - consensus) <= tolerance) return "INLINE";
  return actual > consensus ? "BEAT" : "MISS";
}

function assertAuditValue(path, supplied, calculated, errors) {
  const value = numberOrNull(supplied);
  if (!Number.isFinite(value)) {
    errors.push(fieldError(path, `${path} is required.`));
    return;
  }
  if (Number.isFinite(calculated) && !within(value, calculated, WEIGHT_TOLERANCE)) {
    errors.push(fieldError(path, `${path} must match the canonical array total.`));
  }
}

function pctChange(next, previous) {
  if (!Number.isFinite(next) || !Number.isFinite(previous)) return null;
  if (previous === 0) return next === 0 ? 0 : null;
  return ((next / previous) - 1) * 100;
}

function hasCanonicalPreviousRequirementSet(previousSet = {}) {
  return Boolean(previousSet?.requirementSetId && Array.isArray(previousSet.requirements) && previousSet.requirements.length);
}

function isDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function isoDatePart(value) {
  const text = String(value || "").trim();
  if (isDateOnly(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function isAfterAnalysisDate(value, analysisDate) {
  if (!value || !analysisDate) return false;
  if (isDateOnly(analysisDate)) {
    return isoDatePart(value) > isoDatePart(analysisDate);
  }
  const valueTime = dateTime(value);
  const analysisTime = dateTime(analysisDate);
  return Boolean(valueTime && analysisTime && valueTime > analysisTime);
}

function normalizeMethodName(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeEnum(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function within(actual, expected, tolerance) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[%,$\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(value) {
  const number = numberOrNull(value);
  return Number.isFinite(number) && number > 0;
}

function boundedNumber(value, min, max) {
  const number = numberOrNull(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function validTicker(value) {
  const clean = normalizeTicker(value);
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean) && !["TICKER", "SYMBOL"].includes(clean);
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function validDate(value) {
  if (!hasText(value)) return false;
  const text = value.trim();
  if (isDateOnly(text)) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return false;
  if (!isDateOnly(text.slice(0, 10))) return false;
  return !Number.isNaN(new Date(text).getTime());
}

function validHttpUrl(value) {
  if (!hasText(value)) return false;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function dateTime(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCanonicalQuarterField(path, value, errors, options = {}) {
  if (!hasText(value)) {
    if (options.required) errors.push(fieldError(path, `${path} is required.`));
    return false;
  }
  if (!isCanonicalFiscalQuarterPeriod(value)) {
    errors.push(fieldError(path, `${path} must use Franklin quarter format "${FRANKLIN_FISCAL_QUARTER_FORMAT}", for example "Q4 2026".`));
    return false;
  }
  return true;
}

function sameValue(left, right) {
  if (left === null || left === undefined || left === "") return right === null || right === undefined || right === "";
  if (right === null || right === undefined || right === "") return false;
  if (Number.isFinite(numberOrNull(left)) && Number.isFinite(numberOrNull(right))) return sameNumber(left, right);
  return String(left) === String(right);
}

function sameNumber(left, right) {
  const a = numberOrNull(left);
  const b = numberOrNull(right);
  return Number.isFinite(a) && Number.isFinite(b) ? within(a, b, 0.000001) : a === b;
}

function sameText(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function fieldError(field, message) {
  return { field, message };
}
