# Legacy Code Audit - Version 9

No business logic was changed for this audit.

| Module / Function | Classification | Evidence | Impact |
| --- | --- | --- | --- |
| src/valuationWorkflow/workflow.js:createValuationWorkspace / data review / approval | ACTIVE | Called by store and canonical one-paste path. | Shared shell remains active. |
| src/valuationWorkflow/workflow.js:runInvestmentAnalystBrainValuation | ACTIVE | Directly calls runAnalystBrainEngine at line 279 | Canonical V9 bridge. |
| src/valuationWorkflow/workflow.js:runFixedMethodologyValuation | PARTIALLY ACTIVE | Still imported and callable by store.runWorkspaceValuation and V7/V8 tests. | Legacy V7/V8 valuation can still run if UI action is used. |
| src/valuationWorkflow/workflow.js:buildAnalystBrainReport | DEAD CODE | No call sites found by search except its own definition. | Old wrapper remains but is not used by canonical V9 path. |
| src/valuationWorkflow/workflow.js legacy classifyCompany/suitableModelsFor/selectValuationModels/buildReport | PARTIALLY ACTIVE | Called by runFixedMethodologyValuation. | Contains model universe names not implemented in canonical V9. |
| src/engines/valuationEngine.js | PARTIALLY ACTIVE | Used by old runEquityResearch stack, not by runAnalystBrainEngine. | Legacy dashboard/research calculations remain beside V9. |
| src/engines/decisionEngine.js | PARTIALLY ACTIVE | Used by old runEquityResearch stack. | Legacy decision output is separate from V9 recommendation. |
| src/engines/scoringEngines.js | PARTIALLY ACTIVE | Used by old runEquityResearch stack. | Legacy quality/growth/risk scores are not canonical V9 scores. |
| src/ui/components.js fixedReportPanel and legacy report branches | PARTIALLY ACTIVE | UI can render both legacy and canonical report shapes. | Mixed renderer increases audit complexity. |
| src/dataPlatform/* | ACTIVE | Used by provider fetch/company state; not the calculation source in one-paste V9. | No direct business logic conflict, but data path differs from one-paste evidence path. |

## Direct Answers

- Is Investment Analyst Brain still wrapping Legacy Report? **No for the canonical one-paste path.** `runInvestmentAnalystBrainValuation()` calls `runAnalystBrainEngine()` directly. **However**, `buildAnalystBrainReport()` remains as dead legacy wrapper code in `workflow.js`.
- Does Recommendation still call legacy logic? **No for V9 canonical reports.** It uses `buildRecommendation()` in `src/analystBrain/engine.js`. The old `recommendationFromUpside()` remains in the legacy path.
- Does Valuation still depend on old engine? **No for V9 canonical reports.** DCF/multiples are implemented inside `src/analystBrain/engine.js`. The legacy valuation engine and workflow still exist and are partially active outside the canonical path.
