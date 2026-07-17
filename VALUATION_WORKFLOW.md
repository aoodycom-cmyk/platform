# Valuation Workflow V7-V9.1

Version 7 changes the product from instant ticker scoring to an approved valuation workflow.

Version 9.1 keeps that workflow but replaces the Analyst Brain implementation with a canonical deterministic engine.

## Flow

1. Home
2. Search company
3. Open Company Valuation Workspace
4. Paste or enter company data
5. Run Analyst Brain from the one-block paste
6. Review the generated report and data review
7. Edit data and re-run, or approve and export
8. Approved company appears in Home

## Key Rules

- Search does not create a final valuation.
- Drafts do not appear in the Home dashboard.
- Automatically parsed values are stored with source, source date, confidence, confirmation status, and original text reference.
- Missing fields remain missing and can produce `INSUFFICIENT_DATA`.
- Analyst Brain recommendations require at least one internal valuation model.
- Morningstar Fair Value and Analyst Consensus are capped external references, not standalone decision engines.
- Unsupported models remain excluded until they have deterministic implementations.
- Required fields still affect data quality, confidence, and export readiness.
- The report is generated as structured JSON and rendered into a fixed written report.
- Only approved reports are exported to Evaluated Companies.
- Previous approved versions are preserved.

## Statuses

- Draft
- Collecting Data
- Ready for Analysis
- Valuation Generated
- Awaiting Approval
- Approved
- Needs Update

Arabic labels are implemented in the UI for the same statuses.

## Data Review Groups

- Confirmed Data
- Missing Data
- Conflicting Data
- Outdated Data
- Unconfirmed Parsed Data
- Automatically Fetched Data
- Manually Pasted Data

## Export Fields

Approved valuations export:

- Ticker
- Company Name
- Current Price
- Bear / Base / Bull Fair Value
- Morningstar Fair Value
- Range FV
- Upside %
- Highest Fair Value
- Max FV Upside %
- Investment Score
- Ranking Score
- Recommendation
- Confidence
- Data Quality
- Approved Date
- Valuation Version

## Source of Truth

The approved JSON report, input snapshot, source snapshot, methodology version, and approval timestamp are the source of truth. The rendered report is saved for review, but edits must come from data changes or controlled methodology overrides.
