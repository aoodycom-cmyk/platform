# AI Analyst Contract

Status: CANONICAL AUTHORITY MODEL FOR FAIR VALUE / FRANKLIN V3

The active product contract is defined by `FRANKLIN_PRODUCT_CONSTITUTION.md` and the V3 external-analysis implementation.

## Core Rule

Fair Value inside ChatGPT is the financial analyst.

Franklin is the persistent application, validator, version store, and presentation layer. Franklin must not become the financial decision-maker.

## Fair Value / ChatGPT Responsibilities

Fair Value / ChatGPT owns financial judgment, including:

- researching the company and its latest available information
- explaining the business model in clear Arabic
- selecting company-specific KPIs
- assessing data quality and business quality
- classifying the company for analytical purposes
- identifying strengths, weaknesses, risks, and catalysts
- selecting suitable valuation methods and excluding unsuitable methods
- selecting valuation-model weights
- setting forecast assumptions used in the analysis
- constructing exactly three core scenarios: Bear, Base, and Bull
- choosing scenario probabilities
- producing Bear, Base, and Bull fair values
- producing the probability-weighted fair value from those analyst-selected scenarios
- selecting the stock-level decision: BUY, ADD, HOLD, WATCH, REDUCE, or SELL
- writing and updating the investment thesis
- choosing next-quarter monitoring requirements and their weights
- interpreting quarterly earnings, guidance, and company-specific KPI performance
- deciding thesis impact and whether valuation should change after new evidence

## Franklin Responsibilities

Franklin may perform deterministic validation and state-management work only.

It may:

- build the Fair Value prompt
- provide the canonical JSON template
- parse/import returned JSON
- validate required fields, types, enums, and provenance
- verify arithmetic identities
- verify scenario probabilities total 100%
- verify valuation model weights total 100%
- verify Bear <= Base <= Bull
- verify the supplied probability-weighted value matches the supplied scenario values and probabilities
- verify upside and margin-of-safety arithmetic
- verify requirement weights total 100%
- preserve `NOT_REPORTED` with null actual values when the company did not disclose a metric
- reject inconsistent analysis instead of silently repairing financial judgment
- assign permanent analysis and requirement-set IDs after successful import
- preserve immutable history
- compare versions
- render reports and dashboards
- handle import/export, backups, migrations, and application state

## Forbidden Franklin Behavior

Franklin must not:

- choose the valuation method
- choose Bear/Base/Bull assumptions
- choose or change fair value because a formula or threshold suggests another number
- choose scenario probabilities
- choose the recommendation
- invent company-specific KPIs
- generate monitoring requirements as financial judgment
- replace a missing value with zero
- mark an undisclosed quarterly requirement as failed
- use a hard-coded valuation threshold to override the analyst decision
- silently normalize or drop financially material imported fields

When financial values are inconsistent, Franklin rejects the input and explains the problem. It does not select a replacement analytical answer.

## Canonical Contract

Active versions:

```text
schemaVersion: franklin-fair-value/v3
methodologyVersion: fair-value-methodology/v2
```

Primary implementation:

```text
public/src/externalAnalysis/v3Contract.js
public/src/externalAnalysis/chatgptContract.js
public/src/externalAnalysis/externalAnalysisSchemaValidator.js
```

Legacy deterministic analyst-engine contracts are compatibility/history only and must not override V3.

## JSON Integrity Rules

The application validates at minimum:

- required V3 fields
- canonical versions
- valid enums
- exactly Bear, Base, and Bull core scenarios
- scenario probabilities total 100%
- valuation method weights total 100%
- Bear <= Base <= Bull
- probability-weighted fair value arithmetic
- upside/downside arithmetic
- margin-of-safety arithmetic
- next-requirement weights total 100%
- source/provenance structure
- reporting-currency versus trading-currency consistency
- `NOT_REPORTED` semantics
- prior-analysis and prior-requirement references for earnings revaluations

Invalid output is rejected.

## Language and Direction Rules

Arabic is the primary report language and reading direction.

Standard financial terms may remain English, including DCF, FCF, ROIC, EBITDA, CapEx, EPS, P/E, EV/EBITDA, WACC, SOTP, Bear, Base, and Bull.

The UI must use proper bidi isolation / LTR wrappers where needed so English terms and numbers remain readable inside Arabic text.

## Source Rules

Fair Value / ChatGPT must not invent company data.

Material numbers must be traceable to one of:

- company / Investor Relations disclosure
- SEC or other official filing
- earnings call or official management guidance
- verified market-data source
- consensus data identified as consensus
- user-provided data identified as user-provided
- analyst assumption clearly labeled as an assumption

Reported data, consensus estimates, and analyst assumptions must remain distinguishable.

## Quarterly Rule

For earnings revaluation, Fair Value compares the new reported quarter with the previously saved requirement set.

If the company did not report a required metric:

```text
status = NOT_REPORTED
actualValue = null
```

Franklin preserves that result and does not reinterpret it.
