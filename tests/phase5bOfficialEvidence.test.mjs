import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("./corpus/real-world/source-packages.json", import.meta.url), "utf8"));

test("P5B official source packages preserve 100-company filing provenance", () => {
  assert.equal(corpus.schemaVersion, "franklin-real-world-source-packages/v1");
  assert.ok(corpus.companies.length >= 100);
  assert.ok(new Set(corpus.companies.map((company) => company.ticker)).size >= 100);
  for (const company of corpus.companies) {
    assert.match(company.submissionsUrl, /^https:\/\/data\.sec\.gov\/submissions\/CIK\d{10}\.json$/);
    assert.ok(company.periods.length > 0, company.ticker);
    for (const period of company.periods) {
      assert.ok(period.periodIdentity.accession && period.cutoffDate);
      assert.ok(period.sources.length >= 1, `${company.ticker} ${period.periodIdentity.accession}`);
      assert.ok(period.evidenceClaims.length >= 4, `${company.ticker} ${period.periodIdentity.accession}`);
      assert.equal(period.beatMiss.status, "NOT_APPLICABLE");
      for (const source of period.sources) {
        assert.ok(source.primary === true || source.type === "Official SEC-filed earnings exhibit");
        assert.match(source.url, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
        assert.ok(source.publicationDate <= period.cutoffDate, `${company.ticker} future source`);
      }
    }
  }
});

test("P5B and later evidence gates remain explicit", () => {
  for (const company of corpus.companies) {
    for (const period of company.periods) {
      assert.ok(["VERIFIED", "NOT_VERIFIED", "NOT_APPLICABLE", "GUIDANCE_PRESENT_UNSTRUCTURED"].includes(period.guidance.status));
      assert.ok(["VERIFIED", "NOT_VERIFIED", "NOT_APPLICABLE"].includes(period.narrative.status));
      assert.ok(["VERIFIED", "NOT_VERIFIED"].includes(period.historicalMarketPrice.status));
    }
  }
});
