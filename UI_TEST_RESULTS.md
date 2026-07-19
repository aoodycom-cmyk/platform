# UI Test Results V9.2

## Test Command Used

```bash
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version6.test.mjs
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version7.test.mjs
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version8.test.mjs
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/investmentAnalystBrain.test.mjs
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_1AnalyticalEngine.test.mjs
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_2UIUX.test.mjs
```

## Results

| Test Suite | Passed | Failed | Result |
| --- | ---: | ---: | --- |
| Version 6 ranking and color tests | 1 suite | 0 | PASSED |
| Version 7 valuation workflow tests | 1 suite | 0 | PASSED |
| Version 8 investment report experience tests | 1 suite | 0 | PASSED |
| Investment Analyst Brain v1.1 canonical tests | 1 suite | 0 | PASSED |
| Version 9.1 analytical engine tests | 1 suite | 0 | PASSED |
| Version 9.2 UI/UX tests | 1 suite | 0 | PASSED |

## Terminal Output

```text
(node:95598) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Version 6 ranking and color tests passed.
Version 7 valuation workflow tests passed.
Version 8 investment report experience tests passed.
Investment Analyst Brain v1.1 canonical tests passed.
Version 9.1 analytical engine tests passed.
Version 9.2 UI/UX tests passed.
```

The raw output is saved at `raw-ui-test-output/v9_2_full_test_output.txt`.

## UI-Specific Coverage

`tests/version9_2UIUX.test.mjs` verifies:

- Home card layout exists.
- New Analysis action exists.
- Demo Data action exists.
- One main paste box exists.
- Data Review exists.
- Confirm and Run Analysis exists.
- Processing state exists.
- Decision Summary, Scenario Cards, Fair Value Range, Business Quality, Valuation Models, Monitoring, and Export sections exist.
- Shariah Compliance shows Data Unavailable without inference.
- Search input updates state without re-rendering on every typed character.
- Mobile overflow protection exists in CSS.
- Arabic localization exists for the new workflow.
- Demo data runs through the real deterministic engine.
- Selected models are supported models only.

## Screenshot Evidence

Screenshots are saved in `screenshots-v9.2-ui/`.

The overflow check is saved in `screenshots-v9.2-ui/overflow-check.json`:

```json
{
  "mobile393": {
    "bodyScrollWidth": 393,
    "scrollWidth": 393,
    "width": 393
  },
  "mobile430": {
    "bodyScrollWidth": 430,
    "scrollWidth": 430,
    "width": 430
  }
}
```
