# Supported Valuation Models

Version 9 allows only implemented models to be selected. Unsupported models are documented but not shown as selectable report models.

## Implemented Models

| Model | Implemented? | Data Requirements | Formula | Selection Rule | Rejection Rule | Code File | Test Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DCF | Yes | positive Free Cash Flow, diluted shares, forecast rows, WACC, Terminal Growth, cash/debt | `(PV Year 1-5 FCF + PV Terminal Value + Cash - Debt) / diluted shares` | Non-financial, non-REIT, non-holding companies with positive FCF and shares | Missing/negative FCF, missing shares, Financial Institution, REIT, Holding Company | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth and cyclical cases include DCF |
| P/E | Yes | positive EPS, peer/historical P/E or methodology default | `EPS * P/E multiple` | Positive EPS | Missing/negative EPS | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth, bank, REIT, holding cases |
| PEG | Yes | profitable growth classification, positive EPS, revenue growth, PEG multiple/default | `EPS * growth percent * PEG` | High Growth - Profitable only | Not profitable growth or missing EPS | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth case |
| EV/EBITDA | Yes | EBITDA, diluted shares, cash, debt, peer/historical EV/EBITDA or methodology default | `(EBITDA * EV/EBITDA multiple + Cash - Debt) / diluted shares` | Non-financial, non-REIT company with positive EBITDA and shares | Financial Institution, REIT, missing EBITDA, missing shares | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: cyclical and capital-intensive cases |
| EV/Sales | Yes | Revenue, diluted shares, cash, debt, peer/historical EV/Sales or methodology default | `(Revenue * EV/Sales multiple + Cash - Debt) / diluted shares` | Non-financial, non-REIT, non-holding company with positive Revenue and shares | Financial Institution, REIT, Holding Company, missing Revenue, missing shares | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth and cyclical cases |
| Forward EV/Sales | Yes | forward Revenue or Year 1 Revenue, diluted shares, cash, debt, forward EV/Sales multiple/default | `(Forward Revenue * Forward EV/Sales multiple + Cash - Debt) / diluted shares` | Transition-to-profitability or early-stage company | Not transition/early-stage, missing forward Revenue, missing shares | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: unprofitable transition case |
| Price/FCF | Yes | positive FCF, diluted shares, peer/historical Price/FCF or methodology default | `FCF * Price/FCF multiple / diluted shares` | Positive FCF and shares | Missing/negative FCF, missing shares | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth, REIT, holding cases |
| Morningstar Fair Value | Yes as external reference | supplied Morningstar Fair Value | `supplied value` | Supplied positive value | Missing value | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth and external-only cases |
| Analyst Consensus | Yes as external reference | supplied analyst target average | `supplied value` | Supplied positive value | Missing value | `src/analystBrain/engine.js` | `tests/investmentAnalystBrain.test.mjs`: profitable growth, bank, external-only cases |

## Unsupported Models

These models are not selectable in Version 9 because deterministic implementations and required input contracts are not present:

| Model | Implemented? | Runtime Behavior |
| --- | --- | --- |
| P/B | No | Not selected and not displayed as a selectable report model |
| Residual Income | No | Not selected and not displayed as a selectable report model |
| DDM | No | Not selected and not displayed as a selectable report model |
| AFFO | No | Not selected and not displayed as a selectable report model |
| NAV | No | Not selected and not displayed as a selectable report model |
| Dividend Yield | No | Not selected and not displayed as a selectable report model |
| Cap Rate | No | Not selected and not displayed as a selectable report model |
| Sum of the Parts | No | Not selected and not displayed as a selectable report model |

## Enforcement

Runtime enforcement:

```text
SUPPORTED_MODELS
UNSUPPORTED_MODELS
selectAndValueModels()
validateAnalystBrainOutput()
```

Test enforcement:

```text
tests/investmentAnalystBrain.test.mjs
```

Negative tests reject unsupported selected models, overweight models, overweight external references, invalid probabilities, invalid forecast row counts, and unsupported Exceptional fair values.
