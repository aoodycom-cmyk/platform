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
    previousQuarter: "FY2026 Q3",
    targetQuarter: "Q4 FY2026",
    earningsPeriod: "FY 2026 Q4",
    requirements: [{ type: "Minimum", importance: "High", status: "not reported" }]
  },
  previousRequirementsEvaluation: {
    previousQuarter: "2026 Q2",
    targetQuarter: "FY2026 Q3",
    earningsPeriod: "Q3 FY 2026",
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
assert.equal(normalized.nextRequirements.previousQuarter, "Q3 2026");
assert.equal(normalized.nextRequirements.targetQuarter, "Q4 2026");
assert.equal(normalized.nextRequirements.earningsPeriod, "Q4 2026");
assert.equal(normalized.nextRequirements.requirements[0].type, "minimum");
assert.equal(normalized.nextRequirements.requirements[0].importance, "high");
assert.equal(normalized.nextRequirements.requirements[0].status, "NOT_REPORTED");
assert.equal(normalized.previousRequirementsEvaluation.requirements[0].status, "PARTIALLY_PASSED");
assert.equal(normalized.previousRequirementsEvaluation.previousQuarter, "Q2 2026");
assert.equal(normalized.previousRequirementsEvaluation.targetQuarter, "Q3 2026");
assert.equal(normalized.previousRequirementsEvaluation.earningsPeriod, "Q3 2026");
assert.equal(normalized.previousRequirementsEvaluation.assessment.overallStatus, "MIXED");
assert.equal(normalized.sources[0].type, "Investor Relations");

assert.equal(raw.company.securityUnit, "common share", "normalization must not mutate the pasted raw object");
assert.equal(raw.dataQuality.confidence, 0.91);
assert.equal(raw.latestQuarter.forwardOutlook.growthOutlook, "strong growth");
assert.equal(raw.nextRequirements.previousQuarter, "FY2026 Q3");
assert.equal(raw.forecast.yearlyForecast[0].revenue.basis, "management guidance");

const missingMarketPriceUsage = {
  marketPrice: { sourceId: "S1" },
  sources: [{ id: "S1", type: "market data", usedFor: ["valuation"] }]
};
const repairedMarketPriceUsage = normalizeFranklinV3Input(missingMarketPriceUsage);
assert.deepEqual(repairedMarketPriceUsage.sources[0].usedFor, ["valuation", "marketPrice"]);
assert.deepEqual(missingMarketPriceUsage.sources[0].usedFor, ["valuation"], "provenance repair must not mutate pasted JSON");

const absentUsedFor = normalizeFranklinV3Input({
  marketPrice: { sourceId: "S1" },
  sources: [{ id: "S1", type: "Market Data" }]
});
assert.deepEqual(absentUsedFor.sources[0].usedFor, ["marketPrice"]);

const unresolvedMarketSource = normalizeFranklinV3Input({
  marketPrice: { sourceId: "MISSING" },
  sources: [{ id: "S1", type: "Market Data", usedFor: [] }]
});
assert.deepEqual(unresolvedMarketSource.sources[0].usedFor, [], "normalization must not invent or relink a missing source");

console.log("Franklin V3 input normalization regression: PASS");

const marketAliases = normalizeFranklinV3Input({
  company: { tradingCurrency: "USD" },
  marketPrice: {
    currentPrice: "225.50",
    date: "2026-08-26",
    type: "closing"
  },
  sources: [{ id: "MKT-1", type: "Market Data", usedFor: [] }]
});
assert.equal(marketAliases.marketPrice.value, 225.5);
assert.equal(marketAliases.marketPrice.currency, "USD");
assert.equal(marketAliases.marketPrice.asOf, "2026-08-26");
assert.equal(marketAliases.marketPrice.priceType, "LAST_CLOSE");
assert.equal(marketAliases.marketPrice.sourceId, "MKT-1");

const noGuessing = normalizeFranklinV3Input({
  company: { tradingCurrency: "USD" },
  marketPrice: {},
  sources: [
    { id: "MKT-1", type: "Market Data" },
    { id: "MKT-2", type: "Market Data" }
  ]
});
assert.equal(noGuessing.marketPrice.value, undefined, "normalization must not invent a price");
assert.equal(noGuessing.marketPrice.sourceId, null, "ambiguous market sources must not be guessed");

const nestedMarketAliases = normalizeFranklinV3Input({
  company: { tradingCurrency: "USD" },
  marketPrice: null,
  marketPriceDate: "2026-08-27",
  valuation: { current: { currentPrice: "181.25" } },
  sources: [{ id: "PRICE-1", type: "Market Data", usedFor: ["valuation"] }]
});
assert.equal(nestedMarketAliases.marketPrice.value, 181.25);
assert.equal(nestedMarketAliases.marketPrice.currency, "USD");
assert.equal(nestedMarketAliases.marketPrice.asOf, "2026-08-27");
assert.equal(nestedMarketAliases.marketPrice.sourceId, "PRICE-1");
assert.ok(nestedMarketAliases.sources[0].usedFor.includes("marketPrice"));
