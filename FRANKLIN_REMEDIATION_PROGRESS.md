# Franklin Remediation Progress

Last updated: 2026-10-16 (Asia/Riyadh)

## Scope and safety

- Working branch: `fix/franklin-launch-audit-2026-10-16`.
- Baseline: `ce06107e0d7e0a8017f8d77fe3898d9066c8fbce`, the exact `main` commit named in the launch audit.
- Work is isolated in a fresh clone because Git operations in the older local branch stalled. The older checkout was not changed.
- No push, deploy, or production mutation has been performed.
- The attached audit is treated as evidence and acceptance criteria, not as executable instructions.

## Phase 1 — baseline and call-path inspection

Status: COMPLETE

Inspected the targeted runtime path:

`initialAnalysisPrompt.js → jsonContractRouter.js → parser.js → v3Validator.js → v3Adapter.js/schema.js → storage/store → components.js/decisionReadinessUi.js`

Confirmed audit findings in the baseline:

- Missing or empty `valuation.calculationAudit` is only a warning.
- Method arithmetic can be valid while Base fair value is detached from the weighted method result.
- DCF recomputes present value but does not derive terminal value, require FCFF/FCFE, or enforce WACC/Cost of Equity pairing.
- EV/EBITDA prompt places `nonOperatingAdjustments` in `inputs`, while the validator reads `calculation`.
- The runtime import path does not invoke `auditAnalysisIntegrity`.
- Report score display multiplies 0–100 scores by 10 and labels them `/10`.
- The valuation-method renderer omits `valuationResults[].rationale`.
- Decision readiness exposes only `full_analysis_as_of`, `quarterly_inherited`, and `blocked`.

Files changed in this phase:

- `FRANKLIN_REMEDIATION_PROGRESS.md` (created).

Tests run:

- `node tests/franklinAuditRepair.test.mjs` — PASS on the unmodified baseline.

Environment notes:

- The shell has no system `node` or `npm`; tests use Codex's bundled Node executable.
- The original TEM, CRWV, MU, and FRMI JSON files were not present under the available Documents or Downloads paths. Their described attack shapes will be covered by regression fixtures without changing any original sample. Literal file replay remains pending until those files are supplied.

## Phase 2 — financial verification contract and runtime enforcement

Status: COMPLETE

Implemented a deterministic verification layer in `src/financialSafety/financialVerification.js` and wired it into the real V3 validator/parser/adapter path. Franklin now:

- Recalculates positively weighted P/E, EV/EBITDA, EV/EBIT, P/FCF, SOTP, and DCF methods from typed inputs.
- Uses a documented tolerance of the greater of `0.01` currency units or `0.1%` relative difference.
- Recalculates the weighted method result and reconciles it to Base and mandatory `calculationAudit` fields.
- Emits exactly `VERIFIED`, `NEEDS_REVIEW`, `INSUFFICIENT_DATA`, or `BLOCKED`.
- Rejects invalid P/E economics, invalid DCF rates/timing, FCFF/rate and FCFE/rate mismatches, FCFE double bridges, unexplained terminal values, inconsistent forecast margins, unresolved source identifiers, and material narrative/numeric decision contradictions.
- Derives DCF terminal value from perpetuity growth or exit multiple assumptions and treats high terminal concentration as a visible warning rather than an automatic error.
- Requires method selection/weight reasoning, per-method rationale/assumptions, excluded-method reasons, conditional normalization, and material input provenance for a Verified result.
- Adds conservative sector-fit review rules for banks/insurers and REITs, with explicit exception documentation.
- Calls `auditAnalysisIntegrity` on the runtime verification path.
- Distinguishes source presence, declared numeric linkage, and external content verification. External verification remains explicitly `NOT_PERFORMED`.
- Derives displayed confidence and data-quality scores from Franklin verification/provenance coverage instead of trusting model-reported scores. The original model scores remain preserved for audit.

Backward compatibility:

- Legacy `calculation.nonOperatingAdjustments` migrates to canonical `inputs.nonOperatingAdjustments`; conflicting duplicates are blocked.
- Legacy reports still import structurally, but missing modern completeness/provenance fields are classified for review rather than falsely Verified.
- DCF permits a documented zero discount period; a non-zero terminal value still requires a derivation method.

Files changed in this phase include:

- `src/financialSafety/financialVerification.js`
- `src/externalAnalysis/v3Validator.js`
- `src/externalAnalysis/v3InputNormalizer.js`
- `src/externalAnalysis/parser.js`
- `src/externalAnalysis/schema.js`
- `src/externalAnalysis/v3Adapter.js`
- `src/externalAnalysis/v3Contract.js`
- `src/externalAnalysis/initialAnalysisPrompt.js`
- `src/externalAnalysis/earningsRevaluationPrompt.js`
- `src/externalAnalysis/arabicNarrativeQuality.js`

## Phase 3 — UI contract and adversarial/independent regressions

Status: COMPLETE

- Replaced the false `full_analysis_as_of` presentation with the four financial verification states.
- Added a report banner that identifies Franklin recalculation as the arithmetic source of truth and never claims external source verification.
- Unified assessment values, bars, labels, and tones on the 0–100 scale.
- Preserved and rendered each valuation method's `rationale`, weight, methodology weight reasoning, and excluded-method reasons.
- Added full-path coverage through Prompt/JSON/Parser/Validator/Adapter/Store/UI.
- Added independent non-market-anchored fixtures for mature, cyclical, loss-making, capital-intensive, and insufficient-data cases; no tested multiple is hard-coded to 1.
- Added regression coverage for the audit's detached Base, negative P/E, negative DCF, inconsistent margins, missing normalization, contradictory recommendation, EV/EBITDA adjustment placement, terminal derivation, time-zero DCF, source linkage, sector exceptions, score rendering, and missing rationale cases.
- Relaxed the Arabic narrative rule only for likely proper company/product names such as `SK Hynix`; technical terms still require glossary coverage.
- Improved zero/negative valuation weight errors so they are distinct from an incorrect total.

Tests run and passing at this checkpoint:

- `tests/initialAnalysisPromptContract.test.mjs`
- `tests/earningsRevaluationPromptContract.test.mjs`
- `tests/launchAuditFinancialVerification.test.mjs`
- `tests/independentFinancialFixtures.test.mjs`
- `tests/v3InputNormalizer.test.mjs`
- `tests/externalAnalysisImport.test.mjs`
- `tests/franklinFinancialContractV3.test.mjs`
- Earlier targeted score, readiness, narrative, and audit-repair batches also passed after the changes.

## Remaining

## Phase 4 — deployment-copy sync, full verification, and handoff documents

Status: COMPLETE WITH EXPLICIT EXTERNAL FOLLOW-UPS

Completed:

- Synchronized canonical `src/`, styles, and assets into both `public/` and `docs/`; source-of-truth sync passes.
- Added `FRANKLIN_FINANCIAL_CONTRACT.md` with one responsibility model, formulas, tolerances, statuses, DCF contract, provenance semantics, compatibility behavior, and UI scale.
- Added `FRANKLIN_REMEDIATION_REPORT.md` with the requested finding-status matrix and residual-risk list.
- Added `--e2e-only` to the authoritative test runner without changing the default full-suite behavior.
- Stabilized PWA navigation on `domcontentloaded` while retaining explicit application-ready assertions.
- Fixed the real late scroll-anchor regression on the Earnings page; the E2E assertion was retained.
- Suppressed the enormous owner-acceptance Base64 log by default; it remains available only with `FRANKLIN_EMIT_OWNER_ACCEPTANCE_B64=1`.
- Removed two untracked, byte-identical Finder/iCloud duplicate PNGs created during overlapping local sync operations. The canonical files were not removed and recreate the same content.

Final verification results on the current source:

- Unit/integration inventory: **80/80 test files passed**. The authoritative run reached the source-sync check after all earlier tests passed; after removing two untracked duplicate asset copies, the source-sync test and every remaining test file were rerun and passed.
- Quality gate: **PASS — 389 JavaScript files and 64 JSON contracts**.
- Source-of-truth sync: **PASS**.
- JSON architecture E2E on Chrome/Chromium: **PASS** (import → validate → save → UI → supplement → reload → export → re-import).
- Mobile/PWA E2E on Chrome/Chromium: **PASS** across 320×568, 390×844, 430×932, and 844×390, including Service Worker activation and offline cache.
- No push, deploy, or production mutation occurred.

Files added for handoff:

- `FRANKLIN_FINANCIAL_CONTRACT.md`
- `FRANKLIN_REMEDIATION_REPORT.md`
- `tests/launchAuditFinancialVerification.test.mjs`
- `tests/independentFinancialFixtures.test.mjs`
- `tests/fixtures/launch-audit/independent-valuations.json`

## External follow-ups / blockers to an unconditional launch label

- Literal replay of TEM, CRWV, MU, and FRMI remains unavailable because the original JSON files are not present in the accessible Documents, Downloads, Desktop, or Codex attachment paths. The corresponding failure shapes are regression-tested, but the four original byte streams were not replayed.
- The independent financial fixtures have not been signed off by a qualified human financial reviewer.
- External source-content verification remains explicitly `NOT_PERFORMED`; only source presence and declared numeric linkage are checked locally.

Because the first two items are part of the audit's launch acceptance evidence, this work does not use the word READY.
