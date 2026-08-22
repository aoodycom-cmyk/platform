import assert from "node:assert/strict";
import {
  appendQuarterlySourceContract,
  attachQuarterlySources,
  extractQuarterlySources
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

console.log("Quarterly source provenance tests passed.");
