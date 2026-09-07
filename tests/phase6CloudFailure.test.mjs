import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudSyncFailureState,
  ensureCloudSession,
  saveCloudState
} from "../src/cloud/franklinCloud.js";

const STATE_KEY = "equityResearchV4State";
const SESSION_KEY = "franklinSupabaseSessionV1";
const META_KEY = "franklinCloudMetaV1";
const localState = { stateSchemaVersion: 2, externalAnalyses: { TEST: [{ id: "R1", analysisOrigin: "external_chatgpt", company: { ticker: "TEST" } }] } };

test("expired session failure keeps local state and becomes auth-required", { concurrency: false }, async () => {
  installBrowser({
    [STATE_KEY]: JSON.stringify(localState),
    [SESSION_KEY]: JSON.stringify({ access_token: "expired", refresh_token: "bad", expires_at: 1 })
  }, async () => response(401, { error: "invalid refresh" }));
  const before = localStorage.getItem(STATE_KEY);
  assert.equal(await ensureCloudSession(), null);
  assert.equal(localStorage.getItem(STATE_KEY), before);
  assert.equal(localStorage.getItem(SESSION_KEY), null);
  const failure = cloudSyncFailureState(new Error("AUTH_REQUIRED"));
  assert.equal(failure.status, "auth-required");
  assert.equal(failure.retryable, false);
});

test("503 during cloud save is explicit and never changes local state", { concurrency: false }, async () => {
  let calls = 0;
  installBrowser(sessionState(), async (url) => {
    calls += 1;
    if (String(url).includes("franklin_user_state?")) return response(200, []);
    return response(503, { error: "temporary unavailable" });
  });
  const before = localStorage.getItem(STATE_KEY);
  await assert.rejects(() => saveCloudState(localState), /temporary unavailable/);
  assert.equal(calls, 2);
  assert.equal(localStorage.getItem(STATE_KEY), before);
  assert.match(JSON.parse(localStorage.getItem(META_KEY)).lastError, /temporary unavailable/);
});

test("ambiguous retry uses revision precondition and cannot double-apply", { concurrency: false }, async () => {
  const bodies = [];
  installBrowser(sessionState(), async (url, options = {}) => {
    if (String(url).includes("franklin_user_state?")) return response(200, [{ state: localState, revision: 7, updated_at: "2026-09-06T00:00:00Z" }]);
    bodies.push(JSON.parse(options.body));
    return response(409, { error: "REVISION_CONFLICT" });
  });
  await assert.rejects(() => saveCloudState(localState), /REVISION_CONFLICT/);
  await assert.rejects(() => saveCloudState(localState), /REVISION_CONFLICT/);
  assert.equal(bodies.length, 2);
  assert.ok(bodies.every((body) => body.p_expected_revision === 7));
  assert.equal(cloudSyncFailureState(new Error("REVISION_CONFLICT")).status, "conflict");
  assert.equal(JSON.parse(localStorage.getItem(STATE_KEY)).externalAnalyses.TEST.length, 1);
});

function sessionState() { return { [STATE_KEY]: JSON.stringify(localState), [SESSION_KEY]: JSON.stringify({ access_token: "valid", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }) }; }
function installBrowser(initial, fetchImpl) { globalThis.localStorage = memoryStorage(initial); globalThis.window = { FRANKLIN_SUPABASE_URL: "https://phase6.invalid", FRANKLIN_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key" }; globalThis.fetch = fetchImpl; if (!globalThis.crypto) globalThis.crypto = { randomUUID: () => "device-phase6" }; }
function memoryStorage(initial = {}) { const data = new Map(Object.entries(initial)); return { get length() { return data.size; }, key: (index) => [...data.keys()][index] || null, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }; }
function response(status, body) { const text = JSON.stringify(body); return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => text }; }
