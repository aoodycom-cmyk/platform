import assert from "node:assert/strict";
import { normalizeFranklinV3Input } from "../src/externalAnalysis/v3InputNormalizer.js";

const raw = {
  analysisType: "earnings revaluation",
  dataQuality: { confidence: 0.91 },
  classification: { confidence: "high" },
  businessQuality: { confidence: "very high" },
  company: { securityUnit: "common share" },
  marketPrice: { priceType: "last close" },
  valuation: {
    reviewStatus: "unchanged",
    current: { confidence: 90, securityUnit: "common shares" },
    valuationResults: [{ role: "cross check", confidence: "medium" }]
  },
  thesis: { status: "strengthened" },
  decision: { scope: "stock level", action: "watch" },
  strengths: [
    { confidence: "low", importance: "High" },
    { confidence: "medium", importance: "strategic" }
  ],
  weaknesses: [
    { confidence: 0.7, severity: "Medium" },
    { confidence: "high", severity: "material" }
  ],
  risks: [{ severity: "very high" }],
  latestQuarter: {
    coreMetrics: { revenue: { result: "beat" } },
    companySpecificKpis: [
      { result: "inline", importance: "High" },
      { result: "outperforming", importance: "mission critical" }
    ],
    guidance: [
      { direction: "Raised" },
      { direction: "positive" }
    ],
    forwardOutlook: {
      growthOutlook: "strong growth",
      marginOutlook: "expanding",
      fcfOutlook: "robust",
      demandOutlook: "very strong",
      capacityOutlook: "well supplied",
      executionOutlook: "excellent",
      guidanceTrend: "constructive",
      managementTone: "confident"
    }
  },
  forecast: {
    materiality: "high",
    yearlyForecast: [
      { revenue: { basis: "management guidance" }, eps: { basis: "analyst assumption" } }
    ],
    changedAssumptions: [
      { direction: "higher" },
      { direction: "up" }
    ]
  },
  nextRequirements: {
    mode: "advance target",
    targetScenario: "intermediate",
    requirements: [{ type: "Minimum", importance: "High", status: "not reported" }]
  },
  previousRequirementsEvaluation: {
    requirements: [{ status: "partially passed" }],
    assessment: { overallStatus: "mixed" }
  },
  sources: [{ type: "investor relations" }]
};

const normalized = normalizeFranklinV3Input(raw);

assert.equal(normalized.analysisType, "EARNINGS_REVALUATION");
assert.equal(normalized.dataQuality.confidence, null, "unsupported numeric confidence should be dropped instead of guessed");
assert.equal(normalized.classification.confidence, "HIGH");
assert.equal(normalized.businessQuality.confidence, null, "unsupported narrative confidence should be dropped instead of guessed");
assert.equal(normalized.company.securityUnit, "share");
assert.equal(normalized.valuation.current.securityUnit, "share");
assert.equal(normalized.valuation.current.confidence, null);
assert.equal(normalized.valuation.reviewStatus, "UNCHANGED");
assert.equal(normalized.valuation.valuationResults[0].role, "CROSS_CHECK");
assert.equal(normalized.valuation.valuationResults[0].confidence, "MEDIUM");
assert.equal(normalized.thesis.status, "STRENGTHENED");
assert.equal(normalized.decision.scope, "STOCK_LEVEL");
assert.equal(normalized.decision.action, "WATCH");
assert.equal(normalized.marketPrice.priceType, "LAST_CLOSE");
assert.equal(normalized.strengths[0].confidence, "LOW");
assert.equal(normalized.strengths[0].importance, "high");
assert.equal(normalized.strengths[1].importance, null);
assert.equal(normalized.weaknesses[0].confidence, null);
assert.equal(normalized.weaknesses[0].severity, "medium");
assert.equal(normalized.weaknesses[1].severity, null);
assert.equal(normalized.risks[0].severity, null);
assert.equal(normalized.latestQuarter.coreMetrics.revenue.result, "BEAT");
assert.equal(normalized.latestQuarter.companySpecificKpis[0].result, "INLINE");
assert.equal(normalized.latestQuarter.companySpecificKpis[0].importance, "high");
assert.equal(normalized.latestQuarter.companySpecificKpis[1].result, null, "unsupported optional KPI result should be dropped");
assert.equal(normalized.latestQuarter.companySpecificKpis[1].importance, null);
assert.equal(normalized.latestQuarter.guidance[0].direction, "raised");
assert.equal(normalized.latestQuarter.guidance[1].direction, null, "unsupported optional guidance direction should be dropped");
for (const [field, value] of Object.entries(normalized.latestQuarter.forwardOutlook)) {
  assert.equal(value, null, `unsupported optional forwardOutlook.${field} should be dropped`);
}
assert.equal(normalized.forecast.materiality, null, "unsupported optional forecast materiality should be dropped");
assert.equal(normalized.forecast.yearlyForecast[0].revenue.basis, null, "unsupported optional forecast basis should be dropped");
assert.equal(normalized.forecast.yearlyForecast[0].eps.basis, "analyst_assumption");
assert.equal(normalized.forecast.changedAssumptions[0].direction, null, "unsupported optional changed-assumption direction should be dropped");
assert.equal(normalized.forecast.changedAssumptions[1].direction, "UP");
assert.equal(normalized.nextRequirements.mode, "ADVANCE_TARGET");
assert.equal(normalized.nextRequirements.targetScenario, "INTERMEDIATE");
assert.equal(normalized.nextRequirements.requirements[0].type, "minimum");
assert.equal(normalized.nextRequirements.requirements[0].importance, "high");
assert.equal(normalized.nextRequirements.requirements[0].status, "NOT_REPORTED");
assert.equal(normalized.previousRequirementsEvaluation.requirements[0].status, "PARTIALLY_PASSED");
assert.equal(normalized.previousRequirementsEvaluation.assessment.overallStatus, "MIXED");
assert.equal(normalized.sources[0].type, "Investor Relations");

assert.equal(raw.company.securityUnit, "common share", "normalization must not mutate the pasted raw object");
assert.equal(raw.dataQuality.confidence, 0.91);
assert.equal(raw.latestQuarter.forwardOutlook.growthOutlook, "strong growth");
assert.equal(raw.forecast.yearlyForecast[0].revenue.basis, "management guidance");

console.log("Franklin V3 input normalization regression: PASS");
