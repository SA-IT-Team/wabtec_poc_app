# Ballooned Drawing Extraction — POC Web App

A React + TypeScript front end for the [`wabtec_poc`](../wabtec_poc) backend. Both deploy to
**Vercel**. Configured at build/deploy time to point at one backend (see Configuration below) —
choose a drawing, hit Extract, and see exactly what
[`doc/architecture-poc.md`](../wabtec_poc/doc/architecture-poc.md) §3.2 returns: detected vs.
extracted balloon counts, the mismatch flag, and every balloon's nominal value, tolerance, GD&T,
and confidence — plus reconciliation review and an AI assistant, ending in a download link for the
generated Excel export once signed off.

**This is a POC client for a POC backend.** There is no real user auth, just a shared secret set as
an env var at build time — see Configuration below and
[`../wabtec_poc/deployment-vercel.md`](../wabtec_poc/deployment-vercel.md) §3. Do not point this at
anything holding real customer drawings without first reading those.

## Configuration

Unlike earlier versions of this app, the backend URL and API key are **not** entered in the UI —
they're set once via env vars at build/deploy time:

| Env var | Meaning |
|---|---|
| `VITE_API_BASE_URL` | The `wabtec_poc` backend's base URL (e.g. `http://127.0.0.1:8000` locally, or a Vercel deployment URL). |
| `VITE_API_ACCESS_KEY` | Must match that backend's own `API_ACCESS_KEY`. |

Copy [`.env.example`](.env.example) to `.env.local` for local dev (Vite loads it automatically,
gitignored). For a Vercel deployment, set both as project environment variables instead — see
[`deployment-vercel.md`](deployment-vercel.md).

Note these are `VITE_`-prefixed, which means Vite inlines them into the built client bundle —
anyone with devtools access to a deployed build can read the key out of it, same exposure as the
old localStorage-entered key. See `src/lib/env.ts` for the reasoning; it's an accepted POC-grade
tradeoff, not a regression.

If either var is missing, the app shows a "Backend isn't configured" hint and disables Extract
rather than failing silently.

## What it does

- Compact upload bar (button or drag-and-drop) → `POST /api/drawings/extract`, or — automatically,
  for files over 4MB — the three-step direct-to-Blob-Storage flow (see
  `../wabtec_poc/deployment-vercel.md` §4)
- Drawing preview, results summary, and a balloon table alongside a reconciliation review panel
  (confirm/correct/flag every balloon, sign off, export)
- AI Assistant: general Q&A and a structured feedback pass (missing information, incomplete data,
  cross-sheet inconsistencies, common mistakes) over the current job — see
  `../wabtec_poc/src/chat_assistant.py`
- Job history (client-side only, this browser, collapsible): re-fetch a past job via
  `GET /api/drawings/{jobId}`

## Project layout

```
wabtec_poc_app/
  src/
    lib/
      types.ts       # mirrors wabtec_poc/src/models.py — keep in sync with the backend
      env.ts          # reads VITE_API_BASE_URL / VITE_API_ACCESS_KEY -- see Configuration above
      api.ts           # typed fetch client; picks the upload strategy by file size
      storage.ts        # localStorage: identity + job history (no connection config anymore)
    components/
      UploadPanel     # compact button/drag upload bar
      DrawingPreview    # inline preview of the just-uploaded file
      ResultsSummary      # counts, mismatch banner, export link
      BalloonTable           # per-balloon table
      ReconciliationPanel       # review/signoff/export workflow
      AssistantPanel               # AI feedback + chat
      CollapsiblePanel                # generic collapsible sidebar card
      JobHistory                        # past jobs, this browser only
      BrandLogo                           # logo with text-wordmark fallback
      StatusPill                            # small reusable badge
    App.tsx        # wires everything together
  public/logos/  # drop real logo files here -- see public/logos/README.md
  vercel.json  # SPA routing + security headers
```

## Local development

```bash
cp .env.example .env.local   # fill in VITE_API_BASE_URL / VITE_API_ACCESS_KEY
npm install
npm run dev                  # http://localhost:5173, hot reload
```

To run the whole POC on your machine, start the backend first (`python app.py` in
[`../wabtec_poc`](../wabtec_poc) — see its README), then set:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_API_ACCESS_KEY=<whatever you set as API_ACCESS_KEY in the backend's .env>
```

The backend's CORS default (`*`) already allows `localhost:5173`, so nothing else needs configuring.
Note that the backend calls the real Azure Document Intelligence and Claude APIs even when run
locally, so you need live credentials and each extraction costs real API spend.

## Testing

```bash
npm test              # vitest, single run
npm run test:watch    # vitest watch mode
npm run lint           # tsc --noEmit
```

`lib/storage` (localStorage round-trips for identity + job history), `lib/env` (env-var config
parsing), `lib/api` (request shaping, the `x-api-key` header, the large-file
upload-url/PUT/process orchestration, error mapping, the AI assistant's analyze/chat calls),
`components/BalloonTable`/`AssistantPanel`/`CollapsiblePanel` (unit), and an `App` integration
suite (upload → render result, including the large-file flow and the mismatch/error paths) with
`fetch` mocked — no real backend required to run the suite.

## Building

```bash
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the built dist/ locally to sanity-check before deploying
```

## Deploying

See [`deployment-vercel.md`](deployment-vercel.md) — set `VITE_API_BASE_URL` /
`VITE_API_ACCESS_KEY` as Vercel project env vars (Configuration above), then `vercel --prod` or
Git-connected auto-deploy. One build is now pinned to one backend, by design — see Configuration.

Deploy the backend ([`../wabtec_poc`](../wabtec_poc)) first — you need its URL and `API_ACCESS_KEY`
to set this app's env vars, and it needs this app's deployed origin in its `CORS_ALLOWED_ORIGIN`.
