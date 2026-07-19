# Franklin Research 10.0.0

Franklin Research 10.0.0 keeps the deterministic investment engine, data platform, workflow, valuation methodology, ranking, comparison, approval system, and report-first experience stable. This release prepares the application for private production deployment as a full-stack Node.js app with server-side API configuration and private access protection.

The app answers one question:

> Should I buy this stock today?

It is not a stock dashboard. A ticker search opens a Company Valuation Workspace. The investor pastes one company-data block, the app normalizes the evidence, runs the canonical Analyst Brain, and immediately shows an institutional Investment Report. Forms, assumptions, sources, DCF, WACC, and statements are available as collapsed sections.

Drafts and unapproved valuations do not appear in the final Evaluated Companies dashboard.

The Analyst Brain runs:

```text
parse -> evidence normalization -> classification -> business quality -> yearly forecast -> model selection -> valuation -> recommendation -> monitoring -> report
```

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
npm start
```

Required production environment variables:

```text
FMP_API_KEY
OPENAI_API_KEY
OPENAI_MODEL
APP_ACCESS_PASSWORD
APP_SESSION_SECRET
APP_ORIGIN
```

The server listens on `process.env.PORT` and defaults to `0.0.0.0`.

Health check:

```text
GET /api/health
```

## Production Deployment

Use a Node.js host such as Render or Railway. Do not deploy the API-dependent production build as static GitHub Pages only.

The browser calls only the private backend:

- `POST /api/search`
- `POST /api/research-data`
- `POST /api/parse-investment-analyst`

API keys must be configured only as hosting environment variables. They are not requested in the UI, not sent by the browser, and not stored in browser storage.

## Documentation

- `PROJECT_REVIEW.md`: product and technical review
- `ARCHITECTURE.md`: system architecture
- `DATA_PLATFORM.md`: provider contracts, field provenance, fallback, timeline, and Data Health
- `INSTITUTIONAL_RESEARCH.md`: Version 5 research modules and rules
- `INVESTMENT_ENGINE.md`: formulas, assumptions, weights, and decision rules
- `LANGUAGE_SYSTEM.md`: Arabic/English behavior, RTL/LTR rules, and financial terminology policy
- `RANKING_ENGINE.md`: Version 6 ranking formula, comparison behavior, and color system
- `VALUATION_WORKFLOW.md`: Version 7 workspace, data review, approval, and export workflow
- `INVESTMENT_REPORT_EXPERIENCE.md`: Version 8 report-first user experience
- `VERSION_9_IMPLEMENTATION_REPORT.md`: Version 9.1 analytical correction report
- `VALUATION_METHODOLOGY.md`: fixed valuation methodology
- `VALUATION_POLICY.json`: versioned assumptions and policy defaults
- `VALUATION_OUTPUT_SCHEMA.json`: fixed JSON report schema
- `AI_ANALYST_CONTRACT.md`: AI vs deterministic responsibility contract
- `CHANGELOG.md`: version history
- `PRODUCTION_DEPLOYMENT.md`: private deployment instructions and status
- `PRODUCTION_SECURITY_REVIEW.md`: production security review
- `PRODUCTION_TEST_RESULTS.md`: production and analytical test output
- `IPHONE_INSTALLATION_GUIDE.md`: iPhone Safari installation guide
- `TODO.md`: next development phases

## Source Structure

- `public/src/data`: starter ticker metadata only, no fake financials
- `public/src/dataPlatform`: provider contracts, field provenance, timeline, and Data Health
- `public/src/domain`: financial metric helpers, evaluated-company formulas, semantic colors, and formatting
- `public/src/engines`: deterministic investment engines
- `public/src/providers`: private backend API client
- `public/src/research`: institutional research layer
- `public/src/state`: local app state and persistence
- `public/src/ui`: rendering and interaction components
- `public/src/analystBrain`: canonical Analyst Brain engine, methodology loader, and schema validator
- `public/src/valuationWorkflow`: fixed-methodology valuation workspace, parser, validation, report, approval, and export logic
- `server.mjs`: production Node server, private auth, static app server, FMP/OpenAI proxy, and health endpoint

## Investment Rules

- Do not create fake financial values.
- Do not use AI to calculate numbers.
- Missing inputs remain missing.
- Every financial field carries source, timestamp, confidence, and update status.
- Engines read from the unified data layer and never fetch directly.
- Research modules summarize verified information only.
- Valuation methods are skipped when required inputs are unavailable.
- Unsupported methods are excluded until deterministic implementations exist.
- Morningstar Fair Value and Analyst Consensus are capped external references, not standalone decision engines.
- No single selected model can exceed 45% weight.
- External references cannot exceed 25% combined weight.
- External-only evidence returns `INSUFFICIENT_DATA`.
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
