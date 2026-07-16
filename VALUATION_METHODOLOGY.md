# Fixed Valuation Methodology

Methodology version: `fixed-methodology-2026.07`

## Objective

The methodology answers: should the investor approve this valuation for the Home dashboard?

It does not create a final dashboard row until the investor approves the report.

## Required Inputs

Critical fields:

- Ticker
- Company Name
- Current Price
- Revenue
- Operating Income
- Free Cash Flow
- Diluted Shares Outstanding

Additional fields improve confidence:

- Market Capitalization
- Enterprise Value
- Cash
- Total Debt
- EBITDA
- EPS
- CapEx
- Morningstar Fair Value
- Analyst Consensus
- Qualitative research

## Classification

The workflow classifies companies deterministically:

- Mature Cash Generator
- High-Growth Profitable Company
- Cyclical Company
- Capital-Intensive Company
- Financial Institution
- Early-Stage Growth Company
- Commodity Company
- Holding Company / Conglomerate
- REIT
- Unprofitable Growth Company

Classification determines which valuation methods are suitable.

## Model Selection

Supported methods:

- DCF
- Reverse DCF
- P/E
- PEG
- EV/EBITDA
- EV/Sales
- Price/FCF
- Morningstar Fair Value
- Analyst Consensus

Models are excluded when required inputs are missing or the company classification makes the model inappropriate.

## WACC

WACC is calculated from:

- Risk-free rate
- Equity risk premium
- Classification beta
- Cost of equity
- Pre-tax cost of debt
- Tax rate
- Debt weight
- Equity weight

If exact market inputs are missing, the methodology uses approved defaults and labels them as methodology assumptions.

## FCF Forecast

The FCF bridge uses:

- Revenue
- Revenue Growth
- Operating Margin
- Operating Income
- Tax
- NOPAT
- D&A
- CapEx
- Working Capital Change
- Free Cash Flow

The workflow does not use one unexplained constant FCF growth rate. Forecast assumptions are derived from confirmed data when available, otherwise from the classification policy with reduced confidence.

## CapEx Priority

CapEx is selected in this order:

1. Company CapEx guidance
2. Management commentary
3. Historical CapEx as % of Revenue
4. Historical CapEx growth
5. Sector/classification default

The report labels the chosen source.

## Scenarios

Bear / Base / Bull scenarios include:

- Revenue assumptions
- Margin assumptions
- FCF assumptions
- CapEx assumptions
- WACC
- Terminal Growth
- Exit Multiple
- Fair Value
- Probability
- Key risks
- Key catalysts

Scenario probabilities must total 100%.

## Recommendation

The final decision is deterministic:

- BUY when expected upside is strong and data quality passes the threshold.
- SELL when downside is material.
- HOLD when upside, downside, or data quality is not decisive.

AI is not allowed to alter these calculations.
