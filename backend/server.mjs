import http from "node:http";
import { pathToFileURL } from "node:url";

export const APP_VERSION = "10.0.0";

const DEFAULT_FRONTEND_ORIGIN = "https://aoodycom-cmyk.github.io";
const DEFAULT_BODY_LIMIT = 24_000;
const PARSER_BODY_LIMIT = 260_000;
const FMP_TIMEOUT_MS = 12_000;
const OPENAI_TIMEOUT_MS = 24_000;

export function createBackendServer(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetch || globalThis.fetch;
  const rateStore = options.rateStore || new Map();

  return http.createServer(async (request, response) => {
    applySecurityHeaders(response);

    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      if (request.method === "OPTIONS") {
        if (!applyCorsHeaders(request, response, env)) {
          sendApiError(response, request, 403, "ORIGIN_NOT_ALLOWED");
          return;
        }
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        applyCorsHeaders(request, response, env);
        sendJson(response, 200, {
          status: "ok",
          version: APP_VERSION,
          fmpConfigured: Boolean(env.FMP_API_KEY),
          openAiConfigured: Boolean(env.OPENAI_API_KEY)
        });
        return;
      }

      if (!url.pathname.startsWith("/api/")) {
        sendApiError(response, request, 404, "NOT_FOUND");
        return;
      }

      if (!applyCorsHeaders(request, response, env)) {
        sendApiError(response, request, 403, "ORIGIN_NOT_ALLOWED");
        return;
      }

      await checkRateLimit(request, response, rateStore, env, `${request.method}:${url.pathname}`, rateLimitFor(url.pathname, env));

      if (request.method === "GET" && url.pathname === "/api/search") {
        await handleSearch(url.searchParams.get("q"), response, env, fetchImpl);
        return;
      }

      const companyMatch = url.pathname.match(/^\/api\/company\/([^/]+)$/);
      if (request.method === "GET" && companyMatch) {
        await handleCompany(companyMatch[1], response, env, fetchImpl);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/parse-investment-analyst") {
        await handleInvestmentAnalystParse(request, response, env, fetchImpl);
        return;
      }

      // Backward-compatible aliases for older local clients. The GitHub Pages client uses the GET endpoints above.
      if (request.method === "POST" && url.pathname === "/api/search") {
        const body = await readJson(request, DEFAULT_BODY_LIMIT);
        await handleSearch(body.query, response, env, fetchImpl);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/research-data") {
        const body = await readJson(request, DEFAULT_BODY_LIMIT);
        await handleCompany(body.ticker, response, env, fetchImpl);
        return;
      }

      sendApiError(response, request, 404, "NOT_FOUND");
    } catch (error) {
      if (error instanceof HttpError) {
        sendApiError(response, request, error.status, error.code);
        return;
      }
      sendApiError(response, request, 500, "SERVER_ERROR");
    }
  });
}

export function startBackendServer(options = {}) {
  const env = options.env || process.env;
  const port = Number(env.PORT || 4321);
  const host = env.HOST || "0.0.0.0";
  const server = createBackendServer(options);
  server.listen(port, host, () => {
    console.log(`Franklin Research API ${APP_VERSION} listening on http://${host}:${port}`);
  });
  return server;
}

async function handleSearch(query, response, env, fetchImpl) {
  assertConfigured(env.FMP_API_KEY, "FMP_NOT_CONFIGURED");
  const clean = validateSearchQuery(query);
  const data = await fetchFmp(`/stable/search-symbol?query=${encodeURIComponent(clean)}`, env.FMP_API_KEY, fetchImpl);
  if (!Array.isArray(data)) throw new HttpError(502, "MALFORMED_PROVIDER_RESPONSE");
  const results = data.slice(0, 10).map((item) => ({
    ticker: item.symbol || item.ticker,
    name: item.name || item.companyName || item.symbol,
    sector: item.exchange || item.exchangeShortName || "Market",
    industry: item.currency || "Equity",
    exchange: item.exchangeShortName || item.exchange || "",
    currency: item.currency || "USD"
  })).filter((item) => item.ticker);
  sendJson(response, 200, { results });
}

async function handleCompany(symbol, response, env, fetchImpl) {
  assertConfigured(env.FMP_API_KEY, "FMP_NOT_CONFIGURED");
  const ticker = validateTicker(symbol);
  const [
    quoteData,
    profileData,
    consensusData,
    incomeData,
    balanceData,
    cashflowData,
    quarterlyIncomeData,
    quarterlyBalanceData,
    quarterlyCashflowData
  ] = await Promise.all([
    fetchFmp(`/stable/quote?symbol=${encodeURIComponent(ticker)}`, env.FMP_API_KEY, fetchImpl),
    fetchFmp(`/stable/profile?symbol=${encodeURIComponent(ticker)}`, env.FMP_API_KEY, fetchImpl),
    fetchFmp(`/stable/price-target-consensus?symbol=${encodeURIComponent(ticker)}`, env.FMP_API_KEY, fetchImpl).catch(() => []),
    fetchFmp(`/stable/income-statement?symbol=${encodeURIComponent(ticker)}&limit=4`, env.FMP_API_KEY, fetchImpl),
    fetchFmp(`/stable/balance-sheet-statement?symbol=${encodeURIComponent(ticker)}&limit=4`, env.FMP_API_KEY, fetchImpl),
    fetchFmp(`/stable/cash-flow-statement?symbol=${encodeURIComponent(ticker)}&limit=4`, env.FMP_API_KEY, fetchImpl),
    fetchFmp(`/stable/income-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=8`, env.FMP_API_KEY, fetchImpl).catch(() => []),
    fetchFmp(`/stable/balance-sheet-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=8`, env.FMP_API_KEY, fetchImpl).catch(() => []),
    fetchFmp(`/stable/cash-flow-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=8`, env.FMP_API_KEY, fetchImpl).catch(() => [])
  ]);

  const quote = Array.isArray(quoteData) ? quoteData[0] || {} : quoteData || {};
  const profile = Array.isArray(profileData) ? profileData[0] || {} : profileData || {};
  if (!Object.keys(quote).length && !Object.keys(profile).length) throw new HttpError(404, "COMPANY_NOT_FOUND");

  const consensus = Array.isArray(consensusData) ? consensusData[0] || {} : consensusData || {};
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

async function handleInvestmentAnalystParse(request, response, env, fetchImpl) {
  assertConfigured(env.OPENAI_API_KEY, "OPENAI_NOT_CONFIGURED");
  const body = await readJson(request, PARSER_BODY_LIMIT);
  const text = validatePastedText(body.text);
  const openAiResponse = await fetchProviderJson("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(openAiParserRequest({ ...body, text }, env)),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS)
  }, fetchImpl, "openai");

  const raw = openAiResponse.output_text
    || (Array.isArray(openAiResponse.output) ? openAiResponse.output.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") : "");
  try {
    const parsed = JSON.parse(raw || "{}");
    sendJson(response, 200, {
      source: parsed.source || "OpenAI",
      parsedFields: Array.isArray(parsed.parsedFields) ? parsed.parsedFields : [],
      explanations: Array.isArray(parsed.explanations) ? parsed.explanations : []
    });
  } catch {
    throw new HttpError(502, "MALFORMED_PROVIDER_RESPONSE");
  }
}

function openAiParserRequest(body, env) {
  return {
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "You parse unstructured equity research data for a deterministic valuation engine.",
          "Use the supplied methodology as policy context, but do not calculate final fair value, recommendation, or investment score.",
          "Never invent missing financial values. Preserve standard financial terms in English.",
          "Return JSON only."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          language: body.language || "ar",
          task: "Extract company data fields from the pasted block. Return parsedFields only for values explicitly present or clearly stated.",
          methodologyText: truncate(String(body.methodologyText || ""), 80_000),
          outputSchema: body.outputSchema || null,
          expectedJsonShape: {
            source: "OpenAI",
            parsedFields: [
              {
                fieldId: "ticker",
                value: "AAPL",
                source: "User Paste",
                sourceDate: "YYYY-MM-DD or blank",
                confidence: 0.9,
                originalTextReference: "short supporting excerpt"
              }
            ],
            explanations: ["short Arabic notes about parsing limitations"]
          },
          pastedBlock: body.text
        })
      }
    ],
    text: { format: { type: "json_object" } }
  };
}

async function fetchFmp(pathname, apiKey, fetchImpl) {
  const separator = pathname.includes("?") ? "&" : "?";
  const url = `https://financialmodelingprep.com${pathname}${separator}apikey=${encodeURIComponent(apiKey)}`;
  return fetchProviderJson(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(FMP_TIMEOUT_MS)
  }, fetchImpl, "fmp");
}

async function fetchProviderJson(url, options, fetchImpl, provider) {
  try {
    const response = await fetchImpl(url, options);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new HttpError(502, "MALFORMED_PROVIDER_RESPONSE");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new HttpError(502, provider === "openai" ? "OPENAI_INVALID_KEY" : "FMP_INVALID_KEY");
      if (response.status === 404) throw new HttpError(404, "COMPANY_NOT_FOUND");
      if (response.status === 429) throw new HttpError(429, provider === "openai" ? "OPENAI_RATE_LIMIT" : "FMP_RATE_LIMIT");
      throw new HttpError(502, "PROVIDER_UNAVAILABLE");
    }
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.name === "AbortError" || error.name === "TimeoutError") throw new HttpError(504, "PROVIDER_TIMEOUT");
    throw new HttpError(503, "INTERNET_CONNECTION_FAILURE");
  }
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let data = "";
    let rejected = false;
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxBytes && !rejected) {
        rejected = true;
        reject(new HttpError(413, "REQUEST_TOO_LARGE"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new HttpError(400, "MALFORMED_JSON"));
      }
    });
    request.on("error", () => {
      if (!rejected) reject(new HttpError(400, "MALFORMED_JSON"));
    });
  });
}

async function checkRateLimit(request, response, rateStore, env, bucket, maxRequests) {
  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 60_000);
  const now = Date.now();
  const key = `${clientIp(request)}:${bucket}`;
  const entry = rateStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  rateStore.set(key, entry);
  if (entry.count > maxRequests) {
    response.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    throw new HttpError(429, "RATE_LIMITED");
  }
}

function rateLimitFor(pathname, env) {
  if (pathname === "/api/parse-investment-analyst") return Number(env.PARSER_RATE_LIMIT_MAX || 8);
  return Number(env.RATE_LIMIT_MAX || 45);
}

function applyCorsHeaders(request, response, env) {
  const origin = request.headers.origin;
  if (!origin && request.url === "/api/health") return true;
  if (!origin) return false;
  if (!allowedOrigins(env).has(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "600");
  return true;
}

function allowedOrigins(env) {
  const configured = String(env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(configured);
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
}

function sendApiError(response, request, status, code) {
  sendJson(response, status, { error: { code, message: userMessage(code, request) } });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function userMessage(code, request) {
  const language = String(request.headers["accept-language"] || "").toLowerCase().startsWith("ar") ? "ar" : "en";
  const messages = {
    COMPANY_NOT_FOUND: ["Company was not found by the market data provider.", "لم يتم العثور على الشركة لدى مزود بيانات السوق."],
    FMP_INVALID_KEY: ["Market data provider rejected the server API key.", "رفض مزود بيانات السوق مفتاح الخادم."],
    FMP_NOT_CONFIGURED: ["Market data is not configured on the server.", "بيانات السوق غير مفعلة على الخادم."],
    FMP_RATE_LIMIT: ["Market data provider rate limit reached. Try again later.", "تم الوصول إلى حد طلبات مزود بيانات السوق. حاول لاحقًا."],
    INPUT_TOO_LONG: ["Input is too long for production processing.", "المدخلات طويلة جدًا للمعالجة."],
    INTERNET_CONNECTION_FAILURE: ["Provider connection failed. Try again later.", "فشل الاتصال بمزود البيانات. حاول لاحقًا."],
    INVALID_PASTE: ["Paste a company data block first.", "ألصق بيانات الشركة أولًا."],
    INVALID_QUERY: ["Enter a valid company name or ticker.", "أدخل اسم شركة أو رمز سهم صحيح."],
    INVALID_TICKER: ["Enter a valid ticker symbol.", "أدخل رمز سهم صحيح."],
    MALFORMED_JSON: ["Request body is not valid JSON.", "صيغة الطلب غير صحيحة."],
    MALFORMED_PROVIDER_RESPONSE: ["Provider returned data in an unexpected format.", "أعاد مزود البيانات صيغة غير متوقعة."],
    NOT_FOUND: ["Endpoint not found.", "المسار غير موجود."],
    OPENAI_INVALID_KEY: ["OpenAI rejected the server API key.", "رفض OpenAI مفتاح الخادم."],
    OPENAI_NOT_CONFIGURED: ["OpenAI parsing is not configured on the server.", "تحليل OpenAI غير مفعل على الخادم."],
    OPENAI_RATE_LIMIT: ["OpenAI rate limit reached. Try again later.", "تم الوصول إلى حد طلبات OpenAI. حاول لاحقًا."],
    ORIGIN_NOT_ALLOWED: ["This origin is not allowed to call the private API.", "هذا المصدر غير مسموح له باستخدام API الخاص."],
    PROVIDER_TIMEOUT: ["Provider request timed out. Try again.", "انتهت مهلة مزود البيانات. حاول مرة أخرى."],
    PROVIDER_UNAVAILABLE: ["Provider is temporarily unavailable.", "مزود البيانات غير متاح مؤقتًا."],
    RATE_LIMITED: ["Too many requests. Please slow down.", "طلبات كثيرة جدًا. حاول بعد قليل."],
    REQUEST_TOO_LARGE: ["Request is too large.", "حجم الطلب كبير جدًا."],
    SERVER_ERROR: ["A safe server error occurred.", "حدث خطأ آمن في الخادم."]
  };
  const pair = messages[code] || messages.SERVER_ERROR;
  return language === "ar" ? pair[1] : pair[0];
}

function validateSearchQuery(query) {
  const clean = String(query || "").trim();
  if (!clean) throw new HttpError(400, "INVALID_QUERY");
  if (clean.length > 80) throw new HttpError(400, "INPUT_TOO_LONG");
  if (!/^[\p{L}\p{N} .&,'/-]+$/u.test(clean)) throw new HttpError(400, "INVALID_QUERY");
  return clean;
}

function validateTicker(symbol) {
  const clean = String(symbol || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(clean)) throw new HttpError(400, "INVALID_TICKER");
  return clean;
}

function validatePastedText(text) {
  const clean = String(text || "").trim();
  if (!clean) throw new HttpError(400, "INVALID_PASTE");
  if (clean.length > 180_000) throw new HttpError(400, "INPUT_TOO_LONG");
  return clean;
}

function assertConfigured(value, code) {
  if (!value) throw new HttpError(503, code);
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

function truncate(value, limit) {
  return value.length > limit ? value.slice(0, limit) : value;
}

function clientIp(request) {
  return String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "local").split(",")[0].trim();
}

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startBackendServer();
}
