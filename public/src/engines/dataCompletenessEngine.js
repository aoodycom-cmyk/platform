import { buildMetricSnapshot, toNumber } from "../domain/financialMetrics.js";
import { engineReport, factor } from "./engineUtils.js";

const CHECKS = [
  ["Current price", 12, ({ company }) => positive(company.quote?.price), "Current market price is required."],
  ["Market capitalization", 5, ({ company }) => positive(company.quote?.marketCap), "Market capitalization improves data validation."],
  ["Financial history", 15, ({ m }) => m.financialPeriodCount >= 2, "At least two annual periods are required for growth and trends."],
  ["Revenue", 10, ({ m }) => positive(m.current.revenue), "Revenue is required for margins and revenue multiples."],
  ["Gross profit", 5, ({ m }) => positive(m.current.grossProfit), "Gross profit is required for gross margin."],
  ["Operating income", 8, ({ m }) => Number.isFinite(m.current.operatingIncome), "Operating income is required for operating margin and ROIC."],
  ["Net income", 5, ({ m }) => Number.isFinite(m.current.netIncome), "Net income supports earnings quality review."],
  ["EPS", 8, ({ m }) => positive(m.current.eps), "EPS is required for P/E and PEG valuation."],
  ["Free cash flow", 12, ({ m }) => positive(m.current.freeCashFlow), "Free cash flow is required for DCF and FCF quality."],
  ["Balance sheet", 10, ({ m }) => Number.isFinite(m.current.cash) && Number.isFinite(m.current.debt) && Number.isFinite(m.current.equity), "Cash, debt, and equity are required for ROIC and leverage."],
  ["Diluted shares", 5, ({ m }) => positive(m.current.shares), "Diluted shares are required for per-share valuation."],
  ["Analyst consensus", 3, ({ company }) => positive(company.consensus?.target), "Consensus target is optional but improves external triangulation."],
  ["Manual fair value", 2, ({ company, manualInputs }) => positive(company.dataPlatform?.manualFields?.morningstarFairValue ?? manualInputs.morningstarFairValue), "Morningstar fair value is optional external validation."]
];

export function runDataCompleteness(company, manualInputs = {}) {
  const m = buildMetricSnapshot(company);
  const context = { company, manualInputs, m };
  const factors = CHECKS.map(([label, weight, test, explanation]) => {
    const passed = Boolean(test(context));
    return factor(label, passed ? weight : -weight, passed ? `${label} is available.` : explanation, passed ? "observed" : "missing");
  });
  const availableWeight = factors
    .filter((item) => item.status !== "missing")
    .reduce((sum, item) => sum + Math.max(item.impact, 0), 0);
  const totalWeight = CHECKS.reduce((sum, [, weight]) => sum + weight, 0);
  const score = Math.round((availableWeight / totalWeight) * 100);
  const dataHealth = company.dataPlatform?.health;
  const rating = score >= 85 ? "Complete" : score >= 70 ? "Usable" : score >= 45 ? "Limited" : "Insufficient";
  const missing = unique([
    ...factors.filter((item) => item.status === "missing").map((item) => item.label),
    ...(dataHealth?.missingFields || []).map((item) => item.label)
  ]);

  return {
    ...engineReport({
      name: "Data Completeness Engine",
      inputs: CHECKS.map(([label]) => label),
      formula: "score = available required-data weight / total required-data weight * 100",
      weighting: Object.fromEntries(CHECKS.map(([label, weight]) => [camel(label), `${weight}%`])),
      output: {
        score,
        rating,
        canIssueDecision: score >= 70,
        dataQuality: dataHealth?.overallScore ?? score,
        outdatedFields: dataHealth?.outdatedFields?.length || 0,
        conflictingFields: dataHealth?.conflictingFields?.length || 0
      },
      confidence: score,
      explanation: "Completeness determines whether the platform can issue a reliable investment decision. Missing data lowers confidence before valuation is considered.",
      factors,
      missing
    }),
    score,
    rating,
    canIssueDecision: score >= 70,
    label: "Data",
    summary: missing.length
      ? `Data is ${rating.toLowerCase()}; missing ${missing.slice(0, 4).join(", ")}.`
      : "Core market, financial statement, and external validation inputs are available."
  };
}

function positive(value) {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function camel(value) {
  return value.replace(/\s+([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/\s/g, "");
}

function unique(values) {
  return [...new Set(values)];
}
