# Valuation Workflow V7

Version 7 changes the product from instant ticker scoring to an approved valuation workflow.

## Flow

1. Home
2. Search company
3. Open Company Valuation Workspace
4. Paste or enter company data
5. Review and confirm data
6. Run Valuation Analyst
7. Read fixed-format report
8. Edit data and re-run, or approve and export
9. Approved company appears in Home

## Key Rules

- Search does not create a final valuation.
- Drafts do not appear in the Home dashboard.
- Automatically parsed values are stored with source, source date, confidence, confirmation status, and original text reference.
- Required fields must meet the minimum completeness threshold before valuation.
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
