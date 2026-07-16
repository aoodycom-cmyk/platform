# AI Analyst Contract

The AI analyst is a controlled explanation layer. It is not the calculation engine.

## Allowed AI Responsibilities

- Classify the company using supplied evidence.
- Select methodology according to fixed policy.
- Explain assumptions.
- Summarize risks and catalysts from supplied data.
- Produce a structured written report that conforms to `VALUATION_OUTPUT_SCHEMA.json`.

## Deterministic Code Responsibilities

- Financial formulas
- DCF calculations
- WACC arithmetic
- Scenario math
- Multiples
- Fair value aggregation
- Upside calculations
- Investment scores
- Ranking
- Data completeness
- Approval and export workflow

## JSON Rules

AI output must be JSON first.

The platform validates:

- Required fields
- Number ranges
- Scenario probabilities total 100%
- WACC, growth, CapEx, margin, terminal value, and dilution rationale exists
- No unsupported numeric assumptions
- No invented source citations

Invalid output is rejected.

## Language Rules

Arabic mode:

- Analysis, recommendations, and explanations are Arabic.
- Standard financial terms remain English where appropriate, such as WACC, DCF, FCF, ROIC, EBITDA, CapEx, EPS, P/E, EV/EBITDA, Terminal Growth, Bear, Base, and Bull.

English mode:

- The report is complete English and LTR.

## Source Rules

The AI cannot create company data. Every numeric company value must come from:

- Confirmed manual input
- Confirmed parsed input
- Verified provider data
- Clearly labeled methodology default
- Clearly labeled investor override
