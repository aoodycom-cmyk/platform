# Mutation Test Results - Version 9

Production code was restored after each temporary mutation. Mutation raw outputs are stored in `raw-test-output/`.

| Mutation | Temporary Change | Detected? | Exit Code | Failed Test | Interpretation |
| --- | --- | --- | --- | --- | --- |
| dcf-present-value-formula | DCF mutation removes present-value discounting for yearly FCF. | NO | 0 | - | Current tests did not catch this mutation. Add stronger assertions. |
| recommendation-internal-valuation-gate | Recommendation mutation disables the hasInternalValuation insufficient-data gate. | YES | 1 | --experimental-vm-modules tests/investmentAnalystBrain.test.mjs | Current tests caught this mutation. |
| model-selection-pe-rule | Model selection mutation prevents P/E from being selected when EPS is positive. | NO | 0 | - | Current tests did not catch this mutation. Add stronger assertions. |

## Findings

- DCF formula mutation: **NOT DETECTED**. Removing yearly FCF discounting did not fail the suite.
- Recommendation internal valuation gate mutation: **DETECTED**. The Analyst Brain test caught the change through the external-only insufficient-data case.
- Model selection P/E suitability mutation: **NOT DETECTED**. This revealed that `suitableModelsFor()` is not the sole enforcement path for selected models; `selectAndValueModels()` calls `valuePe()` independently.
