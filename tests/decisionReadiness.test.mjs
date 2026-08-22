import assert from "node:assert/strict";
import {
  classifyDecisionReadiness,
  installDecisionReadinessUi
} from "../src/financialSafety/decisionReadinessUi.js";

const full = {
  analysisDate: "2026-08-19",
  metadata: { importMethod: "structured_json" },
  fairValueSummary: {
    currentPrice: 100,
    fairValueBase: 125,
    probabilityWeightedFairValue: 123,
    upsideDownsidePercent: 25,
    marginOfSafetyPercent: 20
  },
  scenarios: {
    Bear: { fairValue: 80, probability: 20 },
    Base: { fairValue: 125, probability: 60 },
    Bull: { fairValue: 160, probability: 20 }
  },
  valuationMethodology: { modelWeights: [{ weight: 100 }] }
};
const fullReadiness = classifyDecisionReadiness(full);
assert.equal(fullReadiness.status, "full_analysis_as_of");
assert.equal(fullReadiness.asOfDate, "2026-08-19");

const quarterlyInherited = {
  ...full,
  reportPeriod: "Q2 2026",
  metadata: {
    importMethod: "quarterly_earnings_lite",
    quarterlySourcesProvided: true,
    baseAnalysisDate: "2026-08-19"
  },
  previousRequirementsEvaluation: {
    targetQuarter: "Q3 2026",
    earningsPeriod: "Q2 2026",
    requirements: [{ status: "NOT_REPORTED" }]
  }
};
const inheritedReadiness = classifyDecisionReadiness(quarterlyInherited);
assert.equal(inheritedReadiness.status, "quarterly_inherited");
assert.equal(inheritedReadiness.asOfDate, "2026-08-19");

const missingSources = {
  ...quarterlyInherited,
  metadata: { importMethod: "quarterly_earnings_lite", baseAnalysisDate: "2026-08-19" }
};
const missingSourcesReadiness = classifyDecisionReadiness(missingSources);
assert.equal(missingSourcesReadiness.status, "blocked");
assert.ok(missingSourcesReadiness.reasons.includes("QUARTERLY_SOURCE_PROVENANCE_MISSING"));

const brokenWeightedValue = {
  ...full,
  fairValueSummary: { ...full.fairValueSummary, probabilityWeightedFairValue: 140 }
};
const brokenReadiness = classifyDecisionReadiness(brokenWeightedValue);
assert.equal(brokenReadiness.status, "blocked");
assert.ok(brokenReadiness.reasons.includes("WEIGHTED_FAIR_VALUE_MISMATCH"));

{
  const originalDocument = globalThis.document;
  const originalMutationObserver = globalThis.MutationObserver;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const originalSetTimeout = globalThis.setTimeout;
  const writes = [];
  const frames = [];
  const elementsById = new Map();
  let subscribed = null;

  try {
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
        if (tagName === "style") return { id: "", textContent: "" };
        return fakeBadge(writes);
      }
    };
    globalThis.MutationObserver = class {
      observe() {}
    };
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    globalThis.cancelAnimationFrame = () => {};
    globalThis.setTimeout = (callback) => {
      callback();
      return 0;
    };

    const report = { ...full, id: "SAFE-full-analysis", company: { ticker: "SAFE" } };
    const card = fakeCard(writes, report.id);
    const root = {
      querySelectorAll(selector) {
        return selector === ".v31-library-stock-row[data-external-report-id]" ? [card] : [];
      }
    };
    const store = {
      state: { externalAnalyses: { SAFE: [report] } },
      subscribe(listener) {
        subscribed = listener;
      }
    };

    installDecisionReadinessUi(store, root);
    flushFrames(frames);
    const firstWriteCount = writes.length;

    subscribed();
    flushFrames(frames);
    assert.equal(writes.length, firstWriteCount, "Decision readiness render must be idempotent after the badge is current.");
  } finally {
    globalThis.document = originalDocument;
    globalThis.MutationObserver = originalMutationObserver;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    globalThis.setTimeout = originalSetTimeout;
  }
}

console.log("Decision readiness classification tests passed.");

function flushFrames(frames) {
  while (frames.length) {
    const callback = frames.shift();
    callback();
  }
}

function fakeBadge(writes) {
  let textContent = "";
  return {
    className: "",
    dataset: new Proxy({}, {
      set(target, key, value) {
        writes.push(`dataset:${String(key)}:${String(value)}`);
        target[key] = String(value);
        return true;
      }
    }),
    get textContent() {
      return textContent;
    },
    set textContent(value) {
      writes.push(`text:${String(value)}`);
      textContent = String(value);
    }
  };
}

function fakeCard(writes, reportId) {
  let badge = null;
  const classes = new Set();
  return {
    dataset: { externalReportId: reportId },
    classList: {
      contains(className) {
        return classes.has(className);
      },
      toggle(className, force) {
        const shouldHave = force === undefined ? !classes.has(className) : Boolean(force);
        const hasClass = classes.has(className);
        if (shouldHave && !hasClass) {
          classes.add(className);
          writes.push(`class:+${className}`);
        } else if (!shouldHave && hasClass) {
          classes.delete(className);
          writes.push(`class:-${className}`);
        }
        return shouldHave;
      }
    },
    querySelector(selector) {
      return selector === ".franklin-card-readiness" ? badge : null;
    },
    append(element) {
      badge = element;
      writes.push("append:badge");
    }
  };
}
