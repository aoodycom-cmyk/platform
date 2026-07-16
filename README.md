# AI Equity Research Platform V7

Version 7 adds a fixed-methodology valuation workflow above the existing deterministic investment engine, unified financial data platform, institutional research layer, bilingual Arabic/English output, daily Home workspace, and ranking/comparison layer.

The app answers one question:

> Should I buy this stock today?

It is not a stock dashboard. A ticker search now opens a Company Valuation Workspace. The investor pastes or enters data, reviews and confirms it, runs a fixed-methodology valuation analyst, reviews the report, and only then approves and exports the valuation to Home.

Drafts and unapproved valuations do not appear in the final Evaluated Companies dashboard.

The Home workspace shows previously evaluated companies with:

- Rank
- Current Price
- Bear / Base / Bull
- Morningstar
- Range FV
- Upside %
- Max FV Upside %
- Investment Score
- Confidence
- Data Quality
- Recommendation
- Approved Date
- Valuation Version

It also supports deterministic ranking filters, 2-5 company comparison, and a semantic color system for upside/downside, recommendations, risk, and scores.

## Run

```bash
node server.mjs
```

Open the printed local URL.

## GitHub Pages

After pushing to a GitHub repository:

1. Open the repository on GitHub.
2. Go to `Settings -> Pages`.
3. Set `Source` to `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/root`.
6. Save.

The deployed Pages site serves the static app from the repository root. A `/docs` copy is also kept as a fallback, but `/root` is the recommended setting.

Local development uses `server.mjs` as an API proxy. On GitHub Pages, the app falls back to browser-side Financial Modeling Prep requests when the user enters an FMP key in Settings. API keys are not committed to the repository and remain in the browser session.

## Documentation

- `PROJECT_REVIEW.md`: product and technical review
- `ARCHITECTURE.md`: system architecture
- `DATA_PLATFORM.md`: provider contracts, field provenance, fallback, timeline, and Data Health
- `INSTITUTIONAL_RESEARCH.md`: Version 5 research modules and rules
- `INVESTMENT_ENGINE.md`: formulas, assumptions, weights, and decision rules
- `LANGUAGE_SYSTEM.md`: Arabic/English behavior, RTL/LTR rules, and financial terminology policy
- `RANKING_ENGINE.md`: Version 6 ranking formula, comparison behavior, and color system
- `VALUATION_WORKFLOW.md`: Version 7 workspace, data review, approval, and export workflow
- `VALUATION_METHODOLOGY.md`: fixed valuation methodology
- `VALUATION_POLICY.json`: versioned assumptions and policy defaults
- `VALUATION_OUTPUT_SCHEMA.json`: fixed JSON report schema
- `AI_ANALYST_CONTRACT.md`: AI vs deterministic responsibility contract
- `CHANGELOG.md`: version history
- `TODO.md`: next development phases

## Source Structure

- `public/src/data`: starter ticker metadata only, no fake financials
- `public/src/dataPlatform`: provider contracts, field provenance, timeline, and Data Health
- `public/src/domain`: financial metric helpers, evaluated-company formulas, semantic colors, and formatting
- `public/src/engines`: deterministic investment engines
- `public/src/providers`: browser-side API client
- `public/src/research`: institutional research layer
- `public/src/state`: local app state and persistence
- `public/src/ui`: rendering and interaction components
- `public/src/valuationWorkflow`: fixed-methodology valuation workspace, parser, validation, report, approval, and export logic
- `server.mjs`: local static server and FMP API proxy

## Investment Rules

- Do not create fake financial values.
- Do not use AI to calculate numbers.
- Missing inputs remain missing.
- Every financial field carries source, timestamp, confidence, and update status.
- Engines read from the unified data layer and never fetch directly.
- Research modules summarize verified information only.
- Valuation methods are skipped when required inputs are unavailable.
- A ticker search opens a draft valuation workspace, not a final recommendation.
- Only approved valuation reports export to Home.
- Buy / Hold / Sell decisions are deterministic and reproducible.
- Ranking and comparison are deterministic and reproducible.
- AI may later explain, summarize, or challenge assumptions, but cannot alter calculations.

## Evaluated Companies

Evaluated companies are persisted in `localStorage` under the existing app state key.

The table supports search filtering, recommendation/upside/data-quality filters, sticky Rank/Stock columns, horizontal mobile scrolling, row click to open the report, no duplicate tickers, and sorting by every visible column.

Default sorting:

```text
Actionable first
Ranking Score high to low
Data Quality high to low
Ticker alphabetically
```

Formulas:

```text
Range FV = Bear * 25% + Base * 50% + Bull * 25%
Upside % = (Range FV - Current Price) / Current Price
Highest Fair Value = MAX(Bear, Base, Bull, Morningstar)
Max FV Upside % = (Highest Fair Value - Current Price) / Current Price
```

Morningstar is a separate reference and does not affect `Range FV`.

Missing values render as `—`, never as zero.

Ranking formula:

```text
Ranking Score =
  weighted normalized score across
  Investment Score, Upside, Quality, Growth, Management,
  Moat, Risk, Data Quality, and Confidence
```

The complete formula is documented in `RANKING_ENGINE.md`.

## Language

- Arabic uses RTL.
- English uses LTR.
- Financial abbreviations remain in English.
- Formulas remain in English.
- Switching language is instant and saved in `localStorage`.
