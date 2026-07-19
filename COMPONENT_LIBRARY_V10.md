# Component Library V10

## Product Home

| Component | Role | Source |
| --- | --- | --- |
| Product Hero | Brand identity, Version 10 label, app logo, language/theme actions | `public/src/ui/components.js` |
| Search Signature | Large search plus the product question: "Should I buy this stock today?" | `public/src/ui/components.js` |
| Quick Actions | Paste Data, Demo Report, Source Settings | `public/src/ui/components.js` |
| Recent Analyses | Approved reports only, shown as cards/table depending viewport | `public/src/ui/components.js` |
| Watchlist Panel | Saved company notes and review flow | `public/src/ui/components.js` |

## Workflow

| Component | Role | Source |
| --- | --- | --- |
| Paste Input | One main unstructured paste box | `public/src/ui/components.js` |
| Data Review | Confirmed, needs review, missing, and conflicting field groups | `public/src/ui/components.js` |
| Processing State | Calm status while deterministic workflow runs | `public/src/ui/components.js` |

## Investment Report

| Component | Role | Source |
| --- | --- | --- |
| Report Company Hero | Company, ticker, sector, Current Price, Fair Value, Recommendation, Confidence | `public/src/ui/components.js` |
| Decision Card | Large recommendation, Fair Value, Upside, Current Price, Maximum Upside, Confidence, Investment Score | `public/src/ui/components.js` |
| Quick Summary | Compact investment committee readout | `public/src/ui/components.js` |
| Scenario Cards | Bear, Base, Bull cards with probability and fair value | `public/src/ui/components.js` |
| Fair Value Range | Visual range marker for Current Price and Range Fair Value | `public/src/ui/components.js` |
| Business Quality | Compact quality scoring and drivers | `public/src/ui/components.js` |
| Risk Cards | Risk score and major risk factors | `public/src/ui/components.js` |
| Valuation Models | Selected model cards only; unsupported models are not shown as selected | `public/src/ui/components.js` |
| Forecast KPIs | Five-year forecast summary visuals | `public/src/ui/components.js` |
| Monitoring | Thesis monitoring metrics and triggers | `public/src/ui/components.js` |
| Collapsible Details | Assumptions, DCF, WACC, forecasts, sources, risks, catalysts, and methodology | `public/src/ui/components.js` |

## Styling Contract

| Layer | Source |
| --- | --- |
| Product tokens | `public/styles.css` |
| Responsive behavior | `public/styles.css` |
| Microinteractions | `public/styles.css` |
| RTL and number alignment | `public/styles.css` |
| GitHub Pages synced copy | `docs/styles.css` |

## Do Not Use Components For

- Creating or changing financial values
- Selecting valuation models
- Changing recommendation logic
- Editing methodology weights
- Exporting drafts to the dashboard

