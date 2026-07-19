# Production Run Instructions V10.0.0

## Run Locally

From the project folder:

```bash
node server.mjs
```

Open the printed local URL, usually:

```text
http://localhost:4321/
```

For local private access, set at least:

```text
APP_ACCESS_PASSWORD=your-local-password
FMP_API_KEY=your-fmp-key
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4.1-mini
```

## Mobile Use

1. Open the app on the phone.
2. Tap `تحليل جديد`.
3. Enter a ticker if available.
4. Paste one block of company data into the main box.
5. Tap `تحليل النص`.
6. Review extracted data.
7. Tap `تأكيد وتشغيل التحليل`.
8. Read the Investment Report first.
9. Open technical sections only if needed.
10. Add an approval note and tap `اعتماد وتصدير` when the report is final.

## Demo Flow

Use `تحميل بيانات تجريبية` to load the included fixture.

The demo fixture is stored in:

```text
public/src/data/demoFlow.js
```

The UI does not hardcode the final report. The demo fields are passed to the existing deterministic engine.

## Production

Use a Node.js host such as Render or Railway. The production build requires the Node server because API keys are server-side only.

Do not use static GitHub Pages for the API-dependent production deployment.

## Notes

- API keys remain server-side environment variables only.
- Missing fields remain missing.
- AI may explain or parse text, but calculations are deterministic.
- Draft reports are not exported to Home until approved.
