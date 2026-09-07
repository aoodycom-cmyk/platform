import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("./corpus/real-world/source-packages.json", import.meta.url), "utf8"));
const periods = corpus.companies.flatMap((company) => company.periods.map((period) => ({ company, period })));

test("P5C freezes cutoff-safe Nasdaq prices for every benchmark period", () => {
  assert.equal(periods.length, 301);
  for (const { company, period } of periods) {
    const price = period.historicalMarketPrice;
    assert.equal(price.status, "VERIFIED", `${company.ticker} ${period.cutoffDate}`);
    assert.equal(price.ticker, company.ticker);
    assert.ok(price.price > 0);
    assert.equal(price.currency, "USD");
    assert.equal(price.priceType, "LAST_CLOSE");
    assert.ok(price.asOf <= period.cutoffDate, `${company.ticker} look-ahead price`);
    assert.match(price.sourceId, /^NASDAQ-/);
    assert.match(price.sourceUrl, /^https:\/\/api\.nasdaq\.com\/api\/quote\//);
  }
});

test("P5C official excerpts are hashed, linked, and never promoted beyond their evidence", () => {
  let exhibits = 0;
  for (const { company, period } of periods) {
    const exhibit = period.sources.find((source) => source.type === "Official SEC-filed earnings exhibit");
    if (!exhibit) continue;
    exhibits += 1;
    assert.match(exhibit.sha256, /^[a-f0-9]{64}$/);
    assert.ok(exhibit.publicationDate <= period.cutoffDate, `${company.ticker} future exhibit`);
    if (period.narrative.status === "VERIFIED") {
      assert.equal(period.narrative.claimTreatment, "SOURCE_QUOTATION_ONLY");
      assert.equal(period.narrative.sourceId, exhibit.sourceId);
      assert.ok(period.narrative.managementStatement.length <= 620);
    }
    if (period.guidance.status === "VERIFIED") {
      assert.equal(period.guidance.sourceId, exhibit.sourceId);
      assert.ok(period.guidance.low <= period.guidance.high);
      assert.equal(period.guidance.midpoint, (period.guidance.low + period.guidance.high) / 2);
      assert.ok(["raised", "lowered", "reiterated", "initiated", "withdrawn"].includes(period.guidance.direction));
    }
  }
  assert.ok(exhibits >= 63, "resumed acquisition must never lose the Phase 5C checkpoint");
});

test("P5C does not claim native-analysis or chain completion from partial evidence", () => {
  assert.ok(periods.every(({ period }) => !Object.hasOwn(period, "nativeAnalysis")));
});

test("P5D official evidence acquisition has durable resumable states", () => {
  const allowed = new Set(["COMPLETE", "PENDING", "RETRYABLE", "NOT_APPLICABLE", "FAILED"]);
  for (const { period } of periods) {
    const acquisition = period.officialEvidenceAcquisition;
    assert.ok(acquisition && allowed.has(acquisition.state));
    assert.ok(Number.isInteger(acquisition.attempts) && acquisition.attempts >= 0);
    assert.match(acquisition.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
    if (acquisition.state === "COMPLETE") {
      assert.ok(acquisition.sourceId);
      assert.ok(period.sources.some((source) => source.sourceId === acquisition.sourceId));
    }
  }
});

test("P5E guidance classifications are complete, source-linked, and cutoff-safe", () => {
  const allowed = new Set(["VERIFIED_GUIDANCE", "VERIFIED_NO_FORMAL_GUIDANCE", "VERIFIED_GUIDANCE_WITHDRAWN", "VERIFIED_GUIDANCE_NOT_QUANTIFIED", "NOT_APPLICABLE"]);
  for (const { period } of periods) {
    const guidance = period.guidanceClassification;
    assert.ok(guidance && allowed.has(guidance.classification));
    assert.equal(guidance.verificationStatus, "VERIFIED");
    assert.ok(guidance.sourceId && guidance.evidenceLocator);
    assert.ok(guidance.sourceDate <= period.cutoffDate);
    assert.ok(period.sources.some((source) => source.sourceId === guidance.sourceId));
    if (guidance.classification === "VERIFIED_GUIDANCE") {
      assert.ok(guidance.metric);
      assert.ok(guidance.low === null || guidance.high === null || guidance.low <= guidance.high);
    }
    if (guidance.classification === "VERIFIED_GUIDANCE_NOT_QUANTIFIED") {
      assert.ok(guidance.evidenceText);
      assert.ok(guidance.qualitativeDirection);
    }
  }
});
