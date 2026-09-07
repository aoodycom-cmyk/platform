import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { money } from "../src/domain/financialMetrics.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { mergeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementMerge.js";
import { normalizeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementSchema.js";
import { reconcileDeletedReportHistory } from "../src/state/store.js";
import { withCurrentPrice } from "../src/ui/reportPresentationEditor.js";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

function canonicalReport() {
  return {
    analysisOrigin: "external_chatgpt",
    source: "ChatGPT",
    analysisDate: "2026-09-06",
    company: { ticker: "TEST", name: "Test Co" },
    fairValueSummary: { currentPrice: 100, fairValueLow: 90, fairValueBase: 120, fairValueHigh: 150 },
    thesis: { shortSummary: "A sourced thesis." },
    risks: [{ title: "Execution", sourceIds: ["S1"] }],
    decision: { action: "HOLD" },
    sources: [{ id: "S1", title: "Filing", type: "SEC", date: "2026-08-01", url: "https://www.sec.gov/example" }]
  };
}

test("P1 browser provider uses the primary server POST contract", async () => {
  const text = await source("src/dataPlatform/providerContracts.js");
  assert.match(text, /fetch\(apiUrl\("\/api\/search"\),\s*\{\s*method:\s*"POST"/s);
  assert.match(text, /fetch\(apiUrl\("\/api\/research-data"\),\s*\{\s*method:\s*"POST"/s);
  assert.doesNotMatch(text, /\/api\/company\//);
});

test("P1 canonical provenance rejects duplicate, unsafe, unsupported and dangling sources", () => {
  const mutations = [
    (r) => r.sources.push({ ...r.sources[0] }),
    (r) => { r.sources[0].url = "javascript:alert(1)"; },
    (r) => { r.sources[0].type = "Invented"; },
    (r) => { r.sources[0].date = "not-a-date"; },
    (r) => { r.risks[0].sourceIds = ["MISSING"]; }
  ];
  assert.equal(validateExternalAnalysisReport(canonicalReport()).valid, true);
  for (const mutate of mutations) {
    const report = canonicalReport();
    mutate(report);
    assert.equal(validateExternalAnalysisReport(report).valid, false);
  }
});

test("P1 market-price edits preserve native v3 and create a dated owner override", () => {
  const native = { marketPrice: { value: 100, asOf: "2026-08-01", sourceId: "S1" }, valuation: { upsideToBasePct: 20 } };
  const report = canonicalReport();
  report.metadata = { franklinV3Report: native };
  const updated = withCurrentPrice(report, 110, { asOf: "2026-09-06", reason: "Owner refresh" });
  assert.deepEqual(updated.metadata.franklinV3Report, native);
  assert.deepEqual(updated.metadata.ownerMarketPriceOverride, {
    value: 110,
    asOf: "2026-09-06",
    sourceType: "User Provided",
    reason: "Owner refresh"
  });
});

test("P1 money formatting honors explicit currencies", () => {
  assert.match(money(1234.5, 2, "EUR"), /€|EUR/);
  assert.match(money(1234.5, 2, "SAR"), /SAR|ر\.س/);
  assert.doesNotMatch(money(1234.5, 2, "EUR"), /\$/);
});

test("P1 supplement sources merge atomically and remain in the audit record", () => {
  const existing = canonicalReport();
  existing.id = "report-1";
  existing.scores = { quality: null };
  const supplement = normalizeExternalAnalysisSupplement({
    schemaVersion: "external-analysis-supplement/v1",
    ticker: "TEST",
    targetAnalysisId: "report-1",
    fields: { "scores.quality": 80 },
    sources: [{ id: "S2", title: "Earnings release", type: "Investor Relations", date: "2026-09-01", url: "https://example.com/release", usedFor: ["scores.quality"] }]
  }, "raw", { now: new Date("2026-09-06T00:00:00.000Z") });
  const result = mergeExternalAnalysisSupplement(existing, supplement, { now: new Date("2026-09-06T00:00:00.000Z") });
  assert.equal(result.validation.valid, true, JSON.stringify(result.validation.errors));
  assert.equal(result.report.sources.some((item) => item.id === "S2"), true);
  assert.equal(result.report.supplements[0].sources.some((item) => item.id === "S2"), true);
});

test("P1 report deletion tombstones every retained historical reference", () => {
  const result = reconcileDeletedReportHistory({
    historicalRequirementSets: { TEST: [{ requirementSetId: "req-1", createdFromAnalysisId: "report-1" }] },
    quarterlyEarningsHistory: { TEST: [{ quarterKey: "2026-Q2", analysisId: "report-1", sourceAnalysisIds: ["report-1", "report-2"] }] }
  }, "TEST", ["report-1"], new Date("2026-09-06T00:00:00.000Z"));
  assert.equal(result.historicalRequirementSets.TEST[0].sourceAnalysisDeletedAt, "2026-09-06T00:00:00.000Z");
  assert.equal(result.quarterlyEarningsHistory.TEST[0].analysisId, null);
  assert.deepEqual(result.quarterlyEarningsHistory.TEST[0].sourceAnalysisIds, ["report-2"]);
  assert.deepEqual(result.quarterlyEarningsHistory.TEST[0].deletedSourceAnalysisIds, ["report-1"]);
});

test("P1 cloud autosync publishes every failure as visible state", async () => {
  const text = await source("src/cloud/franklinCloud.js");
  assert.match(text, /export function cloudSyncFailureState/);
  assert.match(text, /franklin:cloud-sync-error/);
  assert.doesNotMatch(text, /catch \(error\) \{\s*if \(error\?\.message === "REVISION_CONFLICT"\)[\s\S]*?\n\s*\}/);
});

test("P1 server boundaries fail closed and permit only configured cloud origin", async () => {
  const [rootServer, backend] = await Promise.all([source("server.mjs"), source("backend/server.mjs")]);
  assert.match(rootServer, /if \(!env\.APP_ACCESS_PASSWORD\) return false/);
  assert.match(rootServer, /FRANKLIN_SUPABASE_URL/);
  assert.match(rootServer, /connect-src/);
  assert.match(backend, /BACKEND_API_TOKEN/);
  assert.match(backend, /AUTH_REQUIRED/);
});

test("P1 CI requires quality checks and the authoritative E2E-inclusive test command", async () => {
  const workflow = await source(".github/workflows/mobile2-ci.yml");
  assert.match(workflow, /npm run quality/);
  assert.match(workflow, /npm test/);
  assert.doesNotMatch(workflow, /--unit-only/);
});

test("P1 cloud ownership policies and audit-token implementation are versioned in repo", async () => {
  const [initialMigration, casMigration, reconciliationMigration, edge] = await Promise.all([
    source("supabase/migrations/20260822104507_create_franklin_cloud_state_and_audit.sql"),
    source("supabase/migrations/20260822104553_add_cloud_state_cas_and_audit_insert_policy.sql"),
    source("supabase/migrations/20260906195646_reconcile_franklin_cloud_security.sql"),
    source("supabase/functions/franklin-audit-read/index.ts")
  ]);
  assert.match(initialMigration, /enable row level security/i);
  assert.match(initialMigration, /auth\.uid\(\)/);
  assert.match(casMigration, /security invoker/i);
  assert.match(casMigration, /set search_path = ''/i);
  assert.doesNotMatch(casMigration, /security definer/i);
  assert.match(reconciliationMigration, /revoke all .* from public, anon, authenticated/i);
  assert.match(reconciliationMigration, /security invoker/i);
  assert.match(edge, /expires_at/);
  assert.match(edge, /revoked_at/);
  assert.match(edge, /digest|sha256|SHA-256/i);
});
