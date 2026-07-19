# UI Test Results V10

## Command

```bash
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version6.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version7.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version8.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/investmentAnalystBrain.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_1AnalyticalEngine.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_2UIUX.test.mjs
```

## Terminal Output

```text
(node:10633) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Version 6 ranking and color tests passed.
Version 7 valuation workflow tests passed.
Version 8 investment report experience tests passed.
Investment Analyst Brain v1.1 canonical tests passed.
Version 9.1 analytical engine tests passed.
Version 9.2 UI/UX tests passed.
```

## Suite Summary

| Suite | Result |
| --- | --- |
| Version 6 ranking and color tests | PASS |
| Version 7 valuation workflow tests | PASS |
| Version 8 investment report experience tests | PASS |
| Investment Analyst Brain v1.1 canonical tests | PASS |
| Version 9.1 analytical engine tests | PASS |
| Version 9.2 UI/UX tests | PASS |

## Screenshot Verification

| Check | Result |
| --- | --- |
| Mobile Home screenshot captured | PASS |
| Mobile Data Review screenshot captured | PASS |
| Mobile Decision Report screenshot captured | PASS |
| Mobile full report section screenshots captured | PASS |
| 430px horizontal overflow check | PASS |

## Mobile Overflow Output

```json
{
  "bodyHeight": 9705,
  "hasHorizontalOverflow": false,
  "innerWidth": 430,
  "scrollWidth": 430
}
```

## Notes

- Version 10 did not add or modify test files.
- The existing frozen engine and UI test suites were run after the visual changes.
- Full raw output is saved in `raw-ui-test-output/v10_full_test_output.txt`.

