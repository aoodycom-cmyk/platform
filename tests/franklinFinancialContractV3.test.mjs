import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFullAnalysisPrompt, buildNewEarningsAnalysisPrompt } from "../src/externalAnalysis/chatgptContract.js";
import {
  applyHistoricalRequirementLifecycle,
  attachRequirementSetIdentityToReport,
  prepareHistoricalRequirementEvaluation
} from "../src/externalAnalysis/historicalRequirements.js";
import {
  parseExternalAnalysisInput,
  setQuarterlyEarningsLiteReportResolver
} from "../src/externalAnalysis/parser.js";
import { normalizeExternalAnalysisReport } from "../src/externalAnalysis/schema.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";
import { QUARTERLY_EARNINGS_LITE_SCHEMA } from "../src/externalAnalysis/quarterlyEarningsLite.js";
import { buildFranklinV3ReportTemplate, FRANKLIN_V3_CANONICAL_ENUMS } from "../src/externalAnalysis/v3Contract.js";
import {
  calculateV3RequirementAssessment,
  validateFranklinV3Report
} from "../src/externalAnalysis/v3Validator.js";

const now = new Date("2026-07-25T10:00:00.000Z");

const goldenA = initialV3();
const parsedInitial = await parseExternalAnalysisInput(JSON.stringify(goldenA), { now });
const savedInitial = saveExternalAnalysis({}, parsedInitial.report, { now });
const previousReport = attachRequirementSetIdentityToReport(savedInitial.report, now);
const previousSnapshot = JSON.stringify(previousReport);
let historicalRequirementSets = applyHistoricalRequirementLifecycle({}, previousReport, {}, now);
const previousSet = historicalRequirementSets.VTH[0];

const goldenB = earningsV3(previousReport, { bear: 80, base: 115, bull: 155, reviewStatus: "UPDATED", mode: "ADVANCE_TARGET", targetScenario: "BULL", targetValue: 155 });
const goldenC = earningsV3(previousReport, { bear: 70, base: 100, bull: 140, reviewStatus: "UNCHANGED", mode: "DEFEND_BASE", targetScenario: "BASE_DEFENSE", targetValue: 100 });
const goldenD = earningsV3(previousReport, { bear: 50, base: 75, bull: 105, reviewStatus: "UPDATED", thesisStatus: "WEAKENED", mode: "RECOVERY", targetScenario: "RECOVERY", targetValue: 95 });

const partialBase = await preparedPreviousWithWeights([25, 20, 20, 15, 10, 10]);
const goldenE = earningsV3(partialBase.previousReport, {
  statuses: ["PASSED", "PASSED", "PASSED", "PASSED", "PASSED", "NOT_REPORTED"],
  actualValues: [31, 51, 120, 8, "raised", null],
  bear: 80,
  base: 115,
  bull: 155
});

assertValidation(goldenA, {}, "Golden A INITIAL must validate.");
assertValidation(goldenB, { currentReport: previousReport, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" }, "Golden B UPDATED must validate.");
assertValidation(goldenC, { currentReport: previousReport, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" }, "Golden C UNCHANGED must validate.");
assertValidation(goldenD, { currentReport: previousReport, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" }, "Golden D RECOVERY must validate.");
assertValidation(goldenE, { currentReport: partialBase.previousReport, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" }, "Golden E partial reporting must validate.");

assert.equal(goldenA.valuation.reviewStatus, "INITIAL");
assert.equal(goldenA.thesis.status, "INITIAL");
assert.equal(goldenA.nextRequirements.currentJustifiedValue, 100);
assert.equal(goldenA.nextRequirements.mode, "ADVANCE_TARGET");
assert.ok(goldenA.nextRequirements.requirements.length >= 4 && goldenA.nextRequirements.requirements.length <= 8);
assert.equal(weightTotal(goldenA.nextRequirements.requirements), 100);
assert.equal(goldenA.nextRequirements.requirements.every((item) => item.status === "NOT_REPORTED"), true);

assert.equal(goldenB.valuation.reviewStatus, "UPDATED");
assert.equal(goldenB.valuation.previous.base, 100);
assert.equal(goldenB.valuation.current.base, 115);
assert.equal(Math.round(goldenB.valuation.change.basePct), 15);
assert.equal(goldenB.nextRequirements.currentJustifiedValue, 115);

assert.equal(goldenC.valuation.reviewStatus, "UNCHANGED");
assert.equal(goldenC.valuation.current.base, 100);
assert.ok(goldenC.valuation.valuationBridge.whyBaseChangedOrNot);
assert.equal(goldenC.nextRequirements.currentJustifiedValue, 100);

assert.equal(goldenD.thesis.status, "WEAKENED");
assert.equal(goldenD.nextRequirements.mode, "RECOVERY");
assert.equal(goldenD.nextRequirements.currentJustifiedValue, 75);
assert.equal(goldenD.nextRequirements.targetScenario, "RECOVERY");
assert.ok(goldenD.nextRequirements.requirements.length >= 4 && goldenD.nextRequirements.requirements.length <= 8);
assert.equal(weightTotal(goldenD.nextRequirements.requirements), 100);

assert.equal(goldenE.previousRequirementsEvaluation.assessment.coverageWeightPct, 90);
assert.equal(goldenE.previousRequirementsEvaluation.assessment.achievementOfReportedWeightPct, 100);
assert.equal(goldenE.previousRequirementsEvaluation.assessment.achievementOfTotalWeightPct, 90);
assert.equal(goldenE.previousRequirementsEvaluation.assessment.notReportedWeightPct, 10);

const matrix = [
  ["1. v3 INITIAL import", async () => assert.equal((await parseExternalAnalysisInput(JSON.stringify(goldenA), { now })).report.metadata.nativeSchemaVersion, "franklin-fair-value/v3")],
  ["2. v3 EARNINGS_REVALUATION import", async () => assert.equal((await parseExternalAnalysisInput(JSON.stringify(goldenB), { now, currentReport: previousReport, expectedReportPeriod: "Q2 2026" })).report.metadata.franklinV3.reviewStatus, "UPDATED")],
  ["3. v3 report round-trip storage", () => assert.equal(saveExternalAnalysis({}, parsedInitial.report, { now }).report.metadata.franklinV3Report.schemaVersion, "franklin-fair-value/v3")],
  ["4. Historical v1 remains readable", () => assert.equal(normalizeExternalAnalysisReport(legacyFairValue("fair-value-analysis/v1")).metadata.nativeSchemaVersion, "fair-value-analysis/v1")],
  ["5. Historical v2 remains readable", () => assert.equal(normalizeExternalAnalysisReport(legacyFairValue("fair-value-analysis/v2")).metadata.nativeSchemaVersion, "fair-value-analysis/v2")],
  ["6. external-analysis-report/v2 remains readable", () => assert.equal(normalizeExternalAnalysisReport(parsedInitial.report).schemaVersion, "external-analysis-report/v2")],
  ["7. quarterly-earnings-lite/v1 remains readable", async () => assert.equal((await parseLite(previousReport)).parserSource, "Quarterly Earnings Lite Parser")],
  ["8. Lite does not replace canonical state", async () => assert.equal((await parseLite(previousReport)).report.metadata.franklinV3Report, null)],
  ["9. Previous analysis remains immutable", async () => assert.equal(JSON.stringify(previousReport), previousSnapshot)],
  ["10. New earnings analysis creates a new report", async () => assert.equal((await saveCanonicalEarnings(goldenB, previousReport, historicalRequirementSets)).collection.VTH.length, 2)],
  ["11. previousAnalysisId lineage is preserved", () => assert.equal(goldenB.reportIdentity.previousAnalysisId, previousReport.id)],
  ["12. previousRequirementSetId lineage is preserved", () => assert.equal(goldenB.reportIdentity.previousRequirementSetId, previousReport.priceTargetRequirements.requirementSetId)],
  ["13. wrong previousAnalysisId is rejected", () => expectInvalid(goldenB, (item) => { item.reportIdentity.previousAnalysisId = "WRONG"; }, /previousAnalysisId/)],
  ["14. wrong previousRequirementSetId is rejected", () => expectInvalid(goldenB, (item) => { item.reportIdentity.previousRequirementSetId = "WRONG"; }, /previousRequirementSetId/)],
  ["15. wrong fiscal quarter cannot evaluate requirement set", () => expectInvalid(goldenB, (item) => { item.reportIdentity.fiscalQuarter = "Q3"; }, /different fiscal quarter/)],
  ["16. previous requirement definitions cannot change", () => expectInvalid(goldenB, (item) => { item.previousRequirementsEvaluation.requirements[0].requiredValue = 999; }, /requiredValue/)],
  ["17. NOT_REPORTED does not become FAILED", () => assert.equal(goldenE.previousRequirementsEvaluation.requirements.at(-1).status, "NOT_REPORTED")],
  ["18. PARTIALLY_PASSED preserves partialCreditPct", async () => assert.equal((await parseExternalAnalysisInput(JSON.stringify(earningsV3(previousReport, { statuses: ["PARTIALLY_PASSED", "PASSED", "PASSED", "PASSED"], partialCredits: [50, null, null, null] })), { now, currentReport: previousReport, expectedReportPeriod: "Q2 2026" })).report.previousRequirementsEvaluation.requirements[0].partialCreditPct, 50)],
  ["19. previous requirement scoring formula validates", () => assert.equal(validateFranklinV3Report(goldenB, context()).valid, true)],
  ["20. partial reporting example validates 90/100/90", () => assert.deepEqual([goldenE.previousRequirementsEvaluation.assessment.coverageWeightPct, goldenE.previousRequirementsEvaluation.assessment.achievementOfReportedWeightPct, goldenE.previousRequirementsEvaluation.assessment.achievementOfTotalWeightPct], [90, 100, 90])],
  ["21. Bear <= Base <= Bull", () => assert.ok(goldenA.valuation.current.bear <= goldenA.valuation.current.base && goldenA.valuation.current.base <= goldenA.valuation.current.bull)],
  ["22. invalid Fair Value ordering rejected", () => expectInvalid(goldenA, (item) => { item.valuation.current.bear = 150; item.valuation.scenarios.Bear.fairValue = 150; }, /Bear\/Base\/Bull/)],
  ["23. scenario probabilities sum to 100%", () => assert.equal(weightTotal(Object.values(goldenA.valuation.scenarios).map((item) => ({ weight: item.probability }))), 100)],
  ["24. invalid scenario probability total rejected", () => expectInvalid(goldenA, (item) => { item.valuation.scenarios.Bull.probability = 30; }, /Scenario probabilities/)],
  ["25. valuation weights sum to 100%", () => assert.equal(weightTotal(goldenA.valuation.methodology.modelWeights), 100)],
  ["26. invalid valuation weights rejected", () => expectInvalid(goldenA, (item) => { item.valuation.methodology.modelWeights[0].weight = 60; }, /Valuation method weights/)],
  ["27. probabilityWeighted calculation validates", () => assert.equal(goldenA.valuation.current.probabilityWeighted, 102)],
  ["28. harmless rounding is accepted", () => assert.equal(validateFranklinV3Report(mutated(goldenA, (item) => { item.valuation.current.probabilityWeighted = 102.01; })).valid, true)],
  ["29. new requirements count 4-8", () => assert.ok(goldenA.nextRequirements.requirements.length >= 4 && goldenA.nextRequirements.requirements.length <= 8)],
  ["30. new requirement weights sum to 100%", () => assert.equal(weightTotal(goldenA.nextRequirements.requirements), 100)],
  ["31. every new requirement status = NOT_REPORTED", () => assert.equal(goldenA.nextRequirements.requirements.every((item) => item.status === "NOT_REPORTED"), true)],
  ["32. currentJustifiedValue = new Base", () => assert.equal(goldenB.nextRequirements.currentJustifiedValue, goldenB.valuation.current.base)],
  ["33. mismatch between currentJustifiedValue and Base rejected", () => expectInvalid(goldenB, (item) => { item.nextRequirements.currentJustifiedValue = 999; }, /currentJustifiedValue/)],
  ["34. UPDATED earnings revaluation works", () => assert.equal(goldenB.valuation.reviewStatus, "UPDATED")],
  ["35. UNCHANGED earnings revaluation works", () => assert.equal(validateFranklinV3Report(goldenC, context()).valid, true)],
  ["36. UNCHANGED still creates a new report", async () => assert.equal((await saveCanonicalEarnings(goldenC, previousReport, historicalRequirementSets)).collection.VTH.length, 2)],
  ["37. UNCHANGED still creates a new requirement set", async () => assert.equal((await saveCanonicalEarnings(goldenC, previousReport, historicalRequirementSets)).historical.VTH.some((set) => set.status === "OPEN" && set.requirementSetId !== previousSet.requirementSetId), true)],
  ["38. ADVANCE_TARGET works", () => assert.equal(goldenB.nextRequirements.mode, "ADVANCE_TARGET")],
  ["39. DEFEND_BASE works", () => assert.equal(goldenC.nextRequirements.mode, "DEFEND_BASE")],
  ["40. RECOVERY works", () => assert.equal(goldenD.nextRequirements.mode, "RECOVERY")],
  ["41. reportingCurrency and tradingCurrency stay separate", () => assert.notEqual(mutated(goldenA, (item) => { item.company.reportingCurrency = "HKD"; item.company.tradingCurrency = "USD"; }).company.reportingCurrency, mutated(goldenA, (item) => { item.company.reportingCurrency = "HKD"; item.company.tradingCurrency = "USD"; }).company.tradingCurrency)],
  ["42. marketPrice currency validation", () => expectInvalid(goldenA, (item) => { item.marketPrice.currency = "EUR"; }, /marketPrice.currency/)],
  ["43. valuation currency validation", () => expectInvalid(goldenA, (item) => { item.valuation.current.currency = "EUR"; }, /valuation.current.currency/)],
  ["44. securityUnit validation", () => expectInvalid(goldenA, (item) => { item.valuation.current.securityUnit = "ADR"; }, /securityUnit/)],
  ["45. upside formula validation", () => expectInvalid(goldenA, (item) => { item.valuation.upsideToBasePct = -20; }, /upsideToBasePct/)],
  ["46. margin-of-safety formula validation", () => expectInvalid(goldenA, (item) => { item.valuation.marginOfSafetyPct = -20; }, /marginOfSafetyPct/)],
  ["47. fresh quarterly sources accepted", () => assert.equal(validateFranklinV3Report(goldenB, context()).valid, true)],
  ["48. missing earnings provenance flagged", () => expectInvalid(goldenB, (item) => { item.sources = [source("S1", "Market Data", "2026-04-25", ["marketPrice"])]; }, /source provenance|earnings/i)],
  ["49. previous-quarter sources are rejected as current-quarter evidence", () => expectInvalid(goldenB, (item) => { item.sources = item.sources.map((src) => ({ ...src, date: "2026-01-15" })); }, /fresh quarterly source provenance/i)],
  ["50. existing user reports remain unchanged", () => assert.equal(JSON.stringify(previousReport), previousSnapshot)]
];

assert.equal(matrix.length, 50);
for (const [name, run] of matrix) {
  await run();
  assert.ok(name);
}

const componentsSource = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const liteButtonSource = readFileSync(new URL("../src/ui/quarterlyEarningsJsonPromptV2.js", import.meta.url), "utf8");
assert.ok(componentsSource.includes('data-action="prepare-earnings-prompt"'));
assert.ok(componentsSource.includes("store.prepareEarningsUpdatePrompt"));
assert.equal(liteButtonSource.includes("hidden = true"), false, "Lite must not hide the primary canonical earnings action.");
assert.ok(liteButtonSource.includes("Quick Earnings Read"));
assert.ok(liteButtonSource.includes("غير Canonical"));

const primaryEarningsPrompt = buildNewEarningsAnalysisPrompt(previousReport, { quarter: 2, year: 2026 });
assert.ok(primaryEarningsPrompt.includes("franklin-fair-value/v3"));
assert.ok(primaryEarningsPrompt.includes("EARNINGS_REVALUATION"));
assert.ok(primaryEarningsPrompt.includes("UPDATED أو UNCHANGED"));
assert.ok(primaryEarningsPrompt.includes("nextRequirements.currentJustifiedValue"));

const liteParsed = await parseLite(previousReport);
const litePrepared = prepareHistoricalRequirementEvaluation(liteParsed.report, historicalRequirementSets);
const liteReportForLifecycle = attachRequirementSetIdentityToReport({ ...litePrepared.report, id: "VTH-lite-q2" }, now);
const liteLifecycle = applyHistoricalRequirementLifecycle(historicalRequirementSets, liteReportForLifecycle, litePrepared.match, now);
assert.equal(liteLifecycle.VTH.find((set) => set.requirementSetId === previousSet.requirementSetId).status, "OPEN");
assert.equal(liteLifecycle.VTH.length, historicalRequirementSets.VTH.length);

const updatedLifecycle = await saveCanonicalEarnings(goldenB, previousReport, historicalRequirementSets);
assert.equal(updatedLifecycle.historical.VTH.find((set) => set.requirementSetId === previousSet.requirementSetId).status, "EVALUATED");
assert.equal(updatedLifecycle.historical.VTH.some((set) => set.status === "OPEN" && set.requirementSetId !== previousSet.requirementSetId), true);
const unchangedLifecycle = await saveCanonicalEarnings(goldenC, previousReport, historicalRequirementSets);
assert.equal(unchangedLifecycle.historical.VTH.find((set) => set.requirementSetId === previousSet.requirementSetId).status, "EVALUATED");
assert.equal(unchangedLifecycle.historical.VTH.some((set) => set.status === "OPEN" && set.requirementSetId !== previousSet.requirementSetId), true);

const partialAssessment = calculateV3RequirementAssessment([
  { id: "partial", weight: 20, status: "PARTIALLY_PASSED", partialCreditPct: 50 },
  { id: "passed", weight: 80, status: "PASSED" }
]);
assert.equal(partialAssessment.partialWeightPct, 20);
assert.equal(partialAssessment.passedWeightPct, 80);
assert.equal(partialAssessment.achievementOfReportedWeightPct, 90);
expectInvalid(goldenB, (item) => {
  item.previousRequirementsEvaluation.requirements[0].status = "PARTIALLY_PASSED";
  item.previousRequirementsEvaluation.requirements[0].partialCreditPct = 50;
  item.previousRequirementsEvaluation.assessment = {
    ...calculateV3RequirementAssessment(item.previousRequirementsEvaluation.requirements),
    partialWeightPct: 12.5,
    overallStatus: "MIXED",
    summary: "Wrong partial bucket."
  };
}, /partialWeightPct/);

expectInvalid(goldenB, (item) => {
  item.valuation.current.bear = item.valuation.previous.bear;
  item.valuation.current.base = item.valuation.previous.base;
  item.valuation.current.bull = item.valuation.previous.bull;
  item.valuation.scenarios.Bear.fairValue = item.valuation.previous.bear;
  item.valuation.scenarios.Base.fairValue = item.valuation.previous.base;
  item.valuation.scenarios.Bull.fairValue = item.valuation.previous.bull;
  item.valuation.current.probabilityWeighted = item.valuation.previous.probabilityWeighted;
  item.valuation.change = { bearPct: 0, basePct: 0, bullPct: 0, summary: "No change." };
  item.nextRequirements.currentJustifiedValue = item.valuation.previous.base;
  item.nextRequirements.targetValue = item.valuation.previous.bull;
}, /UPDATED requires/);
expectInvalid(goldenC, (item) => {
  item.valuation.current.base = 101;
  item.valuation.scenarios.Base.fairValue = 101;
  item.valuation.current.probabilityWeighted = 102.6;
  item.valuation.change.basePct = 1;
  item.nextRequirements.currentJustifiedValue = 101;
  item.nextRequirements.targetValue = 101;
}, /UNCHANGED requires|must be zero/);

const adsReport = mutated(goldenA, (item) => {
  item.company.reportingCurrency = "HKD";
  item.company.tradingCurrency = "USD";
  item.company.securityUnit = "ADS";
  item.marketPrice.currency = "USD";
  item.valuation.current.currency = "USD";
  item.valuation.current.securityUnit = "ADS";
  item.latestQuarter.coreMetrics.revenue.unit = "HKDm";
  item.latestQuarter.coreMetrics.eps.unit = "HKD";
});
assertValidation(adsReport, {}, "ADR/ADS reporting/trading currency case must validate.");
const parsedAds = await parseExternalAnalysisInput(JSON.stringify(adsReport), { now, expectedTicker: "VTH" });
assert.equal(parsedAds.report.metadata.franklinV3.securityUnit, "ADS");
assert.equal(parsedAds.report.metadata.franklinV3.reportingCurrency, "HKD");
assert.equal(parsedAds.report.metadata.franklinV3.tradingCurrency, "USD");
assert.equal(parsedAds.report.metadata.franklinV3Report.latestQuarter.coreMetrics.revenue.unit, "HKDm");
assert.equal(parsedAds.report.financialHighlights.revenue, "120 HKDm");
assert.equal(parsedAds.report.financialHighlights.epsReported, "1.2 HKD");
assert.equal(parsedAds.report.fairValueSummary.fairValueBase, 100);
assert.equal(parsedAds.report.company.currency, "USD");

expectInvalid(goldenB, (item) => { item.reportIdentity.earningsReleaseDate = "2026-06-01"; }, /earningsReleaseDate must be on or after periodEndDate/);
expectInvalid(goldenA, (item) => { item.valuation.scenarios.Bull.probability = null; item.valuation.scenarios.Base.probability = 80; }, /Scenario probabilities/);
expectInvalid(goldenA, (item) => { item.valuation.valuationResults = item.valuation.valuationResults.filter((result) => result.method !== "P\/E"); }, /Missing valuationResult/);
expectInvalid(goldenB, (item) => { item.sources[1].usedFor = ["valuation"]; }, /fresh quarterly source provenance/i);
expectInvalid(goldenA, (item) => { item.audit.nextRequirementWeightTotalPct = 99; }, /nextRequirementWeightTotalPct/);
{
  const wrongTicker = mutated(goldenA, (item) => { item.reportIdentity.ticker = "WRONG"; });
  const tickerValidation = validateFranklinV3Report(wrongTicker, { expectedTicker: "VTH" });
  assert.equal(tickerValidation.valid, false);
  assert.match(tickerValidation.errors.map((error) => error.message).join("\n"), /Ticker mismatch/);
}

const initialPrompt = buildFullAnalysisPrompt({ tickerHint: "VTH" });
assert.ok(initialPrompt.includes("franklin-fair-value/v3"));
assert.ok(initialPrompt.includes("analysisType يجب أن يكون INITIAL"));
assert.ok(initialPrompt.includes("nextRequirements.currentJustifiedValue"));
assert.ok(initialPrompt.includes("marketPrice.currency وvaluation.current.currency"));
assert.equal(initialPrompt.includes("fairValueSummary.fairValueBase"), false);
assert.equal(initialPrompt.includes("thesis.shortSummary"), false);
assert.ok(initialPrompt.includes("sourceType: Investor Relations | SEC | Earnings Call"));
assert.ok(initialPrompt.includes("valuationRole: PRIMARY | SECONDARY | CROSS_CHECK"));

const earningsPrompt = buildNewEarningsAnalysisPrompt(previousReport, { quarter: 2, year: 2026 });
assert.ok(earningsPrompt.includes(previousReport.id));
assert.ok(earningsPrompt.includes(previousReport.priceTargetRequirements.requirementSetId));
assert.ok(earningsPrompt.includes("Q2 2026"));
assert.ok(earningsPrompt.includes("previousInvestmentState JSON"));
assert.ok(earningsPrompt.includes("valuationResults"));
assert.ok(earningsPrompt.includes("valuationBridge"));
assert.ok(earningsPrompt.includes("yearlyForecast"));
assert.ok(earningsPrompt.includes("Previous Bear Fair Value"));
assert.ok(earningsPrompt.includes("فرضية الاستثمار"));
assert.ok(earningsPrompt.includes(previousReport.priceTargetRequirements.requirements[0].id));
assert.ok(earningsPrompt.includes("أعد تقييم Bear/Base/Bull إلزاميًا"));
assert.ok(earningsPrompt.includes("UPDATED أو UNCHANGED"));
assert.ok(earningsPrompt.includes("nextRequirements جديدة بالكامل"));
assert.ok(earningsPrompt.includes("nextRequirements.currentJustifiedValue يجب أن يساوي valuation.current.base"));
assert.ok(earningsPrompt.includes("مصادر جديدة خاصة بهذا الربع"));
assert.equal(earningsPrompt.includes("```"), false);

assert.deepEqual(FRANKLIN_V3_CANONICAL_ENUMS.analysisType, ["INITIAL", "EARNINGS_REVALUATION"]);
assert.deepEqual(FRANKLIN_V3_CANONICAL_ENUMS.requirementOverallStatus, ["EXCEEDED", "PASSED", "MIXED", "FAILED", "INCOMPLETE"]);
assert.deepEqual(FRANKLIN_V3_CANONICAL_ENUMS.sourceType, ["Investor Relations", "SEC", "Earnings Call", "Market Data", "Consensus Data", "Trusted Financial News", "User Provided", "Other"]);
assert.equal(buildFranklinV3ReportTemplate({ analysisType: "EARNINGS_REVALUATION", previousReport }).valuation.reviewStatus, null);
assert.equal(buildFranklinV3ReportTemplate({ analysisType: "EARNINGS_REVALUATION", previousReport }).valuation.methodology.methodologyChanged, null);
assert.equal(buildFranklinV3ReportTemplate({ analysisType: "EARNINGS_REVALUATION", previousReport }).valuation.valuationResults[0].role, null);
assert.equal(buildFranklinV3ReportTemplate({ analysisType: "EARNINGS_REVALUATION", previousReport }).risks[0].severity, null);

expectInvalid(goldenA, (item) => { item.latestQuarter.coreMetrics.revenue.result = "AHEAD"; }, /coreMetrics|result/);
expectInvalid(goldenA, (item) => { item.latestQuarter.companySpecificKpis[0].importance = "important"; }, /importance/);
expectInvalid(goldenA, (item) => { item.forecast.materiality = "IMMATERIAL"; }, /materiality/);
expectInvalid(goldenA, (item) => { item.forecast.yearlyForecast[0].revenue.basis = "guessed"; }, /basis/);
expectInvalid(goldenA, (item) => { item.forecast.changedAssumptions[0].direction = "FLAT"; }, /direction/);
expectInvalid(goldenA, (item) => { item.valuation.valuationResults[0].role = "MAIN"; }, /role/);
expectInvalid(goldenA, (item) => { item.marketPrice.priceType = "CLOSING"; }, /priceType/);
expectInvalid(goldenA, (item) => { item.decision.scope = "PORTFOLIO"; }, /decision.scope/);
expectInvalid(goldenB, (item) => { item.previousRequirementsEvaluation.assessment.overallStatus = "PARTIAL"; }, /overallStatus/);
expectInvalid(goldenA, (item) => { item.sources[0].type = "market data"; }, /sources.0.type/);
expectInvalid(goldenA, (item) => { item.reportIdentity.fiscalQuarter = "Quarter 1"; }, /fiscalQuarter/);
expectInvalid(goldenA, (item) => { item.reportIdentity.fiscalYear = 1999; }, /fiscalYear/);
expectInvalid(goldenA, (item) => { item.nextRequirements.requirements[1].id = item.nextRequirements.requirements[0].id; }, /unique/);
expectInvalid(goldenB, (item) => { item.previousRequirementsEvaluation.requirements[1].id = item.previousRequirementsEvaluation.requirements[0].id; }, /unique/);
expectInvalid(goldenA, (item) => { item.valuation.methodology.modelWeights[1].method = "DCF"; }, /unique/);
expectInvalid(goldenA, (item) => { item.valuation.methodology.excludedMethods.push({ method: "DCF", reason: "bad duplicate" }); }, /cannot also be excluded/);
expectInvalid(goldenA, (item) => { item.valuation.valuationResults.push({ ...item.valuation.valuationResults[0] }); }, /exactly one/);

assertValidation(mutated(goldenB, (item) => {
  item.marketPrice.asOf = "2026-07-25T22:00:00.000Z";
}), context(), "Date-only analysisDate must accept same calendar-day market timestamps.");
expectInvalid(goldenB, (item) => {
  item.marketPrice.asOf = "2026-07-26T00:01:00.000Z";
}, /marketPrice.asOf/);

const zeroBearPrevious = mutated(previousReport, (item) => {
  item.fairValueSummary.fairValueLow = 0;
  item.metadata.franklinV3Report.valuation.current.bear = 0;
});
assertValidation(mutated(earningsV3(zeroBearPrevious, { bear: 20, base: 115, bull: 155 }), (item) => {
  item.valuation.previous.bear = 0;
  item.valuation.change.bearPct = null;
  item.valuation.change.summary = "Bear moved from zero after fresh evidence.";
}), { currentReport: zeroBearPrevious, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" }, "Bear Fair Value can move from zero with a null percentage and narrative summary.");

const noSetPrevious = mutated(previousReport, (item) => {
  item.priceTargetRequirements = {
    ...item.priceTargetRequirements,
    requirementSetId: null,
    requirements: []
  };
});
assertValidation(mutated(earningsV3(noSetPrevious, { bear: 80, base: 115, bull: 155 }), (item) => {
  item.reportIdentity.previousRequirementSetId = null;
  item.previousRequirementsEvaluation = null;
  item.audit.previousRequirementWeightTotalPct = null;
}), { currentReport: noSetPrevious, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" }, "Earnings revaluation without a previous requirement set must not invent previousRequirementsEvaluation.");

const noSetTemplate = buildFranklinV3ReportTemplate({ analysisType: "EARNINGS_REVALUATION", previousReport: noSetPrevious, selectedPeriod: "Q2 2026" });
assert.equal(noSetTemplate.previousRequirementsEvaluation, null);
assert.equal(noSetTemplate.audit.previousRequirementWeightTotalPct, null);
assert.ok(buildNewEarningsAnalysisPrompt(noSetPrevious, { quarter: 2, year: 2026 }).includes("لا توجد requirement set سابقة. لا تخترع واحدة."));

const duplicatePeriodSet = {
  ...previousSet,
  requirementSetId: "OTHER_Q2_SET",
  createdAt: "2026-04-26T00:00:00.000Z"
};
const explicitPrepared = prepareHistoricalRequirementEvaluation(
  (await parseExternalAnalysisInput(JSON.stringify(goldenB), { now, currentReport: previousReport, expectedReportPeriod: "Q2 2026" })).report,
  { VTH: [duplicatePeriodSet, previousSet] }
);
assert.equal(explicitPrepared.match.matchType, "canonical_explicit_requirement_set_id");
assert.equal(explicitPrepared.match.set.requirementSetId, previousSet.requirementSetId);

const partialLifecycle = await saveCanonicalEarnings(earningsV3(previousReport, {
  statuses: ["PARTIALLY_PASSED", "PASSED", "PASSED", "PASSED"],
  partialCredits: [60, null, null, null]
}), previousReport, historicalRequirementSets);
const evaluatedPartial = partialLifecycle.historical.VTH.find((set) => set.requirementSetId === previousSet.requirementSetId).requirements[0];
assert.equal(evaluatedPartial.partialCreditPct, 60);
assert.equal(evaluatedPartial.sourceId, "S2");

const storeSource = readFileSync(new URL("../src/state/store.js", import.meta.url), "utf8");
assert.ok(storeSource.includes("expectedTicker: tickerHint || null"));
assert.ok(storeSource.includes("ابحث أولًا عن مصادر الربع المحدد الرسمية والموثوقة"));
assert.ok(storeSource.includes("اطلب من المستخدم تزويدك بالمواد فقط إذا لم تتوفر معلومات رسمية موثوقة"));

console.log("Franklin financial contract v3 tests passed.");

function assertValidation(report, context, message) {
  const validation = validateFranklinV3Report(report, context);
  assert.equal(validation.valid, true, `${message}\n${JSON.stringify(validation.errors, null, 2)}`);
}

function context() {
  return { currentReport: previousReport, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" };
}

function expectInvalid(report, mutate, pattern) {
  const candidate = mutated(report, mutate);
  const validation = validateFranklinV3Report(candidate, report.analysisType === "EARNINGS_REVALUATION" ? context() : {});
  assert.equal(validation.valid, false, `Expected invalid report for ${pattern}`);
  assert.match(validation.errors.map((error) => `${error.field}: ${error.message}`).join("\n"), pattern);
}

async function preparedPreviousWithWeights(weights) {
  const initial = initialV3({ weights });
  const parsed = await parseExternalAnalysisInput(JSON.stringify(initial), { now });
  const saved = saveExternalAnalysis({}, parsed.report, { now });
  const report = attachRequirementSetIdentityToReport(saved.report, now);
  const historical = applyHistoricalRequirementLifecycle({}, report, {}, now);
  return { previousReport: report, historical };
}

async function saveCanonicalEarnings(canonical, currentReport, historical) {
  const parsed = await parseExternalAnalysisInput(JSON.stringify(canonical), {
    now,
    currentReport,
    expectedReportPeriod: "Q2 2026"
  });
  const prepared = prepareHistoricalRequirementEvaluation(parsed.report, historical);
  const reportWithId = { ...prepared.report, id: `${currentReport.company.ticker}-earnings-${canonical.valuation.reviewStatus}-${canonical.nextRequirements.mode}` };
  const reportForSave = attachRequirementSetIdentityToReport(reportWithId, now);
  const saved = saveExternalAnalysis({ [currentReport.company.ticker]: [currentReport] }, reportForSave, { allowDuplicate: true, now });
  const nextHistorical = applyHistoricalRequirementLifecycle(historical, saved.report, prepared.match, now);
  return { collection: saved.collection, report: saved.report, historical: nextHistorical };
}

async function parseLite(currentReport) {
  setQuarterlyEarningsLiteReportResolver(() => currentReport);
  try {
    return await parseExternalAnalysisInput(JSON.stringify({
      schemaVersion: QUARTERLY_EARNINGS_LITE_SCHEMA,
      ticker: currentReport.company.ticker,
      quarter: "Q2",
      year: 2026,
      reportDate: "2026-04-25",
      requirementSetId: currentReport.priceTargetRequirements.requirementSetId,
      summary: "قراءة سريعة غير Canonical.",
      metrics: { revenue: { value: 100, display: "$100M", result: "INLINE" } },
      requirements: []
    }), { now });
  } finally {
    setQuarterlyEarningsLiteReportResolver(null);
  }
}

function initialV3(options = {}) {
  const weights = options.weights || [25, 25, 25, 25];
  const requirements = weights.map((weight, index) => nextRequirement(index, weight));
  return {
    schemaVersion: "franklin-fair-value/v3",
    methodologyVersion: "fair-value-methodology/v2",
    analysisType: "INITIAL",
    reportIdentity: {
      ticker: "VTH",
      companyName: "V3 Test Holdings",
      fiscalQuarter: "Q1",
      fiscalYear: 2026,
      periodEndDate: "2026-03-31",
      earningsReleaseDate: "2026-04-20",
      analysisDate: "2026-04-25",
      previousAnalysisId: null,
      previousRequirementSetId: null
    },
    company: { sector: "Technology", industry: "Software", reportingCurrency: "USD", tradingCurrency: "USD", securityUnit: "share" },
    companyProfile: { summary: "Test company.", businessModel: "تبيع الشركة برمجيات اشتراك.", activities: [{ name: "Software", arabicName: "برمجيات", description: "منصة اشتراكات.", importance: "رئيسي" }], customers: ["Enterprises"], mainGrowthDrivers: ["ARR"] },
    dataQuality: { score: 90, confidence: "HIGH", reportedDataThrough: "Q1 2026", missingCriticalFields: [], notes: [] },
    classification: { companyType: "Profitable growth", businessStage: "Scaled", cyclicality: "low", capitalIntensity: "low", evidence: ["Recurring revenue"], confidence: "HIGH" },
    businessQuality: { score: 88, rating: "High", confidence: "HIGH", components: { growth: 85, profitability: 80, cashFlow: 78, balanceSheet: 82, capitalAllocation: 75, competitiveAdvantage: 84, management: 80 }, explanation: "جودة أعمال قوية." },
    strengths: [{ title: "Recurring revenue", explanation: "إيرادات متكررة.", evidence: ["ARR"], importance: "high", durability: "high", valuationImpact: "supports base", confidence: "HIGH", sourceIds: ["S2"] }],
    weaknesses: [{ title: "Competition", explanation: "منافسة مرتفعة.", evidence: ["Market"], severity: "medium", persistence: "medium", valuationImpact: "limits multiple", monitoringIndicator: "Net retention", confidence: "MEDIUM", sourceIds: ["S2"] }],
    marketPrice: { value: 80, currency: "USD", asOf: "2026-04-25", priceType: "LAST_CLOSE", sourceId: "S1" },
    latestQuarter: latestQuarter(),
    forecast: forecast(),
    previousRequirementsEvaluation: null,
    valuation: valuation({ bear: 70, base: 100, bull: 140, price: 80, reviewStatus: "INITIAL", previous: null, change: null }),
    thesis: { status: "INITIAL", previousSummary: null, updatedSummary: "الفرضية الأولية تعتمد على نمو ARR وربحية مستقرة.", changeReason: null, keySupports: ["ARR"], keyThreats: ["Competition"] },
    decision: { scope: "STOCK_LEVEL", action: "HOLD", confidence: 75, investmentScore: 72, rationale: ["القيمة أعلى من السعر لكن هامش الأمان متوسط."], whyNot: ["منافسة"], biggestAssumption: "ARR growth", mainRisk: "Competition", upgradeTriggers: ["ARR acceleration"], downgradeTriggers: ["Margin pressure"] },
    nextRequirements: { requirementSetId: null, mode: "ADVANCE_TARGET", previousQuarter: "Q1 2026", targetQuarter: "Q2 2026", currentJustifiedValue: 100, targetValue: 140, targetScenario: "BULL", targetDescription: "Bull requires cleaner execution.", summary: "متطلبات قابلة للقياس للربع القادم.", requirements },
    risks: [{ title: "Competition", severity: "medium", explanation: "ضغط الأسعار.", whatToMonitor: "Retention", thesisBreaker: "Retention below 100%", sourceIds: ["S2"] }],
    catalysts: [{ title: "ARR acceleration", explanation: "تسارع ARR.", timeframe: "next quarter", sourceIds: ["S2"] }],
    monitoringChecklist: [{ metric: "ARR growth", currentValue: "25%", expectedRange: "25-30%", upgradeTrigger: ">30%", downgradeTrigger: "<20%", thesisBreak: "<15%" }],
    sources: [source("S1", "Market Data", "2026-04-25", ["marketPrice"]), source("S2", "Investor Relations", "2026-04-20", ["latestQuarter", "valuation"])],
    limitations: [],
    audit: { scenarioProbabilityTotalPct: 100, valuationMethodWeightTotalPct: 100, previousRequirementWeightTotalPct: null, nextRequirementWeightTotalPct: 100, consistencyNotes: [] }
  };
}

function earningsV3(previousReport, options = {}) {
  const bear = options.bear ?? 80;
  const base = options.base ?? 115;
  const bull = options.bull ?? 155;
  const price = options.price ?? 90;
  const previousRequirements = previousReport.priceTargetRequirements.requirements;
  const statuses = options.statuses || previousRequirements.map(() => "PASSED");
  const evaluationRequirements = previousRequirements.map((item, index) => ({
    id: item.id,
    name: item.name,
    arabicName: item.arabicName,
    metric: item.metric,
    weight: item.weight,
    requiredValue: item.requiredValue,
    requiredDisplay: item.requiredDisplay,
    actualValue: options.actualValues?.[index] ?? item.requiredValue,
    actualDisplay: options.actualValues?.[index] === null ? null : item.requiredDisplay,
    status: statuses[index] || "PASSED",
    partialCreditPct: options.partialCredits?.[index] ?? null,
    evaluationNote: "تقييم صناعي للاختبار.",
    sourceId: statuses[index] === "NOT_REPORTED" ? null : "S2"
  }));
  const assessment = {
    ...calculateV3RequirementAssessment(evaluationRequirements),
    overallStatus: statuses.includes("FAILED") ? "MIXED" : statuses.every((status) => status === "NOT_REPORTED") ? "INCOMPLETE" : "PASSED",
    summary: "تم تقييم المتطلبات السابقة."
  };
  const previousBase = previousReport.fairValueSummary.fairValueBase;
  return {
    schemaVersion: "franklin-fair-value/v3",
    methodologyVersion: "fair-value-methodology/v2",
    analysisType: "EARNINGS_REVALUATION",
    reportIdentity: {
      ticker: previousReport.company.ticker,
      companyName: previousReport.company.name,
      fiscalQuarter: "Q2",
      fiscalYear: 2026,
      periodEndDate: "2026-06-30",
      earningsReleaseDate: "2026-07-25",
      analysisDate: "2026-07-25",
      previousAnalysisId: previousReport.id,
      previousRequirementSetId: previousReport.priceTargetRequirements.requirementSetId
    },
    company: { sector: previousReport.company.sector, industry: previousReport.company.industry, reportingCurrency: "USD", tradingCurrency: "USD", securityUnit: "share" },
    companyProfile: { summary: "Test company.", businessModel: "تبيع الشركة برمجيات اشتراك.", activities: [{ name: "Software", arabicName: "برمجيات", description: "منصة اشتراكات.", importance: "رئيسي" }], customers: ["Enterprises"], mainGrowthDrivers: ["ARR"] },
    dataQuality: { score: 92, confidence: "HIGH", reportedDataThrough: "Q2 2026", missingCriticalFields: [], notes: [] },
    classification: { companyType: "Profitable growth", businessStage: "Scaled", cyclicality: "low", capitalIntensity: "low", evidence: ["Recurring revenue"], confidence: "HIGH" },
    businessQuality: { score: 89, rating: "High", confidence: "HIGH", components: { growth: 86, profitability: 82, cashFlow: 80, balanceSheet: 82, capitalAllocation: 75, competitiveAdvantage: 84, management: 80 }, explanation: "الجودة ما زالت قوية." },
    strengths: [{ title: "ARR", explanation: "ARR قوي.", evidence: ["ARR"], importance: "high", durability: "high", valuationImpact: "supports base", confidence: "HIGH", sourceIds: ["S2"] }],
    weaknesses: [{ title: "Competition", explanation: "منافسة.", evidence: ["Market"], severity: "medium", persistence: "medium", valuationImpact: "limits multiple", monitoringIndicator: "Retention", confidence: "MEDIUM", sourceIds: ["S2"] }],
    marketPrice: { value: price, currency: "USD", asOf: "2026-07-25", priceType: "LAST_CLOSE", sourceId: "S1" },
    latestQuarter: latestQuarter(),
    forecast: forecast(),
    previousRequirementsEvaluation: {
      requirementSetId: previousReport.priceTargetRequirements.requirementSetId,
      targetQuarter: previousReport.priceTargetRequirements.targetQuarter,
      requirements: evaluationRequirements,
      assessment
    },
    valuation: valuation({
      bear,
      base,
      bull,
      price,
      reviewStatus: options.reviewStatus || "UPDATED",
      previous: {
        bear: previousReport.fairValueSummary.fairValueLow,
        base: previousReport.fairValueSummary.fairValueBase,
        bull: previousReport.fairValueSummary.fairValueHigh,
        probabilityWeighted: previousReport.fairValueSummary.probabilityWeightedFairValue,
        asOf: previousReport.analysisDate
      },
      change: {
        bearPct: pctChange(bear, previousReport.fairValueSummary.fairValueLow),
        basePct: pctChange(base, previousBase),
        bullPct: pctChange(bull, previousReport.fairValueSummary.fairValueHigh),
        summary: "تغيرت القيمة بناء على الافتراضات المحدثة."
      }
    }),
    thesis: { status: options.thesisStatus || (base < previousBase ? "WEAKENED" : base > previousBase ? "STRENGTHENED" : "UNCHANGED"), previousSummary: previousReport.thesis.shortSummary, updatedSummary: "تم تحديث الفرضية بعد الأرباح.", changeReason: "نتائج الربع أثرت على الافتراضات.", keySupports: ["ARR"], keyThreats: ["Competition"] },
    decision: { scope: "STOCK_LEVEL", action: base >= price ? "HOLD" : "WATCH", confidence: 76, investmentScore: 74, rationale: ["قرار صناعي للاختبار."], whyNot: ["مخاطر"], biggestAssumption: "ARR growth", mainRisk: "Competition", upgradeTriggers: ["ARR acceleration"], downgradeTriggers: ["Margin pressure"] },
    nextRequirements: { requirementSetId: null, mode: options.mode || "ADVANCE_TARGET", previousQuarter: "Q2 2026", targetQuarter: "Q3 2026", currentJustifiedValue: base, targetValue: options.targetValue ?? bull, targetScenario: options.targetScenario || "BULL", targetDescription: "متطلبات جديدة.", summary: "مجموعة جديدة للربع القادم.", requirements: [nextRequirement(0, 25, "q3"), nextRequirement(1, 25, "q3"), nextRequirement(2, 25, "q3"), nextRequirement(3, 25, "q3")] },
    risks: [{ title: "Competition", severity: "medium", explanation: "ضغط الأسعار.", whatToMonitor: "Retention", thesisBreaker: "Retention below 100%", sourceIds: ["S2"] }],
    catalysts: [{ title: "ARR acceleration", explanation: "تسارع ARR.", timeframe: "next quarter", sourceIds: ["S2"] }],
    monitoringChecklist: [{ metric: "ARR growth", currentValue: "28%", expectedRange: "25-30%", upgradeTrigger: ">30%", downgradeTrigger: "<20%", thesisBreak: "<15%" }],
    sources: [source("S1", "Market Data", "2026-07-25", ["marketPrice"]), source("S2", "Earnings Call", "2026-07-25", ["latestQuarter", "previousRequirementsEvaluation", "valuation"])],
    limitations: [],
    audit: { scenarioProbabilityTotalPct: 100, valuationMethodWeightTotalPct: 100, previousRequirementWeightTotalPct: weightTotal(previousRequirements), nextRequirementWeightTotalPct: 100, consistencyNotes: [] }
  };
}

function valuation({ bear, base, bull, price, reviewStatus, previous, change }) {
  const probabilityWeighted = (bear * 0.2) + (base * 0.6) + (bull * 0.2);
  return {
    reviewStatus,
    previous,
    current: { bear, base, bull, probabilityWeighted, currency: "USD", securityUnit: "share", confidence: "HIGH" },
    change,
    methodology: { primaryMethod: "DCF", secondaryMethods: ["P/E"], excludedMethods: [{ method: "Price to Book", reason: "Not economically relevant." }], methodologyChanged: false, selectionReason: "FCF is observable.", modelWeights: [{ method: "DCF", weight: 70 }, { method: "P/E", weight: 30 }], weightReasoning: "DCF primary.", limitations: [] },
    valuationResults: [
      { method: "DCF", role: "PRIMARY", fairValue: base, weight: 70, confidence: "HIGH", inputs: {}, assumptions: {}, rationale: "Base method.", limitations: null },
      { method: "P/E", role: "SECONDARY", fairValue: base, weight: 30, confidence: "MEDIUM", inputs: {}, assumptions: {}, rationale: "Secondary cross-check.", limitations: null }
    ],
    scenarios: {
      Bear: { probability: 20, fairValue: bear, assumptions: ["Bear"], requiredOutcomes: [], keyRisks: [] },
      Base: { probability: 60, fairValue: base, assumptions: ["Base"], requiredOutcomes: [], keyRisks: [] },
      Bull: { probability: 20, fairValue: bull, assumptions: ["Bull"], requiredOutcomes: [], keyRisks: [] }
    },
    valuationBridge: { positiveDrivers: ["ARR"], negativeDrivers: ["Competition"], whyBaseChangedOrNot: reviewStatus === "UNCHANGED" ? "تمت مراجعة الأدلة الجديدة وبقيت القيمة الأساسية مبررة." : "تغيرت القيمة الأساسية بسبب تحديث افتراضات النمو والهامش." },
    upsideToBasePct: (base / price - 1) * 100,
    marginOfSafetyPct: ((base - price) / base) * 100
  };
}

function latestQuarter() {
  return {
    summary: "ربع صناعي للاختبار.",
    coreMetrics: {
      revenue: { actualValue: 120, unit: "USDm", consensusValue: 118, priorYearValue: 100, yoyPct: 20, qoqPct: 5, result: "BEAT", sourceId: "S2" },
      eps: { actualValue: 1.2, unit: "USD", consensusValue: 1.1, priorYearValue: 1, yoyPct: 20, result: "BEAT", sourceId: "S2" },
      grossMarginPct: { actualValue: 51, consensusValue: 50, priorYearValue: 49, result: "BEAT", sourceId: "S2" },
      operatingMarginPct: { actualValue: 18, consensusValue: 17, priorYearValue: 16, result: "BEAT", sourceId: "S2" },
      freeCashFlow: { actualValue: 22, unit: "USDm", priorYearValue: 18, yoyPct: 22, sourceId: "S2" },
      cash: { actualValue: 200, unit: "USDm", sourceId: "S2" },
      debt: { actualValue: 50, unit: "USDm", sourceId: "S2" }
    },
    companySpecificKpis: [{ id: "arr", name: "ARR Growth", arabicName: "نمو ARR", actualValue: 28, actualDisplay: "28%", priorValue: 25, yoyPct: 28, qoqPct: 5, result: "BEAT", importance: "high", interpretation: "نمو قوي.", sourceId: "S2" }],
    guidance: [{ period: "Q3 2026", topic: "Revenue", previousGuidance: "$120M", currentGuidance: "$125M", direction: "raised", interpretation: "توجيه أعلى.", sourceId: "S2" }],
    forwardOutlook: { growthOutlook: "accelerating", marginOutlook: "improving", fcfOutlook: "improving", demandOutlook: "improving", capacityOutlook: "adequate", executionOutlook: "stable", guidanceTrend: "raised", managementTone: "positive", summary: "النظرة إيجابية." }
  };
}

function forecast() {
  return {
    materiality: "MATERIAL",
    yearlyForecast: [{ period: "FY2026", revenue: { value: 500, basis: "analyst_assumption" }, revenueGrowthPct: { value: 20, basis: "analyst_assumption" }, eps: { value: 5, basis: "analyst_assumption" }, ebitda: { value: 120, basis: "analyst_assumption" }, ebitdaMarginPct: { value: 24, basis: "analyst_assumption" }, freeCashFlow: { value: 80, basis: "analyst_assumption" }, fcfMarginPct: { value: 16, basis: "analyst_assumption" } }],
    estimateRevisions: [{ metric: "revenue", period: "FY2026", previousEstimate: 480, updatedEstimate: 500, unit: "USDm", changePct: 4.17, reason: "Guidance raised." }],
    changedAssumptions: [{ metric: "Revenue growth", period: "FY2026", previousValue: 18, updatedValue: 20, unit: "%", direction: "UP", reason: "Demand improved.", sourceId: "S2" }],
    wacc: { value: 9, rangeLow: 8.5, rangeHigh: 9.5, reason: "Stable risk." },
    terminalGrowth: { value: 3, reason: "Mature growth." },
    sensitivity: [],
    summary: "توقعات صناعية."
  };
}

function nextRequirement(index, weight, suffix = "q2") {
  const names = ["ARR Growth", "Gross Margin", "Revenue", "FCF", "Guidance", "Retention"];
  const values = [30, 50, 120, 20, "raised", 110];
  return {
    id: `${suffix}_${index + 1}`,
    name: names[index] || `Metric ${index + 1}`,
    arabicName: names[index] || `مؤشر ${index + 1}`,
    metric: names[index] || `Metric ${index + 1}`,
    type: index === 4 ? "qualitative" : "minimum",
    baselineValue: values[index] === "raised" ? "maintained" : Number(values[index]) - 5,
    baselineDisplay: values[index] === "raised" ? "maintained" : `${Number(values[index]) - 5}`,
    requiredValue: values[index],
    requiredDisplay: `${values[index]}`,
    unit: values[index] === "raised" ? "text" : "%",
    importance: "high",
    weight,
    whyItMatters: "مؤثر في التقييم.",
    status: "NOT_REPORTED"
  };
}

function source(id, type, date, usedFor) {
  return { id, title: `${type} Source`, type, date, url: `https://example.com/${id}`, usedFor };
}

function legacyFairValue(schemaVersion) {
  return {
    schemaVersion,
    methodologyVersion: "fair-value-system/v1",
    analysisDate: "2026-04-25",
    company: { ticker: "OLD", name: "Old Co", sector: "Tech", industry: "Software", currency: "USD", currentPrice: 10 },
    executiveDecision: { recommendation: "HOLD", fairValueLow: 8, fairValue: 10, fairValueHigh: 12, currentPrice: 10, why: ["Legacy."] },
    fairValueSummary: { fairValueLow: 8, fairValueBase: 10, fairValueHigh: 12, currentPrice: 10 },
    thesis: { shortSummary: "Legacy thesis." },
    risks: ["Legacy risk"],
    decision: { action: "HOLD" }
  };
}

function mutated(value, mutator) {
  const next = structuredClone(value);
  mutator(next);
  return next;
}

function weightTotal(items = []) {
  return Number(items.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(6));
}

function pctChange(next, previous) {
  return ((next / previous) - 1) * 100;
}
