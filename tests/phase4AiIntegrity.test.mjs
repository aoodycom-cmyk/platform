import test from "node:test";
import assert from "node:assert/strict";
import { auditAnalysisIntegrity, CLAIM_STATUSES, CLAIM_TYPES, MATERIALITY } from "../src/aiIntegrity/auditor.js";
import { cleanCases, conflictCases, hallucinationCases } from "./aiIntegrity/benchmark.mjs";

test("P4 claim model exposes required states, types, confidence and auditor roles", () => {
  assert.deepEqual(CLAIM_STATUSES, ["VERIFIED", "SUPPORTED", "CONFLICTED", "UNVERIFIED", "UNSUPPORTED"]);
  assert.deepEqual(CLAIM_TYPES, ["FACTUAL", "DERIVED", "INTERPRETIVE", "FORWARD_LOOKING", "SUBJECTIVE"]);
  assert.deepEqual(MATERIALITY, ["CRITICAL", "MAJOR", "MODERATE", "MINOR"]);
  const result = auditAnalysisIntegrity(cleanCases[0].payload);
  assert.deepEqual(Object.keys(result.auditors), ["source", "hallucination", "financial", "contradiction", "temporal", "recommendation", "citationIntegrity"]);
  assert.equal(result.claims[0].status, "VERIFIED");
  assert.equal(result.claims[0].confidence, 1);
});

test("P4 detects all 200 hallucination and source-alignment attacks", () => {
  const missed = [];
  for (const item of hallucinationCases) {
    const result = auditAnalysisIntegrity(item.payload);
    if (!result.findings.length || result.claims.some((claim) => claim.status === "VERIFIED")) missed.push({ id: item.id, attack: item.attack, result });
  }
  assert.deepEqual(missed, []);
  for (const attack of new Set(hallucinationCases.map((item) => item.attack))) {
    const category = hallucinationCases.filter((item) => item.attack === attack);
    assert.equal(category.length, 20);
    assert.equal(category.filter((item) => auditAnalysisIntegrity(item.payload).findings.length).length, 20, attack);
  }
});

test("P4 preserves all 50 primary/secondary conflicts with paired claims", () => {
  for (const item of conflictCases) {
    const result = auditAnalysisIntegrity(item.payload);
    const conflict = result.findings.find((finding) => finding.code === "INTERNAL_VALUE_CONTRADICTION");
    assert.ok(conflict, item.id);
    assert.equal(conflict.claimIds.length, 2);
    assert.ok(conflict.primarySourceId, item.id);
    assert.ok(result.claims.every((claim) => claim.status === "CONFLICTED"), item.id);
    assert.notEqual(result.finalStatus, "VERIFIED");
  }
});

test("P4 clean controls have zero false positives", () => {
  const falsePositives = cleanCases.filter((item) => {
    const result = auditAnalysisIntegrity(item.payload);
    return result.finalStatus !== "VERIFIED" || result.findings.length;
  });
  assert.deepEqual(falsePositives, []);
});

test("P4 guidance, beat/miss, assumption and temporal diagnostics are precise", () => {
  const baseSource = { id: "S1", companyId: "ACME", date: "2026-07-20", facts: [{ metric: "guidance", value: 12, unit: "billions", currency: "USD", period: "FY2027", accountingBasis: "NON_GAAP" }] };
  const payload = {
    companyId: "ACME", analysisDate: "2026-08-01", sources: [baseSource],
    claims: [
      { id: "G", type: "FACTUAL", kind: "guidance", metric: "guidance", value: 12, low: 12, high: 12.5, midpoint: 13, unit: "billions", currency: "USD", period: "FY2027", accountingBasis: "NON_GAAP", sourceId: "S1", text: "Guidance is 12-12.5B." },
      { id: "B", type: "FACTUAL", kind: "beat_miss", metric: "eps", value: 1.2, sourceId: "S1", text: "EPS beat." },
      { id: "A", type: "FACTUAL", metric: "wacc", value: .09, sourceId: "S1", text: "Company reported WACC." }
    ]
  };
  const codes = auditAnalysisIntegrity(payload).findings.map((item) => item.code);
  for (const code of ["GUIDANCE_MIDPOINT_ERROR", "UNDEFINED_BEAT_COMPARATOR", "ASSUMPTION_AS_FACT"]) assert.ok(codes.includes(code), code);
  const diagnostic = auditAnalysisIntegrity(hallucinationCases[0].payload).findings[0];
  for (const key of ["code", "claimId", "claim", "sourceId", "evidence", "period", "severity"]) assert.ok(key in diagnostic, key);
});

test("P4 recommendation and scenario contradictions are deterministic", () => {
  const payload = { marketPrice: 100, fairValue: 70, recommendation: { action: "BUY" }, scenarios: { bear: 90, base: 80, bull: 70 }, claims: [], sources: [] };
  const first = auditAnalysisIntegrity(payload); const second = auditAnalysisIntegrity(payload);
  assert.deepEqual(first, second);
  assert.ok(first.findings.some((item) => item.code === "BUY_WITH_DOWNSIDE"));
  assert.ok(first.findings.some((item) => item.code === "SCENARIO_ORDER_CONTRADICTION"));
});

test("P4 verifies claims independently and accepts faithful supported interpretation", () => {
  const source = { id: "IR1", companyId: "ACME", date: "2026-07-20", text: "Management expects moderate demand growth and disciplined capital spending.", facts: [{ metric: "revenue", value: 4.83, unit: "billions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP" }] };
  const result = auditAnalysisIntegrity({ companyId: "ACME", analysisDate: "2026-08-01", sources: [source], claims: [
    { id: "OK", type: "FACTUAL", metric: "revenue", value: 4.83, unit: "billions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP", sourceId: "IR1", text: "Revenue was 4.83B." },
    { id: "PARA", type: "INTERPRETIVE", metric: "management commentary", sourceId: "IR1", text: "Management expects moderate demand growth and disciplined capital spending." },
    { id: "MISS", type: "FACTUAL", metric: "cash", value: 2, sourceId: "NOPE", text: "Cash was 2B." }
  ] });
  assert.equal(result.claims.find((claim) => claim.id === "OK").status, "VERIFIED");
  assert.equal(result.claims.find((claim) => claim.id === "PARA").status, "SUPPORTED");
  assert.equal(result.claims.find((claim) => claim.id === "MISS").status, "UNSUPPORTED");
  assert.notEqual(result.finalStatus, "VERIFIED");
});

test("P4 guidance withdrawal and valid beat comparator remain distinguishable", () => {
  const source = { id: "G1", companyId: "ACME", date: "2026-07-20", facts: [{ metric: "guidance", value: 12, unit: "billions", currency: "USD", period: "FY2027", accountingBasis: "GAAP" }, { metric: "eps", value: 1.3, unit: "per share", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP" }] };
  const result = auditAnalysisIntegrity({ companyId: "ACME", analysisDate: "2026-08-01", sources: [source], claims: [
    { id: "WG", type: "FACTUAL", kind: "guidance", withdrawn: true, low: 12, high: 12.5, metric: "guidance", value: 12, unit: "billions", currency: "USD", period: "FY2027", accountingBasis: "GAAP", sourceId: "G1", text: "Withdrawn guidance remains active." },
    { id: "BEAT", type: "DERIVED", kind: "beat_miss", comparator: "consensus", metric: "eps", value: 1.3, unit: "per share", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP", sourceId: "G1", text: "EPS beat consensus." }
  ] });
  assert.ok(result.findings.some((item) => item.code === "WITHDRAWN_GUIDANCE_AS_ACTIVE"));
  assert.ok(!result.findings.some((item) => item.claimId === "BEAT" && item.code === "UNDEFINED_BEAT_COMPARATOR"));
});

test("P4 benchmark metrics satisfy critical release thresholds", () => {
  const attackResults = hallucinationCases.map((item) => auditAnalysisIntegrity(item.payload));
  const cleanResults = cleanCases.map((item) => auditAnalysisIntegrity(item.payload));
  const detected = attackResults.filter((result) => result.findings.length && !result.claims.some((claim) => claim.status === "VERIFIED")).length;
  const falsePositives = cleanResults.filter((result) => result.findings.length).length;
  assert.equal(detected / attackResults.length, 1);
  assert.equal(falsePositives / cleanResults.length, 0);
});
