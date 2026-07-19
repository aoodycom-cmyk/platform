# Changelog

## Version 10.1 - Institutional Steel Brand Refresh

- Replaced the previous warm visual palette with the logo-driven institutional palette: Deep Navy, Steel Blue, Graphite, Soft Slate, Silver White, Cool Gray, Muted Emerald, Muted Crimson, and Soft Orange.
- Removed warm emphasis tokens and renamed the mid-signal color category to `warning`.
- Updated Home, Investment Report, cards, buttons, badges, scenario cards, Fair Value visuals, PWA metadata, login screen, and offline screen to the new steel/graphite identity.
- Preserved the investment engine, data platform, workflow, methodology, valuation calculations, and production server behavior.
- Updated the Version 6 color tests to enforce the new `warning` category behavior.

## Version 10.0.0 - Private Production Preparation

- Hardened the Node server for production deployment with `process.env.PORT` and default `0.0.0.0` binding.
- Added private access protection using `APP_ACCESS_PASSWORD` and an HttpOnly session cookie.
- Added `GET /api/health` with non-sensitive configuration status only.
- Moved FMP and OpenAI usage fully server-side for browser calls to `/api/search`, `/api/research-data`, and `/api/parse-investment-analyst`.
- Removed frontend API-key fields, browser API-key storage, request-body API keys, and direct browser fallbacks to FMP/OpenAI.
- Added safe production errors for missing configuration, invalid provider keys, rate limits, provider timeout, malformed provider responses, invalid inputs, and blocked unauthenticated requests.
- Added secure HTTP headers, CSP, request body limits, ticker/query validation, CORS origin checks, safe JSON parsing, provider request timeouts, and API rate limiting.
- Added minimal PWA support with service worker and offline page that does not cache API responses or stale financial data.
- Added Settings action to clear local application data.
- Added Render deployment blueprint and `.env.example` without secret values.
- Added `tests/productionDeployment.test.mjs` for production security, API, auth, manifest, service worker, and metadata checks.

## Version 10 - Product Design System

- Updated the application icon to the final `MAKE MONEY / 2026 / Abdullah. Bin Mushabab` coin artwork across `public`, `docs`, and root asset folders.
- Repositioned the product identity as `Franklin Research V10` with a premium, iPhone-first Home experience.
- Redesigned the Home visual hierarchy around a branded hero, one large search, recent analyses, watchlist, and quick actions.
- Added a report hero header that surfaces Current Price, Fair Value, Recommendation, and Confidence before technical sections.
- Reworked the Investment Report presentation with calmer spacing, stronger visual hierarchy, refined card rhythm, and Apple-like interaction polish.
- Added Version 10 styling tokens for color, typography, spacing, radius, elevation, microinteractions, RTL handling, and mobile breakpoints.
- Updated browser/PWA identity metadata for the new product name.
- Added Version 10 delivery documentation: design system, component library, before/after comparison, UI test results, and product design report.
- Added refreshed mobile screenshots under `screenshots-v10-product-design/`.
- Verified no horizontal overflow on a 430px mobile viewport.
- Did not modify analytical engine formulas, forecast logic, recommendation logic, methodology rules, APIs, or test files for Version 10.

## Version 9.3 - Visual Design Polish

- Polished the Home screen into a mobile-first investment app entry point with logo, search, New Analysis, Recent Analyses, and Watchlist.
- Removed visible Home clutter from the primary experience while preserving existing workflow capability.
- Reworked the Investment Report presentation around a decision-centered card.
- Added concise report-first takeaways: key positives, key risks, and a short conclusion.
- Redesigned Bear / Base / Bull scenario cards for fast scanning.
- Added a premium Fair Value range visual with Current Price and Fair Value markers.
- Redesigned Business Quality, Risks, Valuation Models, Forecast, and Monitoring into compact premium cards with expandable details.
- Added missing Arabic UI labels for the polished report experience.
- Verified iPhone-width rendering with no horizontal overflow.
- Did not modify analytical engine, schema validation, workflow logic, valuation models, model selection, recommendation logic, forecast logic, methodology, or tests.

## Version 9.2 - UI/UX Improvement Phase

### Scope

- Improved the investment analyst experience without changing the analytical engine, valuation formulas, recommendation gates, model selection, forecast logic, methodology rules, or JSON validation logic.
- Preserved the Version 9.1 deterministic engine hashes for `analystBrain/engine.js`, `valuationWorkflow/workflow.js`, and `analystBrain/schemaValidator.js`.

### Home

- Replaced the dense default Home table with mobile-first evaluated-company cards.
- Added a clearer app identity row, New Analysis action, Demo Data action, and clean empty state.
- Kept only approved reports visible on Home; drafts remain private inside the workspace.
- Fixed the mobile search focus behavior by updating the query without re-rendering the page on every typed character.

### Paste Input

- Added one primary paste box workflow with optional ticker and company name fields only.
- Added Load Demo Data, Analyze Paste, and Clear actions.
- Kept user typing stable by avoiding continuous page re-render while editing the paste box.

### Data Review

- Reworked Data Review into simple groups: Confirmed, Needs Review, Missing, and Conflicting.
- Added a single primary Confirm and Run Analysis action.
- Added visible review status, required-field count, completeness, and minimum threshold.

### Processing State

- Added a polished processing state with meaningful stages: reading pasted data, reviewing data, running deterministic engine, and building report.
- No fake percentages or terminal-style logs were added.

### Investment Report

- Reworked the report into a report-first institutional layout.
- Added a company header, large recommendation, confidence, quick summary, scenario cards, Fair Value Range visual, Business Quality breakdown, Investment Thesis, Risks, selected valuation models, forecast bars, monitoring, and final approval/export block.
- Kept technical details in collapsible sections below the primary report.
- Added Shariah Compliance as Data Unavailable when no verified Shariah source exists; no compliance inference is made.

### Responsive UI

- Added iPhone-first CSS refinements for 393x852 and 430x932.
- Verified no horizontal overflow: 393px viewport reports `scrollWidth: 393`; 430px viewport reports `scrollWidth: 430`.
- Added desktop screenshots for Home and Investment Report.

### Demo Flow

- Added `demoFlow.js` fixture that feeds confirmed demo data into the real deterministic workflow.
- Demo values are not hardcoded into UI components; the report is generated by the existing engine.

### Tests

- Added `tests/version9_2UIUX.test.mjs`.
- The new test verifies home cards, paste workflow, data review, processing/report components, Shariah Data Unavailable state, mobile overflow CSS, Arabic localization, search focus behavior, demo flow through the real engine, and supported selected valuation models only.
- Full test command output is saved in `raw-ui-test-output/v9_2_full_test_output.txt`.

### Delivery Artifacts

- Added `UI_CHANGELOG_V9.2.md`.
- Added `UI_COMPONENT_MAP.md`.
- Added `UI_TEST_RESULTS.md`.
- Added `UI_RUN_INSTRUCTIONS.md`.
- Added `UI_DELIVERY_STATUS_V9.2.md`.
- Added `screenshots-v9.2-ui/`.
- Added `investment-analyst-platform-v9.2-ui.zip`.

## Version 9 Final Delivery - Evidence Package

### Analytical Engine

- Added a canonical deterministic Analyst Brain engine in `src/analystBrain/engine.js`.
- Changed the Analyst Brain workflow so it runs `runAnalystBrainEngine()` directly instead of wrapping a legacy valuation report.
- Added evidence normalization before classification and scoring.
- Added deterministic company classification for profitable growth, transition-to-profitability, cyclical, capital-intensive, financial institution, REIT, and holding-company cases.

### Forecast Engine

- Added explicit Year 1-5 forecast rows.
- Each forecast row includes Revenue, Revenue Growth, Operating Margin, tax, D&A/Revenue, CapEx/Revenue, Working Capital/Revenue Growth, dilution, diluted shares, FCF, source, and confidence.
- Added methodology source priority: Company guidance, Analyst estimates, Historical trends, Backlog/contracts/unit economics, Sector assumptions, Methodology defaults.

### Valuation Models

- Enforced supported models only: DCF, P/E, PEG, EV/EBITDA, EV/Sales, Forward EV/Sales, Price/FCF, Morningstar Fair Value, Analyst Consensus.
- Prevented unsupported models from being selected or displayed as selectable report models.
- Documented unsupported models: P/B, Residual Income, DDM, AFFO, NAV, Dividend Yield, Cap Rate, Sum of the Parts.
- Added optional peer/historical multiple fields inside the one-paste workflow.
- Added model weight cap of 45%.
- Added external reference cap of 25% combined for Morningstar Fair Value and Analyst Consensus.

### Recommendation Engine

- Recommendation now evaluates current price, available internal valuation, scenario fair value, data quality, business quality, forecast confidence, risk score, balance sheet, dilution, and scenario asymmetry.
- Added `INSUFFICIENT_DATA` when external references exist without internal valuation support.
- Added a scenario-fair-value gate so BUY is not issued when the probability-weighted scenario fair value is not positive.
- Removed automatic Exceptional fair value generation.

### Monitoring

- Added company-specific monitoring checklist generated from confirmed evidence and classification.
- Monitoring rows include metric, current value, expected range, upgrade trigger, downgrade trigger, thesis break, and revaluation event.

### JSON Schema

- Promoted `investment-analyst-brain-v1.1-canonical` as the report methodology version.
- Added nested validation for required sections, scenario probabilities, selected model support, model weights, external reference weights, five-year forecast rows, monitoring checklist length, and recommendation enum.
- Updated `11_OUTPUT_SCHEMA.json` in root, `public`, and `docs` methodology folders.

### Tests

- Expanded `tests/investmentAnalystBrain.test.mjs` to 47 assertions.
- Added coverage for profitable growth, transition-to-profitability, cyclical, financial institution, REIT, holding company, external-only evidence, overweight models, overweight external references, invalid probabilities, invalid forecast length, and invalid Exceptional fair value.
- Preserved Version 6, Version 7, and Version 8 compatibility tests.

### Mobile UI

- Preserved the existing mobile-first UI.
- Updated visible version labels to Version 9.1.
- Verified mobile evidence screenshots at 390x844 for paste input, data review, decision summary, scenario cards, assumptions, valuation models, monitoring, and export.

### Delivery Artifacts

- Added `VERSION_9_IMPLEMENTATION_REPORT.md`.
- Added `SUPPORTED_VALUATION_MODELS.md`.
- Added `METHODOLOGY_VERSION_CONTRACT.md`.
- Added `VALUATION_CALCULATION_AUDIT.md`.
- Added `VERSION_9_TEST_RESULTS.md`.
- Added `VERSION_9_CHANGED_FILES.md`.
- Added `version_9_evidence/` with test output, screenshots, sample report JSON, readable reports, and inputs.

## Version 9.1 - Canonical Analyst Brain Correction

### Changed

- Replaced the legacy Analyst Brain wrapper with a direct deterministic pipeline in `src/analystBrain/engine.js`.
- Promoted `investment-analyst-brain-v1.1-canonical` as the canonical methodology contract.
- Added `00_METHODOLOGY_CONTRACT.md` and `00_METHODOLOGY_CONTRACT.json` ahead of the detailed methodology files.
- Analyst Brain now runs: parse -> evidence normalization -> classification -> business quality -> yearly forecast -> model selection -> valuation -> recommendation -> monitoring -> report.
- Year 1-5 forecasts are now explicit arrays with source and confidence metadata.
- Recommendation logic now considers margin of safety, internal valuation availability, Business Quality, Forecast Confidence, Data Quality, Risk, dilution, balance sheet, and scenario asymmetry.
- External references such as Morningstar Fair Value and Analyst Consensus are capped at 25% combined model weight.
- Individual valuation models are capped at 45% unless a future approved override is added.
- Unsupported models remain excluded until deterministic implementations exist, including P/B, Residual Income, DDM, AFFO, NAV, Dividend Yield, Cap Rate, and Sum of the Parts.
- Peer and historical multiples can be supplied in the same one-block paste; otherwise multiples are clearly labeled as methodology defaults.
- Exceptional scenario no longer creates an automatic fair value from Optimistic/Bull. It stays unvalued unless explicit quantitative assumptions are supplied and approved.
- Analyst Brain approval now validates against the canonical Analyst Brain schema instead of the legacy valuation report gate.

### Added

- Added nested Analyst Brain validation for methodology version, scenario probabilities, model support, model weights, external reference weights, five-year forecast rows, monitoring checklist length, and recommendation values.
- Added `VERSION_9_IMPLEMENTATION_REPORT.md`.
- Expanded `tests/investmentAnalystBrain.test.mjs` to cover profitable growth, transition-to-profitability, cyclical, financial institution, REIT, holding company, external-only data, and negative validation cases.

### Verification

- Version 6 ranking and color tests passed.
- Version 7 valuation workflow tests passed.
- Version 8 investment report experience tests passed.
- Investment Analyst Brain v1.1 canonical tests passed.

## Version 9.0 - Investment Analyst Brain Workflow

### Added

- Added `Investment Analyst Brain v1` methodology files under `docs/investment_analyst_brain_v1/` and `public/investment_analyst_brain_v1/`.
- Added `public/src/analystBrain/methodology.js` to load the fixed methodology and output schema.
- Added `public/src/analystBrain/schemaValidator.js` to validate required JSON output sections.
- Added one-block investment analyst paste workflow.
- Added optional OpenAI parser endpoint at `/api/parse-investment-analyst`.
- Added local parser fallback for explicit key-value data in the pasted block.
- Added deterministic report mapping to the supplied sections: Company, Executive Decision, Executive Summary, Investment Thesis, Classification, Business Quality, Model Selection, Forecast Assumptions, Valuation Results, Scenario Cards, Catalysts, Risks, What Changes My Mind, Final Decision, Monitoring Checklist, and Dashboard Export.
- Added Conservative / Base / Optimistic / Exceptional scenario structure above the existing deterministic scenario calculations.
- Added approval-only dashboard export metadata.
- Added automated integration test in `tests/investmentAnalystBrain.test.mjs`.

### Changed

- Workspace data entry now prioritizes one main paste box instead of exposing long technical forms first.
- AI is used for parsing explicit pasted data only; deterministic code still calculates valuation, WACC, scenarios, fair value, recommendation, and dashboard export.
- Draft generated reports remain private until the investor clicks `Approve and Export`.
- Search input no longer re-renders on every character, fixing the mobile keyboard-close bug.

### Rules Enforced

- Do not rewrite or simplify the supplied methodology files.
- Do not invent missing financial values.
- Do not let AI calculate investment numbers.
- Validate structured report output before approval.
- Export only investor-approved reports to the Evaluated Companies dashboard.

### Verification

- Version 6 ranking and color tests passed.
- Version 7 valuation workflow tests passed.
- Version 8 investment report experience tests passed.
- Investment Analyst Brain v1 integration test passed.
- Local server served the app and methodology schema successfully on `localhost:4321`.

## Version 8.0 - Investment Report Experience

### Added

- Added report-first Investment Report experience after valuation generation.
- Added Quick Summary Card with recommendation, confidence, Investment Score, Fair Value, current price, upside, and maximum upside.
- Added institutional report sections for Executive Summary, Investment Thesis, Valuation Summary, Decision, and What Could Change This Decision.
- Added collapsed report details for assumptions, DCF, WACC, Revenue Forecast, FCF Forecast, CapEx, margins, Terminal Growth, valuation models, financial statements, analyst estimates, Morningstar, risks, catalysts, historical charts, and sources.
- Added `INVESTMENT_REPORT_EXPERIENCE.md`.

### Changed

- Generated valuations now display the final Investment Report before forms or technical panels.
- Data entry, data review, methodology overrides, and version history move below the report as collapsed details after a report exists.
- Visual hierarchy now emphasizes recommendation, confidence, Investment Score, Fair Value, current price, and upside.

### Rules Enforced

- No investment calculation changed.
- No Data Platform, Workflow, Valuation Methodology, Ranking, Comparison, or Approval logic changed.
- Technical detail remains available but is no longer the primary reading experience.

## Version 7.0 - Fixed-Methodology AI Valuation Workflow

### Added

- Added Company Valuation Workspace.
- Added structured input sections for basics, income statement, balance sheet, cash flow, guidance, analyst estimates, Morningstar research, and qualitative research.
- Added paste drafts, parser preview, source metadata, confidence, confirmation status, and original text references.
- Added Data Review groups for confirmed, missing, conflicting, outdated, unconfirmed parsed, automatic, and manual data.
- Added fixed-methodology valuation workflow in `public/src/valuationWorkflow/workflow.js`.
- Added deterministic WACC, FCF bridge, DCF, model selection, Bear/Base/Bull scenarios, recommendation, and report JSON.
- Added investor approval and export workflow.
- Added valuation version IDs, methodology version snapshots, input snapshots, source snapshots, and report snapshots.
- Added Home export fields for confidence, data quality, approved date, and valuation version.
- Added `VALUATION_WORKFLOW.md`, `VALUATION_METHODOLOGY.md`, `VALUATION_POLICY.json`, `VALUATION_OUTPUT_SCHEMA.json`, `AI_ANALYST_CONTRACT.md`, and root `SCHEMA.md`.

### Changed

- Searching a ticker no longer creates a final valuation or automatically adds the company to Home.
- Search results now open a draft valuation workspace.
- Draft and unapproved valuations remain separate from the Evaluated Companies dashboard.
- Home rows now open the approved valuation report when available.
- The report is rendered from fixed JSON sections in the same order for every company.

### Rules Enforced

- Financial calculations are deterministic.
- AI is limited to explanation and structured reporting, not arithmetic.
- Missing data remains missing and reduces confidence.
- Methodology defaults are labeled as assumptions.
- Investor overrides are labeled and require a reason.
- Scenario probabilities must total 100%.
- Only approved valuations export to Home.

## Version 6.1 - Mobile Onboarding

### Added

- Added a mobile-first "Start here" card that explains the analysis flow in three steps.
- Added quick ticker examples for `AAPL`, `MSFT`, `NVDA`, and `AMZN`.
- Added clearer search labels and Arabic onboarding copy for starting a new analysis.
- Added `AMZN` starter metadata without inventing financial values.

### Changed

- Improved mobile spacing, search layout, and horizontal scrolling behavior.
- Fixed a mobile CSS grouping issue so responsive rules apply only at the intended breakpoint.
- Kept wide financial tables scrollable inside the page instead of widening the full mobile viewport.

### Verification

- JavaScript syntax checks passed for updated UI, language, and starter data files.
- Version 6 deterministic ranking and color tests still pass.
- CSS brace balance is valid for local, root GitHub Pages, and docs stylesheets.

## Version 6.0 - Ranking, Comparison & Market Color System

### Added

- Added deterministic `Ranking Engine` in `public/src/engines/rankingEngine.js`.
- Added `RANKING_ENGINE.md`.
- Added centralized semantic color system in `public/src/domain/marketColorSystem.js`.
- Added Ranking Score, Ranking Confidence, Main Positive Factor, Main Negative Factor, and ranking component coverage to evaluated companies.
- Added Home table columns for Rank, Investment Score, and Recommendation.
- Added ranking filters:
  - All
  - BUY
  - HOLD
  - SELL
  - Positive Upside
  - Negative Upside
  - High Data Quality
- Added optional sector filter when verified sector data exists.
- Added 2-5 company comparison from the Home table.
- Added deterministic comparison conclusion derived only from calculated metrics.
- Added semantic badges/icons for upside, fair value, recommendation, risk, and scores.
- Added tests in `tests/version6.test.mjs`.

### Changed

- Home table default sorting now prioritizes actionable companies, Ranking Score, Data Quality, and ticker.
- Home table now preserves Arabic labels while keeping tickers, numbers, ratios, and English financial terms stable.
- Home table uses sticky Rank and Stock columns where practical.
- Valuation method fair values now use the same fair-value color logic as Home.
- Executive Summary score strip now uses the shared score/risk color categories.
- Missing ranking inputs remain missing and reduce Ranking Confidence instead of becoming zero.

### Rules Enforced

- Ranking does not change deterministic Buy / Hold / Sell recommendations.
- Rank numbers are recalculated from the evaluated-company set and are not stored as permanent truth.
- Extreme upside is capped before ranking normalization.
- Risk Score direction is preserved: higher score means lower risk.
- Color is never the only signal; values include arrows, signs, badges, and missing markers.
- No entire Home table row is colored based on a financial signal.

### Verification

- JavaScript syntax check passed for:
  - `public/src/ui/components.js`
  - `public/src/domain/marketColorSystem.js`
  - `public/src/engines/rankingEngine.js`
  - `public/src/state/store.js`
  - `server.mjs`
- Automated Version 6 tests passed:
  - deterministic ranking output
  - missing-data behavior
  - ranking order
  - upside cap
  - color thresholds
  - recommendation colors
  - Risk Score direction
  - score thresholds
  - Arabic/English labels
  - signed percentage formatting
  - evaluated-company de-duplication
- Browser verification passed on `localhost:4321`:
  - Version 6 title and Arabic labels render correctly
  - Home filters render correctly
  - Comparison panel opens for two evaluated companies
  - Missing comparison values remain `—` and do not enter the deterministic conclusion
  - Mobile viewport `390x844` has horizontal table scrolling
  - Rank and Stock sticky offsets are active
  - No browser console errors

## Version 5.1 - Bilingual Home Dashboard & Evaluated Companies

### Added

- Added bilingual Arabic/English language system.
- Added `LANGUAGE_SYSTEM.md`.
- Added centralized language helpers in `public/src/i18n/language.js`.
- Added daily Home workspace with application title, language toggle, search, and Evaluated Companies table.
- Added persistent Evaluated Companies storage in `localStorage`.
- Added deterministic `Range FV`, `Upside %`, `Highest Fair Value`, and `Max FV Upside %` calculations in `public/src/domain/evaluatedCompanies.js`.
- Added sortable professional table columns for Stock, Current Price, Bear, Base, Bull, Morningstar, Range FV, Upside %, and Max FV Upside %.
- Added Arabic Executive Summary and Investment Decision narratives.
- Added Arabic status, rating, UI label, and explanation formatting.
- Added RTL document setup for Arabic investors.

### Changed

- Localized the app shell, navigation, settings, watch list, history, research modules, and empty states.
- Home now defaults to the evaluated companies workspace instead of the full report.
- Selecting an already evaluated company opens the saved report.
- Selecting a new company analyzes it and saves the latest evaluation automatically.
- Latest evaluation replaces the visible row while preserving prior evaluation history.
- Kept professional financial terms in English, including DCF, FCF, ROIC, EPS, P/E, PEG, EV/EBITDA, EV/Sales, Revenue, Quality, Growth, Management, Risk, Bull, Bear, and Base.
- Updated Institutional Research thesis and CIO memo output to Arabic.
- Preserved formulas in English without mixing formula syntax with Arabic.
- Added CSS rules to keep numbers, tickers, ratios, formulas, and financial terms visually stable in RTL layout.

### Rules Enforced

- Language layer does not calculate numbers.
- Language layer does not change deterministic engine outputs.
- Range FV excludes Morningstar and uses Bear/Base/Bull probabilities only.
- Max FV Upside uses the highest available value across Bear, Base, Bull, and Morningstar.
- Missing values display as `—`, never as zero.
- Missing provider text is not converted into invented Arabic content.
- Long unlocalized provider narratives are shown as needing research-grade Arabic wording instead of being machine-translated.

### Verification

- JavaScript syntax check passed for:
  - `public/src/i18n/language.js`
  - `public/src/domain/evaluatedCompanies.js`
  - `public/src/ui/components.js`
  - `public/src/research/institutionalResearch.js`
- Formula check passed for the documented example:
  - Current Price `202`
  - Bear `220`
  - Base `240`
  - Bull `300`
  - Morningstar `280`
  - Range FV `250`
  - Max FV Upside `49%`

## Version 5.0 - Institutional Research

### Added

- Added Institutional Research layer above the existing investment engine.
- Added `INSTITUTIONAL_RESEARCH.md`.
- Added Research panel with:
  - Company Profile
  - Competitive Analysis
  - Historical Performance
  - Historical Valuation
  - Earnings Center
  - Analyst Consensus
  - Investment Thesis
  - Research Timeline
  - Explain Like CIO
- Added local Watch List with:
  - investment thesis
  - target price
  - review date
  - notes

### Changed

- Updated app label and title to Version 5.
- Added verified profile fields from FMP profile response when available.
- Kept architecture, data platform, and investment engine stable.
- Kept the existing V4 storage key to preserve local data platform history.

### Rules Enforced

- Research layer does not fetch directly.
- Research layer does not invent missing financial data.
- CIO summary is deterministic and capped at 300 words.
- Historical valuation percentiles remain unavailable until verified historical market data exists.

### Verification

- JavaScript syntax check passed.
- Empty company produces institutional research modules with unavailable fields, not fabricated content.
- Test company with verified financials produced historical performance rows, current valuation multiples, capital return timeline events, and a CIO summary under 300 words.
- Browser reload on `localhost:4321` showed Version 5, Research modules, and Watch List with no JavaScript console errors.

## Version 4.0 - Data Platform

### Added

- Added unified data platform layer.
- Added provider contracts for:
  - `QuoteProvider`
  - `FinancialProvider`
  - `AnalystProvider`
  - `ResearchProvider`
- Added provider fallback order:
  - Morningstar future placeholder
  - Financial Modeling Prep
  - Manual Input
  - Missing
- Added field-level provenance:
  - value
  - source
  - timestamp
  - confidence
  - update status
- Added Data Health:
  - Overall Data Quality
  - Missing fields
  - Outdated fields
  - Conflicting fields
- Added annual and quarterly financial timeline support.
- Added `DATA_PLATFORM.md`.

### Changed

- Engines now receive a unified data company from `researchEngine.js`.
- `financialMetrics.js` reads values from documented data fields.
- Browser storage key moved to `equityResearchV4State`.
- Backend research payload now includes provider metadata and financial statement timelines.
- UI label updated to Version 4 without redesigning the layout.

### Improved

- API keys are not persisted inside company data.
- Provider logic is isolated from engines.
- Timeline rows retain prior versions when refreshed.
- Search and company loading now run through provider registry/fallback.

### Verification

- JavaScript syntax check passed.
- Empty company returns:
  - decision: `HOLD`
  - status: `INSUFFICIENT_DATA`
  - Data Quality: `0`
  - source: `Missing`
- Complete manual test company returns:
  - status: `ACTIONABLE`
  - populated Data Health
  - source: `Manual Input`
  - annual timeline periods: `2`
- Browser reload on `localhost:4321` showed Version 4 and the Data Health panel with no JavaScript console errors.

## Version 3.0 - Investment Engine

### Changed

- Refactored the app into a deterministic investment engine architecture.
- Moved API keys and manual assumptions into a dedicated Settings panel.
- Reworked the first screen around Search, Executive Summary, and Investment Decision.
- Changed app storage key to `equityResearchV3State` to avoid stale Version 2 sample financial data.

### Added

- Data Completeness Engine.
- Decision Engine.
- Explainability Engine.
- Shared engine reporting structure.
- `INVESTMENT_ENGINE.md`.
- `TODO.md`.

### Improved

- Valuation methods now run only when required inputs exist.
- Every engine now exposes inputs, formula, weighting, output, confidence, and explanation.
- Buy / Hold / Sell decisions are reproducible from deterministic formulas.
- Missing data lowers confidence before valuation output is trusted.

### Removed

- Removed fake default stock prices and fake financial statements from bundled app data.
- Removed zero and one fallbacks from core metric calculations.
- Removed backend heuristic moat and risk inference.
- Removed technical API inputs from the home search area.

### Verification

- JavaScript syntax check passed for the project files.
- Empty-company engine run returns:
  - decision: `HOLD`
  - status: `INSUFFICIENT_DATA`
  - valuation methods: `0`
  - composite fair value: `null`
- Browser reload on `localhost:4321` showed the Version 3 home screen with API keys hidden from the home page and no JavaScript console errors.

## Version 2.1

### Added

- Created formal Version 2.1 documentation set.
- Added `PROJECT_REVIEW.md`.
- Added root-level `ARCHITECTURE.md`.
- Added `CHANGELOG.md`.
- Documented source code structure.
- Documented engine architecture and product philosophy.

## Version 2.0

### Added

- Rebuilt the project direction from dashboard to AI equity research platform.
- Introduced deterministic research engines.
- Added professional investor decision framework.
- Created V2 project folder.

## Version 1.0

### Added

- Original Valuation Desk prototype.
- Stock search page.
- Overview page.
- Manual valuation sources.
- Financial data paste area.
- AI valuation model page.
- Final summary page.
- History page.
