import assert from "node:assert/strict";
import { decisionHeroModel } from "../src/financialSafety/decisionHeroUx.js";

const report = {
  company: { currency: "USD" },
  fairValueSummary: {
    fairValueLow: 90,
    fairValueBase: 150,
    fairValueHigh: 210,
    probabilityWeightedFairValue: 151.5
  },
  scenarios: {
    Bear: { fairValue: 90, probability: 20 },
    Base: { fairValue: 150, probability: 55 },
    Bull: { fairValue: 210, probability: 25 }
  },
  decision: { action: "WATCH", confidence: 78 },
  thesis: { shortSummary: "النمو قوي لكن السعر يحتاج هامش أمان أفضل." }
};

const model = decisionHeroModel(report);
assert.equal(model.probabilityWeighted, 151.5, "Weighted fair value must be displayed exactly as supplied, not recalculated.");
assert.equal(model.confidence, 78);
assert.equal(model.thesis, report.thesis.shortSummary);
assert.deepEqual(model.scenarios, [
  { name: "Bear", fairValue: 90, probability: 20 },
  { name: "Base", fairValue: 150, probability: 55 },
  { name: "Bull", fairValue: 210, probability: 25 }
]);

const nullModel = decisionHeroModel({
  company: { currency: "USD" },
  fairValueSummary: { fairValueLow: null, fairValueBase: null, fairValueHigh: null, probabilityWeightedFairValue: null },
  scenarios: { Bear: { probability: null }, Base: { probability: null }, Bull: { probability: null } },
  decision: { confidence: null }
});
assert.equal(nullModel.probabilityWeighted, null, "Missing weighted value must remain missing, never zero.");
assert.equal(nullModel.confidence, null, "Missing confidence must remain missing, never zero.");
assert.ok(nullModel.scenarios.every((item) => item.fairValue === null && item.probability === null));

const canonicalOnly = decisionHeroModel({
  metadata: {
    franklinV3Report: {
      company: { tradingCurrency: "USD" },
      valuation: {
        current: { bear: 80, base: 130, bull: 180, probabilityWeighted: 132, currency: "USD", confidence: 70 },
        scenarios: {
          Bear: { fairValue: 80, probability: 20 },
          Base: { fairValue: 130, probability: 60 },
          Bull: { fairValue: 180, probability: 20 }
        }
      },
      thesis: { updatedSummary: "فرضية V3 محفوظة." }
    }
  }
});
assert.equal(canonicalOnly.probabilityWeighted, 132);
assert.equal(canonicalOnly.scenarios[1].fairValue, 130);
assert.equal(canonicalOnly.scenarios[1].probability, 60);
assert.equal(canonicalOnly.thesis, "فرضية V3 محفوظة.");

console.log("Franklin V3 decision hero tests passed.");
