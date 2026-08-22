import assert from "node:assert/strict";
import {
  appendQuarterlySourceContract,
  attachQuarterlySources,
  extractQuarterlySources,
  installQuarterlySourceSafety
} from "../src/financialSafety/quarterlySourceSafety.js";

const prompt = appendQuarterlySourceContract("Quarterly prompt");
assert.ok(prompt.includes("[Franklin source provenance contract]"));
assert.ok(prompt.includes("sources"));
assert.equal(appendQuarterlySourceContract(prompt), prompt, "The source contract must not be appended twice.");

const raw = JSON.stringify({
  schemaVersion: "quarterly-earnings-lite/v1",
  ticker: "SAFE",
  sources: [
    {
      title: "SAFE Q2 earnings release",
      url: "https://example.com/safe-q2",
      sourceType: "Investor Relations"
    },
    {
      title: "User-provided call transcript",
      url: null,
      sourceType: "User-provided earnings materials"
    }
  ]
});
const parsed = extractQuarterlySources(raw);
assert.equal(parsed.valid, true);
assert.equal(parsed.sources.length, 2);
assert.equal(parsed.sources[0].sourceType, "Investor Relations");

const inheritedReport = {
  id: "SAFE-q2",
  metadata: { importMethod: "quarterly_earnings_lite" },
  sources: [{ title: "Old Q1 source", url: "https://example.com/q1", sourceType: "Investor Relations" }]
};
const attached = attachQuarterlySources(inheritedReport, raw);
assert.equal(attached.valid, true);
assert.equal(attached.report.sources.length, 2);
assert.equal(attached.report.sources.some((item) => item.title === "Old Q1 source"), false);
assert.equal(attached.report.metadata.quarterlySourcesProvided, true);
assert.equal(attached.report.metadata.quarterlySourceCount, 2);

const missing = extractQuarterlySources(JSON.stringify({ ticker: "SAFE" }));
assert.equal(missing.valid, false);
assert.ok(missing.errors.some((item) => item.field === "sources"));

const invalidUrl = extractQuarterlySources(JSON.stringify({
  sources: [{ title: "Bad source", url: "javascript:alert(1)", sourceType: "Unknown" }]
}));
assert.equal(invalidUrl.valid, false);
assert.ok(invalidUrl.errors.some((item) => item.field === "sources.0.url"));

const smartQuotes = extractQuarterlySources("“sources”: []");
assert.equal(smartQuotes.valid, false);

{
  const frames = [];
  let subscribed = null;
  const writes = [];
  const globals = installDomHarness(writes);

  try {
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    globalThis.cancelAnimationFrame = () => {};
    globalThis.setTimeout = (callback) => {
      callback();
      return 0;
    };
    globalThis.MutationObserver = class {
      observe() {}
    };

    const root = fakeRoot(writes);
    const store = {
      state: {
        externalReportSelection: { ticker: "SAFE", reportId: "SAFE-q2" },
        externalAnalyses: {
          SAFE: [{
            id: "SAFE-q2",
            metadata: { importMethod: "quarterly_earnings_lite" }
          }]
        }
      },
      subscribe(listener) {
        subscribed = listener;
      }
    };

    installQuarterlySourceSafety(store, root);
    flushFrames(frames);
    const firstWriteCount = writes.length;

    subscribed();
    flushFrames(frames);
    assert.equal(writes.length, firstWriteCount, "Quarterly source warning must not rewrite unchanged DOM.");
  } finally {
    restoreGlobals(globals);
  }
}

console.log("Quarterly source provenance tests passed.");

function installDomHarness(writes) {
  const previous = {
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    setTimeout: globalThis.setTimeout
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
    createElement() {
      return fakeElement(writes);
    }
  };
  return previous;
}

function restoreGlobals(previous) {
  globalThis.document = previous.document;
  globalThis.MutationObserver = previous.MutationObserver;
  globalThis.requestAnimationFrame = previous.requestAnimationFrame;
  globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
  globalThis.setTimeout = previous.setTimeout;
}

function flushFrames(frames) {
  while (frames.length) frames.shift()();
}

function fakeRoot(writes) {
  let banner = null;
  return {
    querySelector(selector) {
      if (selector === ".franklin-quarterly-source-warning") return banner;
      return null;
    },
    prepend(element) {
      banner = element;
      writes.push("prepend:source-warning");
    }
  };
}

function fakeElement(writes) {
  let className = "";
  let innerHTML = "";
  return {
    dataset: {},
    id: "",
    textContent: "",
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
    }
  };
}
