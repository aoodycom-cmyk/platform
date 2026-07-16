# Investment Report Experience V8

Version 8 changes presentation only.

It does not redesign:

- Investment Engine
- Data Platform
- Workflow
- Valuation Methodology
- Ranking Engine
- Comparison Engine
- Approval system

## Product Goal

The application should feel like an institutional investment report generator, not a financial calculator.

After a valuation is generated, the report becomes the first screen:

```text
Search
  ↓
Workspace data collection
  ↓
Run Valuation Analyst
  ↓
Investment Report first
  ↓
Optional collapsed details
  ↓
Approve and Export
```

## Report Order

The visible report appears in this order:

1. Company, ticker, valuation date, methodology
2. Quick Summary Card
3. Executive Summary
4. Investment Thesis
5. Valuation Summary
6. Decision
7. What Could Change This Decision
8. Collapsed technical detail sections

## Quick Summary Card

The quick card shows:

- Recommendation
- Confidence
- Investment Score
- Fair Value
- Current Price
- Upside
- Maximum Upside

## Collapsed Sections

The following are collapsed by default:

- Assumptions
- DCF
- WACC
- Revenue Forecast
- Free Cash Flow Forecast
- CapEx Forecast
- Margins
- Terminal Growth
- Valuation Models
- Financial Statements
- Analyst Estimates
- Morningstar
- Risks
- Catalysts
- Historical Charts
- Sources
- Input Data
- Data Review
- Methodology Overrides
- Version History

## Success Standard

A first-time investor should understand the recommendation, fair value, upside, confidence, and main thesis within 30 seconds without opening a technical section.
