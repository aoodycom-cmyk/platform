# Valuation Calculation Audit

This audit uses generated Version 9 sample reports from:

```text
version_9_evidence/sample-reports/
```

All examples are deterministic outputs from `src/analystBrain/engine.js`.

## 1. DCF Example

Company: `GROW`

Inputs:

| Input | Value |
| --- | ---: |
| Cash | 1,800,000,000 |
| Debt | 300,000,000 |
| Net Cash | 1,500,000,000 |
| WACC | 8.6% |
| Terminal Growth | 3.0% |
| Ending diluted shares | 204,032,128 |

Forecast and discounting:

| Year | FCF | Discount Formula | PV |
| --- | ---: | --- | ---: |
| 1 | 327,504,000 | `327,504,000 / (1 + 0.086)^1` | 301,569,061 |
| 2 | 369,748,260 | `369,748,260 / (1 + 0.086)^2` | 313,506,456 |
| 3 | 405,439,845 | `405,439,845 / (1 + 0.086)^3` | 316,546,088 |
| 4 | 431,417,436 | `431,417,436 / (1 + 0.086)^4` | 310,154,718 |
| 5 | 445,058,133 | `445,058,133 / (1 + 0.086)^5` | 294,623,657 |

Steps:

```text
PV Year 1-5 FCF = 1,536,399,980
Terminal FCF = 445,058,133 * (1 + 0.03) = 458,409,877
Terminal Value = 458,409,877 / (0.086 - 0.03) = 8,185,890,655
PV Terminal Value = 8,185,890,655 / (1 + 0.086)^5 = 5,418,970,826
Equity Value = 1,536,399,980 + 5,418,970,826 + 1,500,000,000 = 8,455,370,806
DCF Fair Value = 8,455,370,806 / 204,032,128 = 41.44
```

Result:

```text
DCF Fair Value = $41.44
```

## 2. P/E Example

Company: `GROW`

Inputs:

| Input | Value |
| --- | ---: |
| EPS | 3.00 |
| P/E multiple | 26.0 |

Formula:

```text
Fair Value = EPS * P/E multiple
Fair Value = 3.00 * 26.0 = 78.00
```

Result:

```text
P/E Fair Value = $78.00
```

## 3. EV/EBITDA Example

Company: `CYC`

Inputs:

| Input | Value |
| --- | ---: |
| EBITDA | 660,000,000 |
| EV/EBITDA multiple | 8.0 |
| Cash | 500,000,000 |
| Debt | 700,000,000 |
| Diluted shares | 120,000,000 |

Formula:

```text
Enterprise Value = EBITDA * EV/EBITDA multiple
Enterprise Value = 660,000,000 * 8.0 = 5,280,000,000
Equity Value = Enterprise Value + Cash - Debt
Equity Value = 5,280,000,000 + 500,000,000 - 700,000,000 = 5,080,000,000
Fair Value = 5,080,000,000 / 120,000,000 = 42.33
```

Result:

```text
EV/EBITDA Fair Value = $42.33
```

## 4. EV/Sales Example

Company: `GROW`

Inputs:

| Input | Value |
| --- | ---: |
| Revenue | 1,500,000,000 |
| EV/Sales multiple | 7.0 |
| Cash | 1,800,000,000 |
| Debt | 300,000,000 |
| Diluted shares | 200,000,000 |

Formula:

```text
Enterprise Value = Revenue * EV/Sales multiple
Enterprise Value = 1,500,000,000 * 7.0 = 10,500,000,000
Equity Value = Enterprise Value + Cash - Debt
Equity Value = 10,500,000,000 + 1,800,000,000 - 300,000,000 = 12,000,000,000
Fair Value = 12,000,000,000 / 200,000,000 = 60.00
```

Result:

```text
EV/Sales Fair Value = $60.00
```

## 5. Financial Institution Implemented Model Example

Specialized bank models such as P/B and Residual Income are NOT IMPLEMENTED in Version 9.

The implemented model used for the bank sample is P/E.

Company: `BANK`

Inputs:

| Input | Value |
| --- | ---: |
| EPS | 5.10 |
| P/E multiple | 10.5 |

Formula:

```text
Fair Value = EPS * P/E multiple
Fair Value = 5.10 * 10.5 = 53.55
```

Result:

```text
Bank P/E Fair Value = $53.55
```

## 6. REIT Implemented Model Example

Specialized REIT models such as AFFO and NAV are NOT IMPLEMENTED in Version 9.

The implemented model used for the REIT sample is Price/FCF.

Company: `REIT`

Inputs:

| Input | Value |
| --- | ---: |
| Free Cash Flow | 180,000,000 |
| Price/FCF multiple | 18.0 |
| Diluted shares | 200,000,000 |

Formula:

```text
Fair Value = FCF * Price/FCF multiple / diluted shares
Fair Value = 180,000,000 * 18.0 / 200,000,000 = 16.20
```

Result:

```text
REIT Price/FCF Fair Value = $16.20
```

## 7. Probability-Weighted Scenario Fair Value

Company: `GROW`

Inputs:

| Scenario | Probability | Fair Value |
| --- | ---: | ---: |
| Conservative | 25% | 27.69 |
| Base | 50% | 41.44 |
| Optimistic | 25% | 60.88 |

Formula:

```text
Probability-Weighted Fair Value =
  Conservative * 25%
  + Base * 50%
  + Optimistic * 25%

= 27.69 * 0.25 + 41.44 * 0.50 + 60.88 * 0.25
= 42.86
```

Result:

```text
Probability-Weighted Fair Value = $42.86
```
