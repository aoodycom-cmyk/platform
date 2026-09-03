import assert from "node:assert/strict";
import test from "node:test";
import {
  applyQuarterlyEarningsLifecycle,
  evaluateRequirementDeterministically,
  normalizeQuarterlyEarningsHistory,
  quarterlyHistoryForTicker
} from "../src/externalAnalysis/quarterlyHistory.js";
import {
  createRequirementSetFromReport,
  prepareHistoricalRequirementEvaluation
} from "../src/externalAnalysis/historicalRequirements.js";
import { saveOrCorrectQuarterlyAnalysis } from "../src/externalAnalysis/storage.js";

const fixedNow = new Date("2027-01-30T12:00:00.000Z");

test("quarter history is chronological, order independent, and idempotent", () => {
  const q1 = report({ quarter: 1, year: 2026, periodEndDate: "2026-03-31", analysisDate: "2026-04-20", revenue: 10 });
  const q2 = report({ quarter: 2, year: 2026, periodEndDate: "2026-06-30", analysisDate: "2026-07-20", revenue: 20 });
  const q3 = report({ quarter: 3, year: 2026, periodEndDate: "2026-09-30", analysisDate: "2026-10-20", revenue: 30 });

  const forward = normalizeQuarterlyEarningsHistory({}, { TEST: [q1, q2, q3] }, { now: fixedNow }).history;
  const reverse = normalizeQuarterlyEarningsHistory({}, { TEST: [q3, q2, q1] }, { now: fixedNow }).history;
  assert.deepEqual(reverse, forward);
  assert.deepEqual(
    quarterlyHistoryForTicker(forward, "TEST").filter((item) => item.status === "REPORTED").map((item) => item.fiscalQuarter),
    ["Q1", "Q2", "Q3"]
  );

  const repeated = normalizeQuarterlyEarningsHistory(forward, { TEST: [q1, q2, q3] }, { now: fixedNow }).history;
  assert.deepEqual(repeated, forward);
});

test("a corrected quarter updates one record, preserves non-null data, and audits conflicts", () => {
  const original = report({
    quarter: 2,
    year: 2026,
    periodEndDate: "2026-06-30",
    analysisDate: "2026-07-20",
    revenue: 20,
    eps: 1.25
  });
  const corrected = report({
    quarter: 2,
    year: 2026,
    periodEndDate: "2026-06-30",
    analysisDate: "2026-07-21",
    revenue: 21.125,
    eps: null,
    idSuffix: "corrected"
  });
  const initial = applyQuarterlyEarningsLifecycle({}, original, { now: fixedNow }).history;
  const result = applyQuarterlyEarningsLifecycle(initial, corrected, { now: fixedNow }).history;
  const reported = quarterlyHistoryForTicker(result, "TEST").filter((item) => item.status === "REPORTED");
  assert.equal(reported.length, 1);
  assert.equal(reported[0].latestQuarter.coreMetrics.revenue.actualValue, 21.125);
  assert.equal(reported[0].latestQuarter.coreMetrics.eps.actualValue, 1.25);
  assert.ok(reported[0].conflicts.some((item) => item.path === "latestQuarter.coreMetrics.revenue.actualValue"));
});

test("Q4 requirements become a Q1 placeholder and then a reported quarter without fabricated actuals", () => {
  const q4 = report({
    quarter: 4,
    year: 2026,
    periodEndDate: "2026-12-31",
    analysisDate: "2027-01-20",
    revenue: 40,
    nextQuarter: 1,
    nextYear: 2027,
    requirementSetId: "REQ-Q1-2027"
  });
  const first = applyQuarterlyEarningsLifecycle({}, q4, { now: fixedNow }).history;
  const upcoming = quarterlyHistoryForTicker(first, "TEST").find((item) => item.status === "UPCOMING");
  assert.equal(upcoming.quarterKey, "TEST:2027:Q1");
  assert.equal(upcoming.latestQuarter, null);
  assert.equal(upcoming.requirements[0].status, "NOT_REPORTED");
  assert.equal(upcoming.requirements[0].actualValue, null);

  const q1 = report({
    quarter: 1,
    year: 2027,
    periodEndDate: "2027-03-31",
    analysisDate: "2027-04-20",
    revenue: 52,
    previousRequirementSetId: "REQ-Q1-2027",
    evaluationActual: 52,
    nextQuarter: 2,
    nextYear: 2027,
    requirementSetId: "REQ-Q2-2027"
  });
  const second = applyQuarterlyEarningsLifecycle(first, q1, { now: fixedNow }).history;
  const timeline = quarterlyHistoryForTicker(second, "TEST");
  const reportedQ1 = timeline.find((item) => item.quarterKey === "TEST:2027:Q1");
  assert.equal(reportedQ1.status, "REPORTED");
  assert.equal(reportedQ1.periodEndDate, "2027-03-31");
  assert.equal(reportedQ1.requirementSetId, "REQ-Q1-2027");
  assert.equal(reportedQ1.requirements[0].requiredValue, 50);
  assert.equal(reportedQ1.requirements[0].actualValue, null);
  assert.equal(reportedQ1.previousRequirementsEvaluation.requirements[0].actualValue, 52);
  assert.ok(timeline.some((item) => item.quarterKey === "TEST:2027:Q2" && item.status === "UPCOMING"));
  assert.equal(timeline.filter((item) => item.quarterKey === "TEST:2027:Q1").length, 1);
});

test("an INITIAL report never evaluates its own upcoming requirement set", () => {
  const initial = report({
    quarter: 2,
    year: 2026,
    periodEndDate: "2026-06-30",
    analysisDate: "2026-07-20",
    revenue: 20,
    nextQuarter: 3,
    nextYear: 2026,
    requirementSetId: "REQ-Q3-2026"
  });
  initial.priceTargetRequirements = initial.nextRequirements;
  const openSet = createRequirementSetFromReport(initial, fixedNow);
  const prepared = prepareHistoricalRequirementEvaluation(initial, { TEST: [openSet] });
  assert.equal(prepared.match.reason, "canonical_initial_has_no_previous_evaluation");
  assert.equal(prepared.report.previousRequirementsEvaluation, null);
});

test("quarterly analysis storage reuses exact imports and updates corrected periods", () => {
  const original = report({ quarter: 3, year: 2026, periodEndDate: "2026-09-30", analysisDate: "2026-10-20", revenue: 30 });
  const saved = saveOrCorrectQuarterlyAnalysis({}, original, { now: fixedNow });
  const duplicate = saveOrCorrectQuarterlyAnalysis(saved.collection, original, { now: fixedNow });
  assert.equal(duplicate.duplicate.id, saved.report.id);
  assert.equal(duplicate.collection.TEST.length, 1);

  const corrected = report({
    quarter: 3,
    year: 2026,
    periodEndDate: "2026-09-30",
    analysisDate: "2026-10-21",
    revenue: 31,
    idSuffix: "corrected"
  });
  const updated = saveOrCorrectQuarterlyAnalysis(saved.collection, corrected, { now: new Date("2026-10-21T18:00:00.000Z") });
  assert.equal(updated.corrected, true);
  assert.equal(updated.collection.TEST.length, 1);
  assert.equal(updated.report.id, saved.report.id);
  assert.equal(updated.report.latestQuarter.coreMetrics.revenue.actualValue, 31);
  assert.ok(updated.report.metadata.correctionConflicts.length > 0);
});

test("deterministic checks require matching dimensions and never fail missing or qualitative data", () => {
  const requirement = {
    type: "minimum",
    requiredValue: 50,
    unit: "USDm",
    currency: "USD",
    accountingBasis: "GAAP",
    targetQuarter: "Q1 2027"
  };
  assert.deepEqual(
    evaluateRequirementDeterministically(requirement, { actualValue: 52, unit: "USDm", currency: "USD", accountingBasis: "GAAP", period: "Q1 2027" }),
    { evaluated: true, status: "PASSED", reason: "DETERMINISTIC_MINIMUM" }
  );
  const wrongCurrency = evaluateRequirementDeterministically(requirement, { actualValue: 52, unit: "USDm", currency: "EUR", accountingBasis: "GAAP", period: "Q1 2027" });
  assert.equal(wrongCurrency.evaluated, false);
  assert.equal(wrongCurrency.status, "NOT_REPORTED");
  assert.equal(wrongCurrency.dimension, "currency");
  assert.equal(evaluateRequirementDeterministically(requirement, { actualValue: null }).status, "NOT_REPORTED");
  assert.equal(evaluateRequirementDeterministically({ ...requirement, type: "qualitative" }, { actualValue: 1 }).status, "NOT_REPORTED");
});

function report({
  quarter,
  year,
  periodEndDate,
  analysisDate,
  revenue,
  eps = 1,
  idSuffix = "original",
  nextQuarter = null,
  nextYear = null,
  requirementSetId = null,
  previousRequirementSetId = null,
  evaluationActual = null
}) {
  const id = `TEST-${year}-Q${quarter}-${idSuffix}`;
  const nextRequirements = nextQuarter ? {
    requirementSetId,
    mode: "ADVANCE_TARGET",
    previousQuarter: `Q${quarter} ${year}`,
    targetQuarter: `Q${nextQuarter} ${nextYear}`,
    currentJustifiedValue: 100,
    targetValue: 120,
    targetScenario: "BULL",
    targetDescription: "Documented target",
    summary: "Documented requirements",
    requirements: [{
      id: "revenue-target",
      name: "Revenue",
      metric: "revenue",
      type: "minimum",
      requiredValue: 50,
      requiredDisplay: ">= 50",
      unit: "USDm",
      weight: 100,
      status: "NOT_REPORTED"
    }]
  } : null;
  const previousRequirementsEvaluation = previousRequirementSetId ? {
    requirementSetId: previousRequirementSetId,
    targetQuarter: `Q${quarter} ${year}`,
    requirements: [{
      id: "revenue-target",
      name: "Revenue",
      metric: "revenue",
      type: "minimum",
      requiredValue: 50,
      requiredDisplay: ">= 50",
      unit: "USDm",
      weight: 100,
      actualValue: evaluationActual,
      actualDisplay: String(evaluationActual),
      status: "PASSED",
      sourceId: "S1"
    }],
    assessment: { overallStatus: "PASSED" }
  } : null;
  const latestQuarter = {
    summary: `Q${quarter} results`,
    coreMetrics: {
      revenue: { actualValue: revenue, consensusValue: revenue - 1, unit: "USDm", result: "BEAT", sourceId: "S1" },
      eps: { actualValue: eps, consensusValue: 0.9, unit: "USD/share", result: "BEAT", sourceId: "S1" }
    },
    companySpecificKpis: [{ id: "users", actualValue: 100 + quarter, result: "NA", sourceId: "S1" }],
    guidance: [{ period: `Q${nextQuarter || quarter} ${nextYear || year}`, topic: "Revenue", currentLow: 45, currentHigh: 55, sourceId: "S1" }],
    forwardOutlook: { growthOutlook: "improving", summary: "Management outlook" }
  };
  return {
    id,
    schemaVersion: "external-analysis-report/v2",
    analysisOrigin: "external_chatgpt",
    analysisDate,
    reportPeriod: `Q${quarter} ${year}`,
    fiscalIdentity: { fiscalQuarter: `Q${quarter}`, fiscalYear: year, periodEndDate, earningsReleaseDate: analysisDate },
    company: { ticker: "TEST", name: "Test Company", currency: "USD" },
    latestQuarter,
    nextRequirements,
    previousRequirementsEvaluation,
    sources: [{ id: "S1", title: "Quarterly release", url: `https://example.com/${year}/q${quarter}`, date: analysisDate, usedFor: ["latestQuarter"] }],
    rawAnalysisOriginal: JSON.stringify({ id, latestQuarter }),
    metadata: {
      nativeSchemaVersion: "franklin-fair-value/v3",
      rawHash: `hash-${id}`,
      importedAt: `${analysisDate}T12:00:00.000Z`,
      updatedAt: `${analysisDate}T12:00:00.000Z`,
      franklinV3Report: {
        schemaVersion: "franklin-fair-value/v3",
        analysisType: previousRequirementSetId ? "EARNINGS_REVALUATION" : "INITIAL",
        reportIdentity: {
          ticker: "TEST",
          companyName: "Test Company",
          fiscalQuarter: `Q${quarter}`,
          fiscalYear: year,
          periodEndDate,
          earningsReleaseDate: analysisDate,
          analysisDate,
          previousRequirementSetId
        },
        latestQuarter,
        nextRequirements,
        previousRequirementsEvaluation,
        sources: [{ id: "S1", title: "Quarterly release", type: "company_filing", url: `https://example.com/${year}/q${quarter}`, date: analysisDate, usedFor: ["latestQuarter"] }]
      }
    }
  };
}
