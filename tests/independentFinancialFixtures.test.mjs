import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recalculateValuationMethod } from "../src/financialSafety/financialVerification.js";

const fixtureUrl = new URL("./fixtures/launch-audit/independent-valuations.json", import.meta.url);
const fixtures = JSON.parse(await readFile(fixtureUrl, "utf8"));

assert.equal(fixtures.length, 5);
assert.deepEqual(new Set(fixtures.map((item) => item.companyProfile)).size, 5);

for (const fixture of fixtures) {
  const result = recalculateValuationMethod(fixture.valuationResult);
  assert.equal(result.state, fixture.expectedState, `${fixture.id}: ${result.reason || "unexpected state"}`);
  assert.ok(fixture.reviewNote.length > 30, `${fixture.id} must document its independent financial purpose.`);

  if (fixture.expectedState === "CALCULATED") {
    assert.ok(Math.abs(result.value - fixture.expectedFairValue) <= 0.000001, `${fixture.id}: expected ${fixture.expectedFairValue}, got ${result.value}`);
    assert.notEqual(result.value, fixture.marketPrice, `${fixture.id}: fair value must not be a market-price anchor.`);
    const multiple = fixture.valuationResult.inputs.impliedMultiple
      ?? fixture.valuationResult.inputs.evEbitdaMultiple
      ?? fixture.valuationResult.inputs.terminalExitMultiple;
    assert.notEqual(multiple, 1, `${fixture.id}: independent fixtures must not use the legacy P/E=1 price anchor.`);
  }

  if (fixture.expectedCode) assert.equal(result.code, fixture.expectedCode, fixture.id);
}

console.log("Independent financial fixtures passed: mature, cyclical, loss-making, capital-intensive, and insufficient-data cases.");
