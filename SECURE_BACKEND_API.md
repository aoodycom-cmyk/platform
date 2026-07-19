# Secure Backend API

## Purpose

The GitHub Pages frontend remains deployed at:

```text
https://aoodycom-cmyk.github.io/platform/
```

API keys must stay on a separate Node.js backend. The browser calls the backend, and the backend calls FMP and OpenAI.

```text
GitHub Pages frontend -> secure backend -> FMP / OpenAI
```

## Backend Folder

The backend lives in:

```text
backend/
```

Start command:

```bash
cd backend
npm start
```

## Environment Variables

Set these only on Render or Railway:

| Variable | Purpose |
| --- | --- |
| `PORT` | Provided by host |
| `HOST` | Use `0.0.0.0` |
| `FRONTEND_ORIGIN` | `https://aoodycom-cmyk.github.io` |
| `FMP_API_KEY` | Server-side FMP key |
| `OPENAI_API_KEY` | Server-side OpenAI key |
| `OPENAI_MODEL` | Parser model, default `gpt-4.1-mini` |

Do not commit real keys.

## Endpoints

```text
GET /api/health
GET /api/search?q=AAPL
GET /api/company/:symbol
POST /api/parse-investment-analyst
```

`/api/health` returns only boolean configuration status, never actual keys.

## CORS

The backend accepts browser requests only from:

```text
https://aoodycom-cmyk.github.io
```

Set `FRONTEND_ORIGIN` to that exact origin.

## Frontend Link

After deploying the backend, update:

```text
docs/backend-config.js
public/backend-config.js
backend-config.js
```

Set:

```js
window.FRANKLIN_BACKEND_URL = "https://YOUR-BACKEND-URL";
```

This value is not a secret. It is only the public backend URL.

## Security Checks

- API keys are not present in frontend JavaScript, HTML, storage, or URLs.
- Backend applies CORS, JSON parsing limits, rate limiting, provider timeouts, and sanitized errors.
- Stack traces and provider secrets are not returned to the browser.
