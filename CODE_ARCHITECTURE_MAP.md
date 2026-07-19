# Code Architecture Map - Version 9 Code Audit

Scope: current project at `outputs/equity-research-v2`. This is an audit map only; no business logic was changed.

## Entry Points

| Area | File | Function / Element | Inputs | Outputs | Next Function Called |
| --- | --- | --- | --- | --- | --- |
| Application entry point | index.html:16 / public/index.html:16 | script module ./src/main.js | Browser loads HTML, CSS, manifest, assets | ES module bootstraps app | src/main.js -> mountApp(root, store) |
| Frontend bootstrap | src/main.js:2 | createStore(); mountApp(root, store) | DOM node #app | Reactive store and rendered UI | src/state/store.js:createStore; src/ui/components.js:mountApp |
| Server entry point | server.mjs:21 | http.createServer() | HTTP requests to static files and API endpoints | Static assets or JSON API responses | handleSearch, handleResearchData, handleInvestmentAnalystParse |
| One-paste UI event | src/ui/components.js:698 | bind() click handler | Textarea value from data-brain-paste | Store action request | store.runAnalystBrainValuation(text) |
| Store orchestration | src/state/store.js:178 | runAnalystBrainValuation(pasteText) | One pasted text block, language, API keys | Generated workspace/report or error notice | loadAnalystBrainMethodology -> parseInvestmentAnalystBlock -> runInvestmentAnalystBrainValuation |

## Request Lifecycle And Analytical Pipeline

| Stage | File | Function | Inputs | Outputs | Next Function Called |
| --- | --- | --- | --- | --- | --- |
| Search/load company | src/providers/apiClient.js:6 | searchCompanies(query, apiKeys) | Ticker/name query and API keys | Provider results or local starter universe | fetchResearchData on selection |
| Optional AI parsing request | src/providers/apiClient.js:55 | parseInvestmentAnalystBlock({ text, apiKeys, methodology, language }) | Raw pasted block, methodology text/schema, OpenAI key | parsedFields/explanations or Local Parser unavailable result | runInvestmentAnalystBrainValuation |
| Server AI parser | server.mjs:33 | handleInvestmentAnalystParse(request,response) | POST body with text/apiKey/methodology | JSON parsedFields/explanations | OpenAI Responses API through openAiParserRequest |
| Local parser | src/valuationWorkflow/workflow.js:271 | parseOneBlockFields(text) | Raw one-block text | candidate field records | normalizeParsedFields |
| Evidence normalization | src/valuationWorkflow/workflow.js:270 | normalizeParsedFields(fields) | Local parser fields + optional AI parsed fields | Deduped normalized field objects | applyParsedFields |
| Workspace field apply | src/valuationWorkflow/workflow.js:275 | applyParsedFields(workspace, fields, source) | Workspace and parsed fields | Workspace with confirmed/automatic fields and dataReview | runAnalystBrainEngine |
| Canonical evidence normalization | src/analystBrain/engine.js:66 | normalizeEvidence(workspace) | workspace.inputs | values, sources, present set, derived marketCap/enterpriseValue | classifyCompany |
| Classification | src/analystBrain/engine.js:68 | classifyCompany(evidence, language) | Normalized values and text evidence | classification, evidence, suitableModels, excludedModels, confidence | scoreBusinessQuality |
| Business Quality | src/analystBrain/engine.js:69 | scoreBusinessQuality(evidence, classification, language) | Revenue, margins, FCF, balance sheet, moat text, management text | score, rating, confidence, weighted components | buildForecastPolicy |
| Forecast Engine | src/analystBrain/engine.js:70 | buildForecastPolicy(evidence, classification, language) | Evidence values and class defaults | Year 1-5 forecast, WACC, assumptions, sensitivity, confidence | buildScenarios |
| WACC | src/analystBrain/engine.js:244 | buildWacc(evidence, classification, defaults, language) | Cash/debt, classification, qualitative risks/moat | finalWacc, guardrail, cost components, rationale | buildYearlyForecast |
| Scenario generation | src/analystBrain/engine.js:71 | buildScenarios(evidence, classification, forecastPolicy, language) | Base forecast policy and fixed adjustments | Scenario forecasts and fair values | selectAndValueModels |
| Valuation Engine | src/analystBrain/engine.js:72 | selectAndValueModels(evidence, classification, forecastPolicy, scenarios, language) | Evidence, classification, forecasts, scenarios | selectedModels, excludedModels, fairValue, weightChecks | buildDataQuality |
| Recommendation Engine | src/analystBrain/engine.js:74 | buildRecommendation(...) | Current price, fair values, quality, risk, dilution, data quality | BUY/HOLD/SELL/INSUFFICIENT_DATA, confidence, investmentScore, gates | buildMonitoringChecklist |
| Monitoring | src/analystBrain/engine.js:75 | buildMonitoringChecklist(evidence, classification, forecastPolicy, language) | Evidence, classification, base forecast | 5-8 monitoring items | buildReport |
| JSON assembly | src/analystBrain/engine.js:76 | buildReport(...) | All pipeline outputs | Canonical report object | validateCanonicalReport |
| Internal validation | src/analystBrain/engine.js:681 | validateCanonicalReport(report) | Report object | validation.valid/errors | returned to workflow |
| Schema validation | src/analystBrain/schemaValidator.js:23 | validateAnalystBrainOutput(report, schema) | Report and optional methodology schema | valid/errors | createVersion if valid |
| Report rendering | src/ui/components.js:652 | investmentReportExperience(workspace,state) | Workspace report | Report-first UI with collapsible details | approval handler if user approves |
| Approval/export | src/valuationWorkflow/workflow.js:534 | approveWorkspaceValuation(workspace, investorNotes) | Generated report and investor approval | approved workspace + evaluatedCompany | exportApprovedValuation |
