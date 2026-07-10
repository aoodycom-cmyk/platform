import { buildMetricSnapshot, clamp, percent, safeDiv } from "../domain/financialMetrics.js";
import { confidenceFromFactors, engineReport, factor, missingFactor, scoreFromFactors, tierImpact } from "./engineUtils.js";

const SCORE_FORMULA = "score = clamp(50 + sum(factor impacts), 0, 100)";

export function scoreQuality(company) {
  const m = buildMetricSnapshot(company);
  const factors = [
    metricFactor("ROIC", m.roic, [
      [18, (value) => value > 0.35, (value) => `ROIC is exceptional at ${value}.`],
      [11, (value) => value > 0.2, (value) => `ROIC is strong at ${value}.`],
      [4, (value) => value > 0.1, (value) => `ROIC is acceptable at ${value}.`],
      [-8, () => true, (value) => `ROIC is weak at ${value}.`]
    ], "ROIC requires operating income, cash, debt, equity, and tax assumption."),
    metricFactor("Gross margin", m.grossMargin, [
      [12, (value) => value > 0.65, (value) => `Gross margin is structurally high at ${value}.`],
      [7, (value) => value > 0.45, (value) => `Gross margin is healthy at ${value}.`],
      [2, (value) => value > 0.3, (value) => `Gross margin is acceptable at ${value}.`],
      [-5, () => true, (value) => `Gross margin is low at ${value}.`]
    ], "Gross margin requires revenue and gross profit."),
    metricFactor("Operating margin", m.operatingMargin, [
      [12, (value) => value > 0.35, (value) => `Operating margin is excellent at ${value}.`],
      [7, (value) => value > 0.2, (value) => `Operating margin is strong at ${value}.`],
      [2, (value) => value > 0.1, (value) => `Operating margin is modest at ${value}.`],
      [-6, () => true, (value) => `Operating margin is thin at ${value}.`]
    ], "Operating margin requires revenue and operating income."),
    metricFactor("FCF margin", m.fcfMargin, [
      [12, (value) => value > 0.25, (value) => `Free cash flow margin is high at ${value}.`],
      [7, (value) => value > 0.12, (value) => `Free cash flow margin is solid at ${value}.`],
      [2, (value) => value > 0.05, (value) => `Free cash flow margin is positive at ${value}.`],
      [-6, () => true, (value) => `Free cash flow conversion is weak at ${value}.`]
    ], "FCF margin requires revenue and free cash flow."),
    metricFactor("Balance sheet", m.netDebtToEbitda, [
      [10, (value) => value < 0, (value) => `Net cash balance sheet with net debt / EBITDA of ${value}x.`],
      [5, (value) => value < 1, (value) => `Leverage is conservative at ${value}x net debt / EBITDA.`],
      [-12, (value) => value > 3, (value) => `Leverage is elevated at ${value}x net debt / EBITDA.`],
      [-2, () => true, (value) => `Leverage is manageable but not pristine at ${value}x net debt / EBITDA.`]
    ], "Balance sheet factor requires cash, debt, and EBITDA.", oneDecimal)
  ];
  const score = scoreFromFactors(50, factors);
  const confidence = confidenceFromFactors(factors);
  return {
    ...engineReport({
      name: "Quality Engine",
      inputs: ["ROIC", "gross margin", "operating margin", "FCF margin", "net debt / EBITDA"],
      formula: SCORE_FORMULA,
      weighting: {
        ROIC: "factor impact range -8 to +18",
        grossMargin: "factor impact range -5 to +12",
        operatingMargin: "factor impact range -6 to +12",
        fcfMargin: "factor impact range -6 to +12",
        balanceSheet: "factor impact range -12 to +10"
      },
      output: { score },
      confidence,
      explanation: "Quality measures profitability, returns on capital, cash conversion, and balance sheet resilience.",
      factors,
      missing: missingLabels(factors)
    }),
    score,
    label: "Quality",
    summary: "Company quality is driven by profitability, returns on capital, free cash flow conversion, and balance sheet strength."
  };
}

export function scoreGrowth(company) {
  const m = buildMetricSnapshot(company);
  const marginTrendImpact = marginTrend(m.operatingMargin, m.fcfMargin);
  const factors = [
    metricFactor("Revenue growth", m.revenueGrowth, [
      [18, (value) => value > 0.25, (value) => `Latest revenue growth is very strong at ${value}.`],
      [10, (value) => value > 0.1, (value) => `Latest revenue growth is strong at ${value}.`],
      [3, (value) => value > 0.03, (value) => `Latest revenue growth is modest at ${value}.`],
      [-8, () => true, (value) => `Latest revenue growth is weak at ${value}.`]
    ], "Revenue growth requires at least two revenue periods."),
    metricFactor("EPS growth", m.epsGrowth, [
      [14, (value) => value > 0.25, (value) => `EPS growth is very strong at ${value}.`],
      [8, (value) => value > 0.1, (value) => `EPS growth is strong at ${value}.`],
      [3, (value) => value > 0.03, (value) => `EPS growth is modest at ${value}.`],
      [-8, () => true, (value) => `EPS growth is weak at ${value}.`]
    ], "EPS growth requires at least two EPS periods."),
    metricFactor("FCF growth", m.fcfGrowth, [
      [12, (value) => value > 0.2, (value) => `Free cash flow growth is strong at ${value}.`],
      [7, (value) => value > 0.08, (value) => `Free cash flow growth is healthy at ${value}.`],
      [2, (value) => value > 0, (value) => `Free cash flow growth is positive at ${value}.`],
      [-7, () => true, (value) => `Free cash flow growth is negative at ${value}.`]
    ], "FCF growth requires at least two free cash flow periods."),
    marginTrendImpact
  ];
  const score = scoreFromFactors(50, factors);
  const confidence = confidenceFromFactors(factors);
  return {
    ...engineReport({
      name: "Growth Engine",
      inputs: ["revenue growth", "EPS growth", "FCF growth", "operating margin", "FCF margin"],
      formula: SCORE_FORMULA,
      weighting: {
        revenueGrowth: "factor impact range -8 to +18",
        epsGrowth: "factor impact range -8 to +14",
        fcfGrowth: "factor impact range -7 to +12",
        marginTrend: "factor impact range -8 to +8"
      },
      output: { score },
      confidence,
      explanation: "Growth combines top-line growth, earnings growth, cash flow growth, and margin quality.",
      factors,
      missing: missingLabels(factors)
    }),
    score,
    label: "Growth",
    summary: "Growth score weighs revenue, EPS, free cash flow, and margin profile."
  };
}

export function scoreManagement(company) {
  const m = buildMetricSnapshot(company);
  const buybackYield = Number.isFinite(m.current.shares) && Number.isFinite(m.prior.shares)
    ? safeDiv(m.prior.shares - m.current.shares, m.prior.shares)
    : null;
  const factors = [
    Number.isFinite(m.current.freeCashFlow)
      ? factor("Capital allocation", m.current.freeCashFlow > 0 ? 9 : -10, m.current.freeCashFlow > 0
        ? "Positive free cash flow gives management flexibility."
        : "Negative free cash flow limits capital allocation flexibility.")
      : missingFactor("Capital allocation", "Capital allocation requires free cash flow."),
    metricFactor("Buybacks", buybackYield, [
      [8, (value) => value > 0.03, (value) => `Share count reduction is meaningful at ${value}.`],
      [4, (value) => value > 0, (value) => `Share count reduction is modest at ${value}.`],
      [-3, () => true, (value) => `Share count is not shrinking; buyback yield is ${value}.`]
    ], "Buyback factor requires current and prior diluted share count."),
    shareDilutionFactor(m.current.shares, m.prior.shares),
    metricFactor("Balance sheet discipline", m.netDebtToEbitda, [
      [7, (value) => value < 1, (value) => `Leverage discipline is strong at ${value}x net debt / EBITDA.`],
      [-10, (value) => value > 3, (value) => `Leverage discipline is weak at ${value}x net debt / EBITDA.`],
      [1, () => true, (value) => `Leverage is acceptable at ${value}x net debt / EBITDA.`]
    ], "Balance sheet discipline requires cash, debt, and EBITDA.", oneDecimal)
  ];
  const score = scoreFromFactors(50, factors);
  const confidence = confidenceFromFactors(factors, 18, 86);
  return {
    ...engineReport({
      name: "Management Engine",
      inputs: ["free cash flow", "share count trend", "buybacks", "net debt / EBITDA", "capital allocation notes"],
      formula: SCORE_FORMULA,
      weighting: {
        capitalAllocation: "factor impact range -10 to +9",
        buybacks: "factor impact range -3 to +8",
        dilution: "factor impact range -8 to +6",
        balanceSheetDiscipline: "factor impact range -10 to +7"
      },
      output: { score, grade: grade(score) },
      confidence,
      explanation: "Management score uses observable capital allocation evidence. Qualitative judgment should be added only from filings and transcripts.",
      factors,
      missing: missingLabels(factors)
    }),
    score,
    grade: grade(score),
    label: "Management",
    summary: confidence < 50
      ? "Management score is provisional because capital allocation evidence is incomplete."
      : "Management score reflects cash generation, buybacks, dilution, and balance sheet discipline."
  };
}

export function scoreMoat(company) {
  const signals = Array.isArray(company.qualitative?.moatSignals) ? company.qualitative.moatSignals.filter(Boolean) : [];
  const factors = signals.length
    ? signals.map((signal) => factor(signal, 8, `${signal} is recorded as a competitive advantage signal.`))
    : [missingFactor("Moat evidence", "Moat rating requires explicit evidence such as brand, network effect, switching cost, cost advantage, patents, or scale.")];
  const score = clamp(35 + signals.length * 8);
  const rating = score >= 75 ? "Wide" : score >= 55 ? "Narrow" : "None";
  const confidence = signals.length ? clamp(36 + signals.length * 12, 36, 84) : 18;
  return {
    ...engineReport({
      name: "Moat Engine",
      inputs: ["brand", "network effect", "switching cost", "cost advantage", "patents", "scale"],
      formula: "score = clamp(35 + 8 * explicit moat signal count, 0, 100)",
      weighting: {
        eachMoatSignal: "+8 points",
        noEvidence: "rating remains None with low confidence"
      },
      output: { score, rating },
      confidence,
      explanation: "Moat is evidence-based. The engine does not infer a moat unless the data includes explicit signals.",
      factors,
      missing: missingLabels(factors)
    }),
    score,
    rating,
    label: "Moat",
    summary: rating === "Wide"
      ? "The company shows multiple recorded competitive advantages."
      : rating === "Narrow"
        ? "The company has some recorded advantages, but durability should be monitored."
        : "There is limited recorded evidence of a durable moat."
  };
}

export function scoreRisk(company) {
  const m = buildMetricSnapshot(company);
  const signals = Array.isArray(company.qualitative?.riskSignals) ? company.qualitative.riskSignals.filter(Boolean) : [];
  const riskFactors = [
    ...signals.map((signal) => factor(signal, -6, `${signal} can pressure estimates, valuation, or thesis durability.`)),
    metricFactor("Debt risk", m.netDebtToEbitda, [
      [8, (value) => value < 0, (value) => `Net cash reduces financial risk; net debt / EBITDA is ${value}x.`],
      [-14, (value) => value > 3, (value) => `Debt risk is elevated at ${value}x net debt / EBITDA.`],
      [0, () => true, (value) => `Debt risk is manageable at ${value}x net debt / EBITDA.`]
    ], "Debt risk requires cash, debt, and EBITDA.", oneDecimal)
  ];
  if (!signals.length) {
    riskFactors.unshift(missingFactor("Specific risks", "Risk engine needs explicit risks such as competition, regulation, debt, customer concentration, China exposure, AI disruption, tariffs, or litigation."));
  }
  const score = scoreFromFactors(70, riskFactors);
  const confidence = confidenceFromFactors(riskFactors, 20, 88);
  return {
    ...engineReport({
      name: "Risk Engine",
      inputs: ["competition", "regulation", "debt", "customer concentration", "China exposure", "AI disruption", "tariffs", "litigation"],
      formula: "risk score = clamp(70 + sum(risk factor impacts), 0, 100); higher score means lower risk",
      weighting: {
        explicitRiskSignal: "-6 points each",
        debtRisk: "factor impact range -14 to +8"
      },
      output: { score, rating: riskRating(score) },
      confidence,
      explanation: "Risk score penalizes explicit thesis risks and financial leverage. Higher score means lower investment risk.",
      factors: riskFactors,
      missing: missingLabels(riskFactors)
    }),
    score,
    rating: riskRating(score),
    label: "Risk",
    summary: "Risk score reflects balance sheet and explicitly recorded competitive, regulatory, geographic, customer, legal, and disruption risks."
  };
}

function metricFactor(label, value, tiers, missingExplanation, formatter = percent) {
  const result = tierImpact(
    value,
    tiers.map(([impact, test, explanation]) => ({ impact, test, explanation })),
    missingExplanation,
    formatter
  );
  return factor(label, result.impact, result.explanation, result.status);
}

function marginTrend(operatingMargin, fcfMargin) {
  if (!Number.isFinite(operatingMargin) || !Number.isFinite(fcfMargin)) {
    return missingFactor("Margin profile", "Margin profile requires operating margin and FCF margin.");
  }
  if (operatingMargin > 0.25 && fcfMargin > 0.15) {
    return factor("Margin profile", 8, `Operating margin is ${percent(operatingMargin)} and FCF margin is ${percent(fcfMargin)}.`);
  }
  if (operatingMargin < 0.08) {
    return factor("Margin profile", -8, `Operating margin is thin at ${percent(operatingMargin)}.`);
  }
  return factor("Margin profile", 2, `Margins are acceptable: operating margin ${percent(operatingMargin)}, FCF margin ${percent(fcfMargin)}.`);
}

function shareDilutionFactor(currentShares, priorShares) {
  if (!Number.isFinite(currentShares) || !Number.isFinite(priorShares)) {
    return missingFactor("Dilution", "Dilution factor requires current and prior diluted share count.");
  }
  return currentShares <= priorShares
    ? factor("Dilution", 6, "Share count is stable or declining.")
    : factor("Dilution", -8, "Share count is increasing.");
}

function riskRating(score) {
  if (score >= 75) return "Low";
  if (score >= 55) return "Medium";
  return "High";
}

function grade(score) {
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 55) return "C+";
  if (score >= 45) return "C";
  return "D";
}

function missingLabels(factors) {
  return factors.filter((item) => item.status === "missing").map((item) => item.label);
}

function oneDecimal(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "-";
}
