# Coverage Report - Version 9 Code Audit

Command source: `raw-test-output/coverage.terminal.txt`.

## Summary

| File | Line % | Branch % | Function % |
| --- | --- | --- | --- |
| engine.js | 97.63 | 77.49 | 100.00 |
| methodology.js | 42.67 | 100.00 | 0.00 |
| schemaValidator.js | 96.55 | 35.42 | 100.00 |
| fields.js | 31.93 | 50.00 | 16.67 |
| evaluatedCompanies.js | 32.62 | 86.67 | 54.55 |
| financialMetrics.js | 31.10 | 80.95 | 35.00 |
| marketColorSystem.js | 83.10 | 82.61 | 75.00 |
| rankingEngine.js | 86.96 | 79.17 | 88.89 |
| language.js | 71.94 | 70.59 | 17.86 |
| workflow.js | 80.69 | 56.22 | 81.21 |
| all files | 78.79 | 68.67 | 77.69 |

## Required Coverage Categories

- Statement Coverage: Node's built-in report exposes line coverage, not a separate statement coverage metric. Use line coverage as the closest available proxy. Overall line coverage: **78.79%**.
- Branch Coverage: **68.67%** from Node built-in coverage.
- Function Coverage: **77.69%**.
- Line Coverage: **78.79%**.

## Untested Public Source Files In Coverage Run

- public/src/data/sampleData.js
- public/src/dataPlatform/dataPlatform.js
- public/src/dataPlatform/providerContracts.js
- public/src/engines/dataCompletenessEngine.js
- public/src/engines/decisionEngine.js
- public/src/engines/engineUtils.js
- public/src/engines/explainabilityEngine.js
- public/src/engines/researchEngine.js
- public/src/engines/scoringEngines.js
- public/src/engines/valuationEngine.js
- public/src/main.js
- public/src/providers/apiClient.js
- public/src/research/institutionalResearch.js
- public/src/state/store.js
- public/src/ui/components.js

## Critical Uncovered Logic

- Exact DCF numerical formula is not protected by current assertions. Mutation removing discounting still passed.
- Model suitability list is not the enforcement point for selected models. Mutation disabling P/E in `suitableModelsFor()` still passed because `selectAndValueModels()` independently calls `valuePe()`.
- Methodology loader has low function coverage because tests do not simulate fetch success/failure deeply.
- Schema validator branch coverage is limited; it catches known bad payloads but does not fuzz nested schema variants.
- Legacy workflow sections remain partially covered by V7/V8 tests but not at institutional audit depth.
