import assert from "node:assert/strict";
import test from "node:test";
import { buildMissingRequirementsPrompt, FIELD_REQUIREMENTS } from "../src/externalAnalysis/missingFields.js";
import { validateExternalAnalysisSupplement } from "../src/externalAnalysis/supplementValidator.js";

test("missing-data prompt and importer share the exact supplement field contract", () => {
  const rationaleDefinition = FIELD_REQUIREMENTS.find((item) => item.path === "decision.rationale");
  const report = {
    id: "ACME-ANALYSIS-1",
    company: { ticker: "ACME", name: "شركة أكمي" },
    analysisDate: "2026-09-01T14:15:16.123Z",
    reportPeriod: "Q2 2026",
    fairValueSummary: { currentPrice: 10 },
    decision: { rationale: [] }
  };
  const prompt = buildMissingRequirementsPrompt(report, {
    details: { criticalRequired: [], recommended: [rationaleDefinition] }
  });
  assert.equal(prompt.count, 1);
  assert.match(prompt.text, /external-analysis-supplement\/v1/);
  assert.match(prompt.text, /decision\.rationale/);
  assert.match(prompt.text, /النوع: Array/);
  assert.doesNotMatch(prompt.text, /valuation\.current\.base/);

  const jsonText = prompt.text.slice(prompt.text.lastIndexOf("\n{") + 1);
  const payload = JSON.parse(jsonText);
  assert.equal(payload.ticker, "ACME");
  assert.equal(payload.targetAnalysisId, "ACME-ANALYSIS-1");
  assert.deepEqual(Object.keys(payload.fields), ["decision.rationale"]);
  payload.fields["decision.rationale"] = ["سبب استثماري موثق بالمصادر"];
  const validation = validateExternalAnalysisSupplement(payload, report);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
});
