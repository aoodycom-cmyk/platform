import { average, buildMetricSnapshot, clamp, hasNumber, percent, safeDiv, toNumber, weightedAverage } from "../domain/financialMetrics.js";
import { engineReport } from "./engineUtils.js";

export const VALUATION_ASSUMPTIONS = {
  dcfYears: 5,
  discountRate: 0.095,
  terminalGrowth: 0.03,
  taxRate: 0.18,
  minGrowth: -0.05,
  maxGrowth: 0.24,
  reverseDcfMinGrowth: -0.1,
  reverseDcfMaxGrowth: 0.35
};

function method(name, fairValue, weight, confidence, explanation, inputs = {}) {
  return { name, fairValue, weight, confidence, explanation, inputs };
}

export function runValuation(company, manualInputs = {}) {
  const m = buildMetricSnapshot(company);
  const price = toNumber(company.quote?.price);
  const shares = m.shares;
  const netCash = hasNumber(m.cash) && hasNumber(m.debt) ? m.cash - m.debt : null;
  const growth = average([m.revenueCagr, m.fcfCagr]);
  const normalizedGrowth = hasNumber(growth)
    ? clamp(growth, VALUATION_ASSUMPTIONS.minGrowth, VALUATION_ASSUMPTIONS.maxGrowth)
    : null;
  const morningstarField = company.dataPlatform?.manualFields?.morningstarFairValue ?? manualInputs.morningstarFairValue;
  const morningstar = positiveInput(morningstarField);
  const consensus = positiveInput(company.consensus?.target);

  const methods = [
    buildDcfMethod(m, shares, netCash, normalizedGrowth),
    buildPeMethod(m, normalizedGrowth),
    buildPegMethod(m, normalizedGrowth),
    buildEvEbitdaMethod(m, shares, netCash, normalizedGrowth),
    buildEvSalesMethod(m, shares, netCash, normalizedGrowth),
    morningstar
      ? method("Morningstar Fair Value", morningstar, 0.16, 0.7, "Manual external fair value input.", { morningstarFairValue: morningstar })
      : null,
    consensus
      ? method("Analyst Consensus", consensus, 0.16, 0.55, "Street target consensus from the connected market data provider.", { consensusTarget: consensus })
      : null
  ].filter(Boolean);

  const compositeFairValue = weightedAverage(methods.map((item) => ({
    value: item.fairValue,
    weight: item.weight * item.confidence
  })));
  const marginOfSafety = hasNumber(price) && price > 0 && hasNumber(compositeFairValue)
    ? (compositeFairValue - price) / price
    : null;
  const reverseDcf = buildReverseDcf({ price, fcf: m.current.freeCashFlow, netCash, shares });
  const confidence = methods.length
    ? Math.round(clamp(methods.reduce((sum, item) => sum + item.confidence, 0) / methods.length * 100, 15, 88))
    : 0;

  return {
    ...engineReport({
      name: "Valuation Engine",
      inputs: ["current price", "FCF", "revenue", "EPS", "EBITDA", "shares", "cash", "debt", "Morningstar fair value", "analyst consensus"],
      formula: "composite fair value = weighted average(method fair value, method weight * method confidence)",
      weighting: {
        DCF: "26%",
        PE: "13%",
        PEG: "9%",
        EV_EBITDA: "12%",
        EV_Sales: "8%",
        Morningstar: "16% when supplied",
        AnalystConsensus: "16% when supplied"
      },
      output: { compositeFairValue, marginOfSafety, methodCount: methods.length },
      confidence,
      explanation: "The engine only runs valuation methods whose required inputs are present. Missing inputs remove the method instead of using placeholder values.",
      factors: methods.map((item) => ({
        label: item.name,
        impact: Math.round(item.weight * item.confidence * 100),
        explanation: item.explanation,
        status: "observed"
      })),
      missing: missingValuationInputs({ m, price, shares, netCash, normalizedGrowth, morningstar, consensus })
    }),
    methods,
    compositeFairValue,
    marginOfSafety,
    reverseDcf,
    assumptions: VALUATION_ASSUMPTIONS
  };
}

export function buildScenarios(valuation, quality, growth, risk) {
  const base = valuation.compositeFairValue;
  if (!hasNumber(base)) {
    return ["Bear", "Base", "Bull"].map((name, index) => ({
      name,
      probability: [0.25, 0.5, 0.25][index],
      fairValue: null,
      assumptions: ["Scenario requires a composite fair value from the valuation engine."]
    }));
  }
  const qualityAdjustment = ((quality.score ?? 50) - 60) / 250;
  const growthAdjustment = ((growth.score ?? 50) - 60) / 260;
  const riskAdjustment = (70 - (risk.score ?? 50)) / 250;
  return [
    {
      name: "Bear",
      probability: 0.25,
      fairValue: base * (0.72 + qualityAdjustment * 0.2 - Math.max(0, riskAdjustment)),
      assumptions: ["Growth normalizes faster", "Margins compress", "Multiple contracts"]
    },
    {
      name: "Base",
      probability: 0.5,
      fairValue: base,
      assumptions: ["Current growth fades gradually", "Margins remain near normalized levels", "Multiple reflects quality and growth"]
    },
    {
      name: "Bull",
      probability: 0.25,
      fairValue: base * (1.18 + Math.max(0, growthAdjustment) + Math.max(0, qualityAdjustment)),
      assumptions: ["Growth remains durable", "FCF conversion improves", "Premium multiple persists"]
    }
  ];
}

function buildDcfMethod(m, shares, netCash, growth) {
  const fcf = m.current.freeCashFlow;
  if (!positive(fcf) || !positive(shares) || !hasNumber(netCash) || !hasNumber(growth)) return null;
  const fairValue = dcfPerShare({
    fcf,
    growth,
    discountRate: VALUATION_ASSUMPTIONS.discountRate,
    terminalGrowth: VALUATION_ASSUMPTIONS.terminalGrowth,
    netCash,
    shares,
    years: VALUATION_ASSUMPTIONS.dcfYears
  });
  return method("DCF", fairValue, 0.26, 0.72, "Projects free cash flow for five years and applies a terminal value.", {
    fcf,
    growth,
    discountRate: VALUATION_ASSUMPTIONS.discountRate,
    terminalGrowth: VALUATION_ASSUMPTIONS.terminalGrowth
  });
}

function buildPeMethod(m, growth) {
  const eps = m.current.eps;
  if (!positive(eps) || !hasNumber(growth)) return null;
  const qualityPremium = hasNumber(m.roic) ? (m.roic > 0.25 ? 1.18 : m.roic > 0.15 ? 1.08 : 0.94) : 1;
  const targetPe = clamp(18 + growth * 90, 12, 42) * qualityPremium;
  return method("P/E", eps * targetPe, 0.13, 0.62, "Applies a growth and quality adjusted earnings multiple.", { eps, growth, targetPe });
}

function buildPegMethod(m, growth) {
  const eps = m.current.eps;
  if (!positive(eps) || !hasNumber(growth)) return null;
  const pegMultiple = clamp(Math.max(growth, 0.04) * 100 * 1.2, 14, 38);
  return method("PEG", eps * pegMultiple, 0.09, 0.48, "Normalizes earnings value against growth.", { eps, growth, pegMultiple });
}

function buildEvEbitdaMethod(m, shares, netCash, growth) {
  const ebitda = m.current.ebitda;
  if (!positive(ebitda) || !positive(shares) || !hasNumber(netCash) || !hasNumber(growth)) return null;
  const marginBonus = hasNumber(m.operatingMargin) ? m.operatingMargin * 10 : 0;
  const evEbitdaMultiple = clamp(10 + growth * 45 + marginBonus, 7, 28);
  const fairValue = safeDiv(ebitda * evEbitdaMultiple + netCash, shares);
  return method("EV/EBITDA", fairValue, 0.12, 0.58, "Uses operating cash earnings and an adjusted enterprise multiple.", { ebitda, evEbitdaMultiple });
}

function buildEvSalesMethod(m, shares, netCash, growth) {
  const revenue = m.current.revenue;
  if (!positive(revenue) || !positive(shares) || !hasNumber(netCash) || !hasNumber(growth)) return null;
  const cashFlowBonus = hasNumber(m.fcfMargin) ? m.fcfMargin * 8 : 0;
  const evSalesMultiple = clamp(2.5 + growth * 24 + cashFlowBonus, 1.2, 18);
  const fairValue = safeDiv(revenue * evSalesMultiple + netCash, shares);
  return method("EV/Sales", fairValue, 0.08, 0.45, "Useful for growth companies, lower confidence for mature businesses.", { revenue, evSalesMultiple });
}

function buildReverseDcf({ price, fcf, netCash, shares }) {
  if (!positive(price) || !positive(fcf) || !positive(shares) || !hasNumber(netCash)) {
    return {
      impliedGrowth: null,
      explanation: "Reverse DCF requires current price, free cash flow, cash, debt, and diluted shares."
    };
  }
  const impliedGrowth = reverseDcfGrowth({
    targetPrice: price,
    fcf,
    discountRate: VALUATION_ASSUMPTIONS.discountRate,
    terminalGrowth: VALUATION_ASSUMPTIONS.terminalGrowth,
    netCash,
    shares,
    years: VALUATION_ASSUMPTIONS.dcfYears
  });
  return {
    impliedGrowth,
    explanation: `Current price implies roughly ${percent(impliedGrowth)} five-year FCF growth under the base discount assumptions.`
  };
}

function dcfPerShare({ fcf, growth, discountRate, terminalGrowth, netCash, shares, years }) {
  let pv = 0;
  let projected = fcf;
  for (let year = 1; year <= years; year += 1) {
    projected *= 1 + growth;
    pv += projected / Math.pow(1 + discountRate, year);
  }
  const terminal = projected * (1 + terminalGrowth) / Math.max(discountRate - terminalGrowth, 0.01);
  const pvTerminal = terminal / Math.pow(1 + discountRate, years);
  return safeDiv(pv + pvTerminal + netCash, shares);
}

function reverseDcfGrowth({ targetPrice, fcf, discountRate, terminalGrowth, netCash, shares, years }) {
  let low = VALUATION_ASSUMPTIONS.reverseDcfMinGrowth;
  let high = VALUATION_ASSUMPTIONS.reverseDcfMaxGrowth;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const value = dcfPerShare({ fcf, growth: mid, discountRate, terminalGrowth, netCash, shares, years });
    if (value > targetPrice) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function missingValuationInputs({ m, price, shares, netCash, normalizedGrowth, morningstar, consensus }) {
  const missing = [];
  if (!positive(price)) missing.push("current price");
  if (!positive(m.current.freeCashFlow)) missing.push("free cash flow");
  if (!positive(m.current.revenue)) missing.push("revenue");
  if (!positive(m.current.eps)) missing.push("EPS");
  if (!positive(m.current.ebitda)) missing.push("EBITDA");
  if (!positive(shares)) missing.push("diluted shares");
  if (!hasNumber(netCash)) missing.push("cash and debt");
  if (!hasNumber(normalizedGrowth)) missing.push("growth history");
  if (!morningstar) missing.push("Morningstar fair value");
  if (!consensus) missing.push("analyst consensus target");
  return missing;
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function positiveInput(value) {
  const parsed = toNumber(value);
  return positive(parsed) ? parsed : null;
}
