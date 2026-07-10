import { buildUnifiedDataCompany } from "../dataPlatform/dataPlatform.js";
import { runDataCompleteness } from "./dataCompletenessEngine.js";
import { runDecision } from "./decisionEngine.js";
import { runExplainability } from "./explainabilityEngine.js";
import { scoreGrowth, scoreManagement, scoreMoat, scoreQuality, scoreRisk } from "./scoringEngines.js";
import { buildScenarios, runValuation } from "./valuationEngine.js";

export function runEquityResearch(company, manualInputs = {}) {
  const dataCompany = buildUnifiedDataCompany(company, {
    manualInputs,
    source: company.dataPlatform?.activeSource,
    timestamp: company.dataPlatform?.updatedAt,
    providers: company.dataPlatform?.providers || []
  });
  const dataHealth = dataCompany.dataPlatform.health;
  const dataCompleteness = runDataCompleteness(dataCompany, manualInputs);
  const quality = scoreQuality(dataCompany);
  const growth = scoreGrowth(dataCompany);
  const management = scoreManagement(dataCompany);
  const moat = scoreMoat(dataCompany);
  const risk = scoreRisk(dataCompany);
  const valuation = runValuation(dataCompany, manualInputs);
  const scenarios = buildScenarios(valuation, quality, growth, risk);
  const decision = runDecision({
    company: dataCompany,
    valuation,
    quality,
    growth,
    management,
    moat,
    risk,
    dataCompleteness
  });
  const explanation = runExplainability({
    company: dataCompany,
    valuation,
    quality,
    growth,
    management,
    moat,
    risk,
    dataCompleteness,
    decision,
    scenarios
  });

  return {
    company: dataCompany,
    manualInputs,
    dataHealth,
    dataCompleteness,
    valuation,
    quality,
    growth,
    management,
    moat,
    risk,
    scenarios,
    decision,
    explanation
  };
}
