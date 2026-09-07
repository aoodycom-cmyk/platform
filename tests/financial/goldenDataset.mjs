import { referenceMetrics, referenceValuation } from "./referenceEngine.mjs";

const categories = [
  "Semiconductor", "SaaS", "Consumer", "Industrial", "Energy", "Utility", "Financial",
  "REIT", "High Growth", "Mature", "Loss Making", "Highly Leveraged", "Net Cash",
  "Cyclical", "Dilution", "Buyback", "53 Week Fiscal", "Negative FCF", "No Meaningful PE", "DCF Sensitive"
];

export const goldenCases = Array.from({ length: 100 }, (_, index) => {
  const category = categories[index % categories.length];
  const scale = 40 + index * 3.75;
  const growth = -0.04 + (index % 15) * 0.018;
  const margin = 0.04 + (index % 11) * 0.018;
  const shares = 12 + (index % 17) * 4.25;
  const revenue = scale * 10;
  const priorRevenue = revenue / (1 + growth);
  const oldestRevenue = priorRevenue / (1 + growth * 0.8);
  const cash = index % 4 === 0 ? scale * 2 : scale * 0.4;
  const debt = index % 6 === 0 ? scale * 3 : scale * 0.7;
  const fcf = category === "Negative FCF" || category === "Loss Making" ? -scale * 0.2 : revenue * (0.06 + (index % 7) * 0.012);
  const current = {
    year: 2026, revenue, grossProfit: revenue * (margin + .25), operatingIncome: revenue * margin,
    netIncome: revenue * margin * .72, eps: category === "No Meaningful PE" ? -1 : revenue * margin * .72 / shares,
    freeCashFlow: fcf, ebitda: Math.max(1, revenue * (margin + .05)), cash, debt, equity: scale * 4, shares
  };
  const prior = { ...current, year: 2025, revenue: priorRevenue, grossProfit: priorRevenue * (margin + .24), operatingIncome: priorRevenue * (margin - .005), freeCashFlow: fcf > 0 ? fcf / (1 + growth) : fcf * .9 };
  const oldest = { ...prior, year: 2024, revenue: oldestRevenue, freeCashFlow: fcf > 0 ? prior.freeCashFlow / (1 + growth * .8) : fcf * .8 };
  const metrics = referenceMetrics(current, prior, oldest);
  const valuationInput = {
    fcf: current.freeCashFlow, growth: (metrics.revenueCagr + Math.sqrt(current.freeCashFlow / oldest.freeCashFlow) - 1) / 2,
    netCash: cash - debt, shares, eps: current.eps, ebitda: current.ebitda, revenue,
    roic: metrics.roic, operatingMargin: metrics.operatingMargin, fcfMargin: metrics.fcfMargin
  };
  const expectedValuation = fcf > 0 ? referenceValuation(valuationInput) : null;
  return {
    id: `GOLD-${String(index + 1).padStart(3, "0")}`, category, currency: ["USD", "EUR", "GBP", "SAR", "JPY"][index % 5],
    fiscalPeriod: index % 20 === 16 ? "FY2026-53W" : "FY2026", units: "millions",
    financials: [current, prior, oldest], expected: { metrics, valuation: expectedValuation },
    evidence: { kind: "controlled-synthetic", generatorVersion: "phase3-golden-v1" }
  };
});
