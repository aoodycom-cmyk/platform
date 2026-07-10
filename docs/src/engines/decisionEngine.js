import { clamp, hasNumber, money, percent, toNumber } from "../domain/financialMetrics.js";
import { engineReport, factor } from "./engineUtils.js";

const DECISION_WEIGHTS = {
  valuation: 0.35,
  quality: 0.16,
  growth: 0.13,
  management: 0.09,
  moat: 0.09,
  risk: 0.12,
  dataCompleteness: 0.06
};

export function runDecision({ company, valuation, quality, growth, management, moat, risk, dataCompleteness }) {
  const price = toNumber(company.quote?.price);
  const marginOfSafety = valuation.marginOfSafety;
  const valuationScore = hasNumber(marginOfSafety) ? clamp(50 + marginOfSafety * 160) : 50;
  const components = {
    valuation: valuationScore,
    quality: quality.score ?? 50,
    growth: growth.score ?? 50,
    management: management.score ?? 50,
    moat: moat.score ?? 50,
    risk: risk.score ?? 50,
    dataCompleteness: dataCompleteness.score ?? 0
  };
  const compositeScore = Math.round(Object.entries(DECISION_WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + components[key] * weight;
  }, 0));
  const hasActionableData = dataCompleteness.score >= 70 && valuation.methods.length >= 2 && hasNumber(price) && price > 0;
  const label = chooseLabel({ hasActionableData, compositeScore, marginOfSafety, riskScore: risk.score });
  const confidence = decisionConfidence({ valuation, quality, growth, management, moat, risk, dataCompleteness, hasActionableData });
  const addBelow = hasNumber(valuation.compositeFairValue) ? valuation.compositeFairValue * 0.82 : null;
  const reduceAbove = hasNumber(valuation.compositeFairValue) ? valuation.compositeFairValue * 1.18 : null;
  const positionSize = positionSizeFor({ label, confidence, riskScore: risk.score, hasActionableData });
  const factors = decisionFactors(components, marginOfSafety);
  const status = hasActionableData ? "ACTIONABLE" : "INSUFFICIENT_DATA";

  return {
    ...engineReport({
      name: "Decision Engine",
      inputs: ["valuation score", "quality score", "growth score", "management score", "moat score", "risk score", "data completeness score"],
      formula: "investment score = weighted sum of engine scores; BUY/HOLD/SELL thresholds are deterministic",
      weighting: {
        valuation: "35%",
        quality: "16%",
        growth: "13%",
        management: "9%",
        moat: "9%",
        risk: "12%",
        dataCompleteness: "6%"
      },
      output: { label, compositeScore, confidence, status },
      confidence,
      explanation: explainDecision({ label, status, compositeScore, marginOfSafety, valuation, dataCompleteness }),
      factors,
      missing: status === "INSUFFICIENT_DATA" ? dataCompleteness.missing : []
    }),
    label,
    confidence,
    compositeScore,
    status,
    valuationScore,
    addBelow,
    reduceAbove,
    positionSize,
    exitThesis: exitThesis(label, status),
    summary: explainDecision({ label, status, compositeScore, marginOfSafety, valuation, dataCompleteness }),
    components
  };
}

function chooseLabel({ hasActionableData, compositeScore, marginOfSafety, riskScore }) {
  if (!hasActionableData) return "HOLD";
  if (compositeScore >= 72 && marginOfSafety >= 0.15 && riskScore >= 55) return "BUY";
  if (compositeScore <= 42 || marginOfSafety <= -0.25 || riskScore < 35) return "SELL";
  return "HOLD";
}

function decisionConfidence({ valuation, quality, growth, management, moat, risk, dataCompleteness, hasActionableData }) {
  const engineConfidence = average([
    quality.confidence,
    growth.confidence,
    management.confidence,
    moat.confidence,
    risk.confidence
  ]);
  const valuationConfidence = valuation.confidence ?? 0;
  const confidence = Math.round(
    dataCompleteness.score * 0.35 +
    valuationConfidence * 0.35 +
    engineConfidence * 0.3
  );
  return hasActionableData ? clamp(confidence, 25, 94) : clamp(confidence, 10, 44);
}

function decisionFactors(components, marginOfSafety) {
  return [
    factor("Valuation", Math.round((components.valuation - 50) * DECISION_WEIGHTS.valuation), hasNumber(marginOfSafety)
      ? `Margin of safety is ${percent(marginOfSafety)}.`
      : "Valuation score is neutral because fair value or current price is missing."),
    factor("Quality", Math.round((components.quality - 50) * DECISION_WEIGHTS.quality), `Quality contributes ${components.quality}/100.`),
    factor("Growth", Math.round((components.growth - 50) * DECISION_WEIGHTS.growth), `Growth contributes ${components.growth}/100.`),
    factor("Management", Math.round((components.management - 50) * DECISION_WEIGHTS.management), `Management contributes ${components.management}/100.`),
    factor("Moat", Math.round((components.moat - 50) * DECISION_WEIGHTS.moat), `Moat contributes ${components.moat}/100.`),
    factor("Risk", Math.round((components.risk - 50) * DECISION_WEIGHTS.risk), `Risk contributes ${components.risk}/100; higher is safer.`),
    factor("Data completeness", Math.round((components.dataCompleteness - 50) * DECISION_WEIGHTS.dataCompleteness), `Data completeness is ${components.dataCompleteness}/100.`)
  ];
}

function positionSizeFor({ label, confidence, riskScore, hasActionableData }) {
  if (!hasActionableData || label === "SELL") return 0;
  if (label === "HOLD") return 2;
  const riskAdjustment = riskScore >= 75 ? 1 : riskScore >= 55 ? 0 : -1;
  return clamp(Math.round((confidence - 45) / 7) + riskAdjustment, 2, 8);
}

function exitThesis(label, status) {
  if (status === "INSUFFICIENT_DATA") {
    return "Do not size the position from this output until market price and core financial statements are available.";
  }
  if (label === "SELL") {
    return "Exit if valuation remains above fair value while growth, quality, or balance-sheet risk fails to improve.";
  }
  return "Exit if the core growth thesis breaks, margins structurally reset lower, or balance-sheet risk rises.";
}

function explainDecision({ label, status, compositeScore, marginOfSafety, valuation, dataCompleteness }) {
  if (status === "INSUFFICIENT_DATA") {
    return `Rated HOLD because the data completeness score is ${dataCompleteness.score}/100 and only ${valuation.methods.length} valuation methods are available.`;
  }
  return `${label} with investment score ${compositeScore}/100, composite fair value ${money(valuation.compositeFairValue)}, and margin of safety ${percent(marginOfSafety)}.`;
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
