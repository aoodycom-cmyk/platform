# JSON Schema Audit - Version 9

Validator audited: `src/analystBrain/schemaValidator.js` plus internal `validateCanonicalReport()` in `src/analystBrain/engine.js`.

| Validation Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Nested validation | PARTIAL | validateNestedPayload checks recommendation, scenarios, models, forecasts, monitoring. | Does not deeply validate all narrative/report sections or dashboardExport consistency. |
| Required fields | COMPLETED | ANALYST_BRAIN_REQUIRED_KEYS checked by validateAnalystBrainOutput. | Required fields are top-level; nested required fields are partial. |
| Probability totals | COMPLETED | Conservative + Base + Optimistic must equal 1. | Exceptional probability not part of total; explicitly expected to be 0 unless supported. |
| Model weight limits | COMPLETED | Individual selected model max 45% unless overrideReason; external refs combined max 25%. | Total model weights are not explicitly required to equal 1 in validator. |
| External reference limits | COMPLETED | externalWeight > 25% rejected. | External reference source freshness not validated. |
| Unsupported model rejection | COMPLETED | Selected model method must be in SUPPORTED_MODELS. | Legacy suitability metadata can still mention unsupported models outside canonical selectedModels. |
| Fair value consistency | PARTIAL | Selected model fairValue must be finite; report generated deterministically. | Validator does not recompute weighted fair value from selected models/scenarios. |
| WACC limits | PARTIAL | Engine clamps WACC and terminal growth during calculation. | Validator does not independently reject WACC outside guardrail if report JSON is manually tampered. |
| Missing validation | PARTIAL | Forecast rows require numeric fields; top-level sections required. | No deep source/confidence requirement for every field in final report. |

## Negative Tests Observed

`tests/investmentAnalystBrain.test.mjs` mutates selected model weight, external reference weight, scenario probabilities, forecast row count, and Exceptional fair value. All are rejected by `validateAnalystBrainOutput()`.
