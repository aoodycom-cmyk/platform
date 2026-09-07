import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { attachCompletionStatus } from "../src/externalAnalysis/missingFields.js";
import { attachRequirementSetIdentityToReport } from "../src/externalAnalysis/historicalRequirements.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";

const corpus = JSON.parse(await readFile(new URL("../artifacts/phase5e/native-analyses.json", import.meta.url), "utf8"));
const evidence = JSON.parse(await readFile(new URL("./corpus/real-world/source-packages.json", import.meta.url), "utf8"));

test("Phase 5E closes every guidance classification without weakening evidence status", () => {
  const records = evidence.companies.flatMap((company) => company.periods);
  assert.equal(records.length, 301);
  assert.equal(records.filter((period) => period.guidanceClassification.classification === "TRUE_EVIDENCE_GAP").length, 0);
  assert.ok(records.every((period) => period.guidanceClassification.verificationStatus === "VERIFIED"));
  assert.ok(records.every((period) => period.guidanceClassification.sourceDate <= period.cutoffDate));
});

test("Phase 5E freezes 100 complete native V3 executions", () => {
  assert.equal(corpus.analyses.length, 100);
  assert.equal(corpus.verification.length, 100);
  assert.ok(corpus.verification.every((row) => Object.entries(row).filter(([key]) => key !== "ticker").every(([, value]) => value === "PASS")));
  for (const item of corpus.analyses) {
    const result = validateFranklinV3Report(item.native, { expectedTicker: item.ticker, expectedReportPeriod: item.reportPeriod });
    assert.equal(result.valid, true, `${item.ticker}: ${JSON.stringify(result.errors)}`);
    assert.equal(item.native.schemaVersion, "franklin-fair-value/v3");
    assert.equal(item.saved.metadata.franklinV3Report.schemaVersion, "franklin-fair-value/v3");
  }
});

test("Phase 5E freezes the required real revaluation and longitudinal chains", () => {
  assert.equal(corpus.twoPeriodChains.length, 30);
  assert.equal(corpus.threePeriodChains.length, 10);
  assert.ok(corpus.twoPeriodChains.every((chain) => chain.status === "PASS" && chain.periods.length === 2));
  assert.ok(corpus.threePeriodChains.every((chain) => chain.status === "PASS" && chain.periods.length === 3));
});

test("Phase 6C freezes an importable real QCOM three-period chain", async () => {
  const fixtureRoot = new URL("./fixtures/phase6c/chains/qcom-q1-q3-2026/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", fixtureRoot), "utf8"));
  let collection = {};
  let previous = null;
  for (const item of manifest.threePeriodChain) {
    const native = JSON.parse(await readFile(new URL(item.fixture, fixtureRoot), "utf8"));
    const direct = validateFranklinV3Report(native, {
      currentReport: previous,
      expectedTicker: manifest.ticker,
      expectedReportPeriod: item.reportPeriod
    });
    assert.equal(direct.valid, true, `${item.reportPeriod}: ${JSON.stringify(direct.errors)}`);
    const now = new Date(`${item.cutoffDate}T23:59:59.000Z`);
    const parsed = await parseExternalAnalysisInput(JSON.stringify(native), {
      now,
      currentReport: previous,
      expectedTicker: manifest.ticker,
      expectedReportPeriod: item.reportPeriod,
      strictJson: true
    });
    const external = validateExternalAnalysisReport(parsed.report);
    assert.equal(external.valid, true, `${item.reportPeriod}: ${JSON.stringify(external.errors)}`);
    let ready = attachCompletionStatus(parsed.report, external);
    ready.id = item.reportId;
    ready = attachRequirementSetIdentityToReport(ready, now);
    const saved = saveExternalAnalysis(collection, ready, { allowDuplicate: true, now });
    collection = saved.collection;
    previous = saved.report;
    assert.equal(previous.priceTargetRequirements.requirementSetId, item.requirementSetId);
  }
  assert.equal(collection.QCOM.length, 3);
  assert.deepEqual(collection.QCOM.map((report) => report.reportPeriod), ["Q3 2026", "Q2 2026", "Q1 2026"]);
});
