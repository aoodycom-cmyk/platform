import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable, Writable } from "node:stream";
import { createBackendServer, APP_VERSION } from "../backend/server.mjs";

const ALLOWED_ORIGIN = "https://aoodycom-cmyk.github.io";
const BLOCKED_ORIGIN = "https://example.com";
const fakeSecrets = {
  fmp: "fmp_secret_test_value",
  openai: "openai_secret_test_value"
};
const requestLog = [];

const mockFetch = async (url, options = {}) => {
  requestLog.push({ url: String(url), body: options.body || "", headers: options.headers || {} });
  const textUrl = String(url);
  if (textUrl.includes("search-symbol")) {
    return jsonResponse([{ symbol: "AAPL", name: "Apple Inc.", exchangeShortName: "NASDAQ", currency: "USD" }]);
  }
  if (textUrl.includes("quote")) {
    return jsonResponse([{ symbol: "AAPL", name: "Apple Inc.", price: 123.45, marketCap: 3_000_000_000_000, changesPercentage: 1.2 }]);
  }
  if (textUrl.includes("profile")) {
    return jsonResponse([{ companyName: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics", currency: "USD", country: "US", website: "https://apple.com" }]);
  }
  if (textUrl.includes("price-target-consensus")) {
    return jsonResponse([{ targetConsensus: 150, targetLow: 120, targetHigh: 180 }]);
  }
  if (textUrl.includes("income-statement")) {
    return jsonResponse([{ calendarYear: "2025", revenue: 1000, grossProfit: 450, operatingIncome: 260, netIncome: 210, eps: 4.2, ebitda: 300, weightedAverageShsOutDil: 50 }]);
  }
  if (textUrl.includes("balance-sheet-statement")) {
    return jsonResponse([{ calendarYear: "2025", cashAndCashEquivalents: 300, totalDebt: 100, totalStockholdersEquity: 900 }]);
  }
  if (textUrl.includes("cash-flow-statement")) {
    return jsonResponse([{ calendarYear: "2025", freeCashFlow: 180, netCashProvidedByOperatingActivities: 220, capitalExpenditure: -40 }]);
  }
  if (textUrl.includes("api.openai.com")) {
    return jsonResponse({
      output_text: JSON.stringify({
        source: "OpenAI",
        parsedFields: [{ fieldId: "ticker", value: "AAPL", source: "User Paste", confidence: 0.9 }],
        explanations: ["تم استخراج الحقول المذكورة فقط."]
      })
    });
  }
  return jsonResponse({ error: "not found" }, 404);
};

const env = {
  FRONTEND_ORIGIN: ALLOWED_ORIGIN,
  FMP_API_KEY: fakeSecrets.fmp,
  OPENAI_API_KEY: fakeSecrets.openai,
  OPENAI_MODEL: "gpt-test-parser",
  RATE_LIMIT_MAX: "20",
  PARSER_RATE_LIMIT_MAX: "20"
};

class MockRequest extends Readable {
  constructor(payload) {
    super();
    this.payload = payload;
  }

  _read() {
    this.push(this.payload);
    this.push(null);
  }
}

class MockResponse extends Writable {
  constructor(done) {
    super();
    this.done = done;
    this.status = 200;
    this.headers = {};
    this.chunks = [];
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  writeHead(status, headers = {}) {
    this.status = status;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  end(chunk) {
    if (chunk) this.chunks.push(Buffer.from(chunk));
    this.done({ status: this.status, headers: this.headers, chunks: this.chunks });
    super.end();
  }
}

const server = createBackendServer({ env, fetch: mockFetch, rateStore: new Map() });

try {
  const health = await inject(server, { path: "/api/health" });
  assert.equal(health.status, 200);
  assert.equal(health.json.status, "ok");
  assert.equal(health.json.version, APP_VERSION);
  assert.equal(health.json.fmpConfigured, true);
  assert.equal(health.json.openAiConfigured, true);
  assert.equal(JSON.stringify(health.json).includes(fakeSecrets.fmp), false);
  assert.equal(JSON.stringify(health.json).includes(fakeSecrets.openai), false);

  const blocked = await inject(server, { path: "/api/search?q=AAPL", headers: { origin: BLOCKED_ORIGIN } });
  assert.equal(blocked.status, 403);

  const options = await inject(server, { method: "OPTIONS", path: "/api/search", headers: { origin: ALLOWED_ORIGIN } });
  assert.equal(options.status, 204);
  assert.equal(options.headers["access-control-allow-origin"], ALLOWED_ORIGIN);

  const search = await inject(server, { path: "/api/search?q=AAPL", headers: { origin: ALLOWED_ORIGIN } });
  assert.equal(search.status, 200);
  assert.equal(search.json.results[0].ticker, "AAPL");
  assert.equal(search.headers["access-control-allow-origin"], ALLOWED_ORIGIN);

  const company = await inject(server, { path: "/api/company/AAPL", headers: { origin: ALLOWED_ORIGIN } });
  assert.equal(company.status, 200);
  assert.equal(company.json.company.ticker, "AAPL");
  assert.equal(company.json.company.quote.price, 123.45);
  assert.equal(company.json.provider.name, "Financial Modeling Prep");
  assert.equal(JSON.stringify(company.json).includes(fakeSecrets.fmp), false);

  const parser = await inject(server, {
    method: "POST",
    path: "/api/parse-investment-analyst",
    headers: { origin: ALLOWED_ORIGIN, "content-type": "application/json" },
    body: { text: "Ticker: AAPL Revenue: 1000", language: "ar" }
  });
  assert.equal(parser.status, 200);
  assert.equal(parser.json.parsedFields[0].fieldId, "ticker");
  assert.equal(JSON.stringify(parser.json).includes(fakeSecrets.openai), false);

  const invalidTicker = await inject(server, { path: "/api/company/../../../AAPL", headers: { origin: ALLOWED_ORIGIN } });
  assert.equal(invalidTicker.status, 404);

  const lowLimitServer = createBackendServer({ env: { ...env, RATE_LIMIT_MAX: "1" }, fetch: mockFetch, rateStore: new Map() });
  await inject(lowLimitServer, { path: "/api/search?q=AAPL", headers: { origin: ALLOWED_ORIGIN } });
  const limited = await inject(lowLimitServer, { path: "/api/search?q=MSFT", headers: { origin: ALLOWED_ORIGIN } });
  assert.equal(limited.status, 429);
  assert.equal(limited.text.includes(fakeSecrets.fmp), false);

  const missingConfigServer = createBackendServer({ env: { FRONTEND_ORIGIN: ALLOWED_ORIGIN }, fetch: mockFetch, rateStore: new Map() });
  const missing = await inject(missingConfigServer, { path: "/api/search?q=AAPL", headers: { origin: ALLOWED_ORIGIN } });
  assert.equal(missing.status, 503);
  assert.equal(missing.text.includes("FMP_NOT_CONFIGURED"), true);

  const frontendFiles = [
    "../public/src/providers/apiClient.js",
    "../public/src/dataPlatform/providerContracts.js",
    "../public/src/providers/backendEndpoint.js",
    "../public/backend-config.js",
    "../docs/backend-config.js"
  ].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  for (const forbidden of ["FMP_API_KEY", "OPENAI_API_KEY", fakeSecrets.fmp, fakeSecrets.openai, "api.openai.com", "financialmodelingprep.com", "Authorization"]) {
    assert.equal(frontendFiles.includes(forbidden), false, `${forbidden} must not appear in frontend files.`);
  }

  for (const entry of requestLog) {
    assert.equal(String(entry.body).includes(fakeSecrets.fmp), false);
    assert.equal(String(entry.body).includes(fakeSecrets.openai), false);
  }
} finally {
  server.close();
}

console.log("Secure backend API tests passed.");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function inject(server, { method = "GET", path = "/", headers = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const payload = body === null ? "" : JSON.stringify(body);
    const request = new MockRequest(payload);
    request.method = method;
    request.url = path;
    request.headers = {
      host: "127.0.0.1",
      accept: "application/json",
      ...(payload ? { "content-type": "application/json" } : {}),
      ...headers
    };
    request.socket = { remoteAddress: "127.0.0.1" };
    const response = new MockResponse((result) => {
      const text = Buffer.concat(result.chunks).toString("utf8");
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      resolve({ ...result, text, json });
    });
    server.emit("request", request, response);
  });
}
