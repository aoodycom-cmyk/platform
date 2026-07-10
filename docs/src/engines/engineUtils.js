import { clamp } from "../domain/financialMetrics.js";

export function factor(label, impact, explanation, status = "observed") {
  return {
    label,
    impact: Number.isFinite(impact) ? impact : 0,
    explanation,
    status
  };
}

export function missingFactor(label, explanation) {
  return factor(label, 0, explanation, "missing");
}

export function scoreFromFactors(base, factors) {
  return clamp(Math.round(base + factors.reduce((sum, item) => sum + item.impact, 0)));
}

export function confidenceFromFactors(factors, floor = 20, ceiling = 92) {
  if (!factors.length) return floor;
  const observed = factors.filter((item) => item.status !== "missing").length;
  return Math.round(clamp(floor + (observed / factors.length) * (ceiling - floor), floor, ceiling));
}

export function tierImpact(value, tiers, missingExplanation, formatter = String) {
  if (!Number.isFinite(value)) return { impact: 0, explanation: missingExplanation, status: "missing" };
  const tier = tiers.find((item) => item.test(value)) || tiers[tiers.length - 1];
  return {
    impact: tier.impact,
    explanation: tier.explanation(formatter(value)),
    status: "observed"
  };
}

export function engineReport({ name, inputs, formula, weighting, output, confidence, explanation, factors = [], missing = [] }) {
  return {
    name,
    inputs,
    formula,
    weighting,
    output,
    confidence,
    explanation,
    factors,
    missing
  };
}
