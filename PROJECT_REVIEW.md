# Project Review - Version 9

## Executive Assessment

Version 9 keeps the deterministic engines, data platform, workflow, ranking, comparison, report-first experience, and approval system stable. It integrates `Investment Analyst Brain v1` as the source of truth for company classification, business quality, model selection, forecasts, WACC, scenarios, fair value, recommendation, monitoring, report structure, and JSON output.

The most important Version 7 product change:

> A ticker search no longer creates a final valuation or Home row. It opens a Company Valuation Workspace. Only approved valuations export to the dashboard.

The most important Version 8 product change:

> Once a valuation is generated, the investor sees the Investment Report first. Forms, assumptions, DCF, WACC, sources, and methodology are collapsed below it.

The most important Version 9 product change:

> The investor now pastes one unstructured company data block. AI may parse explicit data, deterministic code calculates the valuation, the output validates against the fixed JSON schema, and only investor-approved reports export to the dashboard.

The application is still decision-first, but every important financial field now carries provenance:

- value
- source
- timestamp
- confidence
- update status

## Current Product Idea

The app is a mobile-first equity research platform for long-term investors. It answers:

> Should I buy this stock today?

Version 4 added a second question:

> Is the data behind this decision reliable enough?

Version 5 adds a third question:

> How would a professional investor explain and monitor this company?

Version 5.1 adds a fourth product requirement:

> Can Arabic-speaking investors read the recommendation and thesis professionally while finance terms remain institutionally correct?

It also adds the daily operating question:

> Which evaluated companies have the best expected upside today?

Version 6 refines that into:

> Which evaluated companies deserve attention first, and how do they compare?

Version 7 adds:

> Has the investor supplied, reviewed, and approved enough evidence for this valuation to become an official dashboard record?

Version 8 adds:

> Can the investor understand the opportunity, upside, risk, and recommendation within 30 seconds?

Version 9 adds:

> Can a fixed investment analyst methodology turn one pasted research block into an approved institutional report without inventing financial data?

## Technology Stack

- Frontend: vanilla JavaScript modules, HTML, CSS
- Backend: local Node.js HTTP server
- Language system: centralized Arabic RTL localization in `public/src/i18n/language.js`
- Evaluated companies: deterministic snapshot formulas in `public/src/domain/evaluatedCompanies.js`
- Ranking engine: deterministic opportunity ranking in `public/src/engines/rankingEngine.js`
- Market color system: semantic signal colors in `public/src/domain/marketColorSystem.js`
- Valuation workflow: fixed-methodology workspace in `public/src/valuationWorkflow/workflow.js`
- Analyst Brain: methodology loader and schema validator in `public/src/analystBrain/`
- Methodology source files: `docs/investment_analyst_brain_v1/` and `public/investment_analyst_brain_v1/`
- Storage:
  - `localStorage` for app state, saved theses, and local financial timeline
  - `sessionStorage` for API keys
- APIs:
  - Financial Modeling Prep live provider
  - OpenAI parser endpoint for extracting explicit pasted data only
  - Morningstar future provider placeholder
  - Manual Input fallback
  - Missing fallback

## Important File Structure

```text
equity-research-v2/
├── PROJECT_REVIEW.md
├── ARCHITECTURE.md
├── CHANGELOG.md
├── DATA_PLATFORM.md
├── INSTITUTIONAL_RESEARCH.md
├── INVESTMENT_ENGINE.md
├── LANGUAGE_SYSTEM.md
├── RANKING_ENGINE.md
├── VALUATION_WORKFLOW.md
├── VALUATION_METHODOLOGY.md
├── VALUATION_POLICY.json
├── VALUATION_OUTPUT_SCHEMA.json
├── AI_ANALYST_CONTRACT.md
├── TODO.md
├── docs/investment_analyst_brain_v1/
├── server.mjs
└── public/src/
    ├── analystBrain/
    │   ├── methodology.js
    │   └── schemaValidator.js
    ├── dataPlatform/
    │   ├── dataPlatform.js
    │   ├── fields.js
    │   └── providerContracts.js
    ├── domain/
    │   ├── evaluatedCompanies.js
    │   ├── financialMetrics.js
    │   └── marketColorSystem.js
    ├── engines/
    │   ├── rankingEngine.js
    │   └── researchEngine.js
    ├── i18n/language.js
    ├── research/institutionalResearch.js
    ├── providers/apiClient.js
    ├── valuationWorkflow/workflow.js
    ├── state/store.js
    └── ui/components.js
```

## Existing Features

- Executive Summary
- Investment Decision
- Valuation Engine
- Quality Engine
- Growth Engine
- Management Engine
- Moat Engine
- Risk Engine
- Data Completeness Engine
- Data Health display
- Institutional Research section
- Company Profile
- Competitive Analysis
- Historical Performance
- Historical Valuation
- Earnings Center
- Analyst Consensus
- Investment Thesis
- Watch List
- Research Timeline
- Explain Like CIO
- Arabic/English language system
- Home evaluated companies table
- Deterministic Ranking Engine
- Ranking filters
- Company Comparison for 2-5 evaluated companies
- Semantic color system for upside, fair value, recommendations, risk, and scores
- Persistent evaluated company snapshots
- Settings
- Saved thesis history
- Financial timeline storage
- One-block Investment Analyst paste workflow
- AI-assisted data parsing with deterministic calculation boundary
- Investment Analyst Brain v1 JSON validation
- Conservative / Base / Optimistic / Exceptional report structure
- Monitoring checklist in approved reports

## What Works Well

- The user can start from one paste box instead of many technical forms.
- `Investment Analyst Brain v1` files are loaded as methodology source material rather than rewritten in code comments.
- AI parsing is separated from financial calculations.
- JSON output is validated before approval/export.
- Draft reports remain private and do not enter Evaluated Companies.
- Engines remain deterministic.
- Engines do not fetch data directly.
- Data provider logic is separated from calculations.
- Each financial field can report source, timestamp, confidence, and status.
- Missing data no longer becomes zero.
- API keys are not stored inside company data.
- Financial statement history is merged instead of discarded.
- Institutional research modules do not invent missing facts.
- CIO summary is deterministic and capped at 300 words.
- Arabic narratives are separated from deterministic calculations.
- Financial terms such as DCF, FCF, ROIC, EPS, P/E, EV/EBITDA, Revenue, Quality, Growth, Management, and Risk remain in English.
- The Home table is compact, sortable, and built for daily review.
- `Range FV`, `Upside %`, and `Max FV Upside %` are deterministic and stored with each evaluated company.
- Ranking Score is deterministic, weighted, and reproducible.
- Missing ranking inputs stay missing and lower ranking confidence.
- The comparison conclusion is deterministic and uses calculated metrics only.
- Semantic colors are centralized and preserve Risk direction where higher score means lower risk.
- Existing evaluations are de-duplicated by ticker.

## Current Gaps

- Still no server-side database.
- Only one live data provider is implemented.
- AI parsing requires an OpenAI key and falls back to local parsing when unavailable.
- The JSON schema is intentionally permissive because the supplied `11_OUTPUT_SCHEMA.json` defines section presence more than field-level numeric constraints.
- Provider conflicts are structurally supported, but need a second live provider to become meaningful.
- Automated tests now cover Version 6 ranking/color behavior, but broader engine coverage is still needed.
- No TypeScript schema enforcement yet.
- Morningstar is not implemented as a live provider.
- Many institutional research fields require richer provider feeds.
- Historical valuation percentiles require verified historical market data.
- Rich provider descriptions still need a future research-grade translation/summarization path before long English narratives can become Arabic prose.
- Evaluated Companies still uses browser local storage rather than a server-side database.

## Stock Data Storage

Version 6 still uses the Version 4 browser storage schema to preserve local data-platform history:

- Active company: `localStorage` under `equityResearchV4State`
- Evaluated companies: `localStorage` under `equityResearchV4State`
- Saved theses: `localStorage` under `equityResearchV4State`
- API keys: `sessionStorage`

Every loaded company can contain:

- field provenance
- Data Health
- annual financial timeline
- quarterly financial timeline
- prior versions of refreshed timeline rows

Every evaluated company stores:

- Ticker
- Company Name
- Current Price
- Bear / Base / Bull Fair Value and probabilities
- Morningstar Fair Value
- Range FV
- Upside %
- Highest Fair Value
- Max FV Upside %
- Investment Score
- Ranking Score
- Ranking Confidence
- Main Positive Factor
- Main Negative Factor
- Sector when verified
- Recommendation
- Confidence
- Data Quality
- Evaluation Date
- Last Updated
- Approved Investment Analyst Brain report when generated through Version 9
- Dashboard export metadata showing approval-only export status

`Range FV` uses only Bear/Base/Bull probabilities. Morningstar remains a separate reference.

## Data Health

Data Health reports:

- Overall Data Quality 0-100
- Missing fields
- Outdated fields
- Conflicting fields
- Annual timeline count
- Quarterly timeline count

## Version 5.1 Verdict

Version 5.1 was a foundation release for professional Arabic equity research workflow.

## Version 6 Verdict

Version 6 turns the Home workspace into a more realistic portfolio-manager review surface.

The app is not yet a full institutional research terminal, but it now has the correct layers:

- provider contracts
- fallback strategy
- field-level provenance
- local timeline history
- health scoring
- engine isolation from data fetching
- research modules above the engine
- deterministic thesis and CIO summaries
- local watch list
- Arabic RTL presentation with English finance terminology preserved
- bilingual Home workspace with persistent evaluated companies
- deterministic upside and maximum-upside table formulas
- deterministic ranking
- deterministic company comparison
- consistent color semantics across recommendations, risk, scores, and upside/downside

## Recommended Next Priorities

1. Add broader automated tests for investment, data, research, and UI state behavior.
2. Add richer research data providers for segments, competitors, earnings, and analyst revisions.
3. Add research-grade Arabic summarization for verified provider narratives.
4. Add historical market data for valuation percentiles.
5. Add persistent database storage for Evaluated Companies, Watch List, and research timeline.
