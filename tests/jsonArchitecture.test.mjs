import assert from "node:assert/strict";
import test from "node:test";
import { inspectJsonImportText } from "../src/externalAnalysis/jsonFileImport.js";
import {
  JSON_IMPORT_ROUTES,
  dispatchJsonPayload,
  supportedSchemaVersions
} from "../src/externalAnalysis/jsonContractRouter.js";
import {
  FRANKLIN_V3_FIELD_COVERAGE,
  JSON_CONTRACT_INVENTORY
} from "../src/externalAnalysis/jsonContractInventory.js";
import { mergeExternalAnalysisSupplement } from "../src/externalAnalysis/supplementMerge.js";
import { parseExternalAnalysisSupplement } from "../src/externalAnalysis/supplementParser.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { copyableExternalAnalysisJson, externalAnalysisToHomeCard } from "../src/externalAnalysis/reportAdapter.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";
import { validateExternalAnalysisSupplement } from "../src/externalAnalysis/supplementValidator.js";

const originalLog = console.log;
let canonical;
let goldenB;
let previousReport;
try {
  console.log = () => {};
  ({ canonical } = await import("./intcOwnerAcceptance.test.mjs"));
  ({ goldenB, previousReport } = await import("./franklinFinancialContractV3.test.mjs"));
} finally {
  console.log = originalLog;
}

const now = new Date("2026-08-24T15:30:00.000Z");

test("central contract inventory covers every supported dispatcher schema", () => {
  assert.deepEqual(
    JSON_CONTRACT_INVENTORY.map((item) => item.schemaVersion).sort(),
    supportedSchemaVersions().sort()
  );
  assert.equal(FRANKLIN_V3_FIELD_COVERAGE.length, 38);
  assert.ok(FRANKLIN_V3_FIELD_COVERAGE.every((item) => item.persistenceLocation && item.uiConsumer && item.exportPath));
});

test("real full-size Arabic V3 passes raw, fenced, BOM, paste, and file routes", async () => {
  const raw = JSON.stringify(canonical);
  assert.ok(raw.length > 20_000, "The repository's real INTC fixture must remain full-size.");
  assert.match(raw, /[\u0600-\u06ff]/);
  const rawParsed = await parseExternalAnalysisInput(raw, { now });
  const fencedParsed = await parseExternalAnalysisInput(`\`\`\`json\n${raw}\n\`\`\``, { now });
  const bomInspected = inspectJsonImportText(`\uFEFF${raw}`);
  const fileParsed = await parseExternalAnalysisInput(raw, { now, strictJson: true });
  assert.equal(rawParsed.report.company.name, canonical.reportIdentity.companyName);
  assert.deepEqual(fencedParsed.report.metadata.franklinV3Report, canonical);
  assert.deepEqual(bomInspected.value, canonical);
  assert.deepEqual(fileParsed.report, rawParsed.report);
});

test("valid full revaluation uses the full route with its saved lineage", async () => {
  const parsed = await parseExternalAnalysisInput(JSON.stringify(goldenB), {
    now,
    currentReport: previousReport,
    expectedTicker: previousReport.company.ticker,
    expectedReportPeriod: goldenB.nextRequirements.previousQuarter
  });
  assert.equal(parsed.route, JSON_IMPORT_ROUTES.FULL_ANALYSIS);
  assert.equal(parsed.report.metadata.franklinV3Report.analysisType, "EARNINGS_REVALUATION");
  assert.equal(parsed.report.metadata.franklinV3Report.reportIdentity.previousAnalysisId, previousReport.id);
});

test("timestamps, zero, negative numbers, and decimal precision are preserved", async () => {
  const timestamp = "2026-08-24T15:30:00.123+03:00";
  const value = mutate(canonical, (copy) => {
    copy.reportIdentity.analysisDate = timestamp;
    copy.marketPrice.asOf = timestamp;
    copy.businessQuality.components.cashFlow = 0;
  });
  const parsed = await parseExternalAnalysisInput(JSON.stringify(value), { now });
  assert.equal(parsed.report.analysisDate, timestamp);
  assert.equal(parsed.report.marketPrice.asOf, timestamp);
  assert.equal(parsed.report.valuation.upsideToBasePct, canonical.valuation.upsideToBasePct);
  assert.equal(parsed.report.latestQuarter.coreMetrics.freeCashFlow.actualValue, -8419000000);
  assert.equal(parsed.report.businessQuality.components.cashFlow, 0);
});

test("every audited V3 path survives normalization, persistence, export, and re-import exactly", async () => {
  const parsed = await parseExternalAnalysisInput(JSON.stringify(canonical), { now });
  const saved = saveExternalAnalysis({}, { ...parsed.report, id: "INTC-JSON-ARCHITECTURE" }, { now });
  const reloaded = JSON.parse(JSON.stringify(saved.collection)).INTC[0];
  const exported = copyableExternalAnalysisJson(reloaded);
  const reimported = await parseExternalAnalysisInput(exported, { now });
  assert.equal(reimported.report.rawAnalysis, reloaded.rawAnalysis, "canonical re-import must not wrap rawAnalysis recursively");

  for (const row of FRANKLIN_V3_FIELD_COVERAGE) {
    const source = getPath(canonical, row.sourcePath);
    assert.deepEqual(getPath(parsed.report, row.exactPreservationPath), source, `normalized ${row.sourcePath}`);
    assert.deepEqual(getPath(reloaded, row.exactPreservationPath), source, `persisted ${row.sourcePath}`);
    assert.deepEqual(getPath(reimported.report, row.exactPreservationPath), source, `round-trip ${row.sourcePath}`);
  }

  const homeCard = externalAnalysisToHomeCard(reloaded);
  assert.equal(homeCard.ticker, canonical.reportIdentity.ticker);
  assert.equal(homeCard.companyName, canonical.reportIdentity.companyName);
  assert.equal(homeCard.currentPrice, canonical.marketPrice.value);
  assert.equal(homeCard.baseFairValue, canonical.valuation.current.base);
  assert.equal(homeCard.verdict, canonical.decision.action);
});

test("full analysis in supplement route extracts only approved missing fields and no full raw payload", async () => {
  const parsed = await parseExternalAnalysisInput(JSON.stringify(canonical), { now });
  const existingReport = {
    ...parsed.report,
    id: "INTC-TARGET",
    decision: { ...parsed.report.decision, rationale: [] }
  };
  const extracted = await parseExternalAnalysisSupplement(JSON.stringify(canonical), {
    existingReport,
    missingFields: [{ path: "decision.rationale" }],
    now
  });
  assert.equal(extracted.parserSource, "Franklin Full Analysis Extractor");
  assert.deepEqual(Object.keys(extracted.supplement.fields), ["decision.rationale"]);
  assert.deepEqual(extracted.supplement.fields["decision.rationale"], canonical.decision.rationale);
  assert.equal(extracted.supplement.rawSupplement, "");
});

test("supplement in full importer is redirected only when its target validates", async () => {
  const parsed = await parseExternalAnalysisInput(JSON.stringify(canonical), { now });
  const existingReport = { ...parsed.report, id: "INTC-TARGET", scores: { ...parsed.report.scores, risk: null } };
  const supplement = {
    schemaVersion: "external-analysis-supplement/v1",
    ticker: "INTC",
    targetAnalysisId: "INTC-TARGET",
    analysisDate: canonical.reportIdentity.analysisDate,
    fields: { "scores.risk": 0 },
    notes: []
  };
  const routed = await parseExternalAnalysisInput(JSON.stringify(supplement), { now, currentReport: existingReport });
  assert.equal(routed.route, JSON_IMPORT_ROUTES.SUPPLEMENT);
  assert.equal(routed.supplement.fields["scores.risk"], 0);

  await assert.rejects(
    () => parseExternalAnalysisInput(JSON.stringify({ ...supplement, targetAnalysisId: "WRONG" }), { now, currentReport: existingReport }),
    /المسار.*targetAnalysisId|targetAnalysisId/u
  );
});

test("supplement merge preserves zero, negatives, precision, nulls, and atomic conflicts", async () => {
  const parsed = await parseExternalAnalysisInput(JSON.stringify(canonical), { now });
  const existing = {
    ...parsed.report,
    id: "INTC-TARGET",
    scores: { ...parsed.report.scores, risk: null },
    market: { ...parsed.report.market, userAverageCost: null }
  };
  const supplement = {
    schemaVersion: "external-analysis-supplement/v1",
    ticker: "INTC",
    targetAnalysisId: "INTC-TARGET",
    fields: {
      "scores.risk": 0,
      "market.userAverageCost": -12.345678901,
      "thesis.shortSummary": null
    },
    notes: []
  };
  const merged = mergeExternalAnalysisSupplement(existing, supplement, { now });
  assert.equal(merged.report.scores.risk, 0);
  assert.equal(merged.report.market.userAverageCost, -12.345678901);
  assert.equal(merged.report.thesis.shortSummary, existing.thesis.shortSummary);

  const conflicting = {
    ...supplement,
    fields: { "scores.risk": 0, "fairValueSummary.fairValueBase": canonical.valuation.current.base + 1 }
  };
  const atomic = mergeExternalAnalysisSupplement(existing, conflicting, { now });
  assert.deepEqual(atomic.report, existing);
  assert.equal(atomic.proposedReport.scores.risk, 0);
  assert.ok(atomic.conflicts.some((item) => item.path === "fairValueSummary.fairValueBase"));
});

test("supplement validation rejects empty arrays, unknown paths, missing references, and pollution keys", () => {
  const existing = {
    id: "SAFE",
    company: { ticker: "SAFE" },
    sources: [{ id: "S1" }],
    risks: []
  };
  const envelope = (fields, sources = []) => ({
    schemaVersion: "external-analysis-supplement/v1",
    ticker: "SAFE",
    targetAnalysisId: "SAFE",
    fields,
    sources,
    notes: []
  });
  assert.equal(validateExternalAnalysisSupplement(envelope({ risks: [] }), existing).valid, false);
  assert.equal(validateExternalAnalysisSupplement(envelope({ "valuation.current.base": 10 }), existing).valid, false);
  assert.equal(validateExternalAnalysisSupplement(envelope({ risks: [{ title: "Risk", sourceIds: ["MISSING"] }] }), existing).valid, false);
  assert.equal(validateExternalAnalysisSupplement(envelope({ risks: [{ title: "Risk", sourceIds: ["S2"] }] }, [{ id: "S2" }]), existing).valid, false);
  assert.equal(validateExternalAnalysisSupplement(envelope({
    risks: [{ title: "Risk", sourceIds: ["S2"] }],
    sources: [{ id: "S2", title: "Filed source" }]
  }), existing).valid, true);

  const polluted = JSON.parse('{"schemaVersion":"external-analysis-supplement/v1","ticker":"SAFE","targetAnalysisId":"SAFE","fields":{"__proto__.polluted":"yes"},"notes":[]}');
  const dispatched = dispatchJsonPayload(polluted, { intendedRoute: JSON_IMPORT_ROUTES.SUPPLEMENT, existingReport: existing });
  assert.equal(dispatched.validation.valid, false);
  assert.equal({}.polluted, undefined);
});

test("missing schema, unknown schema, unknown properties, missing requirements, enums, source refs, and syntax fail with Arabic diagnostics", async () => {
  await assert.rejects(
    () => parseExternalAnalysisInput(JSON.stringify({ ...canonical, schemaVersion: undefined }), { now }),
    (error) => error.code === "MISSING_SCHEMA"
      && error.userMessage.includes('"schemaVersion": "franklin-fair-value/v3"')
      && error.technicalDetails.includes('add root property "schemaVersion": "franklin-fair-value/v3"')
  );
  const cases = [
    [{ ...canonical, schemaVersion: "franklin-fair-value/v999" }, /المخطط/u],
    [{ ...canonical, unexpectedRoot: true }, /unexpectedRoot/u],
    [mutate(canonical, (value) => { delete value.reportIdentity.ticker; }), /reportIdentity\.ticker/u],
    [mutate(canonical, (value) => { value.decision.action = "MAYBE"; }), /decision\.action/u],
    [mutate(canonical, (value) => { value.marketPrice.sourceId = "MISSING"; }), /marketPrice\.sourceId|MISSING/u]
  ];
  for (const [value, pattern] of cases) {
    await assert.rejects(() => parseExternalAnalysisInput(JSON.stringify(value), { now }), pattern);
  }
  assert.throws(
    () => inspectJsonImportText('{"schemaVersion":"franklin-fair-value/v3"'),
    (error) => error.code === "INCOMPLETE_JSON" && /غير مكتمل/u.test(error.userMessage)
  );
});

test("missing quarterly schema diagnostic recommends the exact v2 root discriminator", () => {
  const quarterlyWithoutSchema = {
    ticker: "INTC",
    quarter: "Q2",
    year: 2026,
    metrics: {}
  };
  assert.throws(
    () => dispatchJsonPayload(quarterlyWithoutSchema),
    (error) => error.code === "MISSING_SCHEMA"
      && error.userMessage.includes('"schemaVersion": "quarterly-earnings-lite/v2"')
      && error.technicalDetails.includes('add root property "schemaVersion": "quarterly-earnings-lite/v2"')
  );
});

function getPath(value, path) {
  return String(path || "").split(".").reduce((cursor, key) => cursor == null ? undefined : cursor[key], value);
}

function mutate(value, change) {
  const copy = structuredClone(value);
  change(copy);
  return copy;
}
