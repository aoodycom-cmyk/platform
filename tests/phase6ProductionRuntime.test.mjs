import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  FRANKLIN_STATE_SCHEMA_VERSION,
  migrateFranklinState,
  migrateStoredFranklinState
} from "../src/state/migration.js";
import {
  createInvestmentDataBackup,
  mergeInvestmentDataBackup,
  parseInvestmentDataBackup
} from "../src/externalAnalysis/backup.js";
import { inspectJsonImportText, JSON_IMPORT_MAX_BYTES, readLocalJsonFile } from "../src/externalAnalysis/jsonFileImport.js";

const report = { id: "R1", analysisOrigin: "external_chatgpt", company: { ticker: "TEST" }, reportPeriod: "Q1 2026", analysisDate: "2026-04-01" };
const state = { stateSchemaVersion: 1, externalAnalyses: { TEST: [report] }, historicalRequirementSets: { TEST: [{ requirementSetId: "S1", requirements: [] }] } };

test("stale client rejects a newer state without rewriting it", () => {
  const raw = JSON.stringify({ ...state, stateSchemaVersion: FRANKLIN_STATE_SCHEMA_VERSION + 1, futureField: { preserved: true } });
  const storage = memoryStorage({ equityResearchV4State: raw });
  assert.throws(
    () => migrateStoredFranklinState(storage),
    (error) => error.code === "FRANKLIN_STATE_VERSION_UNSUPPORTED"
  );
  assert.equal(storage.getItem("equityResearchV4State"), raw);
});

test("malformed and truncated state is quarantined without erasing the source", () => {
  for (const raw of ["{", '{"externalAnalyses":{"TEST":[']) {
    const storage = memoryStorage({ equityResearchV4State: raw });
    assert.throws(() => migrateStoredFranklinState(storage), (error) => error.code === "FRANKLIN_STATE_INVALID_JSON" && Boolean(error.backupKey));
    assert.equal(storage.getItem("equityResearchV4State"), raw);
    assert.ok([...storage.entries()].some(([key, value]) => key.startsWith("franklinCorruptStateBackupV1:") && value === raw));
  }
});

test("quota failure during migration rolls the primary state back exactly", () => {
  const raw = JSON.stringify(state);
  const storage = quotaStorage({ equityResearchV4State: raw }, "equityResearchV4State");
  assert.throws(() => migrateStoredFranklinState(storage));
  assert.equal(storage.getItem("equityResearchV4State"), raw);
});

test("backup round trip preserves state and conflicting duplicates are explicit", () => {
  const migrated = migrateFranklinState(state).state;
  const backup = createInvestmentDataBackup(migrated, new Date("2026-09-06T00:00:00Z"));
  const parsed = parseInvestmentDataBackup(JSON.stringify(backup));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.preview.externalReportCount, 1);
  const conflicting = structuredClone(parsed.backup);
  conflicting.data.externalAnalyses.TEST[0].analysisDate = "2026-04-02";
  assert.throws(() => mergeInvestmentDataBackup(migrated, conflicting), (error) => error.code === "BACKUP_CONFLICT");
});

test("JSON input limits, BOM, malformed UTF-8 and deep incomplete payloads fail explicitly", async () => {
  const bom = inspectJsonImportText(`\uFEFF${JSON.stringify({ schemaVersion: "external-analysis-supplement/v1", ticker: "TEST", targetAnalysisId: "R1", fields: {}, sources: [] })}`, { intendedRoute: "supplement" });
  assert.equal(bom.value.schemaVersion, "external-analysis-supplement/v1");
  await assert.rejects(() => readLocalJsonFile(file("too-large.json", new Uint8Array(1), JSON_IMPORT_MAX_BYTES + 1)), (error) => error.code === "FILE_TOO_LARGE");
  await assert.rejects(() => readLocalJsonFile(file("bad.json", Uint8Array.from([0xc3, 0x28]))), (error) => error.code === "INVALID_UTF8");
  assert.throws(() => inspectJsonImportText('{"a":{"b":[1,2]'), (error) => error.code === "INCOMPLETE_JSON");
});

test("service worker and deploy configuration retain strict production invariants", async () => {
  const [worker, server, backendConfig] = await Promise.all([
    readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../backend-config.js", import.meta.url), "utf8")
  ]);
  assert.match(worker, /const CACHE_NAME = "franklin-research-[^"]+"/);
  assert.match(worker, /event\.request\.method!=="GET"/);
  assert.match(worker, /const OFFLINE_URL = new URL\("\.\/offline\.html", self\.location\.href\)\.href/);
  assert.match(worker, /fetch\(event\.request\)\.catch\(\(\)=>caches\.match\(OFFLINE_URL\)\)/);
  assert.match(server, /"script-src 'self'"/);
  assert.match(server, /"worker-src 'self'"/);
  assert.match(server, /"frame-ancestors 'none'"/);
  assert.doesNotMatch(backendConfig, /service[_-]?role|OPENAI_API_KEY|FMP_API_KEY/i);
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { get length() { return data.size; }, key: (index) => [...data.keys()][index] || null, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key), entries: () => data.entries() };
}
function quotaStorage(initial, failingKey) { const storage = memoryStorage(initial); const set = storage.setItem; let failed = false; storage.setItem = (key, value) => { if (!failed && key === failingKey) { failed = true; throw Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" }); } set(key, value); }; return storage; }
function file(name, bytes, declaredSize = bytes.byteLength) { return { name, size: declaredSize, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; }
