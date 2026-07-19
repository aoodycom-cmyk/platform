# Code Audit Disclosures - Version 9

No issue below was fixed during this audit.

| Problem | File | Function | Severity | Potential Impact |
| --- | --- | --- | --- | --- |
| DCF formula lacks mutation protection | public/src/analystBrain/engine.js | dcfFairValuePerShare | High | Incorrect DCF math could pass current test suite. |
| Model suitability list is not enforced by actual model selection | public/src/analystBrain/engine.js | suitableModelsFor vs selectAndValueModels | High | Reported suitable models may not be a true gate for selected models. |
| Legacy model universe still lists unsupported models | src/valuationWorkflow/workflow.js | MODEL_UNIVERSE / suitableModelsFor | High | Legacy UI/report paths can mention unsupported model names. |
| Balance sheet gate not in BUY condition | src/analystBrain/engine.js | buildRecommendation | Medium | Balance-sheet issues are indirect through risk rather than a hard BUY blocker. |
| WACC guardrail not independently validated by schema validator | src/analystBrain/schemaValidator.js | validateNestedPayload | Medium | Manually altered report JSON could include WACC outside methodology guardrail. |
| Fair value consistency not recomputed by validator | src/analystBrain/schemaValidator.js | validateNestedPayload | Medium | Validator checks shape/limits more than arithmetic consistency. |
| Canonical conflicting data list is empty | src/analystBrain/engine.js | buildDataQuality | Medium | Conflicting evidence is not currently detected in one-paste workflow. |
| AI parser model hardcoded | src/providers/apiClient.js / server.mjs | openAiParserRequest | Low | OpenAI model changes require code/config awareness. |
| Silent parser/provider fallbacks | src/providers/apiClient.js | parseInvestmentAnalystBlock / searchCompanies / fetchResearchData | Medium | Failures may degrade to local/missing paths instead of a blocking error. |
