# Institutional Research - Version 5

## Objective

Version 5 adds an Institutional Equity Research layer above the existing platform.

The following systems remain frozen:

- architecture
- data platform
- investment engine

The research layer consumes verified data already available from the company object, data platform, and deterministic investment engine. It does not fetch directly and does not invent financial data.

## Source

```text
public/src/research/institutionalResearch.js
```

## Modules

### 1. Company Profile

Displays:

- business summary
- business model
- revenue segments
- geographic exposure
- customers
- competitive advantages
- key products
- management

Only fields present in `company.researchProfile` or explicit moat evidence are displayed. Missing fields remain unavailable.

### 2. Competitive Analysis

Displays:

- main competitors
- market share
- competitive strengths
- competitive weaknesses
- peer comparison

The layer can use explicit research profile data plus deterministic moat and risk factors. It does not infer competitors from sector names.

### 3. Historical Performance

Visualizes up to 10 annual periods when available:

- revenue
- EPS
- free cash flow
- operating margin
- ROIC
- gross margin
- debt
- share count

These values are calculated from verified financial statements already loaded into the data platform.

### 4. Historical Valuation

Displays current multiples when possible:

- P/E
- EV/EBITDA
- EV/Sales
- Price/FCF

Historical percentiles remain unavailable until verified historical market price or enterprise value data is added.

### 5. Earnings Center

Displays when provider data exists:

- last earnings
- revenue surprise
- EPS surprise
- guidance
- management commentary summary
- next earnings date

Version 5 does not invent earnings commentary.

### 6. Analyst Consensus

Displays:

- low target
- average target
- high target
- rating
- rating distribution
- upgrades
- downgrades
- consensus trend

Only connected provider data is shown.

### 7. Investment Thesis

Generates a structured deterministic memo:

- why invest
- why avoid
- biggest opportunities
- biggest risks
- what would change the thesis

The memo is built from deterministic engine factors, missing-data flags, and exit thesis text.

### 8. Watch List

Allows investors to save companies with:

- investment thesis
- target price
- review date
- notes

The watch list is stored locally in browser storage.

### 9. Research Timeline

Displays verified events:

- earnings
- major news
- dividend
- buybacks
- product launches
- CEO changes
- acquisitions

Version 5 derives dividends and buybacks from verified financial timelines when available. Other events require explicit provider data.

### 10. Explain Like CIO

Generates one executive summary:

- maximum 300 words
- professional
- objective
- suitable for a portfolio manager

The CIO summary is deterministic and built only from verified profile data, engine outputs, data quality, and thesis factors.

## Rules

- Do not invent financial data.
- Do not summarize unverified facts as if they are known.
- Do not use AI to calculate or fill missing information.
- Do not fetch directly from research modules.
- Missing information should display as unavailable.

## Current Limitations

- Competitors, market share, revenue segments, geographic exposure, customers, products, earnings commentary, and analyst revisions require richer provider feeds.
- Historical valuation percentiles require verified historical market price or enterprise value data.
- Watch List is local only and not yet backed by a server database.
