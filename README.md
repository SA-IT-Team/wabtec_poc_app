# Ballooned Drawing Extraction — POC Web App

A React + TypeScript front end for the [`wabtec_poc`](../wabtec_poc) backend — **deployable to
either Azure Functions or Vercel**, and able to talk to either one regardless of where the frontend
itself is hosted (the connection form's backend selector picks the right auth header per host).
Point it at a deployed backend, drag a ballooned drawing onto the page, and see exactly what
[`doc/architecture-poc.md`](../wabtec_poc/doc/architecture-poc.md) §3.2 returns: detected vs.
extracted balloon counts, the mismatch flag, and every balloon's nominal value, tolerance, GD&T,
and confidence — with a download link for the generated Excel export.

**This is a POC client for a POC backend.** There is no real user auth on either host, just a
shared secret you paste in yourself (stored only in your browser's `localStorage`) — see
`ConnectionBar`'s note in the UI, `../wabtec_poc/doc/architecture-poc.md` §3.3 (Azure), and
`../wabtec_poc/deployment-vercel.md` §3 (Vercel). Do not point this at anything holding real
customer drawings without first reading those.

## What it does

- Upload panel (drag-and-drop or file picker) → `POST /api/drawings/extract`, or — automatically,
  for files over 4MB against a Vercel backend — the three-step direct-to-Blob-Storage flow (see
  `deployment-vercel.md` §5)
- Results summary: drawing number/revision, detected vs. extracted counts, mismatch banner,
  Excel export link
- Balloon table: one row per balloon, low-confidence rows highlighted, extraction errors surfaced
  inline (never silently dropped — mirrors the backend's FR-10 guarantee)
- Job history (client-side only, this browser): re-fetch a past job via `GET /api/drawings/{jobId}`

## Project layout

```
wabtec_poc_app/
  src/
    lib/
      types.ts       # mirrors wabtec_poc/src/models.py — keep in sync with the backend
      api.ts          # typed fetch client; picks auth header + upload strategy per backend/file size
      storage.ts       # localStorage: connection config (incl. backend type) + job history
    components/
      ConnectionBar     # backend type selector + URL/key entry
      UploadPanel         # drag-drop file picker
      ResultsSummary        # counts, mismatch banner, export link
      BalloonTable            # per-balloon table
      JobHistory                 # past jobs, this browser only
      StatusPill                    # small reusable badge
    App.tsx        # wires everything together
  staticwebapp.config.json   # Azure Static Web Apps routing/headers
  vercel.json                 # Vercel routing/headers
  .github/workflows/azure-static-web-apps.yml
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173, hot reload
```

On first load you'll be asked to pick a backend (Azure Functions or Vercel) and enter its URL and
key — see [`../wabtec_poc/deployment.md`](../wabtec_poc/deployment.md) (Azure) or
[`../wabtec_poc/deployment-vercel.md`](../wabtec_poc/deployment-vercel.md) (Vercel) for how to
stand one up.

## Testing

```bash
npm test              # vitest, single run
npm run test:watch    # vitest watch mode
npm run lint           # tsc --noEmit
```

37 tests: `lib/storage` (localStorage round-trips incl. backend-type default/migration, dedup,
25-entry cap), `lib/api` (request shaping and auth-header selection per backend, the large-file
upload-url/PUT/process orchestration, error mapping), `components/BalloonTable` (sorting,
low-confidence highlighting, error surfacing), and an `App` integration suite (connect → upload →
render result on both backend types, including the large-file flow and the mismatch/error paths)
with `fetch` mocked — no real backend required to run the suite.

## Building

```bash
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the built dist/ locally to sanity-check before deploying
```

## Deploying

Two independent choices — this app's hosting doesn't need to match the backend's:

- **Vercel:** see [`deployment-vercel.md`](deployment-vercel.md) — near-zero-config for a Vite SPA,
  `vercel --prod` or Git-connected auto-deploy.
- **Azure Static Web Apps:** see [`deployment.md`](deployment.md) — the bundled GitHub Actions
  workflow or a one-off `swa deploy`.

Either way, the backend (`../wabtec_poc`, on either host) needs to already be deployed and its
CORS configured to allow this app's deployed origin.
