import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const preferredPort = Number(process.env.PORT || 4321);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "POST" && url.pathname === "/api/search") {
      await handleSearch(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/research-data") {
      await handleResearchData(request, response);
      return;
    }
    const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(publicDir, safePath.replace(/^\/+/, ""));
    if (!filePath.startsWith(publicDir)) return send(response, 403, "Forbidden", "text/plain");
    const body = await readFile(filePath);
    send(response, 200, body, mime[path.extname(filePath)] || "application/octet-stream");
  } catch (error) {
    send(response, 404, "Not found", "text/plain; charset=utf-8");
  }
});

async function handleSearch(request, response) {
  const body = await readJson(request);
  const query = String(body.query || "").trim();
  const apiKey = body.apiKey || process.env.FMP_API_KEY;
  if (!query || !apiKey) return sendJson(response, 400, { error: "Missing query or FMP API key" });
  const data = await fetchFmp(`/stable/search-symbol?query=${encodeURIComponent(query)}`, apiKey);
  const results = (Array.isArray(data) ? data : []).slice(0, 10).map((item) => ({
    ticker: item.symbol || item.ticker,
    name: item.name || item.companyName || item.symbol,
    sector: item.exchange || item.exchangeShortName || "Market",
    industry: item.currency || "Equity",
    exchange: item.exchangeShortName || item.exchange || "",
    currency: item.currency || "USD"
  })).filter((item) => item.ticker);
  sendJson(response, 200, { results });
}

async function handleResearchData(request, response) {
  const body = await readJson(request);
  const ticker = cleanSymbol(body.ticker);
  const apiKey = body.apiKey || process.env.FMP_API_KEY;
  if (!ticker || !apiKey) return sendJson(response, 400, { error: "Missing ticker or FMP API key" });
  const [quoteData, profileData, consensusData, incomeData, balanceData, cashflowData, quarterlyIncomeData, quarterlyBalanceData, quarterlyCashflowData] = await Promise.all([
    fetchFmp(`/stable/quote?symbol=${encodeURIComponent(ticker)}`, apiKey),
    fetchFmp(`/stable/profile?symbol=${encodeURIComponent(ticker)}`, apiKey),
    fetchFmp(`/stable/price-target-consensus?symbol=${encodeURIComponent(ticker)}`, apiKey).catch(() => []),
    fetchFmp(`/stable/income-statement?symbol=${encodeURIComponent(ticker)}&limit=4`, apiKey),
    fetchFmp(`/stable/balance-sheet-statement?symbol=${encodeURIComponent(ticker)}&limit=4`, apiKey),
    fetchFmp(`/stable/cash-flow-statement?symbol=${encodeURIComponent(ticker)}&limit=4`, apiKey),
    fetchFmp(`/stable/income-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=8`, apiKey).catch(() => []),
    fetchFmp(`/stable/balance-sheet-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=8`, apiKey).catch(() => []),
    fetchFmp(`/stable/cash-flow-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=8`, apiKey).catch(() => [])
  ]);
  const quote = Array.isArray(quoteData) ? quoteData[0] || {} : quoteData || {};
  const profile = Array.isArray(profileData) ? profileData[0] || {} : profileData || {};
  const consensus = Array.isArray(consensusData) ? consensusData[0] || {} : consensusData || {};
  const financials = normalizeFinancials(incomeData, balanceData, cashflowData);
  const providerTimestamp = new Date().toISOString();
  const company = {
    ticker,
    name: quote.name || profile.companyName || ticker,
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
    financials,
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
  };
  sendJson(response, 200, {
    provider: {
      id: "fmp",
      name: "Financial Modeling Prep",
      timestamp: providerTimestamp,
      providerTypes: ["QuoteProvider", "FinancialProvider", "AnalystProvider"]
    },
    company
  });
}

function normalizeResearchProfile(profile = {}, timestamp) {
  const management = [];
  if (profile.ceo) management.push(`CEO: ${profile.ceo}`);
  if (profile.fullTimeEmployees) management.push(`Employees: ${profile.fullTimeEmployees}`);
  return {
    source: "Financial Modeling Prep",
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
    const year = Number(String(row.calendarYear || row.year || row.date || "").slice(0, 4));
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
    const year = Number(String(row.calendarYear || row.year || row.date || "").slice(0, 4));
    if (!year || !byYear.has(year)) continue;
    Object.assign(byYear.get(year), {
      cash: number(row.cashAndCashEquivalents),
      debt: firstNumber(row.totalDebt, sumNumbers(row.shortTermDebt, row.longTermDebt)),
      equity: number(row.totalStockholdersEquity)
    });
  }
  for (const row of Array.isArray(cashflow) ? cashflow : []) {
    const year = Number(String(row.calendarYear || row.year || row.date || "").slice(0, 4));
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

async function fetchFmp(pathname, apiKey) {
  const separator = pathname.includes("?") ? "&" : "?";
  const url = `https://financialmodelingprep.com${pathname}${separator}apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
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

function sumNumbers(...values) {
  const clean = values.map(number).filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0);
}

function percentNumber(value) {
  const parsed = number(value);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

function absNumber(value) {
  const parsed = number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function compactList(values = []) {
  return values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim());
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function send(response, status, body, contentType) {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

let activePort = preferredPort;
let attempts = 0;

server.on("error", (error) => {
  if ((error.code === "EADDRINUSE" || error.code === "EPERM") && attempts < 20) {
    attempts += 1;
    activePort += 1;
    server.listen(activePort, host);
    return;
  }
  throw error;
});

server.on("listening", () => {
  const label = host === "0.0.0.0" ? "your local network" : "localhost";
  console.log(`AI Equity Research V5 is running on ${label} at http://localhost:${activePort}`);
});

server.listen(activePort, host);
