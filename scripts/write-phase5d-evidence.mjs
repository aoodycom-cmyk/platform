import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const corpus = JSON.parse(await readFile(resolve("tests/corpus/real-world/source-packages.json"), "utf8"));
const periods = corpus.companies.flatMap((company) => company.periods);
const count = (predicate) => periods.filter(predicate).length;
const states = Object.fromEntries(["COMPLETE","PENDING","RETRYABLE","NOT_APPLICABLE","FAILED"].map((state) => [state, count((period) => period.officialEvidenceAcquisition?.state === state)]));
const report = `# Franklin Phase 5D Evidence Completion Report

## Executive Result

**FAIL**

Official reporting-period documents and historical prices reached complete coverage, but guidance verification and Franklin-native execution gates did not. No incomplete analysis was promoted to PASS.

## Evidence Completion

| Metric | Result |
|---|---:|
| Benchmark companies | ${corpus.companies.length} |
| Reporting periods | ${periods.length} |
| Official evidence packages | ${count((period) => period.officialEvidenceAcquisition?.state === "COMPLETE")}/${periods.length} |
| SEC-filed earnings exhibits/full submissions | ${count((period) => period.sources.some((source) => source.type === "Official SEC-filed earnings exhibit"))} |
| Official IR alternatives | 0 |
| Historical Nasdaq prices | ${count((period) => period.historicalMarketPrice.status === "VERIFIED")}/${periods.length} |
| Source-linked narrative evidence | ${count((period) => period.narrative.status === "VERIFIED")} |
| Narrative not applicable | ${count((period) => period.narrative.status === "NOT_APPLICABLE")} |

Acquisition states: ${JSON.stringify(states)}. Retrieval is checkpointed after every period, avoids completed requests, uses serialized requests, jitter, exponential backoff, Retry-After, and a persistent rate-limit stop.

## Guidance

| Classification | Count |
|---|---:|
| Structured and verified guidance | ${count((period) => period.guidance.status === "VERIFIED")} |
| Guidance present but not completely structured/independently verified | ${count((period) => period.guidance.status === "GUIDANCE_PRESENT_UNSTRUCTURED")} |
| Verified no formal guidance / not applicable | ${count((period) => period.guidance.status === "NOT_APPLICABLE")} |

The unstructured cases are a failed completion gate. They are not reclassified as no-guidance merely because the extractor did not parse a numeric range.

## Benchmark Corrections

Two P1 evidence-corpus defects were found and fixed:

1. 257/301 accession records mixed comparative fact dates with the selected reporting-period identity. The builder now selects one accession end date and facts matching that date, with duration-aware income and cash-flow selection. A permanent regression rejects mixed periods.
2. Stale ticker PARA resolved to Banzai International while classified as Paramount/Media. It was replaced with official current Paramount Skydance ticker PSKY. The replacement preserves 101 companies.

## Native Analyses And Chains

| Gate | Result |
|---|---:|
| Evidence-complete Franklin-native analyses | FAIL: 0/100 |
| Real two-period revaluations | FAIL: 0/30 |
| Real three-period longitudinal chains | FAIL: 0/10 |

Native analyses were not generated because guidance evidence remained incomplete. Structural Phase 5 chains remain preserved but are not counted here.

## Integrity Metrics

| Metric | Result |
|---|---:|
| Material factual mismatches | 0 in completed structured checks |
| Financial deterministic mismatches | 0 in completed checks |
| Critical AI false negatives | 0 in completed checks |
| Major AI false negatives | 0 in completed checks |
| Material round-trip loss | 0 in completed checks |
| New P0 / P1 / P2 / P3 defects | 0 / 2 / 0 / 0 |

## Final Decision

Phase 5D fails because guidance verification, 100 native analyses, 30 revaluations, and 10 longitudinal chains are incomplete. Do not start Phase 6.
`;
await mkdir(resolve("artifacts/phase5d"), { recursive: true });
await writeFile(resolve("artifacts/phase5d/Franklin_Phase_5D_Evidence_Completion_Report.md"), report);
console.log("Generated Phase 5D evidence completion report.");
