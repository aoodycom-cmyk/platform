# Data Model

## Company

- ticker
- name
- sector
- industry
- exchange
- currency
- quote
- consensus
- financials
- dataPlatform
- qualitative

## DataField

- value
- source
- timestamp
- confidence
- updateStatus
- providerType
- field
- statement
- period
- fiscalPeriod
- conflicts

Update statuses:

- fresh
- outdated
- manual
- missing
- conflict

## QuoteSnapshot

- ticker
- price
- marketCap
- enterpriseValue
- changePercent
- updatedAt
- provider

All unavailable numeric fields should be `null`, not zero.

## FinancialStatement

- ticker
- year
- revenue
- grossProfit
- operatingIncome
- netIncome
- eps
- freeCashFlow
- operatingCashFlow
- capex
- ebitda
- cash
- debt
- equity
- shares
- dividends
- buybacks

In Version 4, financial statement values are `DataField` objects when loaded through the data platform.

## FinancialTimeline

- annual.incomeStatements
- annual.balanceSheets
- annual.cashFlowStatements
- quarterly.incomeStatements
- quarterly.balanceSheets
- quarterly.cashFlowStatements

Rows may contain `priorVersions` when a period is refreshed.

## Consensus

- target
- low
- high
- rating
- provider

## QualitativeEvidence

- moatSignals
- riskSignals
- managementNotes
- source
- updatedAt

Qualitative signals should come from explicit evidence, not sector inference.

## ResearchProfile

- source
- updatedAt
- businessSummary
- businessModel
- revenueSegments
- geographicExposure
- customers
- competitiveAdvantages
- keyProducts
- management
- competitors
- marketShare
- competitiveStrengths
- competitiveWeaknesses
- peerComparison

Unavailable fields remain empty or `null`.

## InstitutionalResearch

- companyProfile
- competitiveAnalysis
- historicalPerformance
- historicalValuation
- earningsCenter
- analystConsensus
- investmentThesis
- researchTimeline
- cioSummary

## ManualValuationInput

- ticker
- averageCost
- morningstarFairValue
- notes

## EngineResult

- name
- inputs
- formula
- weighting
- output
- confidence
- explanation
- factors
- missing

## ScoreFactor

- label
- impact
- explanation
- status

Status values:

- observed
- missing

## ValuationMethodResult

- method
- fairValue
- weight
- confidence
- explanation
- inputs

## Scenario

- name
- probability
- fairValue
- assumptions

## InvestmentDecision

- label
- confidence
- compositeScore
- status
- valuationScore
- positionSize
- addBelow
- reduceAbove
- exitThesis
- components

## ValuationRun

- ticker
- date
- price
- compositeFairValue
- marginOfSafety
- decision
- confidence
- status
- valuationMethods
- scores
- scenarios
- missing

## WatchListItem

- id
- ticker
- name
- decision
- confidence
- investmentThesis
- targetPrice
- reviewDate
- notes
- updatedAt

## DataHealth

- overallScore
- rating
- missingFields
- outdatedFields
- conflictingFields
- fieldCount
- timelinePeriods
