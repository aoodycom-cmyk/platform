import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const mobileStyles = readFileSync(new URL("../styles-mobile2.css", import.meta.url), "utf8");

const homeSearchSource = components.slice(
  components.indexOf("function homePolishedSearch"),
  components.indexOf("function homeQuickActions")
);

assert.equal(homeSearchSource.includes("state.notice"), false, "Library Home must not reserve persistent layout space for save notices.");
assert.ok(mobileStyles.includes("--mobile-card-title-size: 18px"), "Mobile report cards must share one title scale.");
assert.ok(mobileStyles.includes("--mobile-card-body-size: 14px"), "Mobile report cards must share one body scale.");
assert.ok(mobileStyles.includes("--mobile-card-label-size: 10px"), "Mobile report labels must remain legible without assistive zoom.");
assert.ok(mobileStyles.includes(".mobile-report-facts { grid-template-columns:repeat(2,minmax(0,1fr))"), "Top facts must use wider two-column mobile cards.");
assert.ok(mobileStyles.includes(".mobile-report-facts article:last-child { grid-column:1 / -1"), "The update/date fact must receive a full-width scan row.");
assert.ok(mobileStyles.includes(".stock-summary-metric strong { font-size:20px"), "Scenario values must use restrained mobile typography.");
assert.ok(mobileStyles.includes(".stock-report-section > header h3 { font-size:var(--mobile-card-title-size)"), "Report section titles must share the Investment Opportunity scale.");
assert.ok(mobileStyles.includes(".compact-evidence-row strong { font-size:var(--mobile-card-body-size)"), "Evidence rows must use the shared report typography.");
assert.ok(mobileStyles.includes(".compact-evidence-row small { font-size:var(--mobile-card-detail-size); line-height:1.5; font-weight:400; -webkit-line-clamp:1"), "Evidence previews must remain compact while full details stay available on tap.");
assert.ok(mobileStyles.includes(".requirement-comparison-grid { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr))"), "Requirement values must use a clean two-column mobile layout.");
assert.ok(mobileStyles.includes(".comparison-cell:last-child { grid-column:1 / -1; grid-row:1"), "The actual-quarter value must receive a full-width row.");
assert.ok(mobileStyles.includes(".requirement-comparison-row .requirement-status { grid-column:2"), "Requirement status must stay beside the metric without colliding with values.");
for (const selector of [
  ".mobile-report-facts span,.stock-summary-metric span",
  ".requirement-comparison-row .requirement-metric-name small",
  ".requirement-comparison-row .requirement-status",
  ".comparison-cell span"
]) {
  const declaration = mobileStyles.slice(mobileStyles.indexOf(selector), mobileStyles.indexOf("}", mobileStyles.indexOf(selector)) + 1);
  assert.ok(declaration.includes("font-size:var(--mobile-card-label-size)"), `${selector} must use the shared legible mobile label scale.`);
  assert.equal(declaration.includes("font-size:9px"), false, `${selector} must not regress to 9px text.`);
}
assert.equal(mobileStyles.includes("@media (min-width:"), false, "The polish layer must not introduce desktop overrides.");

console.log("Mobile presentation polish tests passed.");
