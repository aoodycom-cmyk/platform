import {
  FRANKLIN_FAIR_VALUE_METHODOLOGY_VERSION,
  FRANKLIN_FAIR_VALUE_SCHEMA_VERSION,
  FRANKLIN_V3_ANALYSIS_TYPES,
  FRANKLIN_V3_CONFIDENCE_LEVELS,
  FRANKLIN_V3_DECISION_ACTIONS,
  FRANKLIN_V3_INITIAL_REVIEW_STATUS,
  FRANKLIN_V3_NEXT_REQUIREMENT_MODES,
  FRANKLIN_V3_REQUIREMENT_STATUSES,
  FRANKLIN_V3_REVALUATION_REVIEW_STATUSES,
  FRANKLIN_V3_SECURITY_UNITS,
  FRANKLIN_V3_TARGET_SCENARIOS,
  FRANKLIN_V3_THESIS_STATUSES,
  isFranklinV3Report,
  reportPeriodFromV3Identity
} from "./v3Contract.js";

const WEIGHT_TOLERANCE = 0.01;
const ASSESSMENT_TOLERANCE = 0.1;

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

  validateRequiredSections(input, errors);
  validateFiscalIdentity(input, context, errors);
  validateCompanyAndMarket(input, errors);
  validateValuation(input, errors);
  validateDecisionAndThesis(input, errors);
  validateNextRequirements(input, errors);
  validateSources(input, errors, warnings);

  if (input.analysisType === "INITIAL") validateInitialRules(input, errors);
  if (input.analysisType === "EARNINGS_REVALUATION") validateEarningsRevaluationRules(input, context, errors, warnings);

  return { valid: errors.length === 0, errors, warnings };
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
    partialWeightPct: items.reduce((sum, item) => {
      if (String(item?.status || "").toUpperCase() !== "PARTIALLY_PASSED") return sum;
      return sum + ((numberOrNull(item?.weight) || 0) * ((numberOrNull(item?.partialCreditPct) || 0) / 100));
    }, 0),
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
  if (!identity.fiscalQuarter) errors.push(fieldError("reportIdentity.fiscalQuarter", "fiscalQuarter is required."));
  if (!identity.fiscalYear) errors.push(fieldError("reportIdentity.fiscalYear", "fiscalYear is required."));
  if (!validDate(identity.analysisDate)) errors.push(fieldError("reportIdentity.analysisDate", "analysisDate is required."));
  if (identity.periodEndDate && !validDate(identity.periodEndDate)) errors.push(fieldError("reportIdentity.periodEndDate", "periodEndDate must be valid when present."));
  if (identity.earningsReleaseDate && !validDate(identity.earningsReleaseDate)) errors.push(fieldError("reportIdentity.earningsReleaseDate", "earningsReleaseDate must be valid when present."));

  if (context.expectedTicker && normalizeTicker(identity.ticker) !== normalizeTicker(context.expectedTicker)) {
    errors.push(fieldError("reportIdentity.ticker", `Ticker mismatch. Expected ${context.expectedTicker}, received ${identity.ticker}.`));
  }
  const expectedPeriod = context.expectedReportPeriod || null;
  if (expectedPeriod && normalizedPeriod(reportPeriodFromV3Identity(identity)) !== normalizedPeriod(expectedPeriod)) {
    errors.push(fieldError("reportIdentity", `Fiscal identity mismatch. Expected ${expectedPeriod}, received ${reportPeriodFromV3Identity(identity) || "unspecified"}.`));
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
  if (!["LIVE", "DELAYED", "LAST_CLOSE"].includes(market.priceType)) errors.push(fieldError("marketPrice.priceType", "marketPrice.priceType is not supported."));
  if (!market.sourceId) errors.push(fieldError("marketPrice.sourceId", "marketPrice.sourceId is required."));
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

function validateValuation(input, errors) {
  const valuation = input.valuation || {};
  const current = valuation.current || {};
  const bear = numberOrNull(current.bear);
  const base = numberOrNull(current.base);
  const bull = numberOrNull(current.bull);
  if (!positiveNumber(bear)) errors.push(fieldError("valuation.current.bear", "Bear Fair Value is required."));
  if (!positiveNumber(base)) errors.push(fieldError("valuation.current.base", "Base Fair Value is required."));
  if (!positiveNumber(bull)) errors.push(fieldError("valuation.current.bull", "Bull Fair Value is required."));
  if ([bear, base, bull].every(Number.isFinite) && !(bear <= base && base <= bull)) {
    errors.push(fieldError("valuation.current", "Bear/Base/Bull Fair Value must be ordered as Bear <= Base <= Bull."));
  }
  if (current.confidence && !FRANKLIN_V3_CONFIDENCE_LEVELS.includes(current.confidence)) {
    errors.push(fieldError("valuation.current.confidence", "valuation.current.confidence is not supported."));
  }

  const scenarios = valuation.scenarios || {};
  for (const key of ["Bear", "Base", "Bull"]) {
    if (!scenarios[key] || typeof scenarios[key] !== "object") errors.push(fieldError(`valuation.scenarios.${key}`, `${key} scenario is required.`));
  }
  if (Number.isFinite(bear) && numberOrNull(scenarios.Bear?.fairValue) !== bear) errors.push(fieldError("valuation.scenarios.Bear.fairValue", "Bear scenario fairValue must match valuation.current.bear."));
  if (Number.isFinite(base) && numberOrNull(scenarios.Base?.fairValue) !== base) errors.push(fieldError("valuation.scenarios.Base.fairValue", "Base scenario fairValue must match valuation.current.base."));
  if (Number.isFinite(bull) && numberOrNull(scenarios.Bull?.fairValue) !== bull) errors.push(fieldError("valuation.scenarios.Bull.fairValue", "Bull scenario fairValue must match valuation.current.bull."));
  assertWeightTotal("valuation.scenarios", ["Bear", "Base", "Bull"].map((key) => scenarios[key]?.probability), errors, "Scenario probabilities must sum to 100%.");

  const weighted = calculateProbabilityWeighted(scenarios);
  const suppliedWeighted = numberOrNull(current.probabilityWeighted);
  if (Number.isFinite(weighted) && Number.isFinite(suppliedWeighted) && !within(weighted, suppliedWeighted, probabilityWeightedTolerance(weighted))) {
    errors.push(fieldError("valuation.current.probabilityWeighted", "probabilityWeighted Fair Value arithmetic is inconsistent."));
  }

  assertWeightTotal("valuation.methodology.modelWeights", (valuation.methodology?.modelWeights || []).map((item) => item?.weight), errors, "Valuation method weights must sum to 100%.");
  validateUpsideAndMargin(input, errors);
}

function validateUpsideAndMargin(input, errors) {
  const price = numberOrNull(input.marketPrice?.value);
  const base = numberOrNull(input.valuation?.current?.base);
  if (!(price > 0 && base > 0)) return;
  const expectedUpside = (base / price - 1) * 100;
  const expectedMargin = ((base - price) / base) * 100;
  const suppliedUpside = numberOrNull(input.valuation?.upsideToBasePct);
  const suppliedMargin = numberOrNull(input.valuation?.marginOfSafetyPct);
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
  if (decision.scope !== "STOCK_LEVEL") errors.push(fieldError("decision.scope", "decision.scope must be STOCK_LEVEL."));
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
  if (requirements.length < 4) errors.push(fieldError("nextRequirements.requirements", "New requirement set must contain at least 4 requirements."));
  if (requirements.length > 8) errors.push(fieldError("nextRequirements.requirements", "New requirement set must contain no more than 8 requirements."));
  assertWeightTotal("nextRequirements.requirements.weight", requirements.map((item) => item?.weight), errors, "New requirement weights must sum to 100%.");
  for (const [index, item] of requirements.entries()) {
    if (item?.status !== "NOT_REPORTED") errors.push(fieldError(`nextRequirements.requirements.${index}.status`, "New requirement statuses must be NOT_REPORTED."));
    if (!item?.id) errors.push(fieldError(`nextRequirements.requirements.${index}.id`, "New requirement id is required."));
    if (!item?.metric) errors.push(fieldError(`nextRequirements.requirements.${index}.metric`, "New requirement metric is required."));
  }
  const base = numberOrNull(input.valuation?.current?.base);
  const justified = numberOrNull(next.currentJustifiedValue);
  if (Number.isFinite(base) && Number.isFinite(justified) && !within(base, justified, 0.000001)) {
    errors.push(fieldError("nextRequirements.currentJustifiedValue", "nextRequirements.currentJustifiedValue must equal valuation.current.base."));
  }
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
  if (!input.previousRequirementsEvaluation) errors.push(fieldError("previousRequirementsEvaluation", "EARNINGS_REVALUATION must evaluate the previous requirement set."));
  if (input.thesis?.status === "INITIAL" || !["STRENGTHENED", "UNCHANGED", "WEAKENED", "BROKEN"].includes(input.thesis?.status)) {
    errors.push(fieldError("thesis.status", "EARNINGS_REVALUATION thesis.status must be STRENGTHENED, UNCHANGED, WEAKENED, or BROKEN."));
  }
  if (!hasText(input.thesis?.previousSummary)) errors.push(fieldError("thesis.previousSummary", "EARNINGS_REVALUATION must include previous thesis summary."));
  if (!hasText(input.thesis?.changeReason)) errors.push(fieldError("thesis.changeReason", "EARNINGS_REVALUATION must explain thesis transition."));

  if (previous?.id && identity.previousAnalysisId !== previous.id) {
    errors.push(fieldError("reportIdentity.previousAnalysisId", `previousAnalysisId mismatch. Expected ${previous.id}.`));
  }
  const previousSet = previous?.priceTargetRequirements || {};
  if (previousSet.requirementSetId && identity.previousRequirementSetId !== previousSet.requirementSetId) {
    errors.push(fieldError("reportIdentity.previousRequirementSetId", `previousRequirementSetId mismatch. Expected ${previousSet.requirementSetId}.`));
  }
  validatePreviousValuation(input, previous, errors);
  validatePreviousRequirements(input, previousSet, errors);
  validateFreshEarningsSources(input, errors, warnings);
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
  if (previousSet.targetQuarter || previousSet.earningsPeriod) {
    const expectedTarget = previousSet.targetQuarter || previousSet.earningsPeriod;
    if (normalizedPeriod(evaluation.targetQuarter) !== normalizedPeriod(expectedTarget)) {
      errors.push(fieldError("previousRequirementsEvaluation.targetQuarter", `Previous targetQuarter mismatch. Expected ${expectedTarget}.`));
    }
    const reportPeriod = reportPeriodFromV3Identity(input.reportIdentity || {});
    if (normalizedPeriod(reportPeriod) !== normalizedPeriod(expectedTarget)) {
      errors.push(fieldError("reportIdentity.fiscalQuarter", "This earnings revaluation cannot evaluate an OPEN requirement set for a different fiscal quarter."));
    }
  }
  if (previousRequirements.length && evaluated.length !== previousRequirements.length) {
    errors.push(fieldError("previousRequirementsEvaluation.requirements", "Every previous requirement must be evaluated exactly once."));
  }

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
}

function validateSources(input, errors) {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (!sources.length) errors.push(fieldError("sources", "At least one traceable source is required."));
  const sourceIds = new Set(sources.map((source) => source?.id).filter(Boolean));
  if (input.marketPrice?.sourceId && !sourceIds.has(input.marketPrice.sourceId)) {
    errors.push(fieldError("marketPrice.sourceId", "marketPrice.sourceId must reference a source in sources."));
  }
  for (const [index, source] of sources.entries()) {
    if (!source?.id) errors.push(fieldError(`sources.${index}.id`, "Source id is required."));
    if (!source?.title) errors.push(fieldError(`sources.${index}.title`, "Source title is required."));
    if (!source?.type) errors.push(fieldError(`sources.${index}.type`, "Source type is required."));
    if (!validDate(source?.date)) errors.push(fieldError(`sources.${index}.date`, "Source date is required."));
    if (!Array.isArray(source?.usedFor)) errors.push(fieldError(`sources.${index}.usedFor`, "Source usedFor must be an array."));
  }
}

function validateFreshEarningsSources(input, errors, warnings) {
  const releaseDate = dateTime(input.reportIdentity?.earningsReleaseDate);
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const hasEarningsSource = sources.some((source) => {
    const usedFor = (source?.usedFor || []).join(" ").toLowerCase();
    const type = String(source?.type || "").toLowerCase();
    return usedFor.includes("earnings") || usedFor.includes("latestquarter") || usedFor.includes("quarter") || type.includes("earnings") || type.includes("sec") || type.includes("investor");
  });
  if (!hasEarningsSource) {
    errors.push(fieldError("sources", "Earnings revaluation requires fresh quarterly source provenance."));
  }
  if (releaseDate) {
    const fresh = sources.some((source) => {
      const sourceDate = dateTime(source?.date);
      return sourceDate && sourceDate >= releaseDate - 1000 * 60 * 60 * 24;
    });
    if (!fresh) {
      warnings.push(fieldError("sources", "No source date appears to cover the current earnings release."));
    }
  }
}

function assertWeightTotal(path, values = [], errors, message) {
  const numbers = values.map(numberOrNull).filter(Number.isFinite);
  if (!numbers.length) {
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

function sumWeights(items = []) {
  return items.reduce((sum, item) => {
    const value = numberOrNull(item?.weight);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
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
  return !Number.isNaN(new Date(value).getTime());
}

function dateTime(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedPeriod(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
