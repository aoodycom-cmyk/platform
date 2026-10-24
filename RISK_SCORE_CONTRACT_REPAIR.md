# External risk score contract repair

The active external report contract now defines risk as severity: 0 lowest risk,
100 highest risk, with `scores.riskScale = "higher-is-riskier"`. The legacy engine's
safety-score convention is separate and unchanged.

New supplements must explicitly provide both score and scale. Old untyped reports
remain importable, retain their original scores/raw history, and show review-required
instead of a comparable risk bar. The missing-data prompt requests an analyst review
and both fields; it never performs a `100 - score` migration. Conflict resolution is
atomic, so retaining an old score cannot accidentally attach the incoming meaning.

The two reported examples, BE 35 (explained as higher-is-safer) and TXN 63
(explained as higher-is-riskier), illustrate the old ambiguity. Neither numeric value
was rewritten. TXN's direction matches the new contract, but that does not certify
its financial reasoning or fair value. BE needs analyst reassessment, not automatic
conversion to 65. No valuation or recommendation is changed by this repair.

Verification: new boundary, legacy round-trip, pair-validation, conflict-resolution,
unrelated-supplement and BE/TXN preservation tests, existing persistence rollback,
full unit/integration suite, syntax/JSON quality and generated-source sync.
Browser E2E could not launch in the local restricted runtime (Unix socket denied);
CI must verify the browser suite before release. This document is not a deployment
or a successful import confirmation for either user's stored report.
