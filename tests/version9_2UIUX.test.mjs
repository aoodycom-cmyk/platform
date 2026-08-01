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
const storeSource = readFileSync(new URL("../public/src/state/store.js", import.meta.url), "utf8");

const homeStart = components.indexOf("function homeDashboard");
const homeEnd = components.indexOf("function languageToggle", homeStart);
const homeDashboard = components.slice(homeStart, homeEnd);
const panelsStart = components.indexOf("const panels =");
const panelsEnd = components.indexOf("];", panelsStart);
const visiblePanelConfig = components.slice(panelsStart, panelsEnd);

assert.ok(homeDashboard.includes("Professional Equity Research Library"), "Home must present Franklin as a research library.");
assert.ok(homeDashboard.includes("externalAnalysesHomeSection"), "Home must focus on saved imported reports.");
assert.ok(homeDashboard.includes("data-action=\"open-external-import\""), "Home must expose Import Analysis.");
assert.equal(homeDashboard.includes("data-action=\"new-analysis\""), false, "Home must not surface the legacy internal New Analysis flow.");
assert.equal(homeDashboard.includes("data-action=\"load-demo-analysis\""), false, "Home must not surface demo analysis loading.");
assert.equal(visiblePanelConfig.includes("\"workspace\""), false, "Visible navigation must not expose the legacy workspace.");
assert.equal(visiblePanelConfig.includes("\"research\""), false, "Visible navigation must not expose legacy research dashboards.");
assert.equal(visiblePanelConfig.includes("\"watchlist\""), false, "Visible navigation must not expose the old watchlist flow.");
assert.ok(components.includes("function externalImportPanel"), "Import page must exist as the only import flow.");
assert.ok(components.includes("external-import-flow"), "Import page must show Paste -> Parse -> Preview -> Save -> Open Report.");
assert.ok(components.includes("data-external-ticker-hint"), "Import page must provide a ticker fallback field when pasted reports omit the symbol.");
assert.ok(components.includes("store.parseExternalImport(text, { tickerHint })"), "Ticker fallback must be passed to the import parser.");
assert.ok(components.includes("function missingDataCompletionCard"), "Missing data completion card must exist.");
assert.ok(components.includes("copy-missing-requirements"), "Missing data card must expose Copy Missing Requirements.");
assert.ok(components.includes("parse-external-supplement"), "Supplement paste flow must be wired.");
assert.ok(components.includes("function supplementPreviewPanel"), "Supplement preview must exist before safe merge.");
assert.ok(components.includes("function conflictRow"), "Conflict Review UI must exist.");
assert.ok(components.includes("function externalHistoryPanel"), "History page must exist for prior saved analyses.");
assert.ok(components.includes("function externalAnalysisReportView"), "Company Report page must exist.");
assert.ok(components.includes("report-v2-header"), "Company Report must use the V2 report-first header.");
assert.ok(components.includes("Investment Verdict"), "Report must contain the investment verdict section.");
assert.ok(components.includes("Raw Analysis"), "Report must keep raw analysis available but secondary.");
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
assert.ok(styles.includes(".library-card-grid"), "Library card grid styles must exist.");
assert.ok(styles.includes(".external-import-flow"), "External import flow styles must exist.");
assert.ok(styles.includes(".external-import-context"), "Ticker fallback context styles must exist.");
assert.ok(styles.includes(".missing-data-sheet"), "Missing data sheet styles must exist.");
assert.ok(styles.includes(".supplement-sheet"), "Supplement input sheet styles must exist.");
assert.ok(styles.includes(".conflict-row"), "Conflict review styles must exist.");
assert.ok(styles.includes(".report-v2-section"), "Report reading section styles must exist.");
assert.ok(styles.includes(".quick-summary-card"), "Quick summary card styles must exist.");
assert.ok(styles.includes(".fair-value-track"), "Fair Value Range visual styles must exist.");
assert.ok(styles.includes(".forecast-bars"), "Forecast chart styles must exist.");

assert.ok(language.includes("مكتبة أبحاث أسهم احترافية"), "Arabic research-library positioning must be localized.");
assert.ok(language.includes("اكتمال البيانات"), "Arabic data completion label must be localized.");
assert.ok(language.includes("اكتب الرمز هنا إذا كان التقرير الملصوق لا يذكر رمز السهم بوضوح."), "Ticker fallback helper text must be localized.");
assert.ok(language.includes("التوافق الشرعي"), "Arabic Shariah label must be localized.");
assert.ok(storeSource.includes("tickerHint: \"\""), "External import state must persist the ticker hint.");
assert.ok(storeSource.includes("applyImportContextHints(parsed.report, { tickerHint })"), "Parsed external reports must receive context hints before validation.");
assert.ok(storeSource.includes("if (!tickerHint || report.company?.ticker) return report;"), "Ticker hint must never overwrite a ticker already present in the report.");

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

console.log("Franklin Research V2 product UI tests passed.");
