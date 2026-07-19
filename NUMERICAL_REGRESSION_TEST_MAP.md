# NUMERICAL_REGRESSION_TEST_MAP

Primary suite:

```text
tests/version9_1AnalyticalEngine.test.mjs
```

Expected values are calculated in test fixtures with independent formulas, not by calling production valuation helpers.

| Requirement | Covered by |
|---|---|
| DCF | `independentDcfComponents()` and DCF fair value assertions |
| Terminal Value | Terminal FCF and terminal value assertions |
| Present Value of forecast FCF | `presentValue` fixture assertion |
| Present Value of Terminal Value | `presentTerminalValue` fixture assertion |
| Equity Value | `equityValue` fixture assertion |
| Per-share Fair Value | `perShareFairValue` fixture assertion |
| P/E | Hard-coded expected value `50` |
| PEG | Hard-coded expected value `33.6` |
| EV/EBITDA | Hard-coded expected value `49` |
| EV/Sales | Hard-coded expected value `54` |
| Forward EV/Sales | Covered in negative-FCF transition model-selection case |
| Price/FCF | Hard-coded expected value `35.2` |
| Morningstar weighting | Base-weight and confidence-weight loop includes Morningstar |
| Analyst Consensus weighting | Base-weight and confidence-weight loop includes Analyst Consensus |
| Weighted Fair Value | Independent `weightedFairValue()` assertion |
| Scenario Probability Weighted Fair Value | Independent Conservative/Base/Optimistic probability-weighted assertion |
| Margin of Safety | Independent `(fairValue - currentPrice) / currentPrice` assertion |

Key fixed numerical fixtures:

| Metric | Expected |
|---|---:|
| WACC | 0.086 |
| Terminal Growth | 0.03 |
| PV of forecast FCF | 993,639,828.1971937 |
| Terminal FCF | 296,111,043.5525934 |
| Terminal Value | 5,287,697,206.296311 |
| PV of Terminal Value | 3,500,398,197.7764688 |
| Equity Value | 4,894,038,025.973662 |
| DCF Fair Value per Share | 47.97320959009141 |
| Scenario Probability Weighted Fair Value | 49.805960266932274 |
| Margin of Safety fixture | -0.5019577823185997 |

Mutation proof:

| Numerical area | Mutation file |
|---|---|
| DCF discounting | raw-test-output-final/02_mutation_dcf_discounting.txt |
| EV/EBITDA formula | raw-test-output-final/03_mutation_ev_ebitda_uses_revenue.txt |
