import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles-mobile-scorecard-figma.css", import.meta.url), "utf8");
const enhancer = readFileSync(new URL("../src/ui/quarterlyScorecardMobileFigma.js", import.meta.url), "utf8");
const earningsTable = readFileSync(new URL("../src/ui/earningsTableV57.js", import.meta.url), "utf8");
const earningsStyles = readFileSync(new URL("../styles-earnings-v57.css", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");

assert.ok(index.includes("styles-mobile-scorecard-figma.css"), "Figma scorecard stylesheet must remain available.");
assert.ok(main.includes("quarterlyScorecardMobileFigma.js?v=v57-desktop-scorecard"), "The legacy scorecard enhancer must remain available for the desktop outlook.");
assert.ok(main.includes("earningsTableV57.js?v=v57-earnings-single-source"), "The corrected mobile earnings table must load from the guarded runtime.");
assert.ok(main.includes("const scorecardPresentation = window.innerWidth <= MOBILE_PRESENTATION_MAX_WIDTH"), "Only one scorecard presentation engine may run for a viewport.");
assert.ok(syncScript.includes("styles-mobile-scorecard-figma.css"), "Deployment sync must include the Figma stylesheet.");
assert.ok(styles.includes("@media (max-width: 899px)"), "Figma scorecard layer must remain mobile-scoped in CSS.");
assert.ok(styles.includes("#0b0e14"), "Franklin canvas color must be preserved.");
assert.ok(styles.includes("#0d1117"), "Franklin header/navigation color must be preserved.");
assert.ok(styles.includes("#60a5fa"), "Franklin blue accent must be preserved.");
assert.ok(styles.includes("#34d399"), "Positive result color must be preserved.");
assert.ok(styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "The original scorecard fallback remains intact.");
assert.ok(styles.includes("overflow-x: hidden"), "Mobile scorecard must prevent page-level horizontal overflow.");
assert.ok(enhancer.includes("متابعة الأرباع"), "The desktop/fallback enhancer remains intact.");
assert.ok(enhancer.includes("متفوق على المطلوب"), "Execution status labels must remain available without inventing values.");
assert.equal(styles.includes("font-size: 9px"), false, "Important fallback labels must not use 9px text.");

assert.ok(earningsTable.includes('data-fet57-tab="summary"'), "Summary tab must be available above the earnings table.");
assert.ok(earningsTable.includes('data-fet57-tab="earnings"'), "Earnings tab must be available above the earnings table.");
assert.ok(earningsTable.includes("fet57-quarter-rail"), "Quarter selection must be horizontally scrollable.");
assert.ok(earningsTable.includes("المطلوب للـ Bull"), "Upcoming quarters must show saved Bull requirements.");
assert.ok(earningsTable.includes('return "Beat"'), "Reported requirements must expose Beat status.");
assert.ok(earningsTable.includes('return "Miss"'), "Reported requirements must expose Miss status.");
assert.ok(earningsStyles.includes(".fet57-actual.tone-beat"), "Beat actuals must receive the positive color treatment.");
assert.ok(earningsStyles.includes(".fet57-actual.tone-miss"), "Miss actuals must receive the negative color treatment.");
assert.ok(earningsTable.includes("Franklin will not display invented figures"), "The UI must not fabricate missing earnings values.");
assert.ok(earningsTable.includes("buildQuarterlyEarningsViewModel"), "The table must be generated from the canonical quarterly scorecard model.");

console.log("Franklin Quarterly Scorecard and earnings presentation tests passed.");
