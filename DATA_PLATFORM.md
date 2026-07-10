# Data Platform - Version 4

## Objective

Version 4 adds a unified financial data layer under the existing investment engine.

The UI and investment engine remain stable. The change is that every financial field now carries provenance:

- value
- source
- timestamp
- confidence
- update status

## Core Principle

Engines must not fetch data directly.

The flow is:

```text
Provider Registry
  ↓
Provider Fallback
  ↓
Unified Data Company
  ↓
Domain Metrics
  ↓
Investment Engines
```

## Provider Interfaces

Provider roles are defined in:

```text
public/src/dataPlatform/providerContracts.js
```

Supported provider types:

- `QuoteProvider`
- `FinancialProvider`
- `AnalystProvider`
- `ResearchProvider`

Current registry:

```text
Morningstar future placeholder
↓
Financial Modeling Prep
↓
Manual Input
↓
Missing
```

The registry stores public provider metadata only. API keys are not persisted into company data.

## Field Contract

Fields are created in:

```text
public/src/dataPlatform/fields.js
```

Field shape:

```text
{
  value,
  source,
  timestamp,
  confidence,
  updateStatus,
  providerType,
  field,
  statement,
  period,
  fiscalPeriod,
  conflicts
}
```

Update statuses:

- `fresh`
- `outdated`
- `manual`
- `missing`
- `conflict`

## Unified Company

Unified data is built in:

```text
public/src/dataPlatform/dataPlatform.js
```

The builder wraps:

- quote fields
- analyst consensus fields
- latest financial fields
- manual inputs
- annual timeline rows
- quarterly timeline rows

The app still keeps the old company shape for compatibility, but values are now documented fields instead of plain numbers.

## Financial Timeline

The data platform stores:

- annual income statements
- annual balance sheets
- annual cash flow statements
- quarterly income statements
- quarterly balance sheets
- quarterly cash flow statements

History is merged by period and date. When a period is refreshed, the current row is kept and prior versions are retained under `priorVersions`.

## Data Health

Data Health is calculated from required research fields.

Displayed outputs:

- Overall Data Quality 0-100
- Missing fields
- Outdated fields
- Conflicting fields
- Annual timeline count
- Quarterly timeline count

Core health fields include:

- current price
- market capitalization
- revenue
- gross profit
- operating income
- net income
- EPS
- free cash flow
- cash
- debt
- equity
- diluted shares
- analyst target
- Morningstar fair value

## Confidence Model

Current confidence defaults:

- Financial Modeling Prep quote: 98%
- Financial Modeling Prep financials: 96%
- Financial Modeling Prep analyst data: 82%
- Manual input: 70%
- Missing: 0%

Outdated fields and conflicting fields reduce Data Health.

## Backend Changes

The local backend still exposes:

```text
POST /api/search
POST /api/research-data
```

`/api/research-data` now returns:

- provider metadata
- normalized company profile
- quote
- analyst consensus
- annual financial timeline
- quarterly financial timeline

## Engine Integration

`researchEngine.js` converts all incoming company data into a unified data company before running engines.

`financialMetrics.js` reads values from data fields transparently, so valuation and scoring formulas remain deterministic while gaining provenance.

## Current Limitations

- Only Financial Modeling Prep is implemented as a live provider.
- Morningstar is a future provider placeholder.
- Conflicts are structurally supported, but meaningful conflicts require at least two live providers.
- Data is still stored in browser storage, not a server database.
- Field-level audit history is local only.
