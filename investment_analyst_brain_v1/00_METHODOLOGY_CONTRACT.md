# Methodology Contract v1.1

Canonical execution version: `investment-analyst-brain-v1.1-canonical`

## Precedence

1. This methodology contract controls the application implementation.
2. The detailed `01` through `12` Investment Analyst Brain files provide the policy source of truth.
3. The Version 9 gap-analysis / Master Brain v1.1 brief clarifies required corrections and acceptance criteria.
4. Prior legacy valuation workflow behavior remains available only for backward compatibility tests and must not drive the Version 9 Investment Analyst Brain report.

## Required Pipeline

The Version 9 report must be built through this deterministic pipeline:

```text
parse
-> evidence normalization
-> classification
-> business quality
-> yearly forecast
-> model selection
-> valuation
-> recommendation
-> monitoring
-> report
```

AI may parse explicitly supplied data and write explanations. AI must not calculate fair value, WACC, model weights, scenario values, investment score, or recommendation.

## Supported Valuation Models

Supported when required inputs are present:

- DCF
- P/E
- PEG
- EV/EBITDA
- EV/Sales
- Forward EV/Sales
- Price/FCF
- Morningstar Fair Value as external reference
- Analyst Consensus as external reference

Unsupported until fully implemented:

- P/B
- Residual Income
- DDM
- AFFO
- NAV
- Dividend Yield
- Cap Rate
- Sum of the Parts

Unsupported models must be shown only as excluded or unsupported. They must never be selected or assigned fair value.

## Validation Rules

- Conservative + Base + Optimistic probabilities must total 100%.
- Exceptional scenario is omitted unless company-specific evidence supports it.
- No model may exceed 45% weight without explicit override and explanation.
- Morningstar plus Analyst Consensus normally must not exceed 25% combined.
- Every selected model must have required inputs, deterministic calculation, assumptions, source, confidence, and fair value.
- Forecasts must contain Year 1 through Year 5 values for Revenue, margin, tax, D&A, CapEx, working capital, dilution, shares, and FCF.
- Recommendation must use margin of safety, business quality, forecast confidence, data quality, risk, dilution, balance sheet, and scenario asymmetry.
- Missing critical data must return `INSUFFICIENT_DATA` or block model selection.
