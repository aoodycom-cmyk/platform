# Recommendation Engine Audit - Version 9

Canonical function: `src/analystBrain/engine.js:466` `buildRecommendation()`.

## Decision Inputs

| Input | Code Source | Usage |
| --- | --- | --- |
| Business Quality | businessQuality.score/confidence | BUY gate requires score >=55; SELL if score <40; contributes to confidence and investmentScore. |
| Risk | riskScoreFrom(evidence, forecastPolicy, scenarios) | BUY gate requires riskScore <=68; SELL if riskScore >78; contributes inversely to confidence and investmentScore. |
| Confidence | dataQuality, businessQuality.confidence, forecastPolicy.confidence, risk, selected model count | Calculated after decision; reported as confidence. |
| Margin of Safety / Upside | calculateUpside(fairValue,currentPrice) | BUY threshold >=22%; SELL threshold <=-15%; investmentScore uses upsideScore. |
| Balance Sheet | netCash and totalDebt/EBITDA | Gate exists as balanceSheetAcceptable, but BUY condition currently does not include this gate directly. |
| Dilution | forecastPolicy.dilution.value | BUY requires dilution <=3%. |
| Scenario asymmetry | Conservative vs Optimistic upside | BUY requires positive enough asymmetry. |
| Downside | Conservative upside and SELL threshold | Used in riskScore and scenario asymmetry; no separate downside gate. |
| Data Quality | dataQuality.completeness | INSUFFICIENT_DATA if <45; BUY gate requires >=60; contributes to scores. |
| Internal Valuation | selected model role !== external_reference | INSUFFICIENT_DATA if absent. |

## Conditions

- BUY conditions: not insufficient, not SELL, upside >= 22%, scenario probability-weighted fair value is positive, Business Quality >= 55, Forecast Confidence >= 55, Risk Score <= 68, Dilution <= 3%, scenario asymmetry acceptable.
- HOLD conditions: default decision when report is actionable but BUY and SELL thresholds are not met.
- SELL conditions: upside <= -15%, or Business Quality < 40, or Risk Score > 78.
- AVOID conditions: **NOT IMPLEMENTED as a separate output.** The schema and validator allow only BUY/HOLD/SELL/INSUFFICIENT_DATA.
- INSUFFICIENT_DATA conditions: missing/invalid current price, missing/invalid valuation, no internal valuation model, no selected models, or data quality < 45.

## Does Recommendation Depend Mainly On Upside?

**Partially yes.** The final branch uses upside as the primary BUY/SELL threshold. However, BUY is gated by Business Quality, Forecast Confidence, Risk, Dilution, scenario asymmetry, positive scenario FV, and internal valuation availability. SELL can also be triggered by weak Business Quality or high Risk even apart from upside.

## Audit Finding

`balanceSheetAcceptable` is calculated but not included in the BUY condition. This means balance-sheet risk can influence Risk Score and explanations but is not a direct BUY gate in the current code.
