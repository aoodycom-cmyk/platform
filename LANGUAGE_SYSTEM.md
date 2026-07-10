# Language System - Version 5.1

## Objective

The platform supports Arabic and English while preserving professional financial terminology.

The product should feel like a Bloomberg or Morningstar-style research platform adapted for Arabic-speaking and English-speaking investors, not a machine-translated dashboard.

## Rules

- Arabic UI labels are localized naturally.
- English UI labels use professional finance wording.
- Arabic uses RTL.
- English uses LTR.
- The language toggle is compact and persists in `localStorage`.
- Investment summaries, explanations, thesis notes, CIO memo text, and recommendation narratives follow the selected language.
- Standard finance terms remain in English:
  - DCF
  - Reverse DCF
  - FCF
  - ROIC
  - EPS
  - P/E
  - PEG
  - EV/EBITDA
  - EV/Sales
  - Revenue
  - Operating Margin
  - Gross Margin
  - Free Cash Flow
  - Economic Moat
  - Bull
  - Bear
  - Base
  - Management
  - Quality
  - Growth
  - Risk
- Clarified terms use English first, then Arabic explanation:
  - `ROIC (العائد على رأس المال المستثمر)`
  - `Free Cash Flow (التدفق النقدي الحر)`
- Financial formulas remain English and are never mixed with Arabic.
- Numbers, ratios, tickers, table columns, and formulas use stable LTR rendering inside the Arabic RTL layout.

## Implementation

Language logic is centralized in:

```text
public/src/i18n/language.js
```

Responsibilities:

- Set document language and RTL/LTR direction.
- Localize UI labels.
- Preserve and clarify financial terms.
- Localize recommendation labels.
- Localize status and rating labels.
- Convert deterministic engine explanations into selected-language display text.
- Generate selected-language Executive Summary and Investment Decision narratives.

## UI Integration

The UI imports language helpers from:

```text
public/src/ui/components.js
```

The CSS handles RTL layout and financial LTR stability in:

```text
public/styles.css
```

## Invariants

- The language system does not calculate numbers.
- The language system does not alter investment engine outputs.
- The language system does not invent financial data.
- AI remains optional and is only allowed for explanation, summarization, and challenge.
- Deterministic calculations remain the source of every financial output.
