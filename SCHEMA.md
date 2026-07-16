# Data Schema

## Valuation Workspace

```ts
type ValuationWorkspace = {
  id: string;
  ticker: string;
  companyName: string;
  status: "Draft" | "Collecting Data" | "Ready for Analysis" | "Valuation Generated" | "Awaiting Approval" | "Approved" | "Needs Update";
  methodologyVersion: string;
  inputs: Record<string, ValuationField>;
  sectionSources: Record<string, SourceMetadata>;
  pasteDrafts: Record<string, string>;
  pastePreview: PastePreview | null;
  dataReview: DataReview;
  report: ValuationReport | null;
  renderedReport: string;
  investorNotes: string;
  overrides: Record<string, MethodologyOverride>;
  versions: ValuationVersion[];
};
```

## Valuation Field

```ts
type ValuationField = {
  fieldId: string;
  label: string;
  value: string | number | null;
  source: string;
  sourceDate: string;
  mode: "Manual" | "Automatic";
  confidence: number;
  userConfirmed: boolean;
  originalTextReference: string;
  rejected?: boolean;
  notAvailable?: boolean;
};
```

## Approved Export

Approved valuations export to `evaluatedCompanies` with:

- `approvedReport`
- `approvedReportText`
- `approvedInputSnapshot`
- `approvedSourceSnapshot`
- `valuationVersions`
- `approvalTimestamp`
- `approvedDate`
- `valuationVersion`
- Home table valuation fields

Draft workspace data remains separate from the approved Home dashboard.
