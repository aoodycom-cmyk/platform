# MUTATION_TEST_RESULTS_V9.1_FINAL

All mutations were temporary and were restored after each run. The final clean run passed after mutation testing.

## Mutation Summary

| Mutation | File | Function | Expected | Actual | Raw output |
|---|---|---|---|---|---|
| DCF yearly discounting removed | public/src/analystBrain/engine.js | dcfFairValuePerShare | FAIL | FAILED, exit 1 | raw-test-output-final/02_mutation_dcf_discounting.txt |
| EV/EBITDA used Revenue instead of EBITDA | public/src/analystBrain/engine.js | valueEvEbitda | FAIL | FAILED, exit 1 | raw-test-output-final/03_mutation_ev_ebitda_uses_revenue.txt |
| NO_SUPPORTED_MODEL class guard bypassed | public/src/analystBrain/engine.js | suitableModelsFor | FAIL | FAILED, exit 1 | raw-test-output-final/04_mutation_model_selection_no_supported_guard.txt |
| balanceSheetAcceptable removed from mandatory BUY gates | public/src/analystBrain/engine.js | buildRecommendation | FAIL | FAILED, exit 1 | raw-test-output-final/05_mutation_recommendation_balance_sheet_gate.txt |
| Probability-total validator disabled | public/src/analystBrain/schemaValidator.js | validateNestedPayload | FAIL | FAILED, exit 1 | raw-test-output-final/06_mutation_validator_probability_total.txt |

## DCF Mutation

Exact mutation:

```js
pv += row.freeCashFlow;
```

instead of:

```js
pv += row.freeCashFlow / Math.pow(1 + wacc, row.year);
```

Failure detected:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'Selected model fair value is inconsistent with its assumptions: DCF.'
- undefined
```

Exit code: 1

## EV/EBITDA Mutation

Exact mutation:

```js
equityValueFromEv(v.revenue * multiple.value, v)
```

instead of:

```js
equityValueFromEv(v.ebitda * multiple.value, v)
```

Failure detected:

```text
+ 'Selected model fair value is inconsistent with its assumptions: EV/EBITDA. / Critical data conflicts must be resolved before validation.'
- undefined
```

Exit code: 1

## Model Selection Mutation

Exact mutation:

```js
if (false && NO_SUPPORTED_MODEL_CLASSES.has(classification)) return models;
```

instead of:

```js
if (NO_SUPPORTED_MODEL_CLASSES.has(classification)) return models;
```

Failure detected:

```text
AssertionError [ERR_ASSERTION]: BANK should generate without error
+ actual - expected

+ 'Critical data conflicts must be resolved before validation.'
- undefined
```

Exit code: 1

## Recommendation Mutation

Exact mutation:

```text
Removed "balanceSheetAcceptable" from mandatoryBuyGates.
```

Failure detected:

```text
AssertionError [ERR_ASSERTION]: mandatory BUY gate balanceSheetAcceptable must remain in source
```

Exit code: 1

## Validator Mutation

Exact mutation:

```js
if (false && Math.abs(probabilityTotal - 1) > 0.0001)
```

instead of:

```js
if (Math.abs(probabilityTotal - 1) > 0.0001)
```

Failure detected:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

true !== false
```

Exit code: 1

## Restoration Proof

Raw restoration proof:

```text
raw-test-output-final/08_restore_verification_hashes.txt
```

The analytical engine and schema validator matched across src, public, and docs after all temporary mutations were restored.
