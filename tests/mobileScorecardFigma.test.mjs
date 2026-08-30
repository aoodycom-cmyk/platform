import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles-mobile-scorecard-figma.css", import.meta.url), "utf8");
const enhancer = readFileSync(new URL("../src/ui/quarterlyScorecardMobileFigma.js", import.meta.url), "utf8");
const earningsTable = readFileSync(new URL("../src/ui/earningsTableExperience.js", import.meta.url), "utf8");
const syncScript = readFileSync(new URL("../scripts/sync-deploy.mjs", import.meta.url), "utf8");

assert.ok(index.includes("styles-mobile-scorecard-figma.css"), "Figma mobile scorecard stylesheet must load.");
assert.ok(main.includes("quarterlyScorecardMobileFigma.js"), "Figma mobile scorecard enhancer must load from the guarded runtime.");
assert.ok(main.includes("earningsTableExperience.js?v=v55-earnings-table"), "The unified earnings table experience must load from the guarded runtime.");
assert.ok(syncScript.includes("styles-mobile-scorecard-figma.css"), "Deployment sync must include the Figma mobile stylesheet.");
assert.ok(styles.includes("@media (max-width: 899px)"), "Figma scorecard layer must be mobile-only.");
assert.ok(styles.includes("#0b0e14"), "Figma canvas color must be preserved.");
assert.ok(styles.includes("#0d1117"), "Figma header/navigation color must be preserved.");
assert.ok(styles.includes("#60a5fa"), "Figma blue accent must be preserved.");
assert.ok(styles.includes("#34d399"), "Figma positive accent must be preserved.");
assert.ok(styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "Quarter cells must use the approved 2x2 mobile layout.");
assert.ok(styles.includes("overflow-x: hidden"), "Mobile scorecard must prevent horizontal overflow.");
assert.ok(enhancer.includes("متابعة الأرباع"), "Approved mobile Arabic title must be used.");
assert.ok(enhancer.includes("متفوق على المطلوب"), "Execution status labels must be available without inventing financial values.");
assert.equal(styles.includes("font-size: 9px"), false, "Important mobile labels must not fall back to 9px.");

assert.ok(earningsTable.includes('data-fet-tab="summary"'), "Summary tab must be available above the earnings table.");
assert.ok(earningsTable.includes('data-fet-tab="earnings"'), "Earnings tab must be available above the earnings table.");
assert.ok(earningsTable.includes("fet-quarter-rail"), "Quarter selection must be horizontally scrollable.");
assert.ok(earningsTable.includes("المطلوب للـ Bull"), "Upcoming quarters must show the saved Bull requirement.");
assert.ok(earningsTable.includes('return "Beat"'), "Reported requirements must expose Beat status.");
assert.ok(earningsTable.includes('return "Miss"'), "Reported requirements must expose Miss status.");
assert.ok(earningsTable.includes("fet-actual.tone-beat"), "Beat actuals must receive the positive color treatment.");
assert.ok(earningsTable.includes("fet-actual.tone-miss"), "Miss actuals must receive the negative color treatment.");
assert.ok(earningsTable.includes("Franklin shows only saved targets and does not invent forecasts"), "Upcoming-quarter UI must not fabricate consensus values.");
assert.ok(earningsTable.includes("buildQuarterlyEarningsViewModel"), "The table must be generated from the canonical quarterly scorecard model.");

console.log("Figma mobile Quarterly Scorecard presentation tests passed.");
