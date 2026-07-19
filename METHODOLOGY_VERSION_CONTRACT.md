# Methodology Version Contract

## Official Methodology

The official methodology for Version 9 is:

```text
investment-analyst-brain-v1.1-canonical
```

This is the value that appears in generated Analyst Brain reports as:

```json
{
  "methodologyVersion": "investment-analyst-brain-v1.1-canonical"
}
```

## Single Source Of Truth

The single source of truth for execution order and conflict resolution is:

```text
investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.md
investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.json
```

The same files are copied to:

```text
public/investment_analyst_brain_v1/
docs/investment_analyst_brain_v1/
```

## Relationship Between Master Brain v1.1 And Methodology Files

| Source | Role | Authority |
| --- | --- | --- |
| `00_METHODOLOGY_CONTRACT.md` | Human-readable execution contract | Highest |
| `00_METHODOLOGY_CONTRACT.json` | Machine-readable contract | Highest |
| `01_COMPANY_CLASSIFICATION.md` through `10_REPORT_TEMPLATE.md` | Detailed methodology policy source | High |
| `11_OUTPUT_SCHEMA.json` | JSON output contract | High |
| `12_MASTER_ANALYST_PROMPT.md` | AI parsing/explanation prompt boundary | High |
| Legacy valuation workflow | Compatibility only | Low |

## Conflict Resolution

If two methodology files conflict:

1. `00_METHODOLOGY_CONTRACT.*` wins.
2. Then `11_OUTPUT_SCHEMA.json` controls required JSON shape.
3. Then detailed policy files `01` through `10` control domain policy.
4. Legacy code cannot override the canonical contract.

## Runtime Enforcement

The runtime enforcement lives in:

```text
src/analystBrain/engine.js
src/analystBrain/schemaValidator.js
src/valuationWorkflow/workflow.js
```

Public and Pages copies:

```text
public/src/analystBrain/engine.js
public/src/analystBrain/schemaValidator.js
public/src/valuationWorkflow/workflow.js
docs/src/analystBrain/engine.js
docs/src/analystBrain/schemaValidator.js
docs/src/valuationWorkflow/workflow.js
```

## AI Boundary

AI may:

- parse explicit pasted facts
- summarize supplied evidence
- explain deterministic results

AI may not:

- invent financial values
- calculate Fair Value
- select final model weights
- issue Buy/Hold/Sell
- override deterministic recommendation gates

## Report Version

Generated Analyst Brain reports show:

```text
methodologyVersion: investment-analyst-brain-v1.1-canonical
analystBrainVersion: Investment Analyst Brain v1.1 Canonical
```
