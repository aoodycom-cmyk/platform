# Analytical Call Graph - Real Version 9 Execution Path

This graph follows the one-paste Investment Analyst Brain path. It excludes the old multi-form `runFixedMethodologyValuation()` path except where approval/export branches still share workflow utilities.

```mermaid
graph TD
  A["User paste block in analystBrainPastePanel"] --> B["src/ui/components.js bind(): analyze-brain"]
  B --> C["src/state/store.js runAnalystBrainValuation(pasteText)"]
  C --> D["loadAnalystBrainMethodology()"]
  C --> E["parseInvestmentAnalystBlock()"]
  E --> F["server.mjs handleInvestmentAnalystParse() or direct OpenAI fallback"]
  C --> G["runInvestmentAnalystBrainValuation(workspace, options)"]
  G --> H["parseOneBlockFields(text)"]
  H --> I["normalizeParsedFields([...local, ...AI])"]
  I --> J["applyParsedFields(workspace, fields, source)"]
  J --> K["runAnalystBrainEngine(reviewed, { language })"]
  K --> L["normalizeEvidence(workspace)"]
  L --> M["classifyCompany(evidence, language)"]
  M --> N["scoreBusinessQuality(evidence, classification, language)"]
  N --> O["buildForecastPolicy(evidence, classification, language)"]
  O --> P["buildWacc(evidence, classification, defaults, language)"]
  O --> Q["buildYearlyForecast(...)"]
  Q --> R["buildScenarios(evidence, classification, forecastPolicy, language)"]
  R --> S["dcfFairValuePerShare(...)"]
  R --> T["selectAndValueModels(evidence, classification, forecastPolicy, scenarios, language)"]
  T --> U["valueDcf / valuePe / valuePeg / valueEvEbitda / valueEvSales / valueForwardEvSales / valuePriceFcf / externalReference"]
  U --> V["applyModelWeights(models)"]
  V --> W["buildDataQuality(evidence, modelSelection)"]
  W --> X["buildRecommendation({ evidence, businessQuality, forecastPolicy, scenarios, modelSelection, dataQuality })"]
  X --> Y["buildMonitoringChecklist(evidence, classification, forecastPolicy, language)"]
  Y --> Z["buildReport(...)"]
  Z --> AA["validateCanonicalReport(report)"]
  AA --> AB["validateAnalystBrainOutput(report, schema)"]
  AB --> AC["createVersion(...Generated)"]
  AC --> AD["investmentReportExperience(workspace,state)"]
  AD --> AE["approveWorkspaceValuation(workspace, notes)"]
  AE --> AF["validateAnalystBrainOutput(workspace.report)"]
  AF --> AG["exportApprovedValuation(next, approvedVersion)"]
  AG --> AH["scoreEvaluatedCompany(base)"]
  AH --> AI["Home dashboard evaluatedCompanies"]
```

## Function Sequence

1. `src/state/store.js:178` `runAnalystBrainValuation` coordinates methodology load, optional AI parsing, and deterministic valuation.
2. `src/valuationWorkflow/workflow.js:261` `runInvestmentAnalystBrainValuation` merges local and AI parsed fields.
3. `src/analystBrain/engine.js:64` `runAnalystBrainEngine` executes the canonical deterministic pipeline.
4. `src/analystBrain/schemaValidator.js:23` validates the final JSON before accepting it.
5. `src/valuationWorkflow/workflow.js:534` exports only after investor approval.
