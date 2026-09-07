import assert from "node:assert/strict";
import test from "node:test";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { buildMissingRequirementsPrompt, FIELD_REQUIREMENTS } from "../src/externalAnalysis/missingFields.js";
import { validateExternalAnalysisSupplement } from "../src/externalAnalysis/supplementValidator.js";
import { franklinV3ToExternalReport } from "../src/externalAnalysis/v3Adapter.js";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { visibleExternalValidation } from "../src/ui/components.js";

function validReport(scores = { valuation: 65, risk: 72 }) {
  return {
    analysisOrigin: "external_chatgpt",
    source: "ChatGPT",
    analysisDate: "2026-09-07",
    company: { ticker: "TEST", name: "Test Company" },
    scores,
    fairValueSummary: { currentPrice: 80, fairValueLow: 70, fairValueBase: 90, fairValueHigh: 110 },
    thesis: { shortSummary: "فرضية استثمار موثقة." },
    risks: [{ title: "Execution risk" }],
    decision: { action: "WATCH" },
    guidance: [],
    companySpecificKpis: [],
    priceTargetRequirements: { requirements: [] },
    previousRequirementsEvaluation: { requirements: [] },
    sources: []
  };
}

test("full-analysis scores use the deterministic 0-100 contract", () => {
  assert.equal(validateExternalAnalysisReport(validReport()).valid, true);
  for (const value of [0, 1, 50, 99.5, 100]) {
    assert.equal(validateExternalAnalysisReport(validReport({ valuation: value, risk: value })).valid, true, String(value));
  }
  for (const value of [-1, 100.01, 101, Number.NaN, Number.POSITIVE_INFINITY, "80"]) {
    const validation = validateExternalAnalysisReport(validReport({ valuation: value, risk: 72 }));
    assert.equal(validation.valid, false, String(value));
    assert.ok(validation.errors.some((item) => item.field === "scores.valuation"));
  }
});

test("native V3 business-quality scores use the same 0-100 boundaries", () => {
  const validationFor = (value) => validateFranklinV3Report({
    schemaVersion: "franklin-fair-value/v3",
    methodologyVersion: "fair-value-methodology/v2",
    analysisType: "INITIAL",
    businessQuality: { score: value, components: { growth: value } }
  });
  for (const value of [0, 1, 50, 99.5, 100]) {
    const validation = validationFor(value);
    assert.equal(validation.errors.some((item) => item.field === "businessQuality.score"), false, String(value));
    assert.equal(validation.errors.some((item) => item.field === "businessQuality.components.growth"), false, String(value));
  }
  for (const value of [-1, 100.01, 101, Number.NaN, Number.POSITIVE_INFINITY, "80"]) {
    const validation = validationFor(value);
    assert.ok(validation.errors.some((item) => item.field === "businessQuality.score"), String(value));
    assert.ok(validation.errors.some((item) => item.field === "businessQuality.components.growth"), String(value));
  }
});

test("supplement scores use the same 0-100 contract", () => {
  const supplement = {
    schemaVersion: "external-analysis-supplement/v1",
    fields: { "scores.valuation": 65, "scores.risk": 72 }
  };
  assert.equal(validateExternalAnalysisSupplement(supplement, validReport()).valid, true);
  for (const value of [-1, 100.01, 101, Number.NaN, Number.POSITIVE_INFINITY, "80"]) {
    const validation = validateExternalAnalysisSupplement({ ...supplement, fields: { "scores.valuation": value } }, validReport());
    assert.equal(validation.valid, false, String(value));
  }
});

test("V3 adapter preserves 0-100 scores without implicit or repeated scaling", () => {
  const input = {
    reportIdentity: { ticker: "TEST", companyName: "Test Company", analysisDate: "2026-09-07" },
    businessQuality: {
      score: 65,
      components: { growth: 100, competitiveAdvantage: 0, management: 65 }
    }
  };
  const first = franklinV3ToExternalReport(input);
  assert.deepEqual(first.scores, { quality: 65, growth: 100, valuation: null, risk: null, moat: 0, management: 65 });
  const second = franklinV3ToExternalReport({ ...input, businessQuality: { score: first.scores.quality, components: { growth: first.scores.growth } } });
  assert.equal(second.scores.quality, 65);
  assert.equal(second.scores.growth, 100);
});

test("missing-score prompt states the 0-100 range explicitly", () => {
  const definition = FIELD_REQUIREMENTS.find((item) => item.path === "scores.valuation");
  const prompt = buildMissingRequirementsPrompt(validReport({ valuation: null, risk: 72 }), {
    details: { criticalRequired: [], recommended: [definition] }
  });
  assert.match(prompt.text, /scores\.valuation/);
  assert.match(prompt.text, /0–100/);
});

test("warnings remain non-blocking and duplicate path/message pairs display once", () => {
  const report = validReport();
  report.company = { ticker: "ASTS", name: "AST SpaceMobile" };
  report.guidance = [{ topic: "Demand", interpretation: "Micron DRAM demand is improving." }];
  const validation = validateExternalAnalysisReport(report);
  assert.equal(validation.valid, true);
  const warning = validation.warnings.find((item) => item.field === "guidance.0.interpretation");
  assert.ok(warning);
  const visible = visibleExternalValidation({ valid: true, errors: [], warnings: [warning, { ...warning }] });
  assert.equal(visible.warnings.length, 1);
  assert.equal(visible.warnings[0].field, "guidance.0.interpretation");
});
