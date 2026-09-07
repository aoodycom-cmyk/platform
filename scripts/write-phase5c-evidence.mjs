import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const corpus = JSON.parse(await readFile(resolve("tests/corpus/real-world/source-packages.json"), "utf8"));
const periods = corpus.companies.flatMap((company) => company.periods);
const count = (predicate) => periods.filter(predicate).length;
const prices = count((period) => period.historicalMarketPrice.status === "VERIFIED");
const exhibits = count((period) => period.sources.some((source) => source.type === "Official SEC-filed earnings exhibit"));
const guidance = count((period) => period.guidance.status === "VERIFIED");
const narrative = count((period) => period.narrative.status === "VERIFIED");
const report = `# Franklin Phase 5C Final Real-World Report

## Executive Result

**FAIL**

Phase 5C completed the historical-price layer but did not complete the official-exhibit and native-analysis requirements. Acceptance criteria were not weakened and partial evidence was not promoted to completion.

## Preserved Baseline

- ${corpus.companies.length} benchmark companies
- ${periods.length} reporting periods
- 2,526 SEC-linked factual claims
- Phase 1-5B tests, cutoff controls, and provenance controls retained

## Evidence Acquisition

| Evidence | Result |
|---|---:|
| Nasdaq historical prices | PASS: ${prices}/${periods.length} |
| Official SEC-filed exhibits frozen | FAIL: ${exhibits}/${periods.length} |
| Structured guidance records verified | FAIL: ${guidance}/${periods.length} |
| Source-quotation narrative records | FAIL: ${narrative}/${periods.length} |
| Beat/miss | NOT APPLICABLE: no consensus claims added |

Official exhibits are identified by SEC accession, URL, publication date, retrieval date, SHA-256, and content length. Only short relevant excerpts are retained. A sustained SEC HTTP 429 throttle prevented completion after ${exhibits} exhibits; unavailable records remain incomplete.

## Native Franklin Analyses

FAIL: 0/100 evidence-complete analyses. Native reports were not generated from incomplete evidence.

## Real Chains

| Chain gate | Result |
|---|---:|
| 30 real two-period revaluations | FAIL: 0/30 |
| 10 real three-period chains | FAIL: 0/10 |

The prior structural chains remain preserved and are not misrepresented as evidence-complete chains.

## Independent Integrity

The permanent regression suite verifies price chronology, source provenance, exhibit hashing, guidance range arithmetic, source linkage, and narrative treatment. No source quotation is promoted as an independently inferred management conclusion.

## Defects

No Franklin production defect was discovered. The incomplete result is caused by missing evidence acquisition, not a patched benchmark or suppressed mismatch.

## Final Gates

| Required Phase 5C gate | Result |
|---|---:|
| Evidence-complete native analyses >= 100 | FAIL |
| Material factual mismatches = 0 | PASS for completed structured claims |
| Unsupported material facts marked VERIFIED = 0 | PASS for completed checks |
| Historical prices complete | PASS |
| Guidance complete where applicable | FAIL |
| Narrative verification complete | FAIL |
| 30 real revaluations | FAIL |
| 10 real longitudinal chains | FAIL |
| Deterministic mismatches | PASS: 0 observed |
| Critical/major AI false negatives | PASS: 0 observed in completed corpus checks |
| Material round-trip loss | PASS: 0 observed |
| P0/P1 unresolved | PASS: 0/0 |

## Phase 6

Do not start Phase 6. Phase 5C remains FAIL.
`;
await mkdir(resolve("artifacts/phase5c"), { recursive: true });
await writeFile(resolve("artifacts/phase5c/Franklin_Phase_5C_Final_Real_World_Report.md"), report);
console.log(`Generated Phase 5C FAIL report with ${prices} prices and ${exhibits} official exhibits.`);
