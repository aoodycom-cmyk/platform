# MODEL_SELECTION_TEST_MAP

Primary suites:

```text
tests/investmentAnalystBrain.test.mjs
tests/version9_1AnalyticalEngine.test.mjs
```

| Requirement | Coverage |
|---|---|
| DCF requires positive FCF | `negativeFcfReport` asserts DCF is not selected |
| Price/FCF requires positive FCF | `negativeFcfReport` asserts Price/FCF is not selected |
| P/E requires positive EPS | `negativeFcfReport` has negative EPS and asserts P/E is not selected |
| PEG requires profitable high-growth classification | `matureNoPegReport` asserts P/E selected but PEG not selected |
| EV/EBITDA requires valid EBITDA and shares | `missingEbitdaReport` asserts EV/EBITDA is not selected |
| EV/Sales requires valid Revenue and shares | `missingRevenueReport` asserts EV/Sales is not selected |
| Unsupported models never enter selectedModels | Loop asserts selected model is in `SUPPORTED_MODELS` and not in `UNSUPPORTED_MODELS` |
| Financial Institution returns NO_SUPPORTED_MODEL | Financial Institution loop case |
| REIT returns NO_SUPPORTED_MODEL | REIT loop case |
| Holding Company returns NO_SUPPORTED_MODEL | Holding Company loop case |

Mutation proof:

```text
raw-test-output-final/04_mutation_model_selection_no_supported_guard.txt
```

The mutation bypassed the no-supported-model class guard and the suite failed.
