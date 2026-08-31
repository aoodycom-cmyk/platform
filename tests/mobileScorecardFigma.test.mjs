import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EARNINGS_TABLE_EXPERIENCE_VERSION,
  buildQuarterlyEarningsViewModel,
  displayActualValue,
  displayRequirementValue
} from "../src/ui/earningsTableExperience.js";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const figmaStyles = readFileSync(new URL("../styles-mobile-scorecard-figma.css", import.meta.url), "utf8");
const editorialEntry = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const earningsStyles = readFileSync(new URL("../styles-earnings-compact-v56.css", import.meta.url), "utf8");
const earningsTable = readFileSync(new URL("../src/ui/earningsTableExperience.js", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

assert.equal(EARNINGS_TABLE_EXPERIENCE_VERSION, "v57");
assert.ok(index.includes("styles-mobile-scorecard-figma.css"), "Legacy scorecard CSS remains available for desktop/fallback presentation.");
assert.ok(main.includes("earningsTableExperience.js?v=v57-earnings-single-source"), "The v57 single-source earnings experience must load first.");
assert.ok(main.includes("if (!earningsTable.EARNINGS_TABLE_EXPERIENCE_VERSION)"), "The old Figma enhancer may load only as a fallback.");
assert.ok(main.includes("Quarterly scorecard mobile UI fallback"), "The legacy presentation must remain available if the new optional module fails.");
assert.equal(main.includes('loadOptional("./ui/quarterlyScorecardMobileFigma.js", "Quarterly scorecard mobile UI"),'), false, "The conflicting enhancer must not run alongside the earnings table.");

assert.ok(editorialEntry.length > 20000, "The complete Codex editorial layer must be restored, not replaced by an import-only placeholder.");
assert.ok(editorialEntry.includes("Franklin Editorial Finance v53"), "The restored Codex editorial source must remain identifiable.");
assert.ok(earningsTable.includes("STYLE_HREF = \"./styles-earnings-compact-v56.css?v=v57-earnings-single-source\""), "The earnings module must load its isolated stylesheet after the application CSS.");
assert.ok(earningsTable.includes("ensureStylesheet();"), "The isolated earnings stylesheet must be installed by the single-source module.");
assert.ok(syncScript.includes("styles-earnings-compact-v56.css"));
assert.ok(worker.includes("styles-earnings-compact-v56.css"));
assert.ok(worker.includes("v57-earnings-single-source"));

assert.ok(figmaStyles.includes("@media (max-width: 899px)"), "Legacy Figma CSS remains mobile-scoped.");
assert.ok(earningsStyles.includes("franklin-quarterly-earnings-active"), "Bottom navigation and frame changes must be scoped to the earnings screen.");
assert.ok(earningsStyles.includes('data-earnings-table-enhanced="true"'), "All scorecard overrides must require the enhanced screen marker.");
assert.ok(earningsStyles.includes("env(safe-area-inset-top)"), "The header must respect the iPhone status-bar safe area.");
assert.ok(earningsStyles.includes(".fet-table-pending col:first-child"), "Upcoming quarters must use a two-column table.");
assert.ok(earningsStyles.includes(".fet-table-reported col:nth-child(3)"), "Reported quarters must use a three-column table.");
assert.equal(earningsStyles.includes("font-size: 9px"), false, "Important earnings text must never fall back to 9px.");
assert.equal(earningsStyles.includes(":has("), false, "The bottom-bar rule must not depend on a fragile relational selector.");

assert.ok(earningsTable.includes('data-fet-tab="summary"'));
assert.ok(earningsTable.includes('data-fet-tab="earnings"'));
assert.ok(earningsTable.includes("fet-quarter-rail"));
assert.ok(earningsTable.includes("fet-table-pending"));
assert.ok(earningsTable.includes("fet-table-reported"));
assert.equal(earningsTable.includes("fet-result-cell"), false, "Result must be integrated into the actual cell rather than a fourth mobile column.");
assert.equal(earningsTable.includes("localStorage"), false, "The presentation module must not write to Franklin persistence.");
assert.equal(earningsTable.includes("sessionStorage"), false, "The presentation module must not write to session persistence.");
assert.equal(earningsTable.includes("store.set("), false, "The presentation module must not mutate application state.");
assert.ok(earningsTable.includes("Franklin shows saved next-quarter targets without inventing market forecasts"));

const source = {
  ticker: "SPCX",
  companyName: "SPCX",
  year: 2026,
  latestReportedQuarter: null,
  reportedQuarterCount: 0,
  quarters: [1, 2, 3].map((quarter) => ({
    quarter,
    label: `Q${quarter}`,
    evaluated: false,
    lifecycleStatus: "OPEN",
    weightedAchievement: null,
    overallStatus: null,
    summary: null,
    targetValue: null,
    targetScenario: "bull",
    outlook: null
  })),
  rows: [
    {
      key: "revenue",
      label: "نمو الإيراد",
      secondaryLabel: "Revenue Growth",
      cells: {
        1: requirementCell(10),
        2: requirementCell(11),
        3: requirementCell(11.5)
      }
    }
  ]
};
const before = JSON.stringify(source);
const model = buildQuarterlyEarningsViewModel(source);
assert.equal(model.targetQuarter, 3, "With no reported history, the highest saved target is selected without calling all quarters upcoming.");
assert.equal(model.defaultQuarter, 3);
assert.equal(model.quarters.find((item) => item.quarter === 3).phase, "target");
assert.equal(model.quarters.find((item) => item.quarter === 2).phase, "missing");
assert.equal(model.quarters.find((item) => item.quarter === 1).phase, "missing");
assert.equal(JSON.stringify(source), before, "Building the view model must not mutate stored quarterly data.");

const withReported = {
  ...source,
  latestReportedQuarter: 2,
  reportedQuarterCount: 2,
  quarters: source.quarters.map((quarter) => ({ ...quarter, evaluated: quarter.quarter <= 2 })),
  rows: source.rows.map((row) => ({
    ...row,
    cells: {
      1: { ...row.cells[1], reported: true, actualValue: 10.5, status: "PASSED" },
      2: { ...row.cells[2], reported: true, actualValue: 10.2, status: "FAILED" },
      3: { ...row.cells[3] }
    }
  }))
};
const reportedModel = buildQuarterlyEarningsViewModel(withReported);
assert.equal(reportedModel.quarters.find((item) => item.quarter === 3).phase, "upcoming");
assert.equal(reportedModel.quarters.find((item) => item.quarter === 2).phase, "reported");
assert.equal(reportedModel.quarters.find((item) => item.quarter === 2).tone, "miss");

assert.equal(displayRequirementValue({ requiredValue: 11.5, requiredDisplay: "11.5 مليار دولار أو أكثر", unit: "مليار دولار", type: "minimum" }), "≥ $11.5B");
assert.equal(displayRequirementValue({ requiredValue: 37, unit: "%", type: "minimum" }), "≥ 37%");
assert.equal(displayRequirementValue({ requiredValue: 1.1, unit: "مليار دولار", type: "maximum" }), "≤ $1.1B");
assert.equal(displayActualValue({ actualValue: 16.1, unit: "مليار دولار" }), "$16.1B");

console.log("Franklin earnings single-source presentation tests passed.");

function requirementCell(requiredValue) {
  return {
    requiredValue,
    requiredDisplay: `${requiredValue} مليار دولار أو أكثر`,
    actualValue: null,
    actualDisplay: null,
    unit: "مليار دولار",
    type: "minimum",
    status: "NOT_REPORTED",
    reported: false,
    observation: false
  };
}
