import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeFranklinV3Input } from "../src/externalAnalysis/v3InputNormalizer.js";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";
import {
  FINANCIAL_VERIFICATION_STATUSES,
  recalculateValuationMethod,
  verifyFinancialAnalysis
} from "../src/financialSafety/financialVerification.js";
import { classifyDecisionReadiness } from "../src/financialSafety/decisionReadinessUi.js";
import {
  companyAssessmentRow,
  financialVerificationBanner,
  summaryValuationMethodsDashboard
} from "../src/ui/components.js";

const { canonical } = await quietImport("./intcOwnerAcceptance.test.mjs");
const clean = verifiedFixture();

const cleanValidation = validateFranklinV3Report(clean);
assert.equal(cleanValidation.valid, true, JSON.stringify(cleanValidation.errors, null, 2));
assert.equal(cleanValidation.financialVerification.status, FINANCIAL_VERIFICATION_STATUSES.VERIFIED, JSON.stringify(cleanValidation.financialVerification, null, 2));
assert.equal(cleanValidation.financialVerification.sourceOfTruth, "FRANKLIN_RECALCULATION");
assert.equal(cleanValidation.financialVerification.recalculatedWeightedFairValue, 82);
assert.equal(cleanValidation.financialVerification.sourceVerification.externalVerification.status, "NOT_PERFORMED");
assert.equal(cleanValidation.financialVerification.derivedConfidenceScore, 90);
assert.equal(cleanValidation.financialVerification.derivedDataQualityScore, 100);
assert.notEqual(cleanValidation.financialVerification.derivedConfidenceScore, clean.decision.confidence, "AI confidence must not be trusted as Franklin's verified confidence.");

const detachedBase = mutate(clean, (report) => {
  report.valuation.valuationResults[0].fairValue = 1000;
  report.valuation.valuationResults[0].inputs.normalizedForwardEps = 25;
  report.valuation.valuationResults[0].inputs.impliedMultiple = 40;
  report.valuation.calculationAudit = {};
});
const detachedVerification = verifyFinancialAnalysis(detachedBase);
assert.equal(detachedVerification.status, "BLOCKED");
assert.ok(detachedVerification.findings.some((item) => item.code === "BASE_WEIGHTED_VALUE_MISMATCH"));
assert.ok(detachedVerification.findings.some((item) => item.code === "CALCULATION_AUDIT_REQUIRED"));

const detachedOverlay = mutate(clean, (report) => {
  report.valuation.current.base = 90.2;
  report.valuation.calculationAudit.analystOverlayPct = 10;
  report.valuation.calculationAudit.overlayReason = "Unstructured judgment";
  report.valuation.calculationAudit.reconciledBaseFairValue = 90.2;
  report.valuation.calculationAudit.gapToReportedBasePct = 0;
});
assertFinding(detachedOverlay, "ANALYST_OVERLAY_NOT_ALLOWED", "BLOCKED");

const negativePe = mutate(clean, (report) => {
  Object.assign(report.valuation.valuationResults[0], {
    fairValue: 100,
    inputs: { normalizedForwardEps: -2, impliedMultiple: -50 },
    inputProvenance: report.valuation.valuationResults[0].inputProvenance
  });
});
assertFinding(negativePe, "INVALID_PE_ECONOMICS", "BLOCKED");

const negativeDcf = mutate(clean, (report) => configureSingleDcf(report, {
  fairValue: 40,
  forecastFreeCashFlows: [10],
  discountPeriods: [1],
  discountRatePct: -50,
  terminalValueMethod: "NONE",
  terminalValue: 0,
  terminalDiscountPeriod: 1,
  cash: 0,
  debt: 0,
  dilutedShares: 0.5,
  valuationDate: "2026-07-25",
  cashFlowType: "FCFF",
  discountRateType: "WACC"
}));
assertFinding(negativeDcf, "INVALID_DCF_RATE_OR_TIMING", "BLOCKED");

const inconsistentMargins = mutate(clean, (report) => {
  const row = report.forecast.yearlyForecast[0];
  row.revenue.value = 100;
  row.ebitda.value = 200;
  row.ebitdaMarginPct.value = 5;
  row.freeCashFlow.value = 300;
  row.fcfMarginPct.value = 1;
});
assertFinding(inconsistentMargins, "FORECAST_MARGIN_MISMATCH", "BLOCKED");

const missingNormalization = mutate(clean, (report) => {
  report.financialNormalization = {};
});
assertFinding(missingNormalization, "FINANCIAL_NORMALIZATION_MISSING", "INSUFFICIENT_DATA");

const incompleteForecastProvenance = mutate(clean, (report) => {
  report.forecast.yearlyForecast[0].revenue.asOf = null;
});
assertFinding(incompleteForecastProvenance, "FORECAST_PROVENANCE_INCOMPLETE", "NEEDS_REVIEW");

const missingValuationSource = mutate(clean, (report) => {
  report.valuation.valuationResults[0].inputProvenance.normalizedForwardEps.sourceId = "MISSING_SOURCE";
});
assertFinding(missingValuationSource, "VALUATION_INPUT_SOURCE_NOT_FOUND", "INSUFFICIENT_DATA");

const bankEnterpriseValuation = mutate(clean, (report) => {
  report.company.sector = "Banking";
  report.company.industry = "Commercial Banks";
  report.valuation.methodology.primaryMethod = "EV/EBITDA";
  report.valuation.methodology.selectionReason = "EV/EBITDA was selected as the primary method.";
  report.valuation.methodology.modelWeights = [{ method: "EV/EBITDA", weight: 100 }];
  report.valuation.valuationResults = [{
    method: "EV/EBITDA",
    role: "PRIMARY",
    fairValue: 82,
    weight: 100,
    inputs: { normalizedEbitda: 82, evEbitdaMultiple: 1, netDebt: 0, dilutedShares: 1, nonOperatingAdjustments: 0 },
    inputProvenance: Object.fromEntries(["normalizedEbitda", "evEbitdaMultiple", "netDebt", "dilutedShares", "nonOperatingAdjustments"].map((key) => [key, { type: "ANALYST_ASSUMPTION", asOf: "2026-07-25", unit: key.includes("Multiple") ? "x" : "USD", period: "FY2027E" }])),
    assumptions: { simplifiedTest: true },
    rationale: "Uses an enterprise multiple.",
    limitations: "Simplified test."
  }];
});
assertFinding(bankEnterpriseValuation, "SECTOR_METHOD_EXCEPTION_UNEXPLAINED", "NEEDS_REVIEW");

const reitPeWithoutFfo = mutate(clean, (report) => {
  report.company.sector = "Real Estate";
  report.company.industry = "Real Estate Investment Trust";
});
assertFinding(reitPeWithoutFfo, "REIT_PE_NORMALIZATION_UNEXPLAINED", "NEEDS_REVIEW");

const contradictoryDecision = mutate(clean, (report) => {
  report.decision.action = "BUY";
  report.decision.rationale = ["The market price is below Base fair value, so this is a BUY."];
});
const contradictoryVerification = verifyFinancialAnalysis(contradictoryDecision);
assert.equal(contradictoryVerification.status, "BLOCKED");
assert.ok(contradictoryVerification.findings.some((item) => item.code === "BUY_WITHOUT_UPSIDE"));
assert.ok(contradictoryVerification.findings.some((item) => item.code === "DECISION_TEXT_NUMERIC_CONTRADICTION"));

const evWithInputAdjustment = recalculateValuationMethod({
  method: "EV/EBITDA",
  inputs: { normalizedEbitda: 10, evEbitdaMultiple: 10, netDebt: 0, dilutedShares: 1, nonOperatingAdjustments: 10 }
});
assert.equal(evWithInputAdjustment.state, "CALCULATED");
assert.equal(evWithInputAdjustment.value, 110);
const normalizedLegacyAdjustment = normalizeFranklinV3Input(mutate(clean, (report) => {
  Object.assign(report.valuation.valuationResults[0], {
    method: "EV/EBITDA",
    inputs: { normalizedEbitda: 10, evEbitdaMultiple: 10, netDebt: 0, dilutedShares: 1 },
    calculation: { nonOperatingAdjustments: 10 }
  });
}));
assert.equal(normalizedLegacyAdjustment.valuation.valuationResults[0].inputs.nonOperatingAdjustments, 10, "Legacy calculation location must migrate to canonical inputs without changing the value.");
const conflictingAdjustment = recalculateValuationMethod({
  method: "EV/EBITDA",
  inputs: { normalizedEbitda: 10, evEbitdaMultiple: 10, netDebt: 0, dilutedShares: 1, nonOperatingAdjustments: 10 },
  calculation: { nonOperatingAdjustments: 5 }
});
assert.equal(conflictingAdjustment.code, "NON_OPERATING_ADJUSTMENT_CONFLICT");

const dcf = recalculateValuationMethod({
  method: "DCF",
  inputs: {
    valuationDate: "2026-07-25",
    cashFlowType: "FCFF",
    discountRateType: "WACC",
    forecastFreeCashFlows: [100],
    discountPeriods: [1],
    discountRatePct: 10,
    terminalValueMethod: "PERPETUITY_GROWTH",
    terminalCashFlow: 100,
    terminalGrowthPct: 2,
    terminalValue: 1275,
    terminalDiscountPeriod: 1,
    cash: 0,
    debt: 0,
    dilutedShares: 10
  }
});
assert.equal(dcf.state, "CALCULATED");
assert.equal(dcf.value, 125);
assert.ok(dcf.terminalConcentrationPct > 90, "High terminal concentration is warning-worthy but not itself a calculation error.");
const unexplainedTerminal = recalculateValuationMethod({
  method: "DCF",
  inputs: { forecastFreeCashFlows: [100], discountPeriods: [1], discountRatePct: 10, terminalValue: 1275, terminalDiscountPeriod: 1, cash: 0, debt: 0, dilutedShares: 10 }
});
assert.equal(unexplainedTerminal.state, "INSUFFICIENT_DATA");

const zeroPeriodDcf = recalculateValuationMethod({
  method: "DCF",
  inputs: { forecastFreeCashFlows: [10], discountPeriods: [0], discountRatePct: 10, terminalValueMethod: "NONE", terminalValue: 0, terminalDiscountPeriod: 0, cash: 0, debt: 0, dilutedShares: 1 }
});
assert.equal(zeroPeriodDcf.value, 10, "A documented time-zero bridge is valid and must not be rejected as an incomplete period.");

const parsed = await parseExternalAnalysisInput(JSON.stringify(clean), {
  now: new Date("2026-07-25T10:00:00.000Z"),
  strictJson: true,
  expectedTicker: "INTC",
  expectedReportPeriod: "Q2 2026"
});
assert.equal(parsed.report.rawAnalysisOriginal, JSON.stringify(clean));
assert.equal(parsed.report.metadata.financialVerification.status, "VERIFIED");
assert.equal(parsed.report.decision.confidence, 90, "Displayed confidence must be Franklin-derived.");
assert.equal(parsed.report.dataQuality.score, 100, "Displayed data quality must be derived from complete material-input provenance.");
assert.equal(parsed.report.dataQuality.modelReportedScore, clean.dataQuality.score);
assert.equal(parsed.report.valuationResults[0].rationale, clean.valuation.valuationResults[0].rationale);
const saved = saveExternalAnalysis({}, parsed.report, { now: new Date("2026-07-25T10:01:00.000Z") });
assert.equal(saved.report.metadata.financialVerification.status, "VERIFIED");
assert.equal(classifyDecisionReadiness(saved.report).status, "verified");

const originalDocument = globalThis.document;
try {
  globalThis.document = { documentElement: { dir: "ltr", lang: "en" } };
  const methodsHtml = summaryValuationMethodsDashboard(saved.report);
  assert.match(methodsHtml, /P\/E/);
  assert.match(methodsHtml, /Captures normalized forward earnings/);
  assert.match(methodsHtml, /100%/);
  assert.match(methodsHtml, /Weight rationale/);
  assert.match(methodsHtml, /Excluded methods/);
  const banner = financialVerificationBanner(saved.report);
  assert.match(banner, /Verified/);
  assert.match(banner, /Franklin recalculation/);
  assert.doesNotMatch(banner, /Full analysis/);
  for (const score of [0, 55, 72, 82, 100]) {
    const scoreHtml = companyAssessmentRow({ en: "Score", ar: "Score", value: score, tone: "positive" });
    assert.match(scoreHtml.replace(/<[^>]+>/g, ""), new RegExp(`${score.toFixed(1)}/100`));
    assert.match(scoreHtml, new RegExp(`width:${score}%`));
    assert.doesNotMatch(scoreHtml, /\/10(?:\D|$)/);
  }
} finally {
  globalThis.document = originalDocument;
}

const componentsSource = await readFile(new URL("../src/ui/components.js", import.meta.url), "utf8");
assert.match(componentsSource, /value\.rationale \|\| value\.explanation/);
assert.doesNotMatch(componentsSource, /score \* 10/);

console.log("Launch-audit financial verification regressions passed.");

function verifiedFixture() {
  return mutate(canonical, (report) => {
    for (const row of report.forecast.yearlyForecast) {
      for (const [metric, record] of Object.entries(row)) {
        if (metric === "period" || !Number.isFinite(record?.value)) continue;
        record.asOf = "2026-07-25";
        record.unit = metric.toLowerCase().includes("pct") ? "%" : (metric === "eps" ? "USD/share" : "USD");
      }
    }
    report.financialNormalization = {
      reportingPeriod: "FY2027E",
      reportingCurrency: "USD",
      earningsBasisUsedForValuation: "normalized",
      normalizedDilutedEps: { value: 2, unit: "USD/share", accountingBasis: "normalized", period: "FY2027E", sourceId: "S1" },
      sourceIds: ["S1"]
    };
    report.valuation.current.base = 82;
    report.valuation.scenarios.Base.fairValue = 82;
    report.valuation.current.probabilityWeighted = weightedScenarioValue(report.valuation.scenarios);
    report.valuation.methodology = {
      primaryMethod: "Forward P/E",
      secondaryMethods: [],
      excludedMethods: [
        { method: "DCF", reason: "Current free cash flow is not a stable basis." },
        { method: "EV/EBITDA", reason: "Capital structure makes the earnings method clearer for this test." }
      ],
      methodologyChanged: false,
      selectionReason: "Forward P/E matches the company's positive normalized forward earnings.",
      modelWeights: [{ method: "Forward P/E", weight: 100 }],
      weightReasoning: "A single fully reproducible method receives 100% weight.",
      limitations: ["The result remains sensitive to normalized EPS."]
    };
    report.valuation.valuationResults = [{
      method: "Forward P/E",
      role: "PRIMARY",
      fairValue: 82,
      weight: 100,
      confidence: "MEDIUM",
      inputs: { normalizedForwardEps: 2, impliedMultiple: 41 },
      inputProvenance: {
        normalizedForwardEps: { sourceId: "S1", asOf: "2026-07-25", unit: "USD/share", period: "FY2027E" },
        impliedMultiple: { type: "ANALYST_ASSUMPTION", asOf: "2026-07-25", unit: "x", period: "FY2027E" }
      },
      assumptions: { horizon: "FY2027E", multipleBasis: "normalized earnings" },
      calculation: { formula: "fairValue = normalizedForwardEps * impliedMultiple", steps: ["2 * 41 = 82"], computedFairValue: 82 },
      rationale: "Captures normalized forward earnings with a transparent multiple.",
      limitations: "Sensitive to EPS normalization and the selected multiple."
    }];
    report.valuation.calculationAudit = {
      weightedMethodFairValue: 82,
      analystOverlayPct: 0,
      overlayReason: null,
      reconciledBaseFairValue: 82,
      gapToReportedBasePct: 0
    };
    report.valuation.upsideToBasePct = (82 / report.marketPrice.value - 1) * 100;
    report.valuation.marginOfSafetyPct = ((82 - report.marketPrice.value) / 82) * 100;
    report.nextRequirements.currentJustifiedValue = 82;
    if (report.nextRequirements.mode === "DEFEND_BASE") report.nextRequirements.targetValue = 82;
    report.decision.action = "WATCH";
    report.decision.confidence = 100;
    report.decision.rationale = ["Market price is above Base fair value, so the conservative action is WATCH."];
  });
}

function configureSingleDcf(report, inputs) {
  report.valuation.methodology.primaryMethod = "DCF";
  report.valuation.methodology.secondaryMethods = [];
  report.valuation.methodology.modelWeights = [{ method: "DCF", weight: 100 }];
  report.valuation.valuationResults = [{
    method: "DCF",
    role: "PRIMARY",
    fairValue: inputs.fairValue,
    weight: 100,
    confidence: "LOW",
    inputs,
    inputProvenance: {},
    assumptions: { test: true },
    rationale: "DCF test",
    limitations: "Test"
  }];
}

function weightedScenarioValue(scenarios) {
  return ["Bear", "Base", "Bull"].reduce((sum, key) => sum + scenarios[key].fairValue * scenarios[key].probability / 100, 0);
}

function assertFinding(report, code, status) {
  const verification = verifyFinancialAnalysis(report);
  assert.equal(verification.status, status, JSON.stringify(verification, null, 2));
  assert.ok(verification.findings.some((item) => item.code === code), `${code}\n${JSON.stringify(verification.findings, null, 2)}`);
}

function mutate(value, callback) {
  const clone = structuredClone(value);
  callback(clone);
  return clone;
}

async function quietImport(path) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await import(path);
  } finally {
    console.log = originalLog;
  }
}
