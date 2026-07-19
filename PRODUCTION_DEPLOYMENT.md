# Production Deployment

## Status

| Item | Status | Evidence |
| --- | --- | --- |
| Production-ready Node server | COMPLETED | `server.mjs` |
| Private password gate | COMPLETED | `APP_ACCESS_PASSWORD`, `POST /api/login` |
| Health endpoint | COMPLETED | `GET /api/health` |
| Server-side FMP/OpenAI configuration | COMPLETED | `FMP_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Static frontend served from `public/` | COMPLETED | `server.mjs` |
| PWA metadata and icons | COMPLETED | `public/manifest.webmanifest`, `public/assets/` |
| Service worker and offline state | COMPLETED | `public/service-worker.js`, `public/offline.html` |
| Render blueprint | COMPLETED | `render.yaml` |
| Public HTTPS deployment | BLOCKED | Render/Railway/Sites deployment credentials are not available in this Codex session |

## Deployment Target

Preferred platform: Render Node Web Service.

The project is now configured as a full-stack Node.js app. It should not be deployed as static-only GitHub Pages for production because API keys are server-side only.

## Public URL

Status: `BLOCKED`.

No real HTTPS URL was created from this session because there is no authenticated Render/Railway deployment account or token available. The code and deployment config are ready for a Node host.

Credential presence check:

```text
RENDER_API_KEY=missing
RENDER_TOKEN=missing
RAILWAY_TOKEN=missing
RAILWAY_API_TOKEN=missing
VERCEL_TOKEN=missing
```

## Deployment Date

Prepared on: 2026-07-19.

## Branch / Commit

Current branch: `main`

Current HEAD before production packaging:

```text
b01d682b37d7a5ad6ea99fa34187b8dcf2085990
```

The working tree contains uncommitted product and production changes.

## Environment Variables

Do not put secret values in files or frontend JavaScript.

| Variable | Required | Secret | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | No | Use `production` in production |
| `HOST` | Yes | No | Use `0.0.0.0` |
| `PORT` | Provided by host | No | Render/Railway inject this |
| `FMP_API_KEY` | Yes | Yes | Financial Modeling Prep server-side key |
| `OPENAI_API_KEY` | Yes | Yes | OpenAI server-side parser key |
| `OPENAI_MODEL` | Yes | No | Parser model, default `gpt-4.1-mini` |
| `APP_ACCESS_PASSWORD` | Yes | Yes | Private beta access password |
| `APP_SESSION_SECRET` | Yes | Yes | HMAC signing secret for session cookie |
| `APP_ORIGIN` | Yes after URL exists | No | Production HTTPS origin for CORS |

## Build Command

```bash
npm install --omit=dev
```

## Start Command

```bash
npm start
```

## Health Check URL

After deployment:

```text
https://YOUR-PRODUCTION-URL/api/health
```

Expected shape:

```json
{
  "status": "ok",
  "version": "10.0.0",
  "fmpConfigured": true,
  "openAiConfigured": true,
  "accessProtectionConfigured": true
}
```

## Render Setup

1. Create a new Render Web Service from the GitHub repository.
2. Use runtime `Node`.
3. Set build command to `npm install --omit=dev`.
4. Set start command to `npm start`.
5. Add the environment variables listed above.
6. Set health check path to `/api/health`.
7. Deploy.
8. After Render gives a URL, set `APP_ORIGIN` to that exact HTTPS origin and redeploy.

## Update Deployment

1. Commit changes.
2. Push to the deployment branch.
3. Let Render/Railway redeploy.
4. Check `/api/health`.
5. Open the private URL and verify login.

## Rollback

Use the hosting provider's previous deploy/version rollback feature, then verify:

- `/api/health`
- login
- Home load
- `/api/search`
- `/api/research-data`
- `/api/parse-investment-analyst`

## Review Logs

Use the hosting provider logs. Search for:

- boot failures
- `PORT` binding issues
- provider timeout
- rate limits
- invalid provider configuration

Logs must not include API keys. The server returns sanitized errors only.

## Replace API Keys

Update these hosting environment variables:

- `FMP_API_KEY`
- `OPENAI_API_KEY`

Then redeploy or restart the service.

## Change Access Password

Update:

- `APP_ACCESS_PASSWORD`

Then redeploy or restart. Existing sessions are invalidated if `APP_SESSION_SECRET` is also rotated.

## iPhone Installation

See `IPHONE_INSTALLATION_GUIDE.md`.
