import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_ANALYSIS_FIXTURE } from "../public/src/data/demoFlow.js";
import { SUPPORTED_MODELS } from "../public/src/analystBrain/engine.js";
import {
  createValuationWorkspace,
  runFixedMethodologyValuation,
  updateAnalystBrainPaste,
  updateWorkspaceField
} from "../public/src/valuationWorkflow/workflow.js";

const components = readFileSync(new URL("../public/src/ui/components.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const language = readFileSync(new URL("../public/src/i18n/language.js", import.meta.url), "utf8");

assert.ok(components.includes("function homeCompanyCardsSection"), "Home must render compact evaluated-company cards.");
assert.ok(components.includes("company-card-grid"), "Home must use card layout instead of a dense default table.");
assert.ok(components.includes("data-action=\"new-analysis\""), "Home must expose a New Analysis action.");
assert.ok(components.includes("data-action=\"load-demo-analysis\""), "UI must expose demo data loading.");
assert.ok(components.includes("function analystBrainPastePanel"), "Paste Input screen must exist.");
assert.ok(components.includes("data-brain-paste"), "Paste Input must keep one main paste box.");
assert.ok(components.includes("Analyze Paste"), "Paste Input must use a user-facing Analyze Paste action.");
assert.ok(components.includes("function dataReviewPanel"), "Data Review screen must exist.");
assert.ok(components.includes("Confirm and Run Analysis"), "Data Review must expose one primary run action.");
assert.ok(components.includes("function processingStatePanel"), "Processing state must be renderable.");
assert.ok(components.includes("function investmentReportExperience"), "Investment Report experience must exist.");
assert.ok(components.includes("function scenarioCards"), "Scenario cards must be visible in the report.");
assert.ok(components.includes("function fairValueVisual"), "Fair Value Range visual must be visible in the report.");
assert.ok(components.includes("function businessQualityOverview"), "Business Quality snapshot must be visible in the report.");
assert.ok(components.includes("function valuationModelsSnapshot"), "Valuation model snapshot must exist.");
assert.ok(components.includes("function monitoringSnapshot"), "Monitoring snapshot must exist.");
assert.ok(components.includes("function finalActionsBlock"), "Export/approval section must exist.");
assert.ok(components.includes("Data Unavailable"), "Shariah card must show Data Unavailable when no verified source exists.");
assert.ok(components.includes("No verified Shariah source was provided"), "Shariah card must avoid inferred compliance.");

const searchHandlerStart = components.indexOf("root.querySelector(\"#searchInput\")?.addEventListener(\"input\"");
const searchHandlerEnd = components.indexOf("root.querySelector(\"#searchInput\")?.addEventListener(\"keydown\"", searchHandlerStart);
const searchHandler = components.slice(searchHandlerStart, searchHandlerEnd);
assert.ok(searchHandler.includes("store.state.query = event.target.value"), "Search input must update state without re-rendering on each character.");
assert.equal(searchHandler.includes("store.set"), false, "Search input handler must not call store.set and steal mobile keyboard focus.");

assert.ok(styles.includes("overflow-x: hidden"), "Page must prevent horizontal viewport overflow.");
assert.ok(styles.includes("@media (max-width: 620px)"), "Mobile iPhone breakpoint must exist.");
assert.ok(styles.includes(".company-card-grid"), "Card grid styles must exist.");
assert.ok(styles.includes(".analysis-flow-grid"), "Analysis flow styles must exist.");
assert.ok(styles.includes(".quick-summary-card"), "Quick summary card styles must exist.");
assert.ok(styles.includes(".fair-value-track"), "Fair Value Range visual styles must exist.");
assert.ok(styles.includes(".forecast-bars"), "Forecast chart styles must exist.");

assert.ok(language.includes("هل أشتري هذا السهم اليوم؟"), "Arabic decision-first headline must be localized.");
assert.ok(language.includes("التوافق الشرعي"), "Arabic Shariah label must be localized.");

let workspace = createValuationWorkspace(DEMO_ANALYSIS_FIXTURE.company);
workspace = updateAnalystBrainPaste(workspace, DEMO_ANALYSIS_FIXTURE.pasteText);
for (const [field, value] of Object.entries(DEMO_ANALYSIS_FIXTURE.fields)) {
  workspace = updateWorkspaceField(workspace, field, value, {
    source: DEMO_ANALYSIS_FIXTURE.source,
    sourceDate: DEMO_ANALYSIS_FIXTURE.sourceDate,
    mode: "Automatic",
    confidence: 0.96,
    userConfirmed: true,
    originalTextReference: "Loaded from demo fixture"
  });
}

assert.equal(workspace.dataReview.canRun, true, "Demo review must be actionable before analysis.");
assert.equal(workspace.dataReview.missing.length, 0, "Demo review must not leave required fields missing.");

const result = runFixedMethodologyValuation(workspace, "ar");
assert.equal(result.error, undefined, "Demo must run through the real deterministic engine.");
assert.ok(result.report.executiveConclusion.recommendation, "Report must contain a recommendation from the engine.");
assert.ok(Number.isFinite(result.report.executiveConclusion.investmentScore), "Report must contain engine-calculated Investment Score.");
assert.ok(Number.isFinite(result.report.executiveConclusion.rangeFairValue), "Report must contain engine-calculated Range FV.");
assert.ok(Array.isArray(result.report.monitoringChecklist), "Report must contain Monitoring metrics from the engine.");

const selectedModels = result.report.modelSelection.selectedModels.map((item) => item.method);
const supportedModelSet = new Set(SUPPORTED_MODELS);
for (const method of selectedModels) {
  assert.ok(supportedModelSet.has(method), `${method} must be implemented before it can be selected.`);
}
assert.ok(selectedModels.length >= 2, "Demo report must use multiple supported valuation models.");

console.log("Version 9.2 UI/UX tests passed.");
