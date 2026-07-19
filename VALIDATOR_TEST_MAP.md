# VALIDATOR_TEST_MAP

Primary suites:

```text
tests/investmentAnalystBrain.test.mjs
tests/version9_1AnalyticalEngine.test.mjs
```

| Rejection requirement | Coverage |
|---|---|
| Probabilities not equal to 100% | `badProbabilities` |
| Model weights above limits | `badModelWeight` and prior `badWeight` |
| External references above 25% | `badExternalWeight` |
| Unsupported models | `badUnsupportedModel` |
| Incorrect DCF fair value | `badDcf` |
| Incorrect EV/EBITDA fair value | `badEvEbitda` |
| Incorrect EV/Sales fair value | `badEvSales` |
| Incorrect weighted fair value | `badWeightedFairValue` |
| WACC outside guardrails | `badWacc` |
| Unordered scenario values | `badOrder` |
| Currency mismatch | `badCurrency` |
| Critical unresolved conflicts | `badCriticalConflict` and `conflictReport` |
| Exceptional fair value without evidence | `badExceptional` |

Mutation proof:

```text
raw-test-output-final/06_mutation_validator_probability_total.txt
```

The mutation disabled probability-total validation and the suite failed.
