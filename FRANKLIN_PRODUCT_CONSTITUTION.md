# Franklin Product Constitution

Status: CANONICAL PRODUCT SOURCE OF TRUTH

This document defines what Franklin is, who owns financial judgment, what the application is allowed to calculate, and the release standard for product, engineering, design, and AI work.

## 1. Product Mission

Franklin is the persistent investment decision workspace for Fair Value analysis.

The product must let an investor answer four questions quickly and then drill down into evidence:

1. What is the current investment decision?
2. What is the justified value and why?
3. What must happen next for the thesis to strengthen or weaken?
4. What changed after each earnings report?

Franklin is not the financial analyst. Fair Value inside ChatGPT is the financial analyst.

## 2. Authority Model

### Fair Value / ChatGPT owns financial judgment

Only Fair Value / ChatGPT may choose or change:

- company classification and business-stage interpretation
- company-specific KPIs
- business quality assessment and component scores
- strengths and weaknesses
- valuation methods and why each method is suitable or excluded
- valuation model weights
- forecast assumptions used by the analysis
- Bear, Base, and Bull scenario assumptions
- Bear, Base, and Bull fair values
- scenario probabilities
- probability-weighted fair value as an analytical output
- investment thesis
- stock-level decision: BUY, ADD, HOLD, WATCH, REDUCE, or SELL
- risks and catalysts
- monitoring checklist
- next-quarter requirements, weights, and requirement mode
- interpretation of reported quarterly results
- whether the thesis strengthened, weakened, stayed unchanged, or broke
- whether an earnings release justifies a valuation change

### Franklin owns deterministic validation and product state

Franklin may:

- build the prompt and canonical JSON template
- parse/import the returned JSON
- reject malformed or incomplete contracts
- validate enums, required fields, types, and provenance
- verify arithmetic identities without replacing analytical judgment
- verify scenario probabilities total 100%
- verify valuation method weights total 100%
- verify Bear <= Base <= Bull
- verify probabilityWeighted equals the supplied scenario values multiplied by the supplied probabilities
- verify upside and margin-of-safety arithmetic
- verify requirement weights total 100%
- preserve NOT_REPORTED when a metric was not disclosed
- assign persistent analysis IDs and requirement-set IDs
- store immutable historical versions
- compare the current version with the prior version
- render reports, scorecards, history, and monitoring views
- export/import data and protect migrations

Franklin must not invent, infer, optimize, normalize, replace, or silently alter a financial judgment supplied by Fair Value / ChatGPT.

If a financially material value is inconsistent, Franklin rejects the import and explains the inconsistency. It does not choose a replacement value.

## 3. Canonical Contract

The canonical active contract is:

- schemaVersion: `franklin-fair-value/v3`
- methodologyVersion: `fair-value-methodology/v2`

Primary implementation sources:

- `public/src/externalAnalysis/v3Contract.js`
- `public/src/externalAnalysis/chatgptContract.js`
- `public/src/externalAnalysis/externalAnalysisSchemaValidator.js`

Older analyst-engine documents and legacy adapters are compatibility material only. They must not override this constitution or V3 behavior.

## 4. Core Analysis Lifecycle

### Initial analysis

Flow:

`Ticker -> Fair Value prompt -> research + analysis in ChatGPT -> canonical V3 JSON -> Franklin validation -> save -> investment report`

Required outputs include:

- company profile and business model
- data quality
- classification
- business quality
- strengths and weaknesses
- latest reported financial context
- company-specific KPIs
- valuation methodology
- forecast and assumptions
- Bear/Base/Bull scenarios
- probability-weighted fair value
- thesis
- stock-level decision
- risks and catalysts
- monitoring checklist
- next-quarter requirements
- source provenance

### Earnings revaluation

Flow:

`Saved analysis -> next requirements -> new earnings -> Fair Value earnings prompt -> compare actuals with saved requirements -> thesis impact -> valuation review -> new requirements -> save new version`

The quarterly process must preserve history. A new earnings analysis never overwrites the evidence or requirement set that existed before the earnings release.

If a company does not report a required metric, the status is `NOT_REPORTED` and the actual value remains null.

## 5. Financial Decision Hierarchy

The report should distinguish three ideas clearly:

### Market price

What the market currently asks the investor to pay.

### Base Fair Value

Fair Value / ChatGPT's central justified value under the Base scenario.

### Probability-Weighted Fair Value

The expected value across Bear, Base, and Bull using analyst-chosen probabilities.

The application must not present probability-weighted fair value as a substitute for Base Fair Value. Both are useful and should be labeled distinctly.

## 6. Company Report Information Architecture

The default report is investor-first, not methodology-first.

Recommended hierarchy:

1. Decision Hero
   - ticker and company
   - current price
   - decision
   - Base Fair Value
   - upside/downside to Base
   - probability-weighted fair value
   - confidence
   - one-sentence thesis

2. What Changed
   - for initial analysis: why this opportunity is interesting now
   - for earnings revaluation: what changed since the prior version

3. Investment Thesis
   - core thesis
   - key supports
   - key threats
   - upgrade and downgrade triggers

4. Fair Value
   - Bear / Base / Bull cards
   - probabilities
   - probability-weighted value
   - valuation bridge

5. Business Quality
   - quality score
   - growth
   - profitability
   - cash flow
   - balance sheet
   - capital allocation
   - competitive advantage
   - management

6. Company Understanding
   - plain-Arabic business explanation
   - activities/products
   - how the company makes money
   - customers
   - growth drivers

7. Latest Quarter
   - revenue / EPS / margins / FCF where material
   - company-specific KPIs
   - guidance
   - forward outlook

8. Thesis Tracker / Next Requirements
   - next-quarter requirements
   - weights
   - why each matters
   - actual/status after earnings
   - historical requirement sets

9. Forecast and Valuation Methodology
   - yearly forecast
   - assumptions
   - chosen methods
   - exclusions
   - weights
   - method-level results
   - sensitivity

10. Risks and Catalysts

11. Monitoring Checklist

12. Sources, Data Quality, and Audit

Technical forms, raw JSON, and methodology internals should be secondary or collapsible. They must not dominate the normal investor reading path.

## 7. Home / Portfolio-Level Experience

Home is a decision dashboard, not a spreadsheet dump.

Each evaluated company should expose at minimum:

- ticker
- company
- current price
- Base Fair Value
- upside/downside to Base
- decision
- confidence
- thesis status
- next event / requirement state
- last analysis date

The user must be able to identify quickly:

- highest-conviction opportunities
- holdings whose thesis weakened
- companies approaching an earnings check
- analyses that are stale or missing critical data

Ranking must never silently create or alter a stock recommendation.

## 8. UX and Figma Principles

Franklin is Arabic-first and iPhone-first while remaining professional on desktop.

Design requirements:

- Arabic is the primary reading direction (`RTL`).
- English financial terms such as DCF, FCF, WACC, EPS, P/E, EV/EBITDA, Bear, Base, and Bull must remain readable without bidi corruption.
- Use `dir=auto`, bidi isolation, or explicit LTR wrappers where required instead of reversing semantic text.
- Decision and fair value must be visible without scrolling through technical methodology.
- One card should communicate one investor question.
- Dense tables require mobile alternatives rather than horizontal overflow as the default experience.
- Status colors must be semantic and consistent; color is supportive, never the only signal.
- Missing data must look different from zero.
- `NOT_REPORTED` must never look like a miss.
- Historical and current values must be visually distinguishable.
- Numbers need clear units, currencies, and dates.
- Financial language should be understandable to an intelligent non-specialist.

The Figma master file is the product design workspace. Engineering should implement approved interaction and information hierarchy, not independently invent a conflicting hierarchy.

### Commercial editorial presentation standard

Franklin is a premium paid financial product. Its normal investor experience must look quiet, deliberate, and editorial rather than like a generated dashboard or an internal tool.

- Use a restrained type hierarchy: scale, spacing, and tone should create emphasis before heavier font weights do.
- Prefer a page background, a card surface, and one raised surface; do not create a separate bordered card for every sentence or row.
- Use three separator patterns intentionally: inset row dividers, full-width semantic dividers, and open section spacing.
- Keep section headings outside their content cards when that improves scan rhythm.
- Reserve green and red tonal surfaces for financially positive and negative meaning. They are not decorative brand colors.
- Present the leading strength and leading risk as one balanced thesis argument when both exist. Do not imply that unrelated items are causal opposites.
- Preserve all complete evidence behind progressive disclosure; a compact preview may never delete or overwrite stored analysis.
- Show source proximity or source counts only when the report actually carries source references. Never fabricate provenance.
- Render prices, percentages, fiscal periods, ticker symbols, and scenario values with tabular numerals and bidi-safe LTR isolation.
- The presentation layer may reorganize or progressively reveal content, but it must never modify financial values, rankings, judgments, or source requirements.

## 9. Safety and Integrity Gates

No feature is accepted if it creates any of these conditions:

- Franklin chooses a valuation method on behalf of Fair Value
- Franklin changes Bear/Base/Bull analytical values to make arithmetic pass
- Franklin changes a recommendation based on a hard-coded threshold
- a missing quarterly metric is converted into zero
- a requirement is marked failed when it was not reported
- a new analysis overwrites the prior requirement set
- a legacy schema silently loses financially material fields
- reporting currency and trading currency are confused
- current market price has no traceable time/source state
- the UI hides the difference between reported data, consensus, and analyst assumptions
- mixed Arabic/English content becomes materially unreadable

## 10. Release Gates

A Franklin release candidate requires:

- syntax/static checks: PASS
- build: PASS
- full regression test suite: PASS
- canonical V3 contract tests: PASS
- financial safety tests: PASS
- state migration tests: PASS
- mobile tests: PASS
- RTL/bidi tests for affected surfaces: PASS
- product acceptance criteria: PASS
- financial-governance review: PASS
- QA/security review: PASS

Manual owner testing is requested only after the automated gates pass and the version is genuinely testable.

## 11. Owner Testing Contract

The owner is not expected to coordinate engineering agents.

When a version is ready, the system should provide:

- a clear `اختبر Franklin الآن` signal
- the testable URL/version
- a short list of changed behaviors
- a focused manual checklist
- known limitations, if any

Owner feedback then becomes the next product input for Executive AI / Product / Design / Codex.

## 12. Near-Term Product Priorities

Priority 0 — Financial authority cleanup

- make V3 and this constitution the explicit source of truth
- remove or clearly deprecate documentation that assigns financial judgment to deterministic code
- prevent new code from reintroducing legacy authority rules

Priority 1 — Investor-first report

- Decision Hero
- Fair Value / scenario clarity
- thesis and change tracking
- company understanding
- latest-quarter / guidance / company KPIs
- next-requirements tracker

Priority 2 — Quarterly closed loop

- reliable earnings period selection
- saved requirement-set matching
- actual vs requirement scorecard
- forward outlook
- thesis impact
- valuation review and version history

Priority 3 — Portfolio decision dashboard

- stale-analysis state
- earnings-due state
- thesis-change state
- opportunity sorting without rewriting recommendations

Priority 4 — Product polish

- complete RTL/bidi hardening
- mobile ergonomics
- accessibility
- performance
- visual consistency through Figma/design tokens
