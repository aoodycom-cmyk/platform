import assert from "node:assert/strict";
import {
  fiscalQuarterPeriodFromParts,
  fiscalQuarterPeriodsEqual,
  isCanonicalFiscalQuarterPeriod,
  nextFiscalQuarterPeriod,
  normalizeFiscalQuarterPeriod,
  parseFiscalQuarterPeriod
} from "../src/externalAnalysis/fiscalQuarterPeriod.js";
import { buildFranklinV3ReportTemplate } from "../src/externalAnalysis/v3Contract.js";

for (const value of ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"]) {
  assert.equal(normalizeFiscalQuarterPeriod(value), value);
  assert.equal(isCanonicalFiscalQuarterPeriod(value), true);
}

for (const [value, expected] of [
  ["FY2026 Q3", "Q3 2026"],
  ["FY 2026 Q3", "Q3 2026"],
  ["Q3 FY2026", "Q3 2026"],
  ["Q3 FY 2026", "Q3 2026"],
  ["2026 Q3", "Q3 2026"],
  ["Q1-2026", "Q1 2026"]
]) {
  assert.equal(normalizeFiscalQuarterPeriod(value), expected, `${value} should normalize canonically`);
  assert.equal(fiscalQuarterPeriodsEqual(value, expected), true);
}

for (const value of ["Q5 2026", "Q0 2026", "Q3 26", "FY2026", "2026", "quarter three 2026"]) {
  assert.equal(parseFiscalQuarterPeriod(value), null, `${value} must remain invalid`);
  assert.equal(isCanonicalFiscalQuarterPeriod(value), false);
}
assert.equal(isCanonicalFiscalQuarterPeriod(" Q3 2026 "), false);
assert.equal(normalizeFiscalQuarterPeriod(" Q3 2026 "), "Q3 2026");

for (const [value, expected] of [
  ["Q1 2026", "Q2 2026"],
  ["Q2 2026", "Q3 2026"],
  ["Q3 2026", "Q4 2026"],
  ["Q4 2026", "Q1 2027"]
]) {
  assert.equal(nextFiscalQuarterPeriod(value), expected);
}

assert.equal(fiscalQuarterPeriodFromParts("Q3", 2026), "Q3 2026");
assert.deepEqual(
  parseFiscalQuarterPeriod("FY2026 Q3"),
  { quarter: 3, year: 2026, fiscalQuarter: "Q3", fiscalYear: 2026, reportPeriod: "Q3 2026" }
);

const initialTemplate = buildFranklinV3ReportTemplate({
  analysisType: "INITIAL",
  selectedPeriod: "FY2026 Q3"
});
assert.equal(initialTemplate.reportIdentity.fiscalQuarter, "Q3");
assert.equal(initialTemplate.reportIdentity.fiscalYear, 2026);
assert.equal(initialTemplate.nextRequirements.previousQuarter, "Q3 2026");
assert.equal(initialTemplate.nextRequirements.targetQuarter, "Q4 2026");

console.log("Fiscal quarter period contract regression: PASS");
