import { toNumber } from "./financialMetrics.js";
import { scoreEvaluatedCompany } from "../engines/rankingEngine.js";

export const DEFAULT_SCENARIO_PROBABILITIES = {
  Bear: 0.25,
  Base: 0.5,
  Bull: 0.25
};

export function buildEvaluatedCompany({ company, research, manualInputs = {}, previous = null }) {
  const scenarios = scenarioMap(research.scenarios || []);
  const bearFairValue = scenarios.Bear.fairValue;
  const baseFairValue = scenarios.Base.fairValue;
  const bullFairValue = scenarios.Bull.fairValue;
  const bearProbability = scenarios.Bear.probability;
  const baseProbability = scenarios.Base.probability;
  const bullProbability = scenarios.Bull.probability;
  const currentPrice = toNumber(company.quote?.price);
  const morningstarFairValue = morningstarValue(company, research, manualInputs);
  const rangeFairValue = calculateRangeFairValue({
    bearFairValue,
    bearProbability,
    baseFairValue,
    baseProbability,
    bullFairValue,
    bullProbability
  });
  const upside = calculateUpside(rangeFairValue, currentPrice);
  const highestFairValue = highestValue([bearFairValue, baseFairValue, bullFairValue, morningstarFairValue]);
  const maxFairValueUpside = calculateUpside(highestFairValue, currentPrice);
  const now = new Date().toISOString();
  const evaluationDate = previous?.evaluationDate || now.slice(0, 10);

  const base = {
    id: company.ticker,
    ticker: company.ticker,
    companyName: company.name,
    sector: verifiedSector(company.sector),
    currentPrice,
    bearFairValue,
    bearProbability,
    baseFairValue,
    baseProbability,
    bullFairValue,
    bullProbability,
    morningstarFairValue,
    rangeFairValue,
    upside,
    highestFairValue,
    maxFairValueUpside,
    recommendation: research.decision.label,
    decisionStatus: research.decision.status,
    confidence: research.decision.confidence,
    investmentScore: research.decision.compositeScore,
    qualityScore: research.quality?.score ?? null,
    growthScore: research.growth?.score ?? null,
    managementScore: research.management?.score ?? null,
    moatScore: research.moat?.score ?? null,
    riskScore: research.risk?.score ?? null,
    dataQuality: research.dataHealth?.overallScore ?? research.dataCompleteness?.score ?? null,
    evaluationDate,
    lastUpdated: now,
    companySnapshot: company,
    manualInputsSnapshot: { ...manualInputs },
    history: previous ? [evaluationHistoryEntry(previous), ...(previous.history || [])].slice(0, 40) : []
  };
  return {
    ...base,
    ...scoreEvaluatedCompany(base)
  };
}

export function calculateRangeFairValue({
  bearFairValue,
  bearProbability = DEFAULT_SCENARIO_PROBABILITIES.Bear,
  baseFairValue,
  baseProbability = DEFAULT_SCENARIO_PROBABILITIES.Base,
  bullFairValue,
  bullProbability = DEFAULT_SCENARIO_PROBABILITIES.Bull
}) {
  const inputs = [bearFairValue, bearProbability, baseFairValue, baseProbability, bullFairValue, bullProbability].map(toNumber);
  if (inputs.some((value) => !Number.isFinite(value))) return null;
  const [bear, bearWeight, base, baseWeight, bull, bullWeight] = inputs;
  return bear * bearWeight + base * baseWeight + bull * bullWeight;
}

export function calculateUpside(fairValue, currentPrice) {
  const value = toNumber(fairValue);
  const price = toNumber(currentPrice);
  if (!Number.isFinite(value) || !Number.isFinite(price) || price <= 0) return null;
  return (value - price) / price;
}

export function highestValue(values = []) {
  const clean = values.map(toNumber).filter(Number.isFinite);
  return clean.length ? Math.max(...clean) : null;
}

export function upsertEvaluatedCompany(items = [], nextItem) {
  if (!nextItem?.ticker) return items;
  const rest = items.filter((item) => item.ticker !== nextItem.ticker);
  return [nextItem, ...rest];
}

function verifiedSector(sector) {
  return sector && sector !== "Unknown" ? sector : "";
}

function scenarioMap(scenarios) {
  const byName = new Map(scenarios.map((scenario) => [scenario.name, scenario]));
  return Object.fromEntries(["Bear", "Base", "Bull"].map((name) => {
    const scenario = byName.get(name) || {};
    return [name, {
      fairValue: toNumber(scenario.fairValue),
      probability: toNumber(scenario.probability) ?? DEFAULT_SCENARIO_PROBABILITIES[name]
    }];
  }));
}

function morningstarValue(company, research, manualInputs) {
  const methodValue = (research.valuation?.methods || []).find((method) => method.name === "Morningstar Fair Value")?.fairValue;
  return toNumber(methodValue ?? company.dataPlatform?.manualFields?.morningstarFairValue ?? manualInputs.morningstarFairValue);
}

function evaluationHistoryEntry(item) {
  return {
    ticker: item.ticker,
    currentPrice: item.currentPrice,
    rangeFairValue: item.rangeFairValue,
    upside: item.upside,
    highestFairValue: item.highestFairValue,
    maxFairValueUpside: item.maxFairValueUpside,
    recommendation: item.recommendation,
    confidence: item.confidence,
    investmentScore: item.investmentScore,
    rankingScore: item.rankingScore,
    rankingConfidence: item.rankingConfidence,
    dataQuality: item.dataQuality,
    lastUpdated: item.lastUpdated
  };
}
