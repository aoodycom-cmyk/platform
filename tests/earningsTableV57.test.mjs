import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQuarterlyEarningsViewModel } from "../src/ui/earningsTableV57.js";

const allOpen = scorecardFixture({
  latestReportedQuarter: null,
  quarters: [
    quarter(1, false, "OPEN"),
    quarter(2, false, "OPEN"),
    quarter(3, false, "OPEN")
  ],
  rows: [
    row("revenue", "نمو الإيرادات", "Revenue Growth", {
      1: cell(10, null, "NOT_REPORTED", false),
      2: cell(11, null, "NOT_REPORTED", false),
      3: cell(12, null, "NOT_REPORTED", false)
    })
  ]
});
const allOpenBefore = JSON.stringify(allOpen);
const openModel = buildQuarterlyEarningsViewModel(allOpen);
assert.equal(JSON.stringify(allOpen), allOpenBefore, "The presentation model must not mutate saved quarterly state.");
assert.equal(openModel.upcomingQuarter, 3, "With no reported quarter, the latest open target is the upcoming quarter.");
assert.equal(openModel.defaultQuarter, 3, "The upcoming quarter must open by default.");
assert.equal(openModel.quarters.find((item) => item.quarter === 3)?.viewState, "upcoming");
assert.equal(openModel.quarters.find((item) => item.quarter === 2)?.viewState, "historical-missing");
assert.equal(openModel.quarters.find((item) => item.quarter === 1)?.viewState, "historical-missing");

const reportedAndOpen = scorecardFixture({
  latestReportedQuarter: 1,
  quarters: [
    quarter(1, true, "EVALUATED", 88),
    quarter(2, false, "OPEN")
  ],
  rows: [
    row("revenue", "الإيرادات", "Revenue", {
      1: cell(10, 12, "PASSED", true),
      2: cell(13, null, "NOT_REPORTED", false)
    })
  ]
});
const reportedModel = buildQuarterlyEarningsViewModel(reportedAndOpen);
assert.equal(reportedModel.upcomingQuarter, 2);
assert.equal(reportedModel.defaultQuarter, 2);
assert.equal(reportedModel.quarters.find((item) => item.quarter === 1)?.viewState, "reported");
assert.equal(reportedModel.quarters.find((item) => item.quarter === 1)?.tone, "beat");
assert.equal(reportedModel.quarters.find((item) => item.quarter === 2)?.viewState, "upcoming");

const editorial = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const earnings = readFileSync(new URL("../src/ui/earningsTableV57.js", import.meta.url), "utf8");
const earningsStyles = readFileSync(new URL("../styles-earnings-v57.css", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const deployedMain = readFileSync(new URL("../docs/src/main.js", import.meta.url), "utf8");
const deployedEarnings = readFileSync(new URL("../docs/src/ui/earningsTableV57.js", import.meta.url), "utf8");
const publicEarnings = readFileSync(new URL("../public/src/ui/earningsTableV57.js", import.meta.url), "utf8");
const deployedStyles = readFileSync(new URL("../docs/styles-earnings-v57.css", import.meta.url), "utf8");
const publicStyles = readFileSync(new URL("../public/styles-earnings-v57.css", import.meta.url), "utf8");

assert.ok(editorial.startsWith("/* Franklin Editorial Finance v53"), "The full editorial presentation layer must be restored.");
assert.ok(editorial.length > 20000, "The global editorial stylesheet must not be replaced by a one-line earnings import.");
assert.equal(editorial.includes("styles-earnings-compact-v56.css"), false, "The obsolete compact override must not be imported globally.");

assert.ok(main.includes("MOBILE_PRESENTATION_MAX_WIDTH"));
assert.ok(main.includes("const scorecardPresentation = window.innerWidth <= MOBILE_PRESENTATION_MAX_WIDTH"), "Only one scorecard presentation engine may load per viewport.");
assert.ok(main.includes("earningsTableV57.js?v=v57-earnings-single-source"));
assert.ok(main.includes("quarterlyScorecardMobileFigma.js?v=v57-desktop-scorecard"));
assert.equal(main, deployedMain, "Canonical and GitHub Pages main runtime must stay identical.");

assert.ok(earnings.includes("fet57-results"), "Reported quarters need a real compact three-column table.");
assert.ok(earnings.includes("fet57-targets"), "Upcoming quarters need a real two-column Bull requirements table.");
assert.ok(earnings.includes("viewState,"), "Quarter state must be explicit rather than treating every missing quarter as upcoming.");
assert.ok(earnings.includes("historical-missing"));
assert.ok(earnings.includes("franklin-earnings-view-active"), "Bottom navigation visibility must be controlled by a reversible view class.");
assert.ok(earnings.includes("≥ ") && earnings.includes("≤ "), "Compact Bull thresholds must preserve minimum/maximum direction.");
assert.equal(earnings.includes(":has("), false, "The mobile view must not rely on brittle :has selectors.");
assert.equal(earningsStyles.includes(":has("), false, "The stylesheet must not rely on brittle :has selectors.");
assert.equal(/font-size:\s*9(?:px|\.)/.test(earningsStyles), false, "Important mobile earnings text must not fall below 10px.");
assert.equal(earnings.includes("localStorage"), false, "The presentation module must not read or modify saved app memory.");
assert.equal(earnings.includes("store.set("), false, "The presentation module must not write to the application state.");
assert.equal(earnings.includes("nth-child(4)"), false, "A hidden fourth table column must not be used.");
assert.equal(/perplexity/i.test(earnings), false, "Franklin identity must remain independent.");
assert.equal(earnings, deployedEarnings, "Canonical and docs earnings modules must stay identical.");
assert.equal(earnings, publicEarnings, "Canonical and public earnings modules must stay identical.");
assert.equal(earningsStyles, deployedStyles, "Canonical and docs earnings styles must stay identical.");
assert.equal(earningsStyles, publicStyles, "Canonical and public earnings styles must stay identical.");
assert.ok(syncScript.includes("styles-earnings-v57.css"), "Deployment sync must include the dedicated earnings stylesheet.");
assert.ok(worker.includes("v57-earnings-single-source"), "PWA cache must advance for the corrected earnings presentation.");

console.log("Franklin earnings table V57 single-source tests passed.");

function scorecardFixture({ latestReportedQuarter, quarters, rows }) {
  return {
    ticker: "SPCX",
    companyName: "SPACEX",
    year: 2026,
    latestReportedQuarter,
    reportedQuarterCount: quarters.filter((item) => item.evaluated).length,
    trajectory: null,
    overallStatus: null,
    target: null,
    fairValue: { bear: 50, base: 75, bull: 100 },
    quarters,
    rows
  };
}

function quarter(number, evaluated, lifecycleStatus, weightedAchievement = null) {
  return {
    quarter: number,
    label: `Q${number}`,
    evaluated,
    lifecycleStatus,
    weightedAchievement,
    overallStatus: null,
    summary: null,
    targetValue: null,
    targetScenario: "bull",
    outlook: null
  };
}

function row(key, label, secondaryLabel, cells) {
  return { key, label, secondaryLabel, cells };
}

function cell(requiredValue, actualValue, status, reported) {
  return {
    requiredValue,
    requiredDisplay: `${requiredValue}% or more`,
    unit: "%",
    type: "minimum",
    actualValue,
    actualDisplay: actualValue === null ? null : `${actualValue}%`,
    actualRaw: null,
    status,
    direction: reported ? "up" : "unknown",
    impact: status === "FAILED" ? "negative" : status === "NOT_REPORTED" ? "unknown" : "positive",
    evaluationNote: null,
    reported,
    observation: false
  };
}
