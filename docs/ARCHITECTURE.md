# Detailed Architecture

## Product Goal

The platform is designed for a professional individual investor who needs a fast, high-confidence answer to:

> Should I buy this stock today?

Every module supports that decision.

## Layers

1. UI Layer
   - Executive summary first
   - Search and decision before details
   - API keys and assumptions in Settings
   - Mobile-first layout

2. State Layer
   - Stores selected company, manual inputs, selected panel, and thesis history
   - Persists non-secret state in `localStorage`
   - Keeps API keys in `sessionStorage`

3. Provider Layer
   - Abstracts data fetching
   - Uses provider contracts and fallback
   - Current live provider: Financial Modeling Prep through the local server
   - Future provider placeholder: Morningstar
   - Returns manual or missing fields when live data is unavailable

4. Data Platform Layer
   - Wraps every financial field with value, source, timestamp, confidence, and update status
   - Builds annual and quarterly financial timelines
   - Preserves prior timeline versions
   - Calculates Data Health

5. Domain Layer
   - Number normalization
   - Formatting
   - CAGR, margins, ROIC, net debt, and helper calculations
   - Reads values from data fields transparently
   - Missing values remain `null`

6. Engine Layer
   - Data Completeness Engine
   - Valuation Engine
   - Quality Engine
   - Growth Engine
   - Management Engine
   - Moat Engine
   - Risk Engine
   - Scenario Engine
   - Decision Engine
   - Explainability Engine

7. Explainability Layer
   - Records what lifted or reduced scores
   - Reports missing data
   - Converts deterministic factors into investor-facing reasoning

8. Institutional Research Layer
   - Builds profile, competition, performance, valuation history, earnings, analyst, thesis, timeline, watch list, and CIO modules
   - Uses verified company/data-platform/engine output only
   - Does not fetch directly or invent missing facts

## Production Target

The current implementation is dependency-free so it runs locally immediately.

The production target should migrate to:

- React + TypeScript
- Fastify + TypeScript
- SQLite or PostgreSQL
- Provider contracts with field-level provenance
- Server-side data warehouse tables
- Cache and lazy loading
- Unit tests around every engine
