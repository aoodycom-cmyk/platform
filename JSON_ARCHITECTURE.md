# Franklin JSON Architecture

The executable source of truth is `src/externalAnalysis/jsonContractRouter.js`,
`src/externalAnalysis/jsonContractInventory.js`, and their contract tests. Franklin is a JavaScript
application, so there is no separate TypeScript model to reconcile. The canonical persisted analysis
model is `external-analysis-report/v2`.

## Contract inventory

| Schema version | Payload type | Import route | Validator | Adapter | Internal model | Storage destination | Consuming UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `franklin-fair-value/v3` | Initial or earnings revaluation | full-analysis | `validateFranklinV3Report` | `franklinV3ToExternalReport` | `external-analysis-report/v2` | `externalAnalyses` and quarterly lifecycle | All stock pages and export |
| `external-analysis-supplement/v1` | Missing-data supplement | supplement | `validateExternalAnalysisSupplement` | `normalizeExternalAnalysisSupplement` | approved patch against canonical report | target report plus supplement audit | Completion preview |
| `quarterly-earnings-lite/v2` | Auditable focused earnings update | quarterly-earnings | strict source, metric, frozen-requirement, and assessment validation | `inflateQuarterlyEarningsLitePayload` | `external-analysis-report/v2` | `externalAnalyses` and quarterly history | Earnings workspace |
| `quarterly-earnings-lite/v1` | Legacy focused earnings update | quarterly-earnings | legacy compatibility validation | `inflateQuarterlyEarningsLitePayload` | `external-analysis-report/v2` | `externalAnalyses` and quarterly history | Earnings workspace |
| `external-analysis-report/v2` | Canonical export/re-import | full-analysis | `validateExternalAnalysisReport` | `normalizeExternalAnalysisReport` | same version | `externalAnalyses` | All stock pages |
| `external-analysis-report/v1` | Legacy analysis | full-analysis | canonical validator after normalization | `normalizeExternalAnalysisReport` | v2 | `externalAnalyses` | All stock pages |
| `fair-value-analysis/v2` | Legacy fair-value analysis | full-analysis | fair-value contract plus canonical validator | `fairValueAnalysisToExternalReport` | v2 | `externalAnalyses` | Stock workspace |
| `fair-value-analysis/v1` | Legacy fair-value analysis | full-analysis | fair-value contract plus canonical validator | `fairValueAnalysisToExternalReport` | v2 | `externalAnalyses` | Stock workspace |
| `franklin-investment-backup/v1` | Application backup | backup | `validateInvestmentDataBackup` | `migrateFranklinState` | Franklin state v2 | `equityResearchV4State` | Settings restore |

## Routing policy

All analysis paste and file routes parse JSON, detect `schemaVersion`, dispatch to one validator and
adapter, then normalize before UI code sees the payload. Missing or unknown schemas fail without a
write and include an Arabic diagnostic with JSON path, received/expected values, detected payload,
active schema, and recommended route.

A supplement entering the full importer is redirected only when its ticker and target analysis are
safe. A full analysis entering the supplement screen is fully validated and only requested,
whitelisted missing fields are extracted. Its full payload is never relabeled or stored as a
supplement.

## V3 field coverage

Every row below is also represented in `FRANKLIN_V3_FIELD_COVERAGE`. The exact source value is kept at
`metadata.franklinV3Report.<source path>`, persisted in `externalAnalyses[ticker][]`, exported at the
same path, and compared after re-import by `tests/jsonArchitecture.test.mjs`.

| Source path | Canonical read path | Type | Requirement | Primary consumer |
| --- | --- | --- | --- | --- |
| `reportIdentity.ticker` | `company.ticker` | string | required | Header/library |
| `reportIdentity.companyName` | `company.name` | string | required | Header/company |
| `reportIdentity.analysisDate` | `analysisDate` | ISO date/timestamp | required | Metadata/history |
| `reportIdentity.fiscalQuarter` | `fiscalIdentity.fiscalQuarter` | Q1-Q4 | required | Earnings history |
| `reportIdentity.fiscalYear` | `fiscalIdentity.fiscalYear` | integer | required | Earnings history |
| `reportIdentity.periodEndDate` | `fiscalIdentity.periodEndDate` | ISO date | required | Quarter identity |
| `company.reportingCurrency` | `company.reportingCurrency` | currency | required | Financial values |
| `company.tradingCurrency` | `company.tradingCurrency` | currency | required | Valuation |
| `company.securityUnit` | `company.securityUnit` | enum | required | Valuation |
| `marketPrice.value` | `marketPrice.value` | number | required | Decision hero |
| `marketPrice.currency` | `marketPrice.currency` | currency | required | Decision hero |
| `marketPrice.asOf` | `marketPrice.asOf` | ISO date/timestamp | required | Price metadata |
| `marketPrice.priceType` | `marketPrice.priceType` | enum | required | Price metadata |
| `valuation.current.bear` | `valuation.current.bear` | number | required | Scenarios |
| `valuation.current.base` | `valuation.current.base` | number | required | Decision hero |
| `valuation.current.bull` | `valuation.current.bull` | number | required | Scenarios |
| `valuation.current.probabilityWeighted` | `valuation.current.probabilityWeighted` | number | required | Valuation summary |
| `valuation.valuationResults` | `valuation.valuationResults` | array | required | Methodology |
| `valuation.scenarios` | `valuation.scenarios` | object | required | Scenarios |
| `valuation.calculationAudit` | `valuation.calculationAudit` | object | required | Audit detail |
| `thesis.updatedSummary` | `thesis.updatedSummary` | string | required | Summary |
| `businessQuality.score` | `businessQuality.score` | number | required | Company assessment |
| `businessQuality.components` | `businessQuality.components` | object | required | Company assessment |
| `decision.action` | `decision.action` | enum | required | Decision hero |
| `decision.confidence` | `decision.confidence` | number from 0 to 100 | required | Decision hero |
| `decision.investmentScore` | `decision.investmentScore` | number | required | Decision hero |
| `decision.rationale` | `decision.rationale` | array | required | Decision detail |
| `financialNormalization` | `financialNormalization` | object | required | Financial detail |
| `latestQuarter` | `latestQuarter` | object | required | Reported-quarter UI |
| `forecast` | `forecast` | object | required | Forecast detail |
| `strengths` | `strengths` | array | required | Strengths/risks |
| `weaknesses` | `weaknesses` | array | required | Strengths/risks |
| `risks` | `risks` | array | required | Strengths/risks |
| `catalysts` | `catalysts` | array | required | Summary |
| `monitoringChecklist` | `monitoringChecklist` | array | required | Monitoring |
| `sources` | `sources` | array | required | Sources/provenance |
| `nextRequirements` | `nextRequirements` | object | required | Upcoming quarter |
| `previousRequirementsEvaluation` | `previousRequirementsEvaluation` | object/null | conditional | Reported scorecard |

## Supplement merge

Supplement keys are literal whitelisted dotted paths. They are never interpreted as arbitrary object
paths. The shared definitions in `supplementContract.js` drive missing-field analysis, prompt metadata,
normalization, validation, and merge. Null never erases a non-null value. Arrays use explicit replace
on user approval. Existing conflicts block the entire merge until resolved. Unsafe prototype keys and
unresolved source references are rejected. The store persists and reads back the complete next state
before mutating in-memory state or showing success.

## Quarterly lifecycle and migration

`quarterlyEarningsHistory` is keyed by ticker and stable fiscal quarter identity. Reported records keep
`latestQuarter`; upcoming records keep frozen `nextRequirements` with no actuals and
`NOT_REPORTED` status. A matching earnings revaluation converts the placeholder to reported while
retaining the established requirement set and evaluation. Corrections keep the same quarter, retain
older non-null values when a new value is null, select the newer non-null value deterministically, and
record conflicts. Sources and IDs are deduplicated.

State schema v2 migration derives missing history from saved analyses. It supports dry-run statistics,
creates a timestamped pre-migration local backup, writes atomically with read-back verification, rolls
back on failure, and is exactly idempotent. The primary investment store is localStorage key
`equityResearchV4State`; there is no IndexedDB investment store. Optional Franklin Cloud transports
the same state but does not replace the local canonical model.
