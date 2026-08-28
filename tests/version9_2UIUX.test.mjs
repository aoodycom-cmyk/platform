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
const foundation = readFileSync(new URL("../public/src/ui/foundation.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const language = readFileSync(new URL("../public/src/i18n/language.js", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../public/src/state/store.js", import.meta.url), "utf8");
const chatgptContract = readFileSync(new URL("../public/src/externalAnalysis/chatgptContract.js", import.meta.url), "utf8");
const supplementMergeSource = readFileSync(new URL("../public/src/externalAnalysis/supplementMerge.js", import.meta.url), "utf8");

const homeStart = components.indexOf("function homeDashboard");
const homeEnd = components.indexOf("function homePolishedSearch", homeStart);
const homeDashboard = components.slice(homeStart, homeEnd);
const panelsStart = components.indexOf("const panels =");
const panelsEnd = components.indexOf("];", panelsStart);
const visiblePanelConfig = components.slice(panelsStart, panelsEnd);

assert.ok(homeDashboard.includes("My Stocks"), "Home must present Franklin as My Stocks / investment library.");
assert.ok(homeDashboard.includes("externalAnalysesHomeSection"), "Home must focus on saved imported reports.");
assert.ok(foundation.includes("data-action=\"open-external-import\""), "Home must expose Import Analysis through the shared app header.");
assert.ok(components.includes("investmentLibrarySummary"), "Home must show a compact saved-stock status summary.");
assert.ok(components.includes("Analyze / Add Stock"), "Home primary CTA must focus on analyzing or adding a stock.");
assert.equal(homeDashboard.includes("data-action=\"new-analysis\""), false, "Home must not surface the legacy internal New Analysis flow.");
assert.equal(homeDashboard.includes("data-action=\"load-demo-analysis\""), false, "Home must not surface demo analysis loading.");
assert.equal(visiblePanelConfig.includes("\"workspace\""), false, "Visible navigation must not expose the legacy workspace.");
assert.equal(visiblePanelConfig.includes("\"research\""), false, "Visible navigation must not expose legacy research dashboards.");
assert.equal(visiblePanelConfig.includes("\"watchlist\""), false, "Visible navigation must not expose the old watchlist flow.");
assert.ok(components.includes("function externalImportPanel"), "Import page must exist as the only import flow.");
assert.ok(components.includes("json-import-tabs"), "Import page must prioritize JSON file import while retaining paste mode.");
assert.ok(components.includes('data-external-import-mode="file"'), "File JSON must be the primary import tab.");
assert.ok(components.includes('data-external-import-mode="paste"'), "Legacy paste JSON mode must remain available.");
assert.ok(components.includes("data-external-ticker-hint"), "Import page must provide a ticker fallback field when pasted reports omit the symbol.");
assert.ok(components.includes("store.parseExternalImport(text, { tickerHint })"), "Ticker fallback must be passed to the import parser.");
assert.ok(components.includes("data-action=\"copy-full-analysis-prompt\""), "Import page must let users copy the official ChatGPT analysis prompt.");
assert.ok(components.includes("data-action=\"copy-external-json-template\""), "Import page must let users copy a blank JSON Template.");
assert.ok(components.includes("Advanced Options"), "Blank JSON Template must be moved into advanced options.");
assert.ok(components.includes("function externalChatGptPrepCard"), "Import page must show ChatGPT preparation guidance before paste.");
assert.ok(components.includes("function missingDataCompletionCard"), "Missing data completion card must exist.");
assert.ok(components.includes("copy-missing-requirements"), "Missing data card must expose Copy Missing Requirements.");
assert.ok(components.includes("parse-external-supplement"), "Supplement paste flow must be wired.");
assert.ok(components.includes("function supplementPreviewPanel"), "Supplement preview must exist before safe merge.");
assert.ok(components.includes("function conflictRow"), "Conflict Review UI must exist.");
assert.ok(components.includes("لم يُرجع ChatGPT أي قيم غير فارغة للحقول المطلوبة"), "All-null supplement error must be shown in Arabic.");
assert.ok(supplementMergeSource.includes("موجودة مسبقًا"), "Already-present supplement result must be separated from all-null errors.");
assert.ok(components.includes("لا تستخدم TICKER أو SYMBOL"), "Placeholder ticker supplement error must be shown in Arabic.");
assert.ok(components.includes("function externalHistoryPanel"), "History page must exist for prior saved analyses.");
assert.ok(components.includes("function externalAnalysisReportView"), "Company Report page must exist.");
assert.ok(components.includes("data-action=\"copy-new-earnings-prompt\""), "Company Report must expose Analyze New Earnings prompt copy.");
assert.ok(components.includes("currentNewEarningsAnalysisPrompt"), "Analyze New Earnings must copy from the saved stock report.");
assert.ok(components.includes("stock-decision-workspace"), "Company Report must use the compact stock-decision workspace.");
assert.ok(components.includes("function stockDecisionHeader"), "Company Report must start with a compact stock header.");
assert.ok(components.includes("function latestEarningsWorkspace"), "Company Report must prioritize a Latest Earnings workspace.");
assert.ok(components.includes("data-action=\"open-earnings-update\""), "Saved reports must expose the earnings update workflow drawer.");
assert.ok(components.includes("function earningsUpdateDrawer"), "Earnings update workflow drawer must exist.");
assert.ok(components.includes("data-action=\"prepare-earnings-prompt\""), "Earnings workflow must generate a ChatGPT prompt after pasted earnings text.");
assert.ok(components.includes("data-action=\"parse-earnings-update-json\""), "Earnings workflow must validate returned JSON locally.");
assert.ok(components.includes("data-action=\"save-earnings-update\""), "Earnings workflow must save the updated stock report after validation.");
assert.ok(components.includes("function companyProfileView"), "Company Profile page must exist for imported company profiles.");
assert.ok(components.includes("data-profile-ticker"), "Saved stock cards must expose a compact Company Profile action.");
assert.ok(components.includes("event.stopPropagation();"), "Company Profile action must not trigger the stock-report card navigation.");
assert.ok(components.includes("function reportDataHealthCard"), "Company Report must always show data health/completion.");
assert.ok(components.includes("libraryCompletionRow"), "Home report cards must show completion state.");
assert.ok(components.includes("reportDecisionStrip"), "Company Report must show a concise decision strip.");
assert.ok(components.includes("valuation-card-bear"), "Bear/Base/Bull valuation cards must be explicitly classified.");
assert.ok(components.includes("valuation-method-readable-card"), "Valuation methods must render as readable investor cards.");
assert.ok(components.includes("requirementsComparisonView"), "Price target requirements must render as a structured comparison table/dashboard.");
assert.ok(components.includes("sourcesView(report.sources)"), "Sources must render as clean source cards without raw long URLs.");
assert.ok(components.includes("score-visual-card"), "Score cards must include visual bars.");
assert.ok(components.includes("stock-decision-header"), "Company Report must use the compact decision-first header.");
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
assert.ok(styles.includes(".chatgpt-prep-card"), "ChatGPT prep card styles must exist.");
assert.ok(styles.includes(".required-field-chips"), "Required fields guide styles must exist.");
assert.ok(styles.includes(".missing-data-sheet"), "Missing data sheet styles must exist.");
assert.ok(styles.includes(".report-data-health-card"), "Report data health card styles must exist.");
assert.ok(styles.includes(".library-completion-row"), "Home completion row styles must exist.");
assert.ok(styles.includes(".report-decision-strip"), "Report decision strip styles must exist.");
assert.ok(styles.includes(".valuation-card-bear"), "Bear valuation color style must exist.");
assert.ok(styles.includes(".valuation-card-base"), "Base valuation color style must exist.");
assert.ok(styles.includes(".valuation-card-bull"), "Bull valuation color style must exist.");
assert.ok(styles.includes(".score-track"), "Score bar styles must exist.");
assert.ok(styles.includes(".supplement-sheet"), "Supplement input sheet styles must exist.");
assert.ok(styles.includes(".conflict-row"), "Conflict review styles must exist.");
assert.ok(styles.includes(".report-v2-section"), "Report reading section styles must exist.");
assert.ok(styles.includes(".quick-summary-card"), "Quick summary card styles must exist.");
assert.ok(styles.includes(".fair-value-track"), "Fair Value Range visual styles must exist.");
assert.ok(styles.includes(".forecast-bars"), "Forecast chart styles must exist.");
assert.ok(styles.includes(".profile-pill"), "Company Profile pill styles must exist.");
assert.ok(styles.includes(".company-profile-shell"), "Company Profile page styles must exist.");
assert.ok(styles.includes(".valuation-method-readable-card"), "Readable valuation-method card styles must exist.");
assert.ok(styles.includes(".requirements-comparison-mobile"), "Mobile requirement comparison rows must exist.");
assert.ok(styles.includes(".source-readable-card"), "Clean source card styles must exist.");
assert.ok(styles.includes("--font-xs: 11px"), "Report design tokens must define a fixed typography scale.");
assert.ok(styles.includes(".stock-decision-header"), "Compact stock-decision header styles must exist.");
assert.ok(styles.includes(".stock-score-bar"), "Compact investment score bar styles must exist.");
assert.ok(styles.includes(".earnings-update-sheet"), "Earnings update drawer styles must exist.");
assert.ok(styles.includes(".fair-value-scenarios"), "Fair Value scenarios must use compact prominent layout styles.");

assert.ok(language.includes("أسهمي"), "Arabic My Stocks positioning must be localized.");
assert.ok(language.includes("عن الشركة"), "Company Profile label must be localized in Arabic.");
assert.ok(language.includes("اكتمال البيانات"), "Arabic data completion label must be localized.");
assert.ok(language.includes("صحة البيانات"), "Arabic data health label must be localized.");
assert.ok(language.includes('"Bear Scenario Label": "Bear"'), "Bear scenario labels must remain the standard English financial term.");
assert.ok(language.includes('"Base Scenario Label": "Base"'), "Base scenario labels must remain the standard English financial term.");
assert.ok(language.includes('"Bull Scenario Label": "Bull"'), "Bull scenario labels must remain the standard English financial term.");
assert.ok(language.includes("اكتب الرمز هنا إذا كان التقرير الملصوق لا يذكر رمز السهم بوضوح."), "Ticker fallback helper text must be localized.");
assert.ok(language.includes("انسخ برومبت Fair value الرسمي، أرسله إلى ChatGPT، ثم الصق رد JSON هنا."), "ChatGPT prep copy must be localized.");
assert.ok(language.includes("تحليل إعلان الأرباح الجديد"), "Analyze New Earnings action must be localized in Arabic.");
assert.ok(language.includes("التوافق الشرعي"), "Arabic Shariah label must be localized.");
assert.ok(storeSource.includes("tickerHint: \"\""), "External import state must persist the ticker hint.");
assert.ok(storeSource.includes("applyImportContextHints(parsed.report, { tickerHint })"), "Parsed external reports must receive context hints before validation.");
assert.ok(storeSource.includes("if (!tickerHint || report.company?.ticker) return report;"), "Ticker hint must never overwrite a ticker already present in the report.");
assert.ok(storeSource.includes("currentFullAnalysisPrompt"), "Store must expose the official full-analysis prompt.");
assert.ok(storeSource.includes("currentExternalAnalysisJsonTemplate"), "Store must expose the blank JSON Template.");
assert.ok(storeSource.includes("createEarningsUpdateState"), "Store must keep local-only earnings update workflow state.");
assert.ok(storeSource.includes("prepareEarningsUpdatePrompt"), "Store must build the local ChatGPT earnings update prompt.");
assert.ok(storeSource.includes("parseExternalAnalysisInput(rawText, {") && storeSource.includes("currentReport,") && storeSource.includes("expectedReportPeriod"), "Structured earnings JSON import must work locally against the selected saved report without an OpenAI call and lock the selected period.");
assert.ok(storeSource.includes("saveEarningsUpdate"), "Store must save the validated earnings update report.");
assert.ok(chatgptContract.includes("buildFullAnalysisPrompt"), "ChatGPT contract prompt builder must exist.");
assert.ok(chatgptContract.includes("buildExternalAnalysisJsonTemplate"), "ChatGPT contract JSON template builder must exist.");
assert.ok(chatgptContract.includes("buildNewEarningsAnalysisPrompt"), "ChatGPT contract must build the new earnings prompt locally.");

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
