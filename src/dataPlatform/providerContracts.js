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

export function createProviderRegistry(apiKeys = {}, manualInputs = {}) {
  return [
    createMorningstarProvider(),
    createFmpProvider(apiKeys.fmp),
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

export function createFmpProvider(apiKey) {
  return {
    id: "fmp",
    name: SOURCES.FMP,
    enabled: Boolean(apiKey),
    apiKey,
    providerTypes: [PROVIDER_TYPES.QUOTE, PROVIDER_TYPES.FINANCIAL, PROVIDER_TYPES.ANALYST],
    priority: 20,
    confidence: {
      [PROVIDER_TYPES.QUOTE]: 98,
      [PROVIDER_TYPES.FINANCIAL]: 96,
      [PROVIDER_TYPES.ANALYST]: 82
    },
    async search(query) {
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, apiKey })
        });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return data.results;
      } catch {
        return searchFmpDirect(query, apiKey);
      }
    },
    async loadCompany(ticker) {
      const data = await loadFmpPayload(ticker, apiKey);
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

async function loadFmpPayload(ticker, apiKey) {
  try {
    const response = await fetch("/api/research-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, apiKey })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  } catch {
    return loadFmpDirect(ticker, apiKey);
  }
}

async function searchFmpDirect(query, apiKey) {
  const data = await fetchFmpDirect(`/stable/search-symbol?query=${encodeURIComponent(query)}`, apiKey);
  return (Array.isArray(data) ? data : []).slice(0, 10).map((item) => ({
    ticker: item.symbol || item.ticker,
    name: item.name || item.companyName || item.symbol,
    sector: item.exchange || item.exchangeShortName || "Market",
    industry: item.currency || "Equity",
    exchange: item.exchangeShortName || item.exchange || "",
    currency: item.currency || "USD"
  })).filter((item) => item.ticker);
}

async function loadFmpDirect(ticker, apiKey) {
  const cleanTicker = cleanSymbol(ticker);
  const [quoteData, profileData, consensusData, incomeData, balanceData, cashflowData, quarterlyIncomeData, quarterlyBalanceData, quarterlyCashflowData] = await Promise.all([
    fetchFmpDirect(`/stable/quote?symbol=${encodeURIComponent(cleanTicker)}`, apiKey),
    fetchFmpDirect(`/stable/profile?symbol=${encodeURIComponent(cleanTicker)}`, apiKey),
    fetchFmpDirect(`/stable/price-target-consensus?symbol=${encodeURIComponent(cleanTicker)}`, apiKey).catch(() => []),
    fetchFmpDirect(`/stable/income-statement?symbol=${encodeURIComponent(cleanTicker)}&limit=4`, apiKey),
    fetchFmpDirect(`/stable/balance-sheet-statement?symbol=${encodeURIComponent(cleanTicker)}&limit=4`, apiKey),
    fetchFmpDirect(`/stable/cash-flow-statement?symbol=${encodeURIComponent(cleanTicker)}&limit=4`, apiKey),
    fetchFmpDirect(`/stable/income-statement?symbol=${encodeURIComponent(cleanTicker)}&period=quarter&limit=8`, apiKey).catch(() => []),
    fetchFmpDirect(`/stable/balance-sheet-statement?symbol=${encodeURIComponent(cleanTicker)}&period=quarter&limit=8`, apiKey).catch(() => []),
    fetchFmpDirect(`/stable/cash-flow-statement?symbol=${encodeURIComponent(cleanTicker)}&period=quarter&limit=8`, apiKey).catch(() => [])
  ]);
  const quote = Array.isArray(quoteData) ? quoteData[0] || {} : quoteData || {};
  const profile = Array.isArray(profileData) ? profileData[0] || {} : profileData || {};
  const consensus = Array.isArray(consensusData) ? consensusData[0] || {} : consensusData || {};
  const providerTimestamp = new Date().toISOString();
  return {
    provider: {
      id: "fmp",
      name: SOURCES.FMP,
      timestamp: providerTimestamp,
      providerTypes: [PROVIDER_TYPES.QUOTE, PROVIDER_TYPES.FINANCIAL, PROVIDER_TYPES.ANALYST]
    },
    company: {
      ticker: cleanTicker,
      name: quote.name || profile.companyName || cleanTicker,
      sector: profile.sector || "Unknown",
      industry: profile.industry || "Unknown",
      currency: profile.currency || "USD",
      exchange: profile.exchangeShortName || profile.exchange || "",
      quote: {
        price: number(quote.price),
        marketCap: number(quote.marketCap),
        changePercent: percentNumber(quote.changesPercentage),
        enterpriseValue: number(quote.enterpriseValue),
        updatedAt: providerTimestamp
      },
      consensus: {
        target: firstNumber(consensus.targetConsensus, consensus.targetMean, consensus.priceTargetAverage, consensus.targetPrice),
        low: firstNumber(consensus.targetLow, consensus.priceTargetLow),
        high: firstNumber(consensus.targetHigh, consensus.priceTargetHigh),
        rating: "Consensus"
      },
      financials: normalizeFinancials(incomeData, balanceData, cashflowData),
      financialTimeline: {
        annual: {
          incomeStatements: normalizeIncomeStatements(incomeData, "annual"),
          balanceSheets: normalizeBalanceSheets(balanceData, "annual"),
          cashFlowStatements: normalizeCashFlowStatements(cashflowData, "annual")
        },
        quarterly: {
          incomeStatements: normalizeIncomeStatements(quarterlyIncomeData, "quarterly"),
          balanceSheets: normalizeBalanceSheets(quarterlyBalanceData, "quarterly"),
          cashFlowStatements: normalizeCashFlowStatements(quarterlyCashflowData, "quarterly")
        }
      },
      qualitative: {
        moatSignals: [],
        riskSignals: [],
        managementNotes: []
      },
      researchProfile: normalizeResearchProfile(profile, providerTimestamp),
      earningsCenter: {},
      analystResearch: {},
      researchTimeline: []
    }
  };
}

async function fetchFmpDirect(pathname, apiKey) {
  const separator = pathname.includes("?") ? "&" : "?";
  const response = await fetch(`https://financialmodelingprep.com${pathname}${separator}apikey=${encodeURIComponent(apiKey)}`, {
    headers: { "Accept": "application/json" }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
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
