import { readFieldValue } from "../dataPlatform/fields.js";

export function toNumber(value) {
  value = readFieldValue(value);
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[%,$\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasNumber(value) {
  return Number.isFinite(value);
}

export function firstNumber(...values) {
  for (const value of values) {
    const parsed = toNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function latest(financials = []) {
  return [...financials].sort((a, b) => toNumber(b.year) - toNumber(a.year))[0] || {};
}

export function previous(financials = []) {
  return [...financials].sort((a, b) => toNumber(b.year) - toNumber(a.year))[1] || {};
}

export function safeDiv(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : null;
}

export function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function average(values = []) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function CAGR(values = []) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (clean.length < 2) return null;
  const first = clean[clean.length - 1];
  const last = clean[0];
  const years = clean.length - 1;
  return Math.pow(last / first, 1 / years) - 1;
}

export function weightedAverage(items = []) {
  const usable = items.filter((item) => Number.isFinite(item.value) && Number.isFinite(item.weight) && item.weight > 0);
  const weight = usable.reduce((sum, item) => sum + item.weight, 0);
  if (!weight) return null;
  return usable.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
}

export function money(value, digits = 0) {
  value = toNumber(value);
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits
  }).format(value);
}

export function compact(value) {
  value = toNumber(value);
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function percent(value, digits = 1) {
  value = toNumber(value);
  if (!Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

export function buildMetricSnapshot(company) {
  const financials = [...(company.financials || [])].sort((a, b) => toNumber(b.year) - toNumber(a.year));
  const current = normalizeFinancialRow(latest(financials));
  const prior = normalizeFinancialRow(previous(financials));
  const revenueSeries = financials.map((item) => toNumber(item.revenue));
  const epsSeries = financials.map((item) => toNumber(item.eps));
  const fcfSeries = financials.map((item) => toNumber(item.freeCashFlow));

  const grossMargin = safeDiv(current.grossProfit, current.revenue);
  const operatingMargin = safeDiv(current.operatingIncome, current.revenue);
  const fcfMargin = safeDiv(current.freeCashFlow, current.revenue);
  const revenueGrowth = growthRate(current.revenue, prior.revenue);
  const epsGrowth = growthRate(current.eps, prior.eps, true);
  const fcfGrowth = growthRate(current.freeCashFlow, prior.freeCashFlow, true);
  const investedCapital = investedCapitalValue(current);
  const nopat = Number.isFinite(current.operatingIncome) ? current.operatingIncome * 0.82 : null;
  const roic = safeDiv(nopat, investedCapital);
  const netDebt = Number.isFinite(current.debt) && Number.isFinite(current.cash)
    ? current.debt - current.cash
    : null;
  const netDebtToEbitda = safeDiv(netDebt, current.ebitda);

  return {
    current,
    prior,
    financialPeriodCount: financials.length,
    grossMargin,
    operatingMargin,
    fcfMargin,
    revenueGrowth,
    epsGrowth,
    fcfGrowth,
    revenueCagr: CAGR(revenueSeries),
    epsCagr: CAGR(epsSeries),
    fcfCagr: CAGR(fcfSeries),
    roic,
    netDebt,
    netDebtToEbitda,
    shares: current.shares,
    cash: current.cash,
    debt: current.debt
  };
}

function normalizeFinancialRow(row = {}) {
  return {
    year: toNumber(row.year),
    revenue: toNumber(row.revenue),
    grossProfit: toNumber(row.grossProfit),
    operatingIncome: toNumber(row.operatingIncome),
    netIncome: toNumber(row.netIncome),
    eps: toNumber(row.eps),
    freeCashFlow: toNumber(row.freeCashFlow),
    operatingCashFlow: toNumber(row.operatingCashFlow),
    capex: toNumber(row.capex),
    ebitda: toNumber(row.ebitda),
    cash: toNumber(row.cash),
    debt: toNumber(row.debt),
    equity: toNumber(row.equity),
    shares: toNumber(row.shares),
    dividends: toNumber(row.dividends),
    buybacks: toNumber(row.buybacks)
  };
}

function growthRate(current, prior, useAbsolutePrior = false) {
  const denominator = useAbsolutePrior && Number.isFinite(prior) ? Math.abs(prior) : prior;
  return safeDiv(current - prior, denominator);
}

function investedCapitalValue(current) {
  if (!Number.isFinite(current.debt) || !Number.isFinite(current.equity) || !Number.isFinite(current.cash)) return null;
  const value = current.debt + current.equity - current.cash;
  return value > 0 ? value : null;
}
