import { hasNumber, money, percent } from "../domain/financialMetrics.js";
import { engineReport } from "./engineUtils.js";

export function runExplainability({ company, valuation, quality, growth, management, moat, risk, dataCompleteness, decision, scenarios }) {
  const positives = collectFactors([decision, valuation, quality, growth, management, moat, risk, dataCompleteness])
    .filter((item) => item.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5);
  const negatives = collectFactors([decision, valuation, quality, growth, management, moat, risk, dataCompleteness])
    .filter((item) => item.impact < 0 || item.status === "missing")
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 5);
  const summary = summaryText({ company, valuation, decision, dataCompleteness });

  return {
    ...engineReport({
      name: "Explainability Engine",
      inputs: ["engine factors", "decision factors", "missing data", "scenario outputs"],
      formula: "rank positive and negative deterministic factors by impact; do not create financial values",
      weighting: {
        positiveDrivers: "top factors with impact > 0",
        negativeDrivers: "top factors with impact < 0 or missing status",
        summary: "templated deterministic narrative"
      },
      output: { positiveCount: positives.length, negativeCount: negatives.length },
      confidence: decision.confidence,
      explanation: "Explainability describes the deterministic calculations and data gaps. It does not invent numbers or adjust the decision.",
      factors: [...positives, ...negatives],
      missing: dataCompleteness.missing
    }),
    summary,
    why: decision.summary,
    positives,
    negatives,
    finalReason: `${moat.rating} moat, ${risk.rating.toLowerCase()} risk rating, quality score ${quality.score}, growth score ${growth.score}, and data completeness ${dataCompleteness.score}.`,
    scenarios
  };
}

function collectFactors(engines) {
  return engines.flatMap((engine) => Array.isArray(engine.factors) ? engine.factors : []);
}

function summaryText({ company, valuation, decision, dataCompleteness }) {
  if (decision.status === "INSUFFICIENT_DATA") {
    return `${company.ticker} is held at HOLD because the platform needs more data before issuing an actionable Buy or Sell recommendation. Data completeness is ${dataCompleteness.score}/100.`;
  }
  const value = hasNumber(valuation.compositeFairValue) ? money(valuation.compositeFairValue) : "-";
  const mos = hasNumber(valuation.marginOfSafety) ? percent(valuation.marginOfSafety) : "-";
  return `${company.ticker} is rated ${decision.label} with ${decision.confidence}% confidence. Composite fair value is ${value}, implying ${mos} margin of safety.`;
}
