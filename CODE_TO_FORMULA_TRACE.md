# Code To Formula Trace - Version 9

This file traces the documented formulas to the code that actually runs and to golden-case outputs. No production code was changed.

## Trace Table

| Formula | Code Location | Function | Formula | Expected Value | Actual Value |
| --- | --- | --- | --- | --- | --- |
| DCF yearly PV | src/analystBrain/engine.js:934 | dcfFairValuePerShare | sum(FCF_year / (1 + WACC)^year) | $1,557,344,269.9211 | $1,557,344,269.9211 |
| Terminal Value | src/analystBrain/engine.js:941 | dcfFairValuePerShare | Year5 FCF * (1 + g) / max(WACC - g, 1%) | $8,172,690,389.3535 | $8,172,690,389.3535 |
| Present Value of Terminal Value | src/analystBrain/engine.js:942 | dcfFairValuePerShare | Terminal Value / (1 + WACC)^5 | $5,410,232,392.9997 | $5,410,232,392.9997 |
| Equity Value | src/analystBrain/engine.js:943 | dcfFairValuePerShare | PV FCF + PV Terminal + Cash - Debt | $7,567,576,662.9207 | $7,567,576,662.9207 |
| Per Share Value | src/analystBrain/engine.js:943 | dcfFairValuePerShare | Equity Value / diluted shares | $37.0901 | $37.0901 |
| P/E | src/analystBrain/engine.js:728 | valuePe | EPS * P/E multiple | $42 | $42 |
| EV/EBITDA | src/analystBrain/engine.js:742 | valueEvEbitda -> equityValueFromEv | (EBITDA * multiple + cash - debt) / diluted shares | $41.6667 | $41.6667 |
| EV/Sales | src/analystBrain/engine.js:749 | valueEvSales -> equityValueFromEv | (Revenue * multiple + cash - debt) / diluted shares | $63 | $63 |
| Probability Weighted Fair Value | src/analystBrain/engine.js:1004 | scenarioExpectedValue -> calculateRangeFairValue | Conservative*25% + Base*50% + Optimistic*25% | $38.5026 | $38.5026 |
| Margin of Safety | src/domain/evaluatedCompanies.js:87 | calculateUpside | (Fair Value - Current Price) / Current Price | 37.55% | 37.55% |

## DCF Worked Example - profitable-growth / Base Scenario

Inputs:

- Current Price: $28
- WACC: 8.60%
- Terminal Growth: 3.00%
- Cash: $800,000,000
- Debt: $200,000,000
- Ending diluted shares: 204,032,128

Yearly FCF present values:

| Year | FCF | Discount Formula | PV |
| --- | --- | --- | --- |
| 1 | $338,437,500 | $338,437,500 / (1 + 8.60%)^1 | $311,636,740.3315 |
| 2 | $377,592,150 | $377,592,150 / (1 + 8.60%)^2 | $320,157,224.5454 |
| 3 | $410,013,387 | $410,013,387 / (1 + 8.60%)^3 | $320,116,869.354 |
| 4 | $432,989,460.33 | $432,989,460.33 / (1 + 8.60%)^4 | $311,284,878.4009 |
| 5 | $444,340,448.3532 | $444,340,448.3532 / (1 + 8.60%)^5 | $294,148,557.2893 |

DCF bridge:

- PV of Year 1-5 FCF = $1,557,344,269.9211
- Terminal FCF = $457,670,661.8038
- Terminal Value = $8,172,690,389.3535
- PV Terminal Value = $5,410,232,392.9997
- Equity Value = $1,557,344,269.9211 + $5,410,232,392.9997 + $800,000,000 - $200,000,000 = $7,567,576,662.9207
- Per Share Value = $7,567,576,662.9207 / 204,032,128 = $37.0901

## Audit Note

The formula trace maps formulas to code and actual output. Mutation testing shows the current automated tests do **not** fail when yearly DCF discounting is removed, so this trace is documentary evidence, not a sufficient automated proof.
