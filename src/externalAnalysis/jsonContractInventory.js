export const JSON_CONTRACT_INVENTORY = Object.freeze([
  inventory("franklin-fair-value/v3", "Initial or earnings revaluation full analysis", "full-analysis", "validateFranklinV3Report", "franklinV3ToExternalReport", "external-analysis-report/v2", "externalAnalyses", "Stock workspace, earnings, company, strengths/risks, export"),
  inventory("external-analysis-supplement/v1", "Approved missing-field supplement", "supplement", "validateExternalAnalysisSupplement", "normalizeExternalAnalysisSupplement", "field patch against external-analysis-report/v2", "externalAnalyses[].supplements + approved fields", "Completion preview"),
  inventory("quarterly-earnings-lite/v1", "Legacy focused earnings update", "quarterly-earnings", "validateQuarterlyLiteEnvelope", "inflateQuarterlyEarningsLitePayload", "external-analysis-report/v2", "externalAnalyses + quarterlyEarningsHistory", "Earnings workspace"),
  inventory("external-analysis-report/v2", "Canonical analysis export", "full-analysis", "validateExternalAnalysisReport", "normalizeExternalAnalysisReport", "external-analysis-report/v2", "externalAnalyses", "All stock workspace views and JSON export"),
  inventory("external-analysis-report/v1", "Legacy external analysis", "full-analysis", "validateExternalAnalysisReport after normalization", "normalizeExternalAnalysisReport", "external-analysis-report/v2", "externalAnalyses", "All stock workspace views"),
  inventory("fair-value-analysis/v2", "Legacy fair-value analysis", "full-analysis", "fair-value contract + canonical validator", "fairValueAnalysisToExternalReport", "external-analysis-report/v2", "externalAnalyses", "Stock workspace"),
  inventory("fair-value-analysis/v1", "Legacy fair-value analysis", "full-analysis", "fair-value contract + canonical validator", "fairValueAnalysisToExternalReport", "external-analysis-report/v2", "externalAnalyses", "Stock workspace"),
  inventory("franklin-investment-backup/v1", "Application investment backup", "backup", "validateInvestmentDataBackup", "migrateFranklinState", "Franklin state v2", "equityResearchV4State", "Settings restore preview")
]);

export const FRANKLIN_V3_FIELD_COVERAGE = Object.freeze([
  field("reportIdentity.ticker", "company.ticker", "string", "required", "Stock header and library"),
  field("reportIdentity.companyName", "company.name", "string", "required", "Stock header and company page"),
  field("reportIdentity.analysisDate", "analysisDate", "ISO date or timestamp", "required", "Stock metadata and history"),
  field("reportIdentity.fiscalQuarter", "fiscalIdentity.fiscalQuarter", "Q1-Q4", "required", "Earnings timeline"),
  field("reportIdentity.fiscalYear", "fiscalIdentity.fiscalYear", "integer", "required", "Earnings timeline"),
  field("reportIdentity.periodEndDate", "fiscalIdentity.periodEndDate", "ISO date", "required", "Earnings timeline identity"),
  field("company.reportingCurrency", "company.reportingCurrency", "currency code", "required", "Company and earnings values"),
  field("company.tradingCurrency", "company.tradingCurrency", "currency code", "required", "Valuation display"),
  field("company.securityUnit", "company.securityUnit", "enum", "required", "Valuation display"),
  field("marketPrice.value", "marketPrice.value", "number", "required", "Decision hero"),
  field("marketPrice.currency", "marketPrice.currency", "currency code", "required", "Decision hero"),
  field("marketPrice.asOf", "marketPrice.asOf", "ISO date or timestamp", "required", "Market-price metadata"),
  field("marketPrice.priceType", "marketPrice.priceType", "enum", "required", "Market-price metadata"),
  field("valuation.current.bear", "valuation.current.bear", "number", "required", "Valuation scenarios"),
  field("valuation.current.base", "valuation.current.base", "number", "required", "Decision hero"),
  field("valuation.current.bull", "valuation.current.bull", "number", "required", "Valuation scenarios"),
  field("valuation.current.probabilityWeighted", "valuation.current.probabilityWeighted", "number", "required", "Valuation summary"),
  field("valuation.valuationResults", "valuation.valuationResults", "array", "required", "Valuation methodology"),
  field("valuation.scenarios", "valuation.scenarios", "object", "required", "Valuation scenarios"),
  field("valuation.calculationAudit", "valuation.calculationAudit", "object", "required", "Technical audit"),
  field("thesis.updatedSummary", "thesis.updatedSummary", "string", "required", "Summary"),
  field("businessQuality.score", "businessQuality.score", "number", "required", "Company assessment"),
  field("businessQuality.components", "businessQuality.components", "object", "required", "Company assessment"),
  field("decision.action", "decision.action", "enum", "required", "Decision hero"),
  field("decision.confidence", "decision.confidence", "number 0-100", "required", "Decision hero"),
  field("decision.investmentScore", "decision.investmentScore", "number", "required", "Decision hero"),
  field("decision.rationale", "decision.rationale", "array", "required", "Investment thesis"),
  field("financialNormalization", "financialNormalization", "object", "required", "Financial detail"),
  field("latestQuarter", "latestQuarter", "object", "required", "Earnings history"),
  field("forecast", "forecast", "object", "required", "Estimate revisions"),
  field("strengths", "strengths", "array", "required", "Strengths/risks"),
  field("weaknesses", "weaknesses", "array", "required", "Strengths/risks"),
  field("risks", "risks", "array", "required", "Strengths/risks"),
  field("catalysts", "catalysts", "array", "required", "Summary"),
  field("monitoringChecklist", "monitoringChecklist", "array", "required", "Summary"),
  field("sources", "sources", "array", "required", "Sources and quarterly provenance"),
  field("nextRequirements", "nextRequirements", "object", "required", "Upcoming quarter"),
  field("previousRequirementsEvaluation", "previousRequirementsEvaluation", "object or null", "conditional", "Reported-quarter scorecard")
]);

export function exactV3PreservationPath(sourcePath) {
  return `metadata.franklinV3Report.${sourcePath}`;
}

function inventory(schemaVersion, payloadType, importRoute, validator, adapter, internalModel, storageDestination, consumingUi) {
  return Object.freeze({ schemaVersion, payloadType, importRoute, validator, adapter, internalModel, storageDestination, consumingUi });
}

function field(sourcePath, canonicalPath, type, requirement, uiConsumer) {
  return Object.freeze({
    sourcePath,
    canonicalPath,
    exactPreservationPath: exactV3PreservationPath(sourcePath),
    type,
    requirement,
    persistenceLocation: `externalAnalyses[ticker][].${exactV3PreservationPath(sourcePath)}`,
    uiConsumer,
    exportPath: exactV3PreservationPath(sourcePath)
  });
}
