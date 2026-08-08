# Franklin Source of Truth

## Canonical Source Directory

`src/` is the canonical application source for Franklin browser code.

Do not manually edit matching application logic under `public/src/` or `docs/src/`.

## Deployment Directories

`public/` is the local static app copy used by the local Node server.

`docs/` is the GitHub Pages deployment directory for:

`https://aoodycom-cmyk.github.io/platform/`

## Build / Sync Command

Run:

```bash
npm run sync-public
```

or:

```bash
npm run build
```

Both commands run `scripts/sync-deploy.mjs`.

## Generated Automatically

The sync command copies these canonical directories:

- `src/` -> `public/src/`
- `src/` -> `docs/src/`
- `assets/` -> `public/assets/`
- `assets/` -> `docs/assets/`

The sync command also copies these root app files into both deployment directories:

- `index.html`
- `styles.css`
- `service-worker.js`
- `manifest.webmanifest`
- `offline.html`
- `login.html`
- `backend-config.js`
- `CHANGELOG.md`
- `SOURCE_OF_TRUTH.md`

## Files That Should Never Be Manually Edited

Do not manually edit:

- `public/src/**`
- `docs/src/**`
- `public/assets/**`
- `docs/assets/**`
- `public/index.html`
- `docs/index.html`
- `public/styles.css`
- `docs/styles.css`
- `public/service-worker.js`
- `docs/service-worker.js`
- other copied root app files inside `public/` or `docs/`

Edit the canonical root file or `src/` file, then run `npm run sync-public`.

## Sync Check

Run:

```bash
npm run check:source-sync
```

The check fails if deployable application code in `public/` or `docs/` diverges from the canonical source.

## GitHub Pages Path

GitHub Pages serves the app from:

`docs/`

The live URL is:

`https://aoodycom-cmyk.github.io/platform/`
