# Investment Engine - Version 3

## Core Rule

The investment engine is deterministic.

The same inputs must always produce the same outputs. AI is not allowed to calculate financial values or create assumptions. AI may only explain, summarize, or challenge assumptions in a future layer.

## Shared Engine Contract

Every engine returns:

- Inputs
- Formula
- Weighting
- Output
- Confidence
- Explanation
- Factors
- Missing inputs

## Data Completeness Engine

Purpose:

Determine whether the platform has enough data to issue an actionable decision.

Formula:

```text
score = available required-data weight / total required-data weight * 100
```

Weights:

- Current price: 12
- Market capitalization: 5
- Financial history: 15
- Revenue: 10
- Gross profit: 5
- Operating income: 8
- Net income: 5
- EPS: 8
- Free cash flow: 12
- Balance sheet: 10
- Diluted shares: 5
- Analyst consensus: 3
- Manual fair value: 2

Output:

- Score 0-100
- Rating: Complete, Usable, Limited, Insufficient
- `canIssueDecision` when score is at least 70

## Valuation Engine

Purpose:

Estimate fair value using multiple valuation methods. No single method controls the decision.

Composite formula:

```text
composite fair value = weighted average(method fair value, method weight * method confidence)
```

Base assumptions:

- DCF years: 5
- Discount rate: 9.5%
- Terminal growth: 3.0%
- Tax rate for ROIC/NOPAT: 18%
- Normalized growth floor: -5%
- Normalized growth ceiling: 24%
- Reverse DCF growth search range: -10% to 35%

Method weights:

- DCF: 26%
- P/E: 13%
- PEG: 9%
- EV/EBITDA: 12%
- EV/Sales: 8%
- Morningstar Fair Value: 16% when supplied
- Analyst Consensus: 16% when supplied

Required inputs:

- DCF: free cash flow, growth history, cash, debt, diluted shares
- P/E: EPS and growth history
- PEG: EPS and growth history
- EV/EBITDA: EBITDA, growth history, cash, debt, diluted shares
- EV/Sales: revenue, growth history, cash, debt, diluted shares
- Morningstar: manual fair value input
- Analyst Consensus: provider consensus target

If required inputs are missing, the method is skipped.

## Quality Engine

Purpose:

Score the durability and financial quality of the business.

Formula:

```text
score = clamp(50 + sum(factor impacts), 0, 100)
```

Factors:

- ROIC: -8 to +18
- Gross margin: -5 to +12
- Operating margin: -6 to +12
- FCF margin: -6 to +12
- Balance sheet: -12 to +10

Output:

- Quality score 0-100
- Confidence based on observed factor coverage

## Growth Engine

Formula:

```text
score = clamp(50 + sum(factor impacts), 0, 100)
```

Factors:

- Revenue growth: -8 to +18
- EPS growth: -8 to +14
- FCF growth: -7 to +12
- Margin profile: -8 to +8

## Management Engine

Formula:

```text
score = clamp(50 + sum(factor impacts), 0, 100)
```

Factors:

- Capital allocation: -10 to +9
- Buybacks: -3 to +8
- Dilution: -8 to +6
- Balance sheet discipline: -10 to +7

Output:

- Management score 0-100
- Grade: A, B+, B, C+, C, D

## Moat Engine

Formula:

```text
score = clamp(35 + 8 * explicit moat signal count, 0, 100)
```

Signals:

- Brand
- Network effect
- Switching cost
- Cost advantage
- Patents
- Scale

Output:

- Wide when score is at least 75
- Narrow when score is at least 55
- None below 55

The engine does not infer moat signals from sector names. Evidence must be explicit.

## Risk Engine

Formula:

```text
risk score = clamp(70 + sum(risk factor impacts), 0, 100)
```

Higher score means lower risk.

Factors:

- Explicit risk signal: -6 each
- Debt risk: -14 to +8

Risk categories supported:

- Competition
- Regulation
- Debt
- Customer concentration
- China exposure
- AI disruption
- Tariffs
- Litigation

Output:

- Low risk: 75+
- Medium risk: 55-74
- High risk: below 55

## Scenario Engine

Purpose:

Create deterministic Bear / Base / Bull fair value ranges from composite fair value.

Probabilities:

- Bear: 25%
- Base: 50%
- Bull: 25%

If composite fair value is unavailable, all scenario fair values remain unavailable.

## Decision Engine

Formula:

```text
investment score =
  valuation score * 35%
  + quality score * 16%
  + growth score * 13%
  + management score * 9%
  + moat score * 9%
  + risk score * 12%
  + data completeness score * 6%
```

Valuation score:

```text
valuation score = clamp(50 + margin of safety * 160, 0, 100)
```

Actionable data requirement:

- Data completeness score at least 70
- At least two valuation methods
- Current price available

Decision thresholds:

- BUY when investment score is at least 72, margin of safety is at least 15%, and risk score is at least 55
- SELL when investment score is 42 or lower, margin of safety is -25% or worse, or risk score is below 35
- HOLD otherwise
- HOLD with `INSUFFICIENT_DATA` when actionable data is not available

## Explainability Engine

Purpose:

Explain the deterministic result.

Formula:

```text
rank positive and negative factors by impact
```

The engine reports:

- What helped
- What hurt
- Missing data
- Final decision reason

It does not create or adjust financial numbers.
