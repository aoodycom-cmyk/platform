import assert from "node:assert/strict";
import { verifiedFixture } from "./launchAuditFinancialVerification.test.mjs";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { classifyDecisionReadiness } from "../src/financialSafety/decisionReadinessUi.js";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { saveExternalAnalysis, normalizeExternalAnalysesCollection } from "../src/externalAnalysis/storage.js";

const native = verifiedFixture();
const report = (await parseExternalAnalysisInput(JSON.stringify(native), { strictJson: true })).report;
assert.equal(classifyDecisionReadiness(report).status, "verified");
const saved = saveExternalAnalysis({}, report).report;
assert.equal(classifyDecisionReadiness(saved).status, "verified");
await parseExternalAnalysisInput(JSON.stringify(saved), { strictJson: true });

for (const mutate of [
  (r) => { r.decision.action = "BUY"; },
  (r) => { r.decision.rationale = ["Price is below fair value; buy now."]; },
  (r) => { r.decision.confidence = 0; },
  (r) => { r.decision.investmentScore = 100; },
  (r) => { r.scores.quality = 0; },
  (r) => { r.dataQuality.score = 0; },
  (r) => { r.fairValueSummary.fairValueBase = 820; },
  (r) => { r.valuationResults[0].inputs.normalizedForwardEps = 20; },
  (r) => { r.forecastAssumptions.yearlyForecast[0].eps.value = 999; },
  (r) => { r.company.ticker = "OTHER"; },
  (r) => {
    const s = r.fairValueSummary;
    s.fairValueLow = 700; s.fairValueBase = 820; s.fairValueHigh = 1000;
    s.upsideDownsidePercent = (820 / s.currentPrice - 1) * 100;
    s.marginOfSafetyPercent = (820 - s.currentPrice) / 820 * 100;
    for (const [key, value] of [["Bear", 700], ["Base", 820], ["Bull", 1000]]) r.scenarios[key].fairValue = value;
    s.probabilityWeightedFairValue = Object.values(r.scenarios).reduce((sum, x) => sum + x.fairValue * x.probability / 100, 0);
  }
]) {
  const bad = structuredClone(saved);
  mutate(bad);
  assert.equal(classifyDecisionReadiness(bad).status, "blocked");
  await assert.rejects(() => parseExternalAnalysisInput(JSON.stringify(bad), { strictJson: true }), (e) => e.code === "CONTRACT_VALIDATION_FAILED");
  const restored = normalizeExternalAnalysesCollection({ INTC: [bad] }).INTC[0];
  assert.equal(classifyDecisionReadiness(restored).status, "blocked");
}

for (const unit of ["USD million/share", "USD billion per share", "USD thousand/share"]) {
  const bad = structuredClone(native);
  bad.valuation.valuationResults[0].inputProvenance.normalizedForwardEps.unit = unit;
  const verification = validateFranklinV3Report(bad).financialVerification;
  assert.equal(verification.status, "BLOCKED");
  assert.ok(verification.findings.some((f) => f.code === "VALUATION_INPUT_UNIT_MISMATCH"));
}
for (const unit of ["USD trillion/share", "USD 1000/share", "USD mystery/share"]) {
  const bad = structuredClone(native);
  bad.valuation.valuationResults[0].inputProvenance.normalizedForwardEps.unit = unit;
  assert.notEqual(validateFranklinV3Report(bad).financialVerification.status, "VERIFIED", unit);
}
const presentation = structuredClone(saved);
presentation.presentation = { ...presentation.presentation, morningstarFairValue: 120, companyLogoDataUrl: "data:image/png;base64,TEST" };
assert.equal(classifyDecisionReadiness(presentation).status, "verified", "Presentation edits must not change the model or invalidate it.");
const supplemented = structuredClone(saved);
supplemented.scores.risk = 0;
const roundTrip = (await parseExternalAnalysisInput(JSON.stringify(supplemented), { strictJson: true })).report;
assert.equal(roundTrip.scores.risk, 0, "Preserve approved missing-field additions without silently changing user data.");
assert.equal(classifyDecisionReadiness(roundTrip).status, "needs_review", "Supplemented values absent from the native model are not automatically certified.");
console.log("Verified projection, export/reimport, persisted restore, and per-share scale regressions passed.");
