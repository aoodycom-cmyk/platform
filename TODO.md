# TODO - Version 6 Roadmap

## Immediate

- Expand unit tests for every investment engine formula.
- Add browser-level tests for Arabic RTL table behavior, sticky columns, filters, and comparison.
- Add a typed schema for company, financial statement, quote, consensus, and qualitative evidence.
- Add visible source timestamps per loaded data field.
- Add clearer empty states for missing provider data.
- Add research-grade Arabic summarization for verified long-form provider narratives.
- Add persistent server-side storage for evaluated companies once the local workflow stabilizes.

## Phase 1: UX Quality

- Refine mobile density in secondary engine panels.
- Add an assumptions drawer for valuation inputs.
- Make saved thesis history easier to compare.
- Add a guided Settings setup state for market data keys.
- Validate Arabic mobile typography on physical iPhone viewport.
- Add keyboard-friendly comparison selection and clearing.

## Phase 2: Data Quality

- Add a provider interface contract.
- Add a second market data provider.
- Add a local database.
- Store field-level source, timestamp, and confidence.
- Add import/export for thesis history.
- Add historical market data for valuation percentile and ranking context.

## Phase 3: Investment Engine Depth

- Add sector-specific valuation assumptions.
- Add peer group multiples.
- Add ROIC trend and margin trend scoring.
- Add share count trend over more than two years.
- Add capital allocation analysis from cash flow statements.
- Add management, moat, and risk evidence from filings and transcripts.
- Add deterministic AI explanation prompts that cannot modify numbers.
- Add Arabic explanation prompts that can summarize verified facts without changing financial outputs.

## Completed in Version 6

- Added deterministic Ranking Engine.
- Added Ranking Score and Ranking Confidence.
- Added Main Positive Factor and Main Negative Factor.
- Added ranking filters above the Home table.
- Added 2-5 company comparison.
- Added semantic color system for upside, fair value, recommendations, risk, and scores.
- Added tests for Version 6 ranking, color thresholds, language labels, signs, and de-duplication.

## Not Allowed

- Do not create fake financial values.
- Do not use AI to calculate numbers.
- Do not let missing data default to zero unless zero is explicitly reported by the data source.
- Do not issue an actionable Buy or Sell without sufficient data completeness.
