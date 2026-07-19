# RECOMMENDATION_TEST_MAP

Primary suite:

```text
tests/version9_1AnalyticalEngine.test.mjs
```

| Requirement | Coverage |
|---|---|
| BUY succeeds when all mandatory gates pass | `cleanBuyReport.finalDecision.decision === "BUY"` |
| BUY fails when Balance Sheet gate fails | `balanceSheetGateReport` asserts `balanceSheetAcceptable === false` and decision is not BUY |
| BUY fails when Risk gate fails | `riskGateReport` asserts `riskAcceptable === false` and decision is not BUY |
| BUY fails when Forecast Confidence gate is removed | Source contract asserts `forecastConfidence` remains in `mandatoryBuyGates` |
| BUY fails when Data Quality gate fails | `dataQualityGateReport` asserts `dataQuality === false` and decision is not BUY |
| BUY fails when Internal Valuation is missing | `externalOnlyReport` asserts `hasInternalValuation === false` and `INSUFFICIENT_DATA` |
| BUY fails when Margin of Safety fails | `marginGateReport` asserts `marginOfSafety === false` and `HOLD` |
| BUY fails when critical conflicts exist | `conflictReport` asserts critical conflict codes and validator rejection |
| SELL triggers at correct downside boundary | `sellBoundaryHold` above -15% remains HOLD; `sellBoundarySell` at or below -15% becomes SELL |
| SELL triggers for very low Business Quality | `lowBusinessQualityReport` asserts score below 40 and SELL |
| INSUFFICIENT_DATA triggers when no supported model exists | Financial Institution, REIT, and Holding Company loop asserts `NO_SUPPORTED_MODEL` and `INSUFFICIENT_DATA` |
| HOLD when neither BUY nor SELL conditions are met | `marginGateReport` and `sellBoundaryHold` assert HOLD |

Mutation proof:

```text
raw-test-output-final/05_mutation_recommendation_balance_sheet_gate.txt
```

The mutation removed `balanceSheetAcceptable` from mandatory BUY gates and the suite failed.
