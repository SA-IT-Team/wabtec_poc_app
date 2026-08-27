# Ballooned Drawing Extraction — POC Web App

A React + TypeScript front end for the [`wabtec_poc`](../wabtec_poc) backend. Both deploy to
**Vercel**. Point it at a backend — a Vercel deployment, or `http://127.0.0.1:8000` while testing
locally — drag a ballooned drawing onto the page, and see exactly what
[`doc/architecture-poc.md`](../wabtec_poc/doc/architecture-poc.md) §3.2 returns: detected vs.
extracted balloon counts, the mismatch flag, and every balloon's nominal value, tolerance, GD&T,
and confidence — with a download link for the generated Excel export.

**This is a POC client for a POC backend.** There is no real user auth, just a shared secret you
paste in yourself (stored only in your browser's `localStorage`) — see `ConnectionBar`'s note in the
UI and [`../wabtec_poc/deployment-vercel.md`](../wabtec_poc/deployment-vercel.md) §3. Do not point
this at anything holding real customer drawings without first reading those.

## What it does

- Upload panel (drag-and-drop or file picker) → `POST /api/drawings/extract`, or — automatically,
  for files over 4MB — the three-step direct-to-Blob-Storage flow (see
  `../wabtec_poc/deployment-vercel.md` §4)
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
      api.ts          # typed fetch client; picks the upload strategy by file size
      storage.ts       # localStorage: connection config + job history
    components/
      ConnectionBar     # backend URL + API key entry
      UploadPanel         # drag-drop file picker
      ResultsSummary        # counts, mismatch banner, export link
      BalloonTable            # per-balloon table
      JobHistory                 # past jobs, this browser only
      StatusPill                    # small reusable badge
    App.tsx        # wires everything together
  vercel.json     # SPA routing + security headers
```

## Local development

```bash
npm install
npm run dev          # http://localhost:5173, hot reload
```

On first load you'll be asked for a backend URL and key. To run the whole POC on your machine,
start the backend first (`python app.py` in [`../wabtec_poc`](../wabtec_poc) — see its README),
then enter:

- **Backend URL:** `http://127.0.0.1:8000`
- **API access key:** whatever you set as `API_ACCESS_KEY` in the backend's `.env`

The backend's CORS default (`*`) already allows `localhost:5173`, so nothing else needs configuring.
Note that the backend calls the real Azure Document Intelligence and Claude APIs even when run
locally, so you need live credentials and each extraction costs real API spend.

## Testing

```bash
npm test              # vitest, single run
npm run test:watch    # vitest watch mode
npm run lint           # tsc --noEmit
```

37 tests: `lib/storage` (localStorage round-trips including the legacy-field migration, dedup,
25-entry cap), `lib/api` (request shaping, the `x-api-key` header, the large-file
upload-url/PUT/process orchestration, error mapping), `components/BalloonTable` (sorting,
low-confidence highlighting, error surfacing), and an `App` integration suite (connect → upload →
render result, including the large-file flow and the mismatch/error paths) with `fetch` mocked — no
real backend required to run the suite.

## Building

```bash
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the built dist/ locally to sanity-check before deploying
```

## Deploying

See [`deployment-vercel.md`](deployment-vercel.md) — near-zero-config for a Vite SPA, either
`vercel --prod` or Git-connected auto-deploy. No build-time env vars: the backend URL and key are
entered at runtime, so one build works against any backend.

Deploy the backend ([`../wabtec_poc`](../wabtec_poc)) first — you need its URL and `API_ACCESS_KEY`
to connect, and it needs this app's deployed origin in its `CORS_ALLOWED_ORIGIN`.
