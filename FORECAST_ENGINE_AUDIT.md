# Forecast Engine Audit - Version 9

Canonical functions: `buildForecastPolicy()`, `buildWacc()`, `buildYearlyForecast()`, `adjustForecast()` in `src/analystBrain/engine.js`.

| Area | Verified Behavior | Source / Confidence | Reused Constants Or Defaults |
| --- | --- | --- | --- |
| Independent Year 1-5 assumptions | PARTIALLY. The engine creates five separate yearly rows, but each row is mechanically derived from starting assumptions faded toward terminal growth/target margin. It does not accept independent year-by-year investor assumptions. | Each row carries source and confidence inherited from revenue/margin/capex assumptions. | Fade formula, terminalGrowth, shared taxRate, shared D&A/Revenue, shared WC drag, shared dilution. |
| Revenue | Starts from current Revenue if positive, then applies yearly revenueGrowth. Growth fades from selected growth to terminal growth. | Revenue Growth source can be Analyst estimates, Company guidance, historical/current evidence, or Methodology default. | Growth clamp -15% to 35%; class defaults in CLASS_DEFAULTS. |
| Margins | Operating Margin starts from current margin or class default and fades toward target. | Source is Current Operating Margin or Methodology default. | Margin clamp -20% to 45%. |
| CapEx | CapEx / Revenue comes from guidance, historical CapEx / Revenue, or class default. | Source/confidence explicitly stored in forecastPolicy.capex. | CapEx clamp 0.5% to 25%. |
| Working Capital | Modeled as a percent of positive revenue growth. | Source is Methodology default unless user field supplied. | Default 1% of revenue growth. |
| FCF | Calculated as NOPAT + D&A - CapEx - Working Capital Change. | Derived output, row confidence is min(revenue, margin, capex confidence). | No direct FCF override after forecast is built. |
| Tax | Tax = max(0, Operating Income * taxRate). | TaxRate source is supplied value or Methodology default. | Default 21%. |
| D&A | D&A / Revenue from EBITDA - Operating Income if available, otherwise default. | Source stored by selectDaToRevenue. | Default 3.5% of Revenue. |
| Dilution | From SBC / Market Cap proxy if available, otherwise class default. | Source stored by selectDilution. | Default 2% for transition/pre-profit, 0.4% otherwise. |
| WACC | Midpoint of class guardrail plus risk adjustments, clamped to guardrail. | WACC confidence uses marketCap, totalDebt/cash availability. | Risk-free 4.5%, ERP 5.5%, debt cost 5.5%, class guardrails. |

## Identified Reused Constants

- Scenario probabilities: Conservative 25%, Base 50%, Optimistic 25%.
- Scenario adjustments: Conservative growth -3%, margin -2.5%, WACC +1%; Optimistic growth +2.5%, margin +2%, WACC -0.75%.
- Tax default: 21%.
- D&A / Revenue default: 3.5%.
- Working Capital drag default: 1% of positive Revenue growth.
- Dilution defaults: 0.4% mature/profitable, 2% transition/pre-profit.
- Multiple defaults and WACC guardrails are hardcoded in `CLASS_DEFAULTS`.
