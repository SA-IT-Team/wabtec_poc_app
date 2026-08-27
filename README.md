# Ballooned Drawing Extraction — POC Web App

A React + TypeScript front end for the [`poc/`](../poc) Azure Function App. Lets you point at a
deployed Function App, drag a ballooned drawing onto the page, and see exactly what
[`architecture-poc.md`](../architecture-poc.md) §3.2 returns: detected vs. extracted balloon
counts, the mismatch flag, and every balloon's nominal value, tolerance, GD&T, and confidence —
with a download link for the generated Excel export.

**This is a POC client for a POC backend.** There is no user auth beyond a function key you paste
in yourself (stored only in your browser's `localStorage`) — see `ConnectionBar`'s note in the UI
and `poc/architecture-poc.md` §3.3. Do not point this at anything holding real customer drawings
without first reading that section.

## What it does

- Upload panel (drag-and-drop or file picker) → `POST /api/drawings/extract`
- Results summary: drawing number/revision, detected vs. extracted counts, mismatch banner,
  Excel export link
- Balloon table: one row per balloon, low-confidence rows highlighted, extraction errors surfaced
  inline (never silently dropped — mirrors the backend's FR-10 guarantee)
- Job history (client-side only, this browser): re-fetch a past job via `GET /api/drawings/{jobId}`

## Project layout

```
POC_App/
  src/
    lib/
      types.ts       # mirrors poc/src/models.py — keep in sync with the backend
      api.ts          # typed fetch client for the two POC endpoints
      storage.ts       # localStorage: connection config + job history
    components/
      ConnectionBar     # Function App URL + key entry
      UploadPanel         # drag-drop file picker
      ResultsSummary        # counts, mismatch banner, export link
      BalloonTable            # per-balloon table
      JobHistory                 # past jobs, this browser only
      StatusPill                    # small reusable badge
    App.tsx        # wires everything together
  staticwebapp.config.json   # Azure Static Web Apps routing/headers
  .github/workflows/azure-static-web-apps.yml
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173, hot reload
```

On first load you'll be asked for a Function App URL and key — see
[`../poc/deployment.md`](../poc/deployment.md) for how to stand one up, or
`az functionapp keys list` if you already have one deployed.

## Testing

```bash
npm test              # vitest, single run
npm run test:watch    # vitest watch mode
npm run lint           # tsc --noEmit
```

24 tests: `lib/storage` (localStorage round-trips, dedup, 25-entry cap), `lib/api` (request
shaping, function-key header, error mapping), `components/BalloonTable` (sorting, low-confidence
highlighting, error surfacing), and an `App` integration suite (connect → upload → render result,
including the mismatch banner and error path) with `fetch` mocked — no real Function App required
to run the suite.

## Building

```bash
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the built dist/ locally to sanity-check before deploying
```

## Deploying

See [`deployment.md`](deployment.md) — Azure Static Web Apps, either via the bundled GitHub
Actions workflow or a one-off `swa deploy`. Requires the `poc/` Function App to already be
deployed (`../poc/deployment.md`) and its CORS configured to allow the Static Web App's origin.
