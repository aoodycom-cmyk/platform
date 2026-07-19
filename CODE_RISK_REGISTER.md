# Code Risk Register - Version 9

| Severity | Risk | Evidence | Potential Impact |
| --- | --- | --- | --- |
| High | DCF formula mutation was not detected by tests | raw-test-output/mutation-summary.json: dcf-present-value-formula detected=false | A material valuation formula regression could pass current tests. |
| High | Model suitability is advisory, not the enforcement point | Mutation disabling P/E in suitableModelsFor passed; selectAndValueModels independently calls valuePe. | Classification suitableModels can diverge from actual selected models. |
| High | Legacy workflow still contains unsupported model names | src/valuationWorkflow/workflow.js MODEL_UNIVERSE and legacy suitableModelsFor include P/B/AFFO/NAV/Sum of Parts. | Legacy report metadata may show models not implemented in canonical V9. |
| Medium | Balance-sheet gate calculated but not directly used in BUY branch | buildRecommendation computes balanceSheetAcceptable but BUY condition omits it. | A BUY can rely on riskScore rather than a hard balance-sheet gate. |
| Medium | Hardcoded assumptions live in code | CLASS_DEFAULTS, MODEL_BASE_WEIGHTS, scenario adjustments, WACC constants. | Methodology changes require code edits and can drift from docs. |
| Medium | WACC and fair value consistency are not independently recomputed by validator | schemaValidator checks finite values and caps but not calculation recomputation. | Tampered JSON could pass some checks if values remain finite. |
| Medium | Silent fallbacks in provider/parser paths | apiClient catches provider/OpenAI failures and returns local parser/unavailable output. | User may receive reduced data quality without an explicit hard stop. |
| Medium | Conflicting data in canonical data quality is always empty | buildDataQuality returns conflictingData: []. | Conflicts between sources are not surfaced in canonical one-paste reports. |
| Medium | Holding vs Financial classification priority | If sector says Financial Services and industry says Holding Company, Financial Institution wins. | Holding companies in financial sector can be misclassified. |
| Low | Dynamic valuationDate | new Date() is used in report generation. | Golden full snapshots can change by date. Stable audited fields avoid this. |
| Low | Duplicate source/public/docs copies | src, public/src, docs/src contain mirrored logic. | Risk of drift if one copy is updated without the others. |
