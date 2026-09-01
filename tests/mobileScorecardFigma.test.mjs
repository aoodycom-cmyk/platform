import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQuarterlyEarningsViewModel,
  compactRequirementDisplay,
  EARNINGS_TABLE_EXPERIENCE_VERSION
} from "../src/ui/earningsTableExperience.js";

const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const earnings = readFileSync(new URL("../src/ui/earningsTableExperience.js", import.meta.url), "utf8");
const compactStyles = readFileSync(new URL("../styles-earnings-compact-v56.css", import.meta.url), "utf8");
const editorialStyles = readFileSync(new URL("../styles-editorial-finance-v53.css", import.meta.url), "utf8");
const serviceWorker = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");

assert.equal(EARNINGS_TABLE_EXPERIENCE_VERSION, "v57");
assert.ok(editorialStyles.includes("Franklin Editorial Finance v53"), "Codex editorial presentation must be restored intact.");
assert.ok(editorialStyles.includes("--editorial-font"), "The global editorial system must not be replaced by a one-line import.");
assert.equal(editorialStyles.trim().startsWith("@import"), false);
assert.ok(serviceWorker.includes("visual-qa-20260901-7"));
assert.ok(serviceWorker.includes("styles-earnings-compact-v56.css"));
assert.ok(syncScript.includes("styles-earnings-compact-v56.css"));
assert.ok(main.includes("earningsTableExperience.js?v=v57-earnings-clean"));
assert.ok(main.includes("if (!earningsTableReady)"));
assert.ok(main.includes("quarterlyScorecardMobileFigma.js"), "The previous mobile scorecard remains available only as a safe fallback.");
assert.ok(main.indexOf("earningsTableExperience.js?v=v57-earnings-clean") < main.indexOf("quarterlyScorecardMobileFigma.js"));

assert.ok(earnings.includes('data-fet-tab="summary"'));
assert.ok(earnings.includes('data-fet-tab="earnings"'));
assert.ok(earnings.includes('const columns = reported ? "reported" : "target"'));
assert.ok(compactStyles.includes(".fet-table-target"));
assert.ok(compactStyles.includes(".fet-table-reported"));
assert.equal(earnings.includes("<col><col><col><col>"), false, "The mobile table must not create a hidden fourth column.");
assert.equal(earnings.includes("localStorage"), false, "Presentation code must not touch persisted Franklin data.");
assert.equal(earnings.includes("sessionStorage"), false, "Presentation code must not touch persisted Franklin data.");
assert.equal(earnings.includes("store.set("), false, "Presentation code must not mutate the application store.");

assert.ok(compactStyles.includes("html.franklin-quarterly-earnings-active .mobile-bottom-nav"));
assert.ok(compactStyles.includes("safe-area-inset-top"));
assert.ok(compactStyles.includes("--fet-accent: #59cfc0"), "Franklin's own accent must remain the primary identity color.");
assert.equal(compactStyles.includes(":has("), false, "The screen must not depend on :has() to hide navigation.");
assert.equal(compactStyles.includes("font-size: 9px"), false, "Readable mobile text must not fall to 9px.");
assert.equal(compactStyles.includes("radial-gradient"), false, "The earnings card should stay quiet and editorial, not decorative.");

const allOpen = buildQuarterlyEarningsViewModel({
  ticker: "SPCX",
  year: 2026,
  latestReportedQuarter: null,
  quarters: [1, 2, 3].map((quarter) => ({ quarter, label: `Q${quarter}`, lifecycleStatus: "OPEN", evaluated: false })),
  rows: [{
    key: "revenue",
    label: "نمو الإيراد",
    secondaryLabel: "Revenue Growth",
    cells: {
      1: { requiredValue: 9, unit: "USD billion", type: "minimum", status: "NOT_REPORTED" },
      2: { requiredValue: 10, unit: "USD billion", type: "minimum", status: "NOT_REPORTED" },
      3: { requiredValue: 11.5, unit: "USD billion", type: "minimum", status: "NOT_REPORTED" }
    }
  }]
});
assert.equal(allOpen.quarters.find((quarter) => quarter.quarter === 3).phase, "upcoming");
assert.equal(allOpen.quarters.find((quarter) => quarter.quarter === 2).phase, "missing");
assert.equal(allOpen.quarters.find((quarter) => quarter.quarter === 1).phase, "missing");
assert.equal(allOpen.defaultQuarter, 3);

const afterReported = buildQuarterlyEarningsViewModel({
  ticker: "DEMO",
  year: 2026,
  latestReportedQuarter: 2,
  quarters: [
    { quarter: 2, label: "Q2", evaluated: true },
    { quarter: 3, label: "Q3", evaluated: false, lifecycleStatus: "OPEN" }
  ],
  rows: [{
    key: "margin",
    label: "الهامش",
    cells: {
      2: { requiredValue: 35, actualValue: 37, unit: "%", type: "minimum", status: "PASSED", reported: true },
      3: { requiredValue: 39, unit: "%", type: "minimum", status: "NOT_REPORTED" }
    }
  }]
});
assert.equal(afterReported.quarters.find((quarter) => quarter.quarter === 3).phase, "upcoming");
assert.equal(afterReported.quarters.find((quarter) => quarter.quarter === 2).phase, "reported");

assert.equal(compactRequirementDisplay({ requiredValue: 11.5, requiredDisplay: "11.5 مليار دولار أو أكثر", unit: "USD billion", type: "minimum" }), "≥ $11.5B");
assert.equal(compactRequirementDisplay({ requiredValue: 37, requiredDisplay: "37% أو أكثر", unit: "%", type: "minimum" }), "≥ 37%");
assert.equal(compactRequirementDisplay({ requiredValue: 1.1, requiredDisplay: "1.1 مليار دولار أو أقل", unit: "USD billion", type: "maximum" }), "≤ $1.1B");

console.log("Franklin earnings v57 presentation contract passed.");
