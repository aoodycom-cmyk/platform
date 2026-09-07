import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const corpus = JSON.parse(await readFile(resolve("tests/corpus/real-world/source-packages.json"), "utf8"));
const periods = corpus.companies.flatMap((company) => company.periods);
const releases = periods.filter((period) => period.sources.some((source) => source.type.includes("2.02")));
const releaseCompanies = corpus.companies.filter((company) => company.periods.some((period) => period.sources.some((source) => source.type.includes("2.02"))));
const claims = periods.flatMap((period) => period.evidenceClaims);
const directory = resolve("artifacts/phase5b");
await mkdir(directory, { recursive: true });

const report = `# Franklin Phase 5B Real-World Evidence Report

## A. Executive Result

**FAIL**

Phase 5B added reproducible official SEC filing packages, but the required evidence-complete native analyses, historical prices, guidance/narrative extraction, and real revaluation chains are not complete. Acceptance criteria were not loosened.

## B. Phase 5 Gaps Addressed

| Phase 5 gap | Phase 5B result |
|---|---|
| Complete 100-company native analyses | FAIL: 0 evidence-complete reports |
| Official guidance, narrative, and beat/miss evidence | FAIL: filing packages added; extraction incomplete. Beat/miss is NOT APPLICABLE because no consensus claims are made. |
| Historical market-price evidence | FAIL: 0 required snapshots frozen |
| 30 real revaluations and 10 real longitudinal chains | FAIL: 0 evidence-complete chains |

## C. Official Evidence Sources

Official SEC submissions and EDGAR archive URLs were frozen for ${corpus.companies.length} issuers and ${periods.length} reporting periods. The corpus contains ${claims.length} structured evidence-to-claim links. ${releases.length} periods across ${releaseCompanies.length} issuers have a nearby official Item 2.02 8-K release package. Missing releases remain explicit.

## D. 100 Native Analyses

FAIL. No report is counted as complete without a cutoff-correct historical price and the required official narrative/guidance assessment.

## E. Guidance Verification

FAIL. Official release packages are identified, but guidance values, basis, units, and direction have not been extracted and independently checked.

## F. Narrative Verification

FAIL. No material narrative interpretation is promoted to verified by this corpus.

## G. Beat/Miss Verification

NOT APPLICABLE. The Phase 5B corpus makes no actual-versus-consensus beat/miss claims. It does not substitute prior-year or company-guidance comparisons for consensus.

## H. Historical Market Prices

FAIL. No recognized bulk market-data source produced a reproducible point-in-time record for every required snapshot. Today's prices were not substituted.

## I. 30 Real Revaluations

FAIL. The 30 structural chains remain preserved, but none is reclassified as a complete evidence-based revaluation.

## J. 10 Real Longitudinal Chains

FAIL. The 10 structural chains remain preserved, but none is reclassified as a complete three-period evidence chain.

## K. AI Integrity

PASS for the preserved structured factual claims. Critical and major false negatives observed: 0. Full native-analysis AI integrity remains part of the failed native-analysis gate.

## L. Financial Integrity

PASS for applicable structured Phase 3 differential checks. Unexplained deterministic mismatches observed: 0.

## M. Defects Discovered

No new production defect was found. One corpus acquisition edge case was found: an accession absent from the SEC recent-submissions window. The builder now preserves its official accession-index source without inventing a primary document filename.

## N. Regression Coverage Added

Added Phase 5B tests for 100-company official filing provenance, source dates at or before cutoff, evidence-to-claim links, and explicit incomplete-gate states.

## O. Full Phase 1-5B Regression

The focused Phase 5/5B corpus tests pass. Final full-suite results are recorded in the execution closeout; a green engineering suite does not override failed evidence gates.

## P. Remaining Risks

Historical prices and official release contents are not frozen for all required snapshots. Guidance and narrative claims therefore cannot be promoted to verified, and complete real revaluations cannot be asserted.

## Q. Phase 6 Recommendation

Do not start Phase 6. Phase 5B remains FAIL until all required evidence gates pass.
`;

const rows = corpus.companies.map((company) => {
  const hasRelease = company.periods.some((period) => period.sources.some((source) => source.type.includes("2.02")));
  return `| ${company.caseId} | ${company.ticker} | ${company.periods.length} | PASS | ${hasRelease ? "PASS" : "FAIL"} | FAIL | FAIL | NOT APPLICABLE | FAIL | FAIL |`;
}).join("\n");
const traceability = `# Phase 5 Real-World Traceability

Phase 5B updates every former required NOT VERIFIED gate to an explicit PASS, FAIL, or NOT APPLICABLE result.

| Gate | Result | Evidence |
|---|---|---|
| 100 complete native analyses | FAIL | 0 evidence-complete analyses |
| Official guidance | FAIL | Extraction incomplete |
| Official narrative | FAIL | Claim linkage incomplete |
| Beat/miss | NOT APPLICABLE | No consensus claims made |
| Historical market prices | FAIL | 0 required snapshots |
| 30 real revaluations | FAIL | Structural chains preserved only |
| 10 real longitudinal chains | FAIL | Structural chains preserved only |

| Case | Ticker | Period packages | SEC filing | Item 2.02 package | Native analysis | Guidance/narrative | Beat/miss | Historical price | Final |
|---|---|---:|---|---|---|---|---|---|---|
${rows}
`;

await writeFile(resolve(directory, "Franklin_Phase_5B_Real_World_Evidence_Report.md"), report);
await writeFile(resolve("artifacts/phase5/PHASE5_REAL_WORLD_TRACEABILITY.md"), traceability);
console.log(`Generated Phase 5B FAIL report for ${corpus.companies.length} issuers.`);
