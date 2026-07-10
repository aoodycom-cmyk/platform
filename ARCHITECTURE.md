# Architecture - Version 6

## Product Definition

AI Equity Research Platform V6 keeps the architecture, data platform, investment engine, institutional research layer, Arabic/English language system, and evaluated-company storage stable, then adds deterministic ranking, company comparison, and a semantic market color system.

The product still answers:

> Should I buy this stock today?

Version 5 focuses on turning verified data and deterministic engine output into a professional research workflow.

Version 5.1 focused on making that workflow usable for Arabic-speaking investors while preserving standard English financial terminology and giving the investor a fast daily table of evaluated companies.

Version 6 focuses on making that daily table decision-ready by ranking opportunities, comparing evaluated companies, and visually separating positive, neutral, missing, and negative signals.

## Runtime Flow

```text
User search
  ↓
Provider Registry
  ↓
Provider Fallback
  ↓
Unified Data Layer
  ↓
Domain Metrics
  ↓
Investment Engines
  ↓
Institutional Research Layer
  ↓
Language System
  ↓
Evaluated Companies Snapshot
  ↓
Ranking Engine + Market Color System
  ↓
Decision + Explainability
  ↓
Home Table + Comparison + Report UI
```

## Source Layout

```text
public/src/
├── data/
│   └── sampleData.js
├── dataPlatform/
│   ├── dataPlatform.js
│   ├── fields.js
│   └── providerContracts.js
├── domain/
│   ├── evaluatedCompanies.js
│   ├── financialMetrics.js
│   └── marketColorSystem.js
├── engines/
│   ├── dataCompletenessEngine.js
│   ├── decisionEngine.js
│   ├── engineUtils.js
│   ├── explainabilityEngine.js
│   ├── rankingEngine.js
│   ├── researchEngine.js
│   ├── scoringEngines.js
│   └── valuationEngine.js
├── i18n/
│   └── language.js
├── providers/
│   └── apiClient.js
├── research/
│   └── institutionalResearch.js
├── state/
│   └── store.js
└── ui/
    └── components.js
```

## Data Platform Layer

Location:

```text
public/src/dataPlatform/
```

Responsibilities:

- Define provider contracts
- Build provider fallback order
- Wrap every financial field with source, timestamp, confidence, and update status
- Build financial timelines
- Preserve prior versions when timeline rows refresh
- Calculate Data Health

## Provider Layer

Location:

```text
public/src/providers/apiClient.js
server.mjs
```

Responsibilities:

- Search through enabled providers
- Load company data through provider interfaces
- Fall back to manual/missing data when a provider is unavailable
- Avoid storing API keys inside company data

Current live provider:

- Financial Modeling Prep

Future provider slot:

- Morningstar

## Domain Layer

Location:

```text
public/src/domain/financialMetrics.js
public/src/domain/evaluatedCompanies.js
```

Responsibilities:

- Read values from data fields transparently
- Preserve missing values as `null`
- Provide deterministic financial calculations to engines
- Build persistent evaluated-company snapshots
- Calculate `Range FV`, `Upside %`, `Highest Fair Value`, and `Max FV Upside %`

### Evaluated Companies Formulas

```text
Range FV =
  Bear FV * Bear Probability
  + Base FV * Base Probability
  + Bull FV * Bull Probability
```

Default scenario probabilities:

- Bear: `25%`
- Base: `50%`
- Bull: `25%`

Morningstar does not affect `Range FV`.

```text
Upside % = (Range FV - Current Price) / Current Price
```

```text
Highest Fair Value = MAX(Bear, Base, Bull, Morningstar)
```

```text
Max FV Upside % = (Highest Fair Value - Current Price) / Current Price
```

Missing values remain `null` internally and render as `—`.

## Engine Layer

Location:

```text
public/src/engines/
```

Responsibilities:

- Run deterministic formulas
- Never fetch data directly
- Use the unified data company prepared by `researchEngine.js`
- Report confidence and missing inputs

### Ranking Engine

Location:

```text
public/src/engines/rankingEngine.js
```

Responsibilities:

- Calculate Ranking Score from evaluated-company outputs
- Normalize scores and cap extreme upside
- Lower confidence for missing inputs
- Keep insufficient-data rows below actionable rows
- Recalculate rank positions from the current evaluated-company set
- Report main positive and negative ranking factors

The ranking layer does not change Buy / Hold / Sell. It orders existing evaluated companies for daily review.

Full formula: `RANKING_ENGINE.md`.

## State Layer

Location:

```text
public/src/state/store.js
```

Storage:

- `localStorage` key: `equityResearchV4State`
- `sessionStorage` for API keys

State preserves:

- active company
- manual inputs
- selected language
- evaluated companies
- evaluated company sort preference
- ranking filters
- selected companies for comparison
- thesis history
- financial timeline history

Evaluated companies are stored under the existing `equityResearchV4State` key to preserve the current storage architecture. Latest evaluation replaces the visible company row and keeps prior summaries in the row history.

Rank numbers are recalculated from the evaluated-company set and are not treated as permanent facts.

## Data Health UI

The existing Risk/Data section now includes Data Health:

- Overall Data Quality
- Missing fields
- Outdated fields
- Conflicting fields
- Annual/quarterly timeline counts

No full UI redesign was performed.

## Institutional Research Layer

Location:

```text
public/src/research/institutionalResearch.js
```

Responsibilities:

- Build company profile views from verified profile data
- Build competitive analysis from explicit research profile, moat, and risk evidence
- Build historical performance from verified financial statements
- Build historical valuation views without inventing unavailable market history
- Build earnings, analyst, thesis, timeline, watch list, and CIO summary modules
- Keep all missing facts visibly unavailable

The research layer does not fetch data and does not change investment engine formulas.

## Language System

Location:

```text
public/src/i18n/language.js
```

Responsibilities:

- Set Arabic RTL document behavior
- Set English LTR document behavior
- Localize UI labels naturally
- Keep institutional finance terms in English
- Clarify terms such as `ROIC (العائد على رأس المال المستثمر)`
- Render deterministic investment explanations in Arabic
- Keep formulas, tickers, ratios, and numbers visually stable

The language layer does not calculate numbers, does not modify engine outputs, and does not invent missing provider data.

## Home Workspace

Location:

```text
public/src/ui/components.js
```

The Home workspace contains only:

- application title
- compact language toggle
- search bar
- evaluated companies table
- ranking filters
- optional comparison panel

Table behavior:

- sorting by every visible column
- default sort by actionable status, Ranking Score, Data Quality, then ticker
- search filtering
- recommendation/upside/data-quality filtering
- sticky header
- sticky Rank and Stock columns where practical
- responsive horizontal scrolling
- row click opens the saved report
- no duplicate tickers
- latest evaluation replaces the current row
- prior evaluations remain in history

Comparison behavior:

- Select 2-5 evaluated companies from Home
- Compare valuation, upside, quality, growth, management, moat, risk, data quality, ranking score, and recommendation
- Highlight best/worst cells only, never entire rows
- Generate a deterministic conclusion from calculated metrics only

## Semantic Color System

Location:

```text
public/src/domain/marketColorSystem.js
```

Responsibilities:

- Centralize color categories for upside, fair value, recommendations, risk, and scores
- Preserve Risk Score direction where higher means lower risk
- Add icons/signs/badges so color is not the only signal
- Keep Arabic RTL layout stable while numbers, tickers, ratios, and English finance terms remain readable

## Backend Routes

```text
POST /api/search
POST /api/research-data
```

`/api/research-data` now returns provider metadata plus annual and quarterly statement timelines.

## Invariants

- Missing values remain missing.
- API keys are not persisted in company data.
- Engines do not call providers.
- Research modules do not call providers.
- AI does not calculate financial numbers.
- Provider origin remains attached to each field.
- Financial history is merged, not discarded.
- Arabic output is a presentation layer, not a calculation layer.
- English output uses LTR while preserving the same financial formulas.
- Formulas stay in English and remain deterministic.
- Morningstar is a separate reference and does not enter `Range FV`.
- Ranking and comparison do not invent financial values.
- Missing ranking inputs remain missing and lower confidence.
