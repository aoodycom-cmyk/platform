# Ranking Engine - Version 6

Version 6 adds a deterministic ranking layer above the existing investment engine.

It does not replace Buy / Hold / Sell. It answers a daily portfolio workflow question:

> Which evaluated companies deserve attention first?

## Source

```text
public/src/engines/rankingEngine.js
public/src/domain/marketColorSystem.js
public/src/ui/components.js
```

## Inputs

Each evaluated company can contribute:

- Investment Score
- Upside %
- Max FV Upside %
- Quality Score
- Growth Score
- Management Score
- Moat Score
- Risk Score
- Data Quality
- Confidence

Missing values remain missing and render as `—`. They are not converted to zero.

## Default Weights

```text
Investment Score      30%
Upside Composite      15%
Quality Score         15%
Growth Score          10%
Management Score       7%
Moat Score             8%
Risk Score             8%
Data Quality           4%
Confidence             3%
```

`Upside Composite` uses:

```text
Upside Composite = 70% * Upside % + 30% * Max FV Upside %
```

If only one upside input is available, the available input is used.

## Normalization

Scores already expressed from 0-100 are clamped to 0-100.

Upside is capped to reduce distortion:

```text
Upside floor = -50%
Upside cap   = +50%

Normalized Upside =
  ((CAPPED_UPSIDE - Upside floor) / (Upside cap - Upside floor)) * 100
```

Extreme upside values therefore cannot dominate the table.

## Ranking Score

```text
Ranking Score =
  SUM(Normalized Component * Component Weight)
  / SUM(Available Component Weights)
```

If all inputs are missing, `Ranking Score = null`.

## Ranking Confidence

```text
Evidence Score = average(Decision Confidence, Data Quality)

Ranking Confidence =
  (Available Weight * 75% + Evidence Score * 25%)
  * Actionability Multiplier
```

Actionability multiplier:

```text
ACTIONABLE        = 1.00
INSUFFICIENT_DATA = 0.72
```

## Default Sort

The Home table sorts by:

1. Actionable companies first
2. Ranking Score high to low
3. Data Quality high to low
4. Ticker alphabetically

Rank numbers are recalculated from the current evaluated-company set. They are not stored as permanent truth.

## Explainability

Each row stores:

- Main Positive Factor
- Main Negative Factor
- Ranking Coverage
- Ranking Missing Weight
- Ranking Components

The strongest positive factor is the available component above 55 with the largest weighted positive impact.

The strongest negative factor is the available component below 45 with the largest weighted negative impact. If no weak component exists, the first missing component is reported.

## Semantic Color System

Upside:

```text
>= +25%        strong green
+10% to +24%   green
0% to +9%      muted neutral
-0.01% to -14% orange
<= -15%        red
```

Recommendations:

```text
BUY / شراء      green
HOLD / احتفاظ   warning
SELL / بيع      red
Insufficient    gray
```

Risk:

```text
Risk Score higher = lower risk

>= 75   green
55-74   warning
< 55    red
```

Scores:

```text
85-100  strong green
70-84   green
55-69   warning
40-54   orange
< 40    red
```

Fair value compared with current price uses a 2% neutral tolerance.

Color is never the only signal. Values also include arrows, signs, badges, and missing markers.

## Company Comparison

The comparison view supports 2-5 evaluated companies.

It compares:

- Current Price
- Bear / Base / Bull
- Morningstar
- Range FV
- Upside %
- Max FV Upside %
- Investment Score
- Quality
- Growth
- Management
- Moat
- Risk
- Data Quality
- Ranking Score
- Recommendation

The conclusion is deterministic and derived only from calculated metrics.

## Tests

```bash
node --experimental-vm-modules tests/version6.test.mjs
```

The test suite covers:

- deterministic ranking output
- missing-data behavior
- ranking order
- upside caps
- color thresholds
- recommendation colors
- Risk Score direction
- score color thresholds
- Arabic/English labels
- signed percentage formatting
- evaluated-company de-duplication
