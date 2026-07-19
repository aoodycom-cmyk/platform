# TEST_RESULTS_V9.1_FINAL

## Clean Test Run

Status: COMPLETED

Exact command used:

```bash
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version6.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version7.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version8.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/investmentAnalystBrain.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_1AnalyticalEngine.test.mjs
```

## Summary

| Metric | Result |
|---|---:|
| Test suites executed | 5 |
| Total tests | 5 script suites |
| Passed tests | 5 |
| Failed tests | 0 |
| Total assertion call sites | 178 |
| Exit code | 0 |
| Execution time | 0 seconds in captured shell output |

Assertion call-site count by suite:

| Suite | Assertion call sites |
|---|---:|
| tests/version6.test.mjs | 35 |
| tests/version7.test.mjs | 20 |
| tests/version8.test.mjs | 9 |
| tests/investmentAnalystBrain.test.mjs | 47 |
| tests/version9_1AnalyticalEngine.test.mjs | 67 |

Note: the project uses script-style Node assertion files, not a test runner that reports runtime assertion totals. The total above is the directly counted assertion call sites in the executed suites.

## Test Suites Executed

| Suite | Result |
|---|---|
| tests/version6.test.mjs | PASSED |
| tests/version7.test.mjs | PASSED |
| tests/version8.test.mjs | PASSED |
| tests/investmentAnalystBrain.test.mjs | PASSED |
| tests/version9_1AnalyticalEngine.test.mjs | PASSED |

## Raw Terminal Output

Stored in:

```text
raw-test-output-final/07_clean_post_mutation.txt
```

```text
COMMAND: /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version6.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version7.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version8.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/investmentAnalystBrain.test.mjs && /Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_1AnalyticalEngine.test.mjs
(node:81457) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Version 6 ranking and color tests passed.
Version 7 valuation workflow tests passed.
Version 8 investment report experience tests passed.
Investment Analyst Brain v1.1 canonical tests passed.
Version 9.1 analytical engine tests passed.
EXIT_CODE: 0
EXECUTION_TIME_SECONDS: 0
```

## Restore Verification

Stored in:

```text
raw-test-output-final/08_restore_verification_hashes.txt
```

Result:

```text
engine src/public: MATCH
engine src/docs: MATCH
schema src/public: MATCH
schema src/docs: MATCH
```
