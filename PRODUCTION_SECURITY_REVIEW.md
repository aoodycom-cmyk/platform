# Production Security Review

## Summary

Version 10.0.0 prepares Franklin Research for private production deployment. The browser no longer asks for, stores, or sends FMP/OpenAI keys. The Node server owns provider access and returns sanitized responses.

## Completed Controls

| Control | Status | Evidence |
| --- | --- | --- |
| Server listens on `process.env.PORT` | COMPLETED | `server.mjs` |
| Production host defaults to `0.0.0.0` | COMPLETED | `server.mjs` |
| Private access password | COMPLETED | `APP_ACCESS_PASSWORD` |
| HttpOnly session cookie | COMPLETED | `server.mjs` |
| Server-only FMP key | COMPLETED | `server.mjs`, frontend scan |
| Server-only OpenAI key | COMPLETED | `server.mjs`, frontend scan |
| No browser-side provider fallback | COMPLETED | `public/src/providers/apiClient.js`, `public/src/dataPlatform/providerContracts.js` |
| No API-key fields in Settings | COMPLETED | `public/src/ui/components.js` |
| Safe error messages | COMPLETED | `server.mjs` |
| No raw stack traces in API responses | COMPLETED | `server.mjs` |
| CSP | COMPLETED | `server.mjs` |
| X-Content-Type-Options | COMPLETED | `server.mjs` |
| Referrer-Policy | COMPLETED | `server.mjs` |
| Permissions-Policy | COMPLETED | `server.mjs` |
| X-Frame-Options | COMPLETED | `server.mjs` |
| CORS origin restriction | COMPLETED | `APP_ORIGIN`, `server.mjs` |
| Request size limits | COMPLETED | `server.mjs` |
| API rate limiting | COMPLETED | `server.mjs` |
| Ticker/query validation | COMPLETED | `server.mjs` |
| Provider request timeout | COMPLETED | `server.mjs` |
| Safe JSON parsing | COMPLETED | `server.mjs` |
| No API response caching by service worker | COMPLETED | `public/service-worker.js` |
| Offline state avoids stale prices | COMPLETED | `public/offline.html` |
| Clear Local Data action | COMPLETED | `public/src/ui/components.js`, `public/src/state/store.js` |

## Browser Storage

| Data | Storage | Notes |
| --- | --- | --- |
| Language | `localStorage` | Preference only |
| Theme | `localStorage` | Preference only |
| Approved evaluated companies | `localStorage` | Created after investor approval/export |
| Saved watchlist/history | `localStorage` | Created by explicit user action |
| Draft pasted data | Not persisted automatically | Removed from persistence in Version 10.0.0 |
| API keys | Not stored | Server-side environment variables only |
| Access password | Not stored | Sent only to `/api/login`; session cookie is HttpOnly |

## Known Limits

| Item | Status | Note |
| --- | --- | --- |
| Real HTTPS deployment | BLOCKED | Requires Render/Railway credentials or user-connected hosting account |
| Production provider verification with real keys | BLOCKED | Requires hosted environment variables |
| iPhone real-device verification | BLOCKED | Requires final HTTPS URL |

## Analytical Integrity

The production changes did not modify:

- analytical formulas
- valuation logic
- recommendation logic
- forecast logic
- model-selection rules
- methodology files

Reference hashes:

```text
b80df9a55ef224ccd73e5ce5ed74b14b65ad62e9e172a6c051282b0696d6e05b  public/src/analystBrain/engine.js
48cc3ad7db62b0e87d2efccf7be9060a0868b0ed7087940f39776acffe580552  public/src/analystBrain/schemaValidator.js
3ab79b3dcc36ba8ba4d3c4e4751efef5905ca9083b36df0878c7d95da6cf1b0d  public/src/valuationWorkflow/workflow.js
```

