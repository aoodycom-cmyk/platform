# UI Changelog V9.2

## Objective

Version 9.2 improves the Investment Analyst Platform user experience without changing the deterministic analytical engine.

## Completed

- Home is now a mobile-first workspace with app identity, New Analysis, Demo Data, search, and compact evaluated-company cards.
- The search input no longer re-renders the app on every typed character, which protects mobile keyboard focus.
- The primary workflow is now: Search or New Analysis -> Paste Input -> Data Review -> Processing -> Investment Report -> Approve and Export.
- Paste Input now uses one main paste box plus optional ticker and company name only.
- Data Review now groups fields as Confirmed, Needs Review, Missing, and Conflicting.
- Processing now shows meaningful stages without fake percentages.
- The Investment Report now leads with the decision, confidence, score, current price, Fair Value, upside, and scenario context.
- Scenario cards, Fair Value Range visual, Business Quality breakdown, selected valuation models, forecast bars, risks, monitoring, and export actions are visible in the report.
- Technical details remain available below the report in collapsible sections.
- Shariah Compliance displays Data Unavailable unless a verified Shariah source is supplied.
- Mobile screenshots were captured at 393x852 and desktop screenshots at 1440x1000.
- Horizontal overflow was checked at 393px and 430px.

## Not Changed

- Valuation formulas.
- Recommendation gates.
- Model selection rules.
- Forecast logic.
- Methodology rules.
- JSON schema validation.
- Supported/unsupported valuation model contract.

## New Files

- `public/src/data/demoFlow.js`
- `src/data/demoFlow.js`
- `docs/src/data/demoFlow.js`
- `tests/version9_2UIUX.test.mjs`
- `UI_CHANGELOG_V9.2.md`
- `UI_COMPONENT_MAP.md`
- `UI_TEST_RESULTS.md`
- `UI_RUN_INSTRUCTIONS.md`
- `UI_DELIVERY_STATUS_V9.2.md`
- `screenshots-v9.2-ui/`

## Modified UI Files

- `public/src/ui/components.js`
- `src/ui/components.js`
- `docs/src/ui/components.js`
- `public/styles.css`
- `docs/styles.css`
- `public/src/state/store.js`
- `src/state/store.js`
- `docs/src/state/store.js`
- `public/src/i18n/language.js`
- `src/i18n/language.js`
- `docs/src/i18n/language.js`
- `package.json`
- `CHANGELOG.md`

## Engine Integrity

The following hashes stayed unchanged during Version 9.2:

```text
b80df9a55ef224ccd73e5ce5ed74b14b65ad62e9e172a6c051282b0696d6e05b  analystBrain/engine.js
3ab79b3dcc36ba8ba4d3c4e4751efef5905ca9083b36df0878c7d95da6cf1b0d  valuationWorkflow/workflow.js
48cc3ad7db62b0e87d2efccf7be9060a0868b0ed7087940f39776acffe580552  analystBrain/schemaValidator.js
```
