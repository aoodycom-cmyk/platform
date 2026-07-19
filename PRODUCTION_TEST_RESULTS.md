# Production Test Results

## Command

```bash
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version6.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version7.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version8.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/investmentAnalystBrain.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_1AnalyticalEngine.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_2UIUX.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/productionDeployment.test.mjs
```

## Terminal Output

```text
(node:17597) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Version 6 ranking and color tests passed.
Version 7 valuation workflow tests passed.
Version 8 investment report experience tests passed.
Investment Analyst Brain v1.1 canonical tests passed.
Version 9.1 analytical engine tests passed.
Version 9.2 UI/UX tests passed.
Version 10 production deployment tests passed.
```

## Suite Summary

| Suite | Passed | Failed | Status |
| --- | ---: | ---: | --- |
| Version 6 ranking and color tests | 1 suite | 0 | PASS |
| Version 7 valuation workflow tests | 1 suite | 0 | PASS |
| Version 8 investment report experience tests | 1 suite | 0 | PASS |
| Investment Analyst Brain v1.1 canonical tests | 1 suite | 0 | PASS |
| Version 9.1 analytical engine tests | 1 suite | 0 | PASS |
| Version 9.2 UI/UX tests | 1 suite | 0 | PASS |
| Version 10 production deployment tests | 1 suite | 0 | PASS |

## Production Test Coverage

`tests/productionDeployment.test.mjs` verifies:

- server default host is `0.0.0.0`
- `GET /api/health` works
- health response contains no secrets
- static app is blocked behind login
- unauthenticated API access is blocked
- authenticated app access works
- `/api/search` works using server-side FMP config
- `/api/research-data` works using server-side FMP config
- `/api/parse-investment-analyst` works using server-side OpenAI config
- invalid ticker requests are rejected
- rate limit returns safe errors
- no fake secrets appear in API responses
- frontend bundles do not contain provider keys or direct provider URLs
- manifest loads and supports standalone installation metadata
- service worker loads and avoids API caching
- offline page renders

Raw output is saved in:

```text
raw-production-test-output/v10_production_full_test_output.txt
```

