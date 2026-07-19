# UI Component Map V9.2

## Entry Points

| Area | File | Purpose |
| --- | --- | --- |
| App mount | `public/src/main.js` | Creates store and mounts UI. |
| UI rendering | `public/src/ui/components.js` | Main component renderer and event binding. |
| App state | `public/src/state/store.js` | Workflow actions, demo loading, processing state, persistence. |
| Styling | `public/styles.css` | Design tokens, responsive layout, report-first UI, mobile breakpoints. |
| Localization | `public/src/i18n/language.js` | Arabic/English labels, RTL/LTR behavior, financial term preservation. |
| Demo fixture | `public/src/data/demoFlow.js` | Demo input and confirmed fields used by the real engine. |

## Main Screens

| Screen | Component / Function | Evidence |
| --- | --- | --- |
| Home / Company List | `homeDashboard`, `homeCompanyCardsSection`, `evaluatedCompanyCard` | `mobile-01-home.png`, `desktop-01-home.png` |
| New Analysis / Paste Input | `emptyAnalysisWorkspace`, `analystBrainPastePanel` | `mobile-03-paste-input.png`, `mobile-05-paste-input-demo-loaded.png` |
| Data Review | `dataReviewPanel`, `reviewGroup` | `mobile-06-data-review.png` |
| Processing State | `processingStatePanel` | `mobile-07-processing.png` |
| Investment Report | `investmentReportExperience`, `reportCompanyHeader`, `quickSummaryCard` | `mobile-08-decision-summary.png`, `desktop-02-investment-report.png` |
| Scenario Cards | `scenarioCards`, `priceScenarioChart` | `mobile-09-scenario-cards.png` |
| Fair Value Range | `fairValueVisual`, `valueMarker` | `mobile-10-fair-value-range.png` |
| Business Quality | `businessQualityOverview` | `mobile-11-business-quality.png` |
| Valuation Models | `valuationModelsSnapshot` | `mobile-12-valuation-models.png` |
| Risks / Shariah | `riskSnapshot`, `shariahComplianceCard` | `mobile-13-risks.png` |
| Monitoring | `monitoringSnapshot` | `mobile-14-monitoring.png` |
| Export / Approval | `finalActionsBlock` | `mobile-15-export.png` |

## State Actions

| Action | File | Behavior |
| --- | --- | --- |
| `startBlankAnalysis` | `public/src/state/store.js` | Opens a blank one-paste workflow. |
| `loadDemoAnalysis` | `public/src/state/store.js` | Loads demo data into the workflow as confirmed fields. |
| `clearAnalystPaste` | `public/src/state/store.js` | Clears the current draft. |
| `runWorkspaceValuation` | `public/src/state/store.js` | Runs the existing deterministic methodology after review. |
| `runAnalystBrainValuation` | `public/src/state/store.js` | Parses pasted data and runs the existing deterministic methodology. |
| `approveAndExportWorkspace` | `public/src/state/store.js` | Exports only approved reports to Home. |

## Design Tokens

Primary tokens are defined in `public/styles.css` under `:root` and `[data-theme="light"]`.

The V9.2 additions reuse these variables:

- `--bg`
- `--surface`
- `--surface-2`
- `--ink`
- `--muted`
- `--line`
- `--accent`
- `--green`
- `--warning`
- `--red`
- `--radius`

No random one-off color system was added.

## Engine Boundary

UI components read values from `workspace.report` and `workspace.dataReview`.

They do not calculate recommendations, model fair values, scenario fair values, forecast rows, or Investment Score.
