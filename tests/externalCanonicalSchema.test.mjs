import assert from "node:assert/strict";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { copyableExternalAnalysisJson } from "../src/externalAnalysis/reportAdapter.js";
import {
  EXTERNAL_ANALYSIS_SCHEMA_VERSION,
  normalizeExternalAnalysisReport
} from "../src/externalAnalysis/schema.js";
import { normalizeExternalAnalysesCollection } from "../src/externalAnalysis/storage.js";
import { estimateRevisionsCard } from "../src/ui/components.js";

const now = new Date("2026-08-17T10:00:00.000Z");

const canonicalInput = {
  schemaVersion: "external-analysis-report/v2",
  analysisOrigin: "external_chatgpt",
  source: "ChatGPT",
  analysisDate: "2026-08-17",
  reportPeriod: "Q2 2026",
  company: { ticker: "ACME", name: "Acme Systems", currency: "USD" },
  scores: { quality: 8.7, growth: 7.8, valuation: 6.4, risk: 4.2 },
  fairValueSummary: {
    fairValueLow: 210,
    fairValueBase: 274,
    fairValueHigh: 345,
    probabilityWeightedFairValue: 272.2,
    currentPrice: 262.65,
    upsideDownsidePercent: 4.3,
    marginOfSafetyPercent: 4.1,
    confidenceLevel: "medium-high"
  },
  valuationMethodology: { primaryMethod: "DCF" },
  valuationResults: [{ method: "DCF", role: "primary", fairValue: 274, weight: 1 }],
  forecastAssumptions: { wacc: { value: 9.2 } },
  scenarios: { Base: { fairValue: 274 } },
  decision: {
    action: "WATCH",
    confidence: "medium-high",
    investmentScore: 82,
    rationale: ["السعر قريب من القيمة العادلة."],
    whyNot: ["هامش الأمان محدود."],
    upgradeTriggers: ["ارتفاع التقديرات."],
    downgradeTriggers: ["تراجع الهوامش."],
    biggestAssumption: "استمرار النمو",
    mainRisk: "ضغط الهوامش"
  },
  guidance: [{ period: "Q3 2026", topic: "Revenue", currentGuidance: "$197B-$202B", direction: "raised" }],
  monitoringChecklist: [{ metric: "Revenue Growth", expectedRange: "8%-10%" }],
  estimateRevisions: {
    periodDays: 90,
    asOfDate: "2026-08-17",
    revenue: { trend: "up", currentEstimate: 202, previousEstimate: 198, changePercent: 2.02 },
    eps: null,
    ebitda: null,
    overallDirection: "positive",
    interpretation: "ارتفعت تقديرات Revenue خلال آخر 90 يومًا.",
    confidence: "medium",
    source: "consensusEstimates"
  },
  thesis: { shortSummary: "شركة جيدة بسعر قريب من القيمة العادلة." },
  risks: [{ title: "Margin pressure", explanation: "قد تتراجع الهوامش." }]
};

const parsedCanonical = await parseExternalAnalysisInput(JSON.stringify(canonicalInput), { now });
assert.equal(parsedCanonical.usedAi, false, "Canonical JSON import must remain local.");
assert.equal(parsedCanonical.report.schemaVersion, EXTERNAL_ANALYSIS_SCHEMA_VERSION);
assert.equal(parsedCanonical.report.fairValueSummary.fairValueBase, 274);
assert.equal(parsedCanonical.report.decision.action, "WATCH");
assert.equal(parsedCanonical.report.decision.investmentScore, 82);
assert.equal(parsedCanonical.report.estimateRevisions.revenue.trend, "up");
assert.equal(Object.keys(parsedCanonical.report).includes("fairValue"), false);
assert.equal(Object.keys(parsedCanonical.report).includes("recommendation"), false);

const legacyInput = {
  ...canonicalInput,
  schemaVersion: "external-analysis-report/v1",
  fairValueSummary: undefined,
  valuationResults: undefined,
  decision: { verdict: "HOLD / ACCUMULATE ON WEAKNESS", rationale: "انتظار هامش أمان أفضل." },
  market: { priceAtAnalysis: 250 },
  fairValue: { bear: 180, base: 260, bull: 330, upsideToBasePct: 4 },
  valuationMethods: { dcf: { method: "DCF", fairValue: 260 } },
  recommendation: { action: "BUY", confidence: 71, whatWouldUpgrade: ["نمو أسرع"] },
  guidance: [],
  nextQuarterGuidance: { quarter: "Q3 2026", items: [{ topic: "Revenue", guidance: "$190B-$195B", direction: "raised" }] },
  monitoringChecklist: undefined,
  whatChangesMyMind: { items: [{ metric: "FCF", downgradeTrigger: "انخفاض مستمر" }] },
  watchItems: ["Revenue Growth"]
};

const migratedLegacy = normalizeExternalAnalysisReport(legacyInput, JSON.stringify(legacyInput), { now });
assert.equal(migratedLegacy.fairValueSummary.currentPrice, 250);
assert.equal(migratedLegacy.fairValueSummary.fairValueBase, 260);
assert.equal(migratedLegacy.decision.action, "HOLD", "Legacy decision.verdict has priority over recommendation.action.");
assert.ok(migratedLegacy.decision.rationale.includes("HOLD / ACCUMULATE ON WEAKNESS"), "Detailed legacy action text must be preserved as rationale.");
assert.equal(migratedLegacy.guidance[0].period, "Q3 2026");
assert.deepEqual(migratedLegacy.monitoringChecklist.map((item) => item.metric), ["FCF", "Revenue Growth"]);
assert.equal(migratedLegacy.valuationResults[0].method, "DCF");

const conflictingInput = {
  ...legacyInput,
  company: { ...legacyInput.company, currentPrice: 999 },
  fairValueSummary: canonicalInput.fairValueSummary,
  decision: canonicalInput.decision,
  guidance: canonicalInput.guidance,
  monitoringChecklist: canonicalInput.monitoringChecklist,
  estimateRevisions: canonicalInput.estimateRevisions
};
const normalizedConflict = normalizeExternalAnalysisReport(conflictingInput, "conflict", { now });
assert.equal(normalizedConflict.fairValueSummary.fairValueBase, 274, "Canonical fairValueSummary must win over legacy fairValue.");
assert.equal(normalizedConflict.fairValueSummary.currentPrice, 262.65, "Canonical fairValueSummary.currentPrice must win over legacy price copies.");
assert.equal(normalizedConflict.decision.action, "WATCH", "Canonical decision.action must win over legacy recommendation.");
assert.equal(normalizedConflict.guidance[0].currentGuidance, "$197B-$202B", "Canonical guidance must be retained first.");
assert.equal(normalizedConflict.monitoringChecklist[0].metric, "Revenue Growth", "Canonical monitoring entries must be retained first.");

const exported = JSON.parse(copyableExternalAnalysisJson(migratedLegacy));
for (const deprecated of ["executiveDecision", "finalDecision", "recommendation", "fairValue", "nextQuarterGuidance", "watchItems", "whatChangesMyMind", "dashboardExport", "valuationMethods"]) {
  assert.equal(Object.hasOwn(exported, deprecated), false, `Export must not recreate deprecated ${deprecated}.`);
}
assert.equal(exported.schemaVersion, EXTERNAL_ANALYSIS_SCHEMA_VERSION);
assert.equal(exported.fairValueSummary.fairValueBase, 260);
assert.equal(exported.decision.action, "HOLD");
assert.equal(Object.hasOwn(exported.market, "priceAtAnalysis"), false);
assert.equal(Object.hasOwn(exported.scores, "overall"), false);

const oldSavedCollection = normalizeExternalAnalysesCollection({ ACME: [{ ...legacyInput, id: "legacy-acme", analysisOrigin: "external_chatgpt" }] });
assert.equal(oldSavedCollection.ACME[0].schemaVersion, EXTERNAL_ANALYSIS_SCHEMA_VERSION);
assert.equal(oldSavedCollection.ACME[0].fairValueSummary.fairValueBase, 260);

const withoutRevisions = normalizeExternalAnalysisReport({ ...canonicalInput, estimateRevisions: undefined }, "missing revisions", { now });
assert.equal(withoutRevisions.estimateRevisions, null);
assert.equal(estimateRevisionsCard(withoutRevisions.estimateRevisions), "");

const partialMarkup = estimateRevisionsCard(parsedCanonical.report.estimateRevisions);
assert.match(partialMarkup, /Revenue/);
assert.match(partialMarkup, /▲/);
assert.match(partialMarkup, /EPS/);
assert.doesNotMatch(partialMarkup, />0(?:\.0+)?%</, "Unavailable estimate metrics must not render fake zero changes.");

const unknownMarkup = estimateRevisionsCard({
  periodDays: null,
  asOfDate: null,
  revenue: null,
  eps: null,
  ebitda: null,
  overallDirection: "unknown",
  interpretation: null,
  source: null
});
assert.doesNotMatch(unknownMarkup, /▲|▼/);
assert.match(unknownMarkup, /—/);

console.log("External canonical schema and Estimate Revisions tests passed.");
