# Deployment Changelog V10.0.0

## Server

- Rebuilt `server.mjs` as a production-capable Node server.
- Added `process.env.PORT` support.
- Changed default binding to `0.0.0.0`.
- Added `GET /api/health`.
- Added secure headers and CSP.
- Added body-size limits, JSON parsing guards, request validation, provider timeouts, and rate limiting.

## Authentication

- Added private login screen.
- Added `POST /api/login`, `GET /api/session`, and `POST /api/logout`.
- Added HttpOnly signed session cookie.
- Added `APP_ACCESS_PASSWORD` and `APP_SESSION_SECRET`.

## API Security

- Removed browser-provided FMP/OpenAI key handling.
- Removed direct browser fallback calls to FMP and OpenAI.
- Browser now calls only:
  - `/api/search`
  - `/api/research-data`
  - `/api/parse-investment-analyst`
- Provider keys are server-side environment variables only.

## Frontend

- Removed API-key inputs from Settings.
- Added server-side configuration message.
- Added Clear Local Data action.
- Updated visible version labels to 10.0.0.
- Updated title and PWA metadata.

## PWA

- Added `public/service-worker.js`.
- Added `public/offline.html`.
- Service worker caches safe static assets only.
- API responses, auth responses, provider requests, and user data are not cached.

## Tests

- Added `tests/productionDeployment.test.mjs`.
- Full existing analytical and UI tests continue to pass.

## Deployment Config

- Added `render.yaml`.
- Added `.env.example`.

## Blocked

- Public HTTPS deployment is blocked until Render/Railway credentials or an already-connected hosting target is provided.

