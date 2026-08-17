import { getByPath } from "./fieldPaths.js";

export function validateExternalAnalysisReport(report = {}) {
  const errors = [];
  const warnings = [];

  if (!isValidTicker(report.company?.ticker)) errors.push(fieldError("company.ticker", "Ticker is required and must be a valid market symbol."));
  if (!isValidDate(report.analysisDate)) errors.push(fieldError("analysisDate", "Analysis date is required and must be valid."));
  if (!isPositiveNumber(report.fairValueSummary?.currentPrice)) errors.push(fieldError("fairValueSummary.currentPrice", "Price at analysis is required and must be greater than zero."));

  for (const key of ["quality", "growth", "valuation", "risk", "moat", "management"]) {
    if (report.scores?.[key] !== null && report.scores?.[key] !== undefined && !isScore(report.scores?.[key])) {
      errors.push(fieldError(`scores.${key}`, `${key} score must be between 0 and 10 when present.`));
    }
  }

  for (const [key, label] of [["fairValueLow", "bear"], ["fairValueBase", "base"], ["fairValueHigh", "bull"]]) {
    if (!isPositiveNumber(report.fairValueSummary?.[key])) errors.push(fieldError(`fairValueSummary.${key}`, `${label} fair value is required and must be greater than zero.`));
  }
  validateFairValueOrdering(report, errors);
  validateOptionalPositiveFairValues(report, errors);
  validateExternalDecisionFields(report, errors);

  if (!hasText(report.thesis?.shortSummary) && !hasText(report.thesis?.fullSummary)) {
    errors.push(fieldError("thesis.shortSummary", "Investment thesis summary is required."));
  }
  if (!Array.isArray(report.risks) || !report.risks.length || !report.risks.some((risk) => hasText(risk?.title) || hasText(risk?.explanation))) {
    errors.push(fieldError("risks", "At least one main risk is required."));
  }
  if (!hasText(report.decision?.action)) errors.push(fieldError("decision.action", "Verdict is required and must be stated in the pasted analysis."));

  validateArrays(report, errors);
  validateGuidance(report, errors);
  validateCompanySpecificKpis(report, errors);
  validatePriceTargetRequirements(report, errors);
  validateEstimateRevisions(report.estimateRevisions, errors);
  validateFiniteNumbers(report, errors);
  warnings.push(...detectCrossCompanyContamination(report));

  if (report.analysisOrigin && report.analysisOrigin !== "external_chatgpt") {
    errors.push(fieldError("analysisOrigin", "External reports must keep analysisOrigin = external_chatgpt."));
  }
  if (report.source && report.source !== "ChatGPT") {
    warnings.push(fieldError("source", "Source is not ChatGPT. Keep this only if the pasted analysis explicitly identifies another source."));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function detectCrossCompanyContamination(report = {}) {
  const ticker = String(report.company?.ticker || "").trim().toUpperCase();
  const company = String(report.company?.name || "").trim().toLowerCase();
  if (!ticker) return [];
  const fields = [
    ...contaminationFields("companySpecificKpis", report.companySpecificKpis, ["name", "arabicName", "category", "interpretation", "source", "sourceName", "sourceUrl"]),
    ...contaminationFields("companyProfile.activities", report.companyProfile?.activities, ["name", "arabicName", "description", "importance"]),
    ...contaminationFields("priceTargetRequirements.requirements", report.priceTargetRequirements?.requirements, ["name", "arabicName", "metric", "whyItMatters", "evaluationNote"]),
    ...contaminationFields("guidance", report.guidance, ["topic", "arabicTopic", "title", "name", "interpretation", "commentary", "explanation"]),
    ...contaminationFields("guidance", report.guidance, ["topic", "arabicTopic", "interpretation"])
  ];
  const warnings = [];
  for (const field of fields) {
    const match = knownCompanies().find((known) => {
      if (known.tickers.includes(ticker)) return false;
      if (company && known.names.some((name) => company.includes(name.toLowerCase()))) return false;
      return known.tokens.some((token) => tokenMatches(field.text, token));
    });
    if (match) {
      warnings.push(fieldError(
        field.path,
        `تحذير: توجد بيانات قد تخص شركة أخرى (${match.label}). راجع هذا الحقل قبل الحفظ.`
      ));
    }
  }
  return warnings;
}

function contaminationFields(basePath, items, keys = []) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    return keys
      .map((key) => ({ path: `${basePath}.${index}.${key}`, text: String(item[key] || "") }))
      .filter((entry) => entry.text.trim());
  });
}

function knownCompanies() {
  return [
    { label: "Micron / MU", tickers: ["MU"], names: ["Micron"], tokens: ["Micron", "MU", "DRAM", "NAND", "HBM"] },
    { label: "AST SpaceMobile / ASTS", tickers: ["ASTS"], names: ["AST SpaceMobile"], tokens: ["AST SpaceMobile", "ASTS", "BlueBird", "satellite deployment"] },
    { label: "Microsoft / MSFT", tickers: ["MSFT"], names: ["Microsoft"], tokens: ["Microsoft", "MSFT", "Azure", "Copilot"] },
    { label: "Apple / AAPL", tickers: ["AAPL"], names: ["Apple"], tokens: ["Apple", "AAPL", "iPhone", "App Store"] },
    { label: "NVIDIA / NVDA", tickers: ["NVDA"], names: ["NVIDIA"], tokens: ["NVIDIA", "NVDA", "CUDA", "Blackwell"] },
    { label: "Amazon / AMZN", tickers: ["AMZN"], names: ["Amazon"], tokens: ["Amazon", "AMZN", "AWS"] },
    { label: "Alphabet / GOOGL", tickers: ["GOOGL", "GOOG"], names: ["Alphabet", "Google"], tokens: ["Alphabet", "Google", "GOOGL", "GOOG", "YouTube"] },
    { label: "Meta / META", tickers: ["META"], names: ["Meta"], tokens: ["Meta", "META", "Facebook", "Instagram"] },
    { label: "Tesla / TSLA", tickers: ["TSLA"], names: ["Tesla"], tokens: ["Tesla", "TSLA", "Model Y", "Cybertruck"] }
  ];
}

function tokenMatches(text, token) {
  if (!text || !token) return false;
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(text);
}

function validateExternalDecisionFields(report, errors) {
  const action = report.decision?.action;
  if (action && !["BUY", "ADD", "HOLD", "WATCH", "REDUCE", "SELL"].includes(String(action).toUpperCase())) {
    errors.push(fieldError("decision.action", "External recommendation action must be BUY, ADD, HOLD, WATCH, REDUCE, or SELL."));
  }
  const confidence = report.decision?.confidence;
  if (typeof confidence === "number" && (!Number.isFinite(confidence) || confidence < 0 || confidence > 100)) {
    errors.push(fieldError("decision.confidence", "External recommendation confidence must be between 0 and 100 when numeric."));
  }
  if (report.decision?.investmentScore !== null && report.decision?.investmentScore !== undefined && !isInvestmentScore(report.decision.investmentScore)) {
    errors.push(fieldError("decision.investmentScore", "Investment score must be between 0 and 100 when present."));
  }
}

function validateFairValueOrdering(report, errors) {
  const bear = report.fairValueSummary?.fairValueLow;
  const base = report.fairValueSummary?.fairValueBase;
  const bull = report.fairValueSummary?.fairValueHigh;
  if (![bear, base, bull].every(Number.isFinite)) return;
  if (!(bear <= base && base <= bull)) {
    errors.push(fieldError("fairValueSummary", "Bear/Base/Bull Fair Value must be ordered as Bear <= Base <= Bull."));
  }
}

function validateOptionalPositiveFairValues(report, errors) {
  for (const key of ["probabilityWeightedFairValue"]) {
    const value = report.fairValueSummary?.[key];
    if (value !== null && value !== undefined && !isPositiveNumber(value)) {
      errors.push(fieldError(`fairValueSummary.${key}`, `${key} must be a positive number when present.`));
    }
  }
}

function validateArrays(report, errors) {
  const arrayPaths = ["risks", "catalysts", "sources", "quality.strengths", "quality.weaknesses", "earningsQuality.oneOffItems", "guidance", "monitoringChecklist", "valuationResults", "companySpecificKpis", "companyProfile.activities", "companyProfile.mainGrowthDrivers", "priceTargetRequirements.requirements", "decision.rationale", "decision.whyNot", "decision.upgradeTriggers", "decision.downgradeTriggers"];
  for (const path of arrayPaths) {
    const value = getByPath(report, path);
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      errors.push(fieldError(path, `${path} must be an array when present.`));
    }
  }
}

function validateGuidance(report, errors) {
  const directions = new Set(["raised", "maintained", "lowered", "new", "not_applicable"]);
  for (const [index, item] of (report.guidance || []).entries()) {
    if (item?.direction && !directions.has(item.direction)) {
      errors.push(fieldError(`guidance.${index}.direction`, "Guidance direction is not supported."));
    }
  }
}

function validateCompanySpecificKpis(report, errors) {
  const trends = new Set(["improving", "stable", "deteriorating", "unknown"]);
  for (const [index, item] of (report.companySpecificKpis || []).entries()) {
    if (!hasText(item?.name) && !hasText(item?.arabicName)) {
      errors.push(fieldError(`companySpecificKpis.${index}.name`, "Company-specific KPI needs a name when present."));
    }
    if (item?.trend && !trends.has(item.trend)) {
      errors.push(fieldError(`companySpecificKpis.${index}.trend`, "Company-specific KPI trend is not supported."));
    }
  }
}

function validatePriceTargetRequirements(report, errors) {
  const requirements = report.priceTargetRequirements?.requirements || [];
  const statuses = new Set(["NOT_REPORTED", "PASSED", "PARTIALLY_PASSED", "FAILED", "EXCEEDED"]);
  const directions = new Set(["up", "down", "flat", "unknown"]);
  const impacts = new Set(["positive", "negative", "mixed", "neutral", "unknown"]);
  for (const [index, item] of requirements.entries()) {
    if (!statuses.has(item.status)) errors.push(fieldError(`priceTargetRequirements.requirements.${index}.status`, "Requirement status is not supported."));
    if (!Number.isFinite(item.weight) || item.weight < 0) errors.push(fieldError(`priceTargetRequirements.requirements.${index}.weight`, "Requirement weight must be zero or greater."));
    if (item.direction && !directions.has(item.direction)) errors.push(fieldError(`priceTargetRequirements.requirements.${index}.direction`, "Requirement direction is not supported."));
    if (item.impact && !impacts.has(item.impact)) errors.push(fieldError(`priceTargetRequirements.requirements.${index}.impact`, "Requirement impact is not supported."));
  }
  for (const [index, item] of (report.previousRequirementsEvaluation?.requirements || []).entries()) {
    if (!statuses.has(item.status)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${index}.status`, "Requirement status is not supported."));
    if (item.direction && !directions.has(item.direction)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${index}.direction`, "Requirement direction is not supported."));
    if (item.impact && !impacts.has(item.impact)) errors.push(fieldError(`previousRequirementsEvaluation.requirements.${index}.impact`, "Requirement impact is not supported."));
  }
}

function validateEstimateRevisions(value, errors) {
  if (value === null || value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(fieldError("estimateRevisions", "Estimate Revisions must be an object when present."));
    return;
  }
  if (value.periodDays !== null && value.periodDays !== undefined && (!Number.isFinite(value.periodDays) || value.periodDays <= 0)) {
    errors.push(fieldError("estimateRevisions.periodDays", "Estimate revision periodDays must be greater than zero."));
  }
  if (value.asOfDate && !isValidDate(value.asOfDate)) errors.push(fieldError("estimateRevisions.asOfDate", "Estimate revision asOfDate must be valid."));
  const trends = new Set(["up", "flat", "down", null]);
  for (const metric of ["revenue", "eps", "ebitda"]) {
    const item = value[metric];
    if (item === null || item === undefined) continue;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(fieldError(`estimateRevisions.${metric}`, `${metric} revisions must be an object or null.`));
      continue;
    }
    if (!trends.has(item.trend)) errors.push(fieldError(`estimateRevisions.${metric}.trend`, "Revision trend must be up, flat, down, or null."));
  }
  if (!["positive", "neutral", "negative", "mixed", "unknown"].includes(value.overallDirection)) {
    errors.push(fieldError("estimateRevisions.overallDirection", "Overall revision direction is not supported."));
  }
}

function validateFiniteNumbers(value, errors, path = "") {
  if (typeof value === "number" && !Number.isFinite(value)) {
    errors.push(fieldError(path || "report", "Numbers cannot be NaN or Infinity."));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    validateFiniteNumbers(child, errors, path ? `${path}.${key}` : key);
  }
}

function isValidTicker(value) {
  const clean = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean) && !["TICKER", "SYMBOL"].includes(clean);
}

function isValidDate(value) {
  if (!hasText(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isInvestmentScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function isScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 10;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fieldError(field, message) {
  return { field, message };
}
