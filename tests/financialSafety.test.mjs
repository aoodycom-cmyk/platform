import assert from "node:assert/strict";
import {
  applyHistoricalRequirementLifecycle
} from "../src/externalAnalysis/historicalRequirements.js";
import {
  inflateQuarterlyEarningsLitePayload,
  QUARTERLY_EARNINGS_LITE_SCHEMA,
  validateQuarterlyAssessmentIntegrity
} from "../src/externalAnalysis/quarterlyEarningsLite.js";
import {
  auditFinancialReport,
  installFinancialSafetyLayer,
  repairHistoricalRequirementSets
} from "../src/financialSafety/financialSafety.js";

const definitions = [
  { id: "rev", name: "Revenue", metric: "Revenue", weight: 50, status: "NOT_REPORTED", requiredValue: 100 },
  { id: "eps", name: "EPS", metric: "EPS", weight: 50, status: "NOT_REPORTED", requiredValue: 2 }
];

const baseReport = {
  id: "SAFE-full-analysis",
  analysisDate: "2026-08-19",
  reportPeriod: "Q1 2026",
  company: { ticker: "SAFE", name: "Safety Test" },
  fairValueSummary: {
    currentPrice: 100,
    fairValueLow: 80,
    fairValueBase: 125,
    fairValueHigh: 160,
    probabilityWeightedFairValue: 123,
    upsideDownsidePercent: 25,
    marginOfSafetyPercent: 20
  },
  scenarios: {
    Bear: { fairValue: 80, probability: 20 },
    Base: { fairValue: 125, probability: 60 },
    Bull: { fairValue: 160, probability: 20 }
  },
  valuationMethodology: {
    modelWeights: [
      { method: "DCF", weight: 60 },
      { method: "P/E", weight: 40 }
    ]
  },
  thesis: { shortSummary: "Test thesis" },
  risks: [{ title: "Test risk" }],
  decision: { action: "WATCH" },
  priceTargetRequirements: {
    requirementSetId: "SAFE_Q22026",
    status: "OPEN",
    createdAt: "2026-08-19T00:00:00.000Z",
    createdFromAnalysisId: "SAFE-full-analysis",
    targetQuarter: "Q2 2026",
    earningsPeriod: "Q2 2026",
    targetValue: 160,
    requirements: definitions
  },
  metadata: {
    importedAt: "2026-08-19T00:00:00.000Z",
    importMethod: "structured_json"
  }
};

const validAssessment = {
  weightedAchievement: 50,
  reportedRequirements: 1,
  totalRequirements: 2,
  passed: 1,
  failed: 0,
  exceeded: 0,
  partiallyPassed: 0,
  notReported: 1,
  overallStatus: "base_case_supported",
  summary: "Revenue met the requirement; EPS was not reported."
};

const validPayload = {
  schemaVersion: QUARTERLY_EARNINGS_LITE_SCHEMA,
  ticker: "SAFE",
  quarter: "Q2",
  year: 2026,
  reportDate: "2026-08-20",
  requirementSetId: "SAFE_Q22026",
  summary: "Quarterly update.",
  metrics: {},
  companyKpis: [],
  guidance: [],
  forwardOutlook: {
    growthOutlook: "stable",
    marginOutlook: "unclear",
    guidanceTrend: "not_reported",
    managementTone: "neutral",
    thesisImpact: "neutral",
    summary: "No change to the long-term thesis."
  },
  requirements: [
    { id: "rev", actualValue: 110, actualDisplay: "110", status: "PASSED", evaluationNote: "Met." },
    { id: "eps", actualValue: null, actualDisplay: null, status: "NOT_REPORTED", evaluationNote: "Not reported." }
  ],
  requirementsAssessment: validAssessment,
  highlights: [],
  concerns: []
};

const inflated = inflateQuarterlyEarningsLitePayload(
  baseReport,
  validPayload,
  JSON.stringify(validPayload),
  new Date("2026-08-20T12:00:00.000Z")
);
assert.equal(inflated.metadata.analysisScope, "quarterly_earnings_update");
assert.equal(inflated.metadata.baseAnalysisId, "SAFE-full-analysis");
assert.equal(inflated.metadata.baseAnalysisDate, "2026-08-19");
assert.equal(inflated.metadata.earningsReportDate, "2026-08-20");
assert.equal(inflated.metadata.valuationAsOfDate, "2026-08-19");
assert.equal(inflated.metadata.decisionAsOfDate, "2026-08-19");
assert.deepEqual(inflated.fairValueSummary, baseReport.fairValueSummary);
assert.deepEqual(inflated.decision, baseReport.decision);
assert.equal(auditFinancialReport(inflated).valid, true);

assert.throws(() => inflateQuarterlyEarningsLitePayload(
  baseReport,
  { ...validPayload, requirementsAssessment: null },
  "missing assessment"
), /requirementsAssessment is required/);

assert.throws(() => validateQuarterlyAssessmentIntegrity({
  reportPeriod: "Q1 2026",
  targetPeriod: "Q2 2026",
  requirements: [
    { ...definitions[0], status: "PASSED" },
    definitions[1]
  ],
  requirementsAssessment: null
}), /must remain NOT_REPORTED/);

assert.throws(() => inflateQuarterlyEarningsLitePayload(
  baseReport,
  {
    ...validPayload,
    requirementsAssessment: { ...validAssessment, reportedRequirements: 2 }
  },
  "inconsistent counts"
), /does not match requirement statuses/);

const openSet = {
  requirementSetId: "SAFE_Q22026",
  ticker: "SAFE",
  status: "OPEN",
  createdAt: "2026-08-19T00:00:00.000Z",
  createdFromAnalysisId: "SAFE-full-analysis",
  earningsPeriod: "Q2 2026",
  targetQuarter: "Q2 2026",
  requirements: definitions,
  requirementsAssessment: null
};
const q2Report = {
  ...inflated,
  id: "SAFE-q2-results",
  reportPeriod: "Q2 2026",
  previousRequirementsEvaluation: {
    ...inflated.previousRequirementsEvaluation,
    requirementSetId: "SAFE_Q22026",
    ticker: "SAFE",
    earningsPeriod: "Q2 2026",
    targetQuarter: "Q2 2026"
  }
};
let lifecycle = applyHistoricalRequirementLifecycle(
  { SAFE: [openSet] },
  q2Report,
  { status: "matched", matchType: "exact_earnings_period", set: openSet },
  new Date("2026-08-20T12:00:00.000Z")
);
assert.equal(lifecycle.SAFE[0].status, "OPEN");
assert.equal(lifecycle.SAFE[0].evaluatedByAnalysisId, null);

const staleQ1 = {
  ...q2Report,
  id: "SAFE-old-q1-imported-later",
  reportPeriod: "Q1 2026",
  previousRequirementsEvaluation: {
    ...q2Report.previousRequirementsEvaluation,
    earningsPeriod: "Q2 2026",
    requirements: definitions.map((item) => ({ ...item, status: "NOT_REPORTED" })),
    requirementsAssessment: null
  }
};
lifecycle = applyHistoricalRequirementLifecycle(
  lifecycle,
  staleQ1,
  { status: "matched", matchType: "explicit_requirement_set_id", set: openSet },
  new Date("2026-08-21T12:00:00.000Z")
);
assert.equal(lifecycle.SAFE[0].evaluatedByAnalysisId, null, "Lite observations must not become canonical evaluations.");
assert.equal(lifecycle.SAFE[0].requirements[0].status, "NOT_REPORTED");

const corrupted = {
  SAFE: [{
    ...lifecycle.SAFE[0],
    evaluatedByAnalysisId: "SAFE-old-q1-imported-later",
    requirements: definitions.map((item) => ({ ...item, status: "NOT_REPORTED" })),
    requirementsAssessment: null
  }]
};
const repaired = repairHistoricalRequirementSets(corrupted, { SAFE: [staleQ1, q2Report, baseReport] });
assert.equal(repaired.repairs.length, 1);
assert.equal(repaired.collection.SAFE[0].evaluatedByAnalysisId, "SAFE-q2-results");
assert.equal(repaired.collection.SAFE[0].requirements[0].status, "PASSED");
assert.equal(repaired.collection.SAFE[0].requirementsAssessment.weightedAchievement, 50);

const badArithmetic = {
  ...baseReport,
  fairValueSummary: {
    ...baseReport.fairValueSummary,
    probabilityWeightedFairValue: 140
  }
};
const arithmeticAudit = auditFinancialReport(badArithmetic);
assert.equal(arithmeticAudit.valid, false);
assert.ok(arithmeticAudit.errors.some((item) => item.code === "WEIGHTED_FAIR_VALUE_MISMATCH"));

const legacyQuarterly = {
  ...q2Report,
  metadata: { importMethod: "quarterly_earnings_lite" },
  requirementsAssessment: {
    weightedAchievement: null,
    reportedRequirements: null,
    totalRequirements: null
  },
  previousRequirementsEvaluation: {
    ...q2Report.previousRequirementsEvaluation,
    requirementsAssessment: null
  }
};
const legacyAudit = auditFinancialReport(legacyQuarterly);
assert.equal(legacyAudit.valid, false);
assert.ok(legacyAudit.errors.some((item) => item.code === "TARGET_ASSESSMENT_MISSING"));
assert.ok(legacyAudit.warnings.some((item) => item.code === "INHERITED_DECISION_DATE_MISSING"));

{
  const writes = [];
  const frames = [];
  let subscribed = null;
  const globals = installFinancialDomHarness(writes, frames);

  try {
    const root = fakeFinancialRoot(writes, legacyQuarterly);
    const store = {
      state: {
        language: "ar",
        externalReportSelection: { ticker: "SAFE", reportId: legacyQuarterly.id },
        externalAnalyses: { SAFE: [legacyQuarterly, baseReport] },
        historicalRequirementSets: {}
      },
      subscribe(listener) {
        subscribed = listener;
      }
    };

    installFinancialSafetyLayer(store, root);
    flushFinancialFrames(frames);
    const firstWriteCount = writes.length;

    subscribed();
    flushFinancialFrames(frames);
    assert.equal(writes.length, firstWriteCount, "Financial safety warning must not rewrite unchanged DOM.");
  } finally {
    restoreFinancialGlobals(globals);
  }
}

console.log("Financial safety and lifecycle regression tests passed.");

function installFinancialDomHarness(writes, frames) {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    setTimeout: globalThis.setTimeout,
    structuredClone: globalThis.structuredClone
  };
  const elementsById = new Map();
  globalThis.document = {
    documentElement: { dir: "rtl", lang: "ar" },
    head: {
      append(element) {
        if (element.id) elementsById.set(element.id, element);
      }
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    createElement(tagName) {
      return fakeFinancialElement(writes, tagName);
    }
  };
  globalThis.window = {};
  globalThis.MutationObserver = class {
    observe() {}
  };
  globalThis.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  globalThis.setTimeout = (callback) => {
    callback();
    return 0;
  };
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
  return previous;
}

function restoreFinancialGlobals(previous) {
  globalThis.document = previous.document;
  globalThis.window = previous.window;
  globalThis.MutationObserver = previous.MutationObserver;
  globalThis.requestAnimationFrame = previous.requestAnimationFrame;
  globalThis.setTimeout = previous.setTimeout;
  globalThis.structuredClone = previous.structuredClone;
}

function flushFinancialFrames(frames) {
  while (frames.length) frames.shift()();
}

function fakeFinancialRoot(writes, report) {
  let banner = null;
  const priceLabel = fakeFinancialElement(writes, "span");
  const upsideLabel = fakeFinancialElement(writes, "span");
  const completionLabel = fakeFinancialElement(writes, "span");
  const sortOption = fakeFinancialElement(writes, "option");
  const host = fakeFinancialHost(writes);
  const card = {
    dataset: { externalReportId: report.id },
    classList: {
      contains(className) {
        return className === "v31-library-stock-row";
      }
    },
    querySelector(selector) {
      return selector === ".v31-library-price-block" ? host : null;
    }
  };

  return {
    querySelector(selector) {
      if (selector === ".franklin-financial-safety-banner") return banner;
      if (selector === ".report-app-bar") return null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".v31-current-price > span") return [priceLabel];
      if (selector === ".v31-upside-line > span") return [upsideLabel];
      if (selector === ".library-completion-row > span") return [completionLabel];
      if (selector === "select[data-library-sort] option[value='upside']") return [sortOption];
      if (selector === "[data-external-report-id]") return [card];
      return [];
    },
    prepend(element) {
      banner = element;
      writes.push("prepend:financial-warning");
    }
  };
}

function fakeFinancialHost(writes) {
  let asOf = null;
  return {
    querySelector(selector) {
      return selector === ".franklin-price-asof" ? asOf : null;
    },
    append(element) {
      asOf = element;
      writes.push("append:asof");
    }
  };
}

function fakeFinancialElement(writes) {
  let className = "";
  let innerHTML = "";
  let textContent = "";
  return {
    dataset: {},
    id: "",
    get className() {
      return className;
    },
    set className(value) {
      writes.push(`class:${value}`);
      className = String(value);
    },
    get innerHTML() {
      return innerHTML;
    },
    set innerHTML(value) {
      writes.push("html");
      innerHTML = String(value);
    },
    get textContent() {
      return textContent;
    },
    set textContent(value) {
      writes.push(`text:${String(value)}`);
      textContent = String(value);
    }
  };
}
