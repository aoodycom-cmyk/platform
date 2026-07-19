# Design System V10

## Product Direction

Franklin Research V10 is designed as a premium investment research product, not a generic dashboard. The visual goal is fast decision comprehension on iPhone first, with a calm institutional feel inspired by Apple Stocks, Bloomberg Research, Morningstar Premium, Linear, and Notion.

## Core Principles

| Principle | Implementation |
| --- | --- |
| Decision first | Recommendation, Current Price, Fair Value, Upside, and Confidence appear before technical details |
| One primary action | Home centers on search and New Analysis instead of dense controls |
| Progressive disclosure | Technical sections remain available but secondary |
| Mobile first | 430px viewport has no horizontal overflow |
| RTL professional Arabic | Arabic analysis is RTL while standard terms like DCF, FCF, ROIC, EPS, P/E, and Fair Value remain readable |
| Quiet premium | Muted surfaces, disciplined borders, subtle elevation, and restrained color signals |

## Color Tokens

| Token | Purpose |
| --- | --- |
| `--bg` | Main page background |
| `--surface` | Primary panels and report cards |
| `--surface-2` | Secondary panels |
| `--surface-3` | Interactive controls |
| `--ink` | Primary text |
| `--ink-soft` | Secondary text |
| `--muted` | Labels and supporting copy |
| `--line` | Structural borders |
| `--accent` | Product teal accent |
| `--gold` | Premium report emphasis |
| `--green` / `--strong-green` | Positive investment signal |
| `--amber` / `--orange` | Hold, watch, or caution signal |
| `--red` | Sell, risk, and downside signal |

## Typography

- Uses an Apple-style system font stack.
- Hero typography is reserved for product identity and recommendation only.
- Compact panels use smaller, tighter headings.
- Letter spacing is kept at `0`.
- Financial numbers use `direction: ltr` and `unicode-bidi` handling where needed.

## Spacing And Shape

| Token | Purpose |
| --- | --- |
| `--space-1` to `--space-8` | Consistent page rhythm |
| `--radius` | Standard 8px card radius |
| `--radius-lg` | Select product surfaces and app identity |
| `--shadow` | Premium depth for primary cards |
| `--shadow-soft` | Gentle hover or secondary elevation |

## Interaction

- Buttons, cards, and compact actions have subtle transform and shadow changes.
- Motion is short and restrained.
- Inputs avoid disruptive re-rendering so mobile keyboard focus stays stable.
- Cards use touch-friendly hit areas.

## Responsive Contract

| Breakpoint | Behavior |
| --- | --- |
| Desktop | Wider grids, expanded report composition, richer spacing |
| Tablet | Report and metric grids collapse to two columns |
| Mobile 430px and below | Single-column app rhythm, compact header, two-column key metrics, fixed bottom navigation |

## Frozen Systems

The design system must not alter:

- Analytical formulas
- Forecast engine
- Valuation model selection
- Recommendation logic
- JSON schema validation
- API provider contracts
- Methodology files

