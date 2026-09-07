export const close = (actual, expected, tolerance = 1e-10) =>
  Object.is(actual, expected) || (Number.isFinite(actual) && Number.isFinite(expected) &&
  Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)));

export function referenceMetrics(current, prior, oldest) {
  const div = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null;
  const cagr = oldest.revenue > 0 && prior.revenue > 0 && current.revenue > 0
    ? (current.revenue / oldest.revenue) ** 0.5 - 1 : null;
  const invested = current.debt + current.equity - current.cash;
  return {
    revenueGrowth: div(current.revenue - prior.revenue, prior.revenue),
    grossMargin: div(current.grossProfit, current.revenue),
    operatingMargin: div(current.operatingIncome, current.revenue),
    fcfMargin: div(current.freeCashFlow, current.revenue),
    revenueCagr: cagr,
    netDebt: current.debt - current.cash,
    netDebtToEbitda: div(current.debt - current.cash, current.ebitda),
    roic: invested > 0 ? div(current.operatingIncome * 0.82, invested) : null
  };
}

export function referenceDcf({ fcf, growth, discountRate, terminalGrowth, netCash, shares, years = 5 }) {
  if (![fcf, growth, discountRate, terminalGrowth, netCash, shares, years].every(Number.isFinite) ||
      fcf <= 0 || shares <= 0 || years <= 0 || discountRate <= terminalGrowth) return null;
  const forecast = [];
  let projected = fcf;
  for (let year = 1; year <= years; year += 1) {
    projected *= 1 + growth;
    const discountFactor = (1 + discountRate) ** year;
    forecast.push({ year, projectedFcf: projected, discountFactor, presentValue: projected / discountFactor });
  }
  const terminalValue = projected * (1 + terminalGrowth) / (discountRate - terminalGrowth);
  const presentValueForecast = forecast.reduce((sum, row) => sum + row.presentValue, 0);
  const presentValueTerminal = terminalValue / (1 + discountRate) ** years;
  const enterpriseValue = presentValueForecast + presentValueTerminal;
  const equityValue = enterpriseValue + netCash;
  return { forecast, terminalValue, presentValueForecast, presentValueTerminal, enterpriseValue, equityValue, fairValuePerShare: equityValue / shares };
}

export function referenceValuation(input) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const growth = clamp(input.growth, -0.05, 0.24);
  const dcf = referenceDcf({ ...input, growth, discountRate: 0.095, terminalGrowth: 0.03, years: 5 });
  const roicPremium = !Number.isFinite(input.roic) ? 1 : input.roic > 0.25 ? 1.18 : input.roic > 0.15 ? 1.08 : 0.94;
  const peMultiple = clamp(18 + growth * 90, 12, 42) * roicPremium;
  const pegMultiple = clamp(Math.max(growth, 0.04) * 120, 14, 38);
  const evEbitdaMultiple = clamp(10 + growth * 45 + input.operatingMargin * 10, 7, 28);
  const evSalesMultiple = clamp(2.5 + growth * 24 + input.fcfMargin * 8, 1.2, 18);
  const methods = {
    DCF: dcf?.fairValuePerShare ?? null,
    "P/E": input.eps > 0 ? input.eps * peMultiple : null,
    PEG: input.eps > 0 ? input.eps * pegMultiple : null,
    "EV/EBITDA": input.ebitda > 0 ? (input.ebitda * evEbitdaMultiple + input.netCash) / input.shares : null,
    "EV/Sales": input.revenue > 0 ? (input.revenue * evSalesMultiple + input.netCash) / input.shares : null
  };
  const weights = { DCF: .26 * .72, "P/E": .13 * .62, PEG: .09 * .48, "EV/EBITDA": .12 * .58, "EV/Sales": .08 * .45 };
  const usable = Object.entries(methods).filter(([, value]) => Number.isFinite(value));
  const composite = usable.reduce((sum, [name, value]) => sum + value * weights[name], 0) /
    usable.reduce((sum, [name]) => sum + weights[name], 0);
  return { methods, composite, dcf };
}

export function referenceRange(values) {
  const usable = values.filter(({ value, probability }) => Number.isFinite(value) && Number.isFinite(probability) && probability > 0);
  const total = usable.reduce((sum, item) => sum + item.probability, 0);
  return total ? usable.reduce((sum, item) => sum + item.value * item.probability, 0) / total : null;
}
