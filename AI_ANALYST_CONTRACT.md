# AI Analyst Contract

The AI analyst is a controlled parsing and explanation layer. It is not the calculation engine.

## Allowed AI Responsibilities

- Extract explicit fields from one pasted company-data block.
- Explain assumptions.
- Summarize risks and catalysts from supplied data.
- Produce Arabic narrative explanations after deterministic calculations are complete.

## Deterministic Code Responsibilities

- Financial formulas
- DCF calculations
- WACC arithmetic
- Scenario math
- Multiples
- Fair value aggregation
- Upside calculations
- Investment scores
- Company classification
- Business Quality score
- Model selection
- Ranking
- Data completeness
- Recommendation
- Monitoring checklist
- Approval and export workflow

## JSON Rules

Analyst Brain output must be JSON first and must conform to the canonical methodology contract.

The platform validates:

- Required fields
- Canonical methodology version
- Scenario probabilities total 100%
- Five Year 1-5 forecast rows
- Selected models are supported
- Single-model weight does not exceed 45%
- External references do not exceed 25% combined weight
- WACC, growth, CapEx, margin, terminal value, and dilution rationale exists
- No unsupported models are selected
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

## Canonical Methodology Contract

Version 9.1 uses:

```text
investment-analyst-brain-v1.1-canonical
```

The deterministic pipeline is:

```text
parse -> evidence normalization -> classification -> business quality -> yearly forecast -> model selection -> valuation -> recommendation -> monitoring -> report
```

External references such as Morningstar Fair Value and Analyst Consensus are references, not standalone valuation engines. If no internal valuation model is available, the recommendation must be `INSUFFICIENT_DATA`.
