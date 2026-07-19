import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable, Writable } from "node:stream";
import { createAppServer, APP_VERSION } from "../server.mjs";

const source = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
assert.ok(source.includes('env.HOST || "0.0.0.0"'), "Production server must default to 0.0.0.0.");
assert.equal(APP_VERSION, "10.0.0");

const jsonHeaders = { "Content-Type": "application/json" };
const requestLog = [];
const fakeSecrets = {
  fmp: "fmp_secret_test_value",
  openai: "openai_secret_test_value"
};

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

  getHeader(name) {
    return this.headers[name.toLowerCase()];
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

const env = {
  APP_ACCESS_PASSWORD: "correct-password",
  APP_SESSION_SECRET: "session-secret",
  FMP_API_KEY: fakeSecrets.fmp,
  OPENAI_API_KEY: fakeSecrets.openai,
  OPENAI_MODEL: "gpt-test-parser",
  RATE_LIMIT_MAX: "20",
  PARSER_RATE_LIMIT_MAX: "20"
};

const server = createAppServer({ env, fetch: mockFetch, rateStore: new Map() });

try {
  const health = (await inject(server, { path: "/api/health" })).json;
  assert.equal(health.status, "ok");
  assert.equal(health.version, "10.0.0");
  assert.equal(health.fmpConfigured, true);
  assert.equal(health.openAiConfigured, true);
  assert.equal(JSON.stringify(health).includes(fakeSecrets.fmp), false);
  assert.equal(JSON.stringify(health).includes(fakeSecrets.openai), false);

  const unauthApi = await inject(server, { method: "POST", path: "/api/search", body: { query: "AAPL" } });
  assert.equal(unauthApi.status, 401);

  const loginScreen = await inject(server, { path: "/", headers: { accept: "text/html" } });
  assert.equal(loginScreen.status, 200);
  assert.ok(loginScreen.text.includes("Private Beta"));

  const badLogin = await inject(server, { method: "POST", path: "/api/login", body: { password: "wrong" } });
  assert.equal(badLogin.status, 401);

  const login = await inject(server, { method: "POST", path: "/api/login", body: { password: "correct-password" } });
  assert.equal(login.status, 200);
  const cookie = login.headers["set-cookie"];
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=Lax"));

  const app = await inject(server, { path: "/", headers: { cookie, accept: "text/html" } });
  assert.equal(app.status, 200);
  assert.ok(app.text.includes("Franklin Research 10.0.0"));
  assert.ok(app.text.includes("apple-mobile-web-app-title"));

  const search = await inject(server, { method: "POST", path: "/api/search", headers: { cookie }, body: { query: "AAPL" } });
  assert.equal(search.status, 200);
  assert.deepEqual(search.json.results[0].ticker, "AAPL");

  const research = await inject(server, { method: "POST", path: "/api/research-data", headers: { cookie }, body: { ticker: "AAPL" } });
  assert.equal(research.status, 200);
  assert.equal(research.json.company.ticker, "AAPL");
  assert.equal(research.json.company.quote.price, 123.45);
  assert.equal(JSON.stringify(research.json).includes(fakeSecrets.fmp), false);

  const parser = await inject(server, {
    method: "POST",
    path: "/api/parse-investment-analyst",
    headers: { cookie },
    body: { text: "Ticker: AAPL Revenue: 1000", language: "ar" }
  });
  assert.equal(parser.status, 200);
  assert.equal(parser.json.parsedFields[0].fieldId, "ticker");

  const invalidTicker = await inject(server, { method: "POST", path: "/api/research-data", headers: { cookie }, body: { ticker: "../../../AAPL" } });
  assert.equal(invalidTicker.status, 400);

  const manifest = await inject(server, { path: "/manifest.webmanifest" });
  assert.equal(manifest.status, 200);
  assert.equal(manifest.json.name, "Franklin Research");
  assert.equal(manifest.json.display, "standalone");
  assert.ok(manifest.json.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.json.icons.some((icon) => icon.sizes === "512x512"));

  const serviceWorker = await inject(server, { path: "/service-worker.js", headers: { cookie } });
  assert.equal(serviceWorker.status, 200);
  assert.ok(serviceWorker.text.includes("offline.html"));
  assert.equal(serviceWorker.text.includes("/api/search"), false);
  assert.equal(serviceWorker.text.includes("api.openai.com"), false);

  const offline = await inject(server, { path: "/offline.html" });
  assert.equal(offline.status, 200);
  assert.ok(offline.text.includes("أنت غير متصل"));

  const loginScript = await inject(server, { path: "/src/login.js" });
  assert.equal(loginScript.status, 200);

  const frontendFiles = [
    "../public/src/providers/apiClient.js",
    "../public/src/dataPlatform/providerContracts.js",
    "../public/src/state/store.js",
    "../public/src/ui/components.js",
    "../public/src/main.js",
    "../public/src/pwa.js"
  ].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  for (const forbidden of ["apiKey", "apiKeys", "financialmodelingprep", "api.openai.com", "Authorization", "equityResearchFmpKey", "equityResearchOpenAiKey"]) {
    assert.equal(frontendFiles.includes(forbidden), false, `${forbidden} must not appear in frontend bundles.`);
  }

  for (const entry of requestLog) {
    assert.equal(String(entry.body).includes(fakeSecrets.fmp), false, "Frontend request bodies must not include FMP secrets.");
    assert.equal(String(entry.body).includes(fakeSecrets.openai), false, "Frontend request bodies must not include OpenAI secrets.");
  }

  const lowLimitServer = createAppServer({ env: { ...env, RATE_LIMIT_MAX: "1" }, fetch: mockFetch, rateStore: new Map() });
  const lowLogin = await inject(lowLimitServer, { method: "POST", path: "/api/login", body: { password: "correct-password" } });
  const lowCookie = lowLogin.headers["set-cookie"];
  await inject(lowLimitServer, { method: "POST", path: "/api/search", headers: { cookie: lowCookie }, body: { query: "AAPL" } });
  const limited = await inject(lowLimitServer, { method: "POST", path: "/api/search", headers: { cookie: lowCookie }, body: { query: "MSFT" } });
  assert.equal(limited.status, 429);
  assert.equal(limited.text.includes(fakeSecrets.fmp), false);

  const missingConfigServer = createAppServer({ env: { APP_ACCESS_PASSWORD: "correct-password" }, fetch: mockFetch, rateStore: new Map() });
  const cfgLogin = await inject(missingConfigServer, { method: "POST", path: "/api/login", body: { password: "correct-password" } });
  const cfgCookie = cfgLogin.headers["set-cookie"];
  const missing = await inject(missingConfigServer, { method: "POST", path: "/api/search", headers: { cookie: cfgCookie }, body: { query: "AAPL" } });
  assert.equal(missing.status, 503);
  assert.equal(missing.text.includes("FMP_NOT_CONFIGURED"), true);
} finally {
  server.close();
}

console.log("Version 10 production deployment tests passed.");

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
      ...(payload ? jsonHeaders : {}),
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
