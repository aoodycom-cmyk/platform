import { SOURCES } from "./fields.js";

export const PROVIDER_TYPES = {
  QUOTE: "QuoteProvider",
  FINANCIAL: "FinancialProvider",
  ANALYST: "AnalystProvider",
  RESEARCH: "ResearchProvider"
};

export const PROVIDER_FALLBACK_ORDER = [
  SOURCES.MORNINGSTAR,
  SOURCES.FMP,
  SOURCES.MANUAL,
  SOURCES.MISSING
];

export function createProviderRegistry(_serverOptions = {}, manualInputs = {}) {
  return [
    createMorningstarProvider(),
    createFmpProvider(),
    createManualProvider(manualInputs),
    createMissingProvider()
  ];
}

export function createMorningstarProvider() {
  return {
    id: "morningstar",
    name: SOURCES.MORNINGSTAR,
    enabled: false,
    providerTypes: [PROVIDER_TYPES.ANALYST, PROVIDER_TYPES.RESEARCH],
    priority: 10,
    confidence: 94
  };
}

export function createFmpProvider() {
  return {
    id: "fmp",
    name: SOURCES.FMP,
    enabled: true,
    providerTypes: [PROVIDER_TYPES.QUOTE, PROVIDER_TYPES.FINANCIAL, PROVIDER_TYPES.ANALYST],
    priority: 20,
    confidence: {
      [PROVIDER_TYPES.QUOTE]: 98,
      [PROVIDER_TYPES.FINANCIAL]: 96,
      [PROVIDER_TYPES.ANALYST]: 82
    },
    async search(query) {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw await safeApiError(response, "Search failed.");
      const data = await response.json();
      return data.results;
    },
    async loadCompany(ticker) {
      const data = await loadFmpPayload(ticker);
      return {
        company: data.company,
        source: this.name,
        timestamp: data.provider?.timestamp || new Date().toISOString(),
        provider: data.provider || {
          id: this.id,
          name: this.name,
          providerTypes: this.providerTypes
        }
      };
    }
  };
}

export function createManualProvider(manualInputs = {}) {
  return {
    id: "manual",
    name: SOURCES.MANUAL,
    enabled: true,
    manualInputs,
    providerTypes: [PROVIDER_TYPES.RESEARCH, PROVIDER_TYPES.ANALYST],
    priority: 30,
    confidence: 70
  };
}

export function createMissingProvider() {
  return {
    id: "missing",
    name: SOURCES.MISSING,
    enabled: true,
    providerTypes: Object.values(PROVIDER_TYPES),
    priority: 40,
    confidence: 0
  };
}

export function providerConfidence(provider, providerType) {
  if (!provider) return 0;
  if (typeof provider.confidence === "number") return provider.confidence;
  return provider.confidence?.[providerType] ?? 70;
}

export function enabledProviders(registry = []) {
  return registry.filter((provider) => provider.enabled);
}

export function publicProviderMetadata(registry = []) {
  return registry.map((provider) => ({
    id: provider.id,
    name: provider.name,
    enabled: provider.enabled,
    providerTypes: provider.providerTypes,
    priority: provider.priority
  }));
}

async function loadFmpPayload(ticker) {
  const response = await fetch("/api/research-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ ticker })
  });
  if (!response.ok) throw await safeApiError(response, "Could not load research data.");
  return response.json();
}

async function safeApiError(response, fallback) {
  const data = await response.json().catch(() => ({}));
  const error = new Error(data?.error?.code || fallback);
  error.status = response.status;
  error.code = data?.error?.code || "API_ERROR";
  error.userMessage = data?.error?.message || fallback;
  return error;
}

function normalizeResearchProfile(profile = {}, timestamp) {
  const management = [];
  if (profile.ceo) management.push(`CEO: ${profile.ceo}`);
  if (profile.fullTimeEmployees) management.push(`Employees: ${profile.fullTimeEmployees}`);
  return {
    source: SOURCES.FMP,
    updatedAt: timestamp,
    businessSummary: profile.description || profile.companyDescription || null,
    businessModel: null,
    revenueSegments: [],
    geographicExposure: compactList([profile.country]),
    customers: [],
    competitiveAdvantages: [],
    keyProducts: [],
    management,
    competitors: [],
    marketShare: [],
    competitiveStrengths: [],
    competitiveWeaknesses: [],
    peerComparison: [],
    website: profile.website || null
  };
}

function normalizeFinancials(income = [], balance = [], cashflow = []) {
  const byYear = new Map();
  for (const row of Array.isArray(income) ? income : []) {
    const year = statementYear(row);
    if (!year) continue;
    byYear.set(year, {
      year,
      revenue: number(row.revenue),
      grossProfit: number(row.grossProfit),
      operatingIncome: number(row.operatingIncome),
      netIncome: number(row.netIncome),
      eps: number(row.eps),
      ebitda: number(row.ebitda),
      shares: number(row.weightedAverageShsOutDil)
    });
  }
  for (const row of Array.isArray(balance) ? balance : []) {
    const year = statementYear(row);
    if (!year || !byYear.has(year)) continue;
    Object.assign(byYear.get(year), {
      cash: number(row.cashAndCashEquivalents),
      debt: firstNumber(row.totalDebt, sumNumbers(row.shortTermDebt, row.longTermDebt)),
      equity: number(row.totalStockholdersEquity)
    });
  }
  for (const row of Array.isArray(cashflow) ? cashflow : []) {
    const year = statementYear(row);
    if (!year || !byYear.has(year)) continue;
    Object.assign(byYear.get(year), {
      freeCashFlow: number(row.freeCashFlow),
      operatingCashFlow: number(row.netCashProvidedByOperatingActivities),
      capex: number(row.capitalExpenditure),
      dividends: absNumber(row.dividendsPaid),
      buybacks: absNumber(row.commonStockRepurchased)
    });
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

function normalizeIncomeStatements(rows = [], period = "annual") {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    date: row.date || null,
    year: statementYear(row),
    fiscalPeriod: row.period || row.fiscalPeriod || period,
    period,
    revenue: number(row.revenue),
    grossProfit: number(row.grossProfit),
    operatingIncome: number(row.operatingIncome),
    netIncome: number(row.netIncome),
    eps: number(row.eps),
    ebitda: number(row.ebitda),
    shares: number(row.weightedAverageShsOutDil)
  })).filter((row) => row.year || row.date);
}

function normalizeBalanceSheets(rows = [], period = "annual") {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    date: row.date || null,
    year: statementYear(row),
    fiscalPeriod: row.period || row.fiscalPeriod || period,
    period,
    cash: number(row.cashAndCashEquivalents),
    debt: firstNumber(row.totalDebt, sumNumbers(row.shortTermDebt, row.longTermDebt)),
    equity: number(row.totalStockholdersEquity)
  })).filter((row) => row.year || row.date);
}

function normalizeCashFlowStatements(rows = [], period = "annual") {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    date: row.date || null,
    year: statementYear(row),
    fiscalPeriod: row.period || row.fiscalPeriod || period,
    period,
    freeCashFlow: number(row.freeCashFlow),
    operatingCashFlow: number(row.netCashProvidedByOperatingActivities),
    capex: number(row.capitalExpenditure),
    dividends: absNumber(row.dividendsPaid),
    buybacks: absNumber(row.commonStockRepurchased)
  })).filter((row) => row.year || row.date);
}

function statementYear(row = {}) {
  return Number(String(row.calendarYear || row.year || row.date || "").slice(0, 4)) || null;
}

function cleanSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[%,$\s,]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function percentNumber(value) {
  const parsed = number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
}

function sumNumbers(...values) {
  const clean = values.map(number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) : null;
}

function absNumber(value) {
  const parsed = number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function compactList(values) {
  return values.filter((value) => value !== null && value !== undefined && value !== "");
}
