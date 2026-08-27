# Deployment Guide — Vercel

Scope: deploying this React front end to **Vercel**, wired up to the Vercel-hosted `wabtec_poc`
backend (see [`../wabtec_poc/deployment-vercel.md`](../wabtec_poc/deployment-vercel.md), which must
be done first — you need its URL and `API_ACCESS_KEY`). Like the backend, treat this as disposable
POC infrastructure: no auth beyond the key the user pastes into the connection form.

Much simpler than the backend: this is a static Vite/React SPA, one of Vercel's best-supported
zero-config cases — no Python runtime concerns, no request-body caps, no entrypoint conventions to
get right.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| A deployed backend | `../wabtec_poc/deployment-vercel.md`. You need its URL and `API_ACCESS_KEY`. |
| A Vercel account + the Vercel CLI | `npm install -g vercel`, then `vercel login`. Only needed for the CLI path (§3.1) — the Git-connected path (§3.2) doesn't require it locally. |
| Node.js 20+, npm | Same as local dev — `npm install && npm run build` must succeed first. |

No build-time environment variables are required — the backend URL and key are entered by the user
at runtime through the connection form and stored in that browser's `localStorage`, not baked into
the build. That also means the exact same build works against any backend without a redeploy,
including a locally-running one.

---

## 2. What's actually in `vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [...]
}
```

The rewrite is a no-op today — this app has no client-side router, just one page — but it's the
standard SPA deep-linking fallback Vercel documents for Vite, and costs nothing to have in place if
routing gets added later. The headers set `X-Content-Type-Options`, `X-Frame-Options`, and
`Referrer-Policy`.

---

## 3. Deploy — two paths

### 3.1 One-off deploy with the Vercel CLI (fastest)

```bash
npm run build
vercel --prod
```

First run prompts you to link the directory to a Vercel project (or create one). Re-run
`vercel --prod` after any change you want live — `vercel` handles both build and deploy.

### 3.2 Git-connected deploys (recommended for anything beyond one-off testing)

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In the Vercel dashboard: **Add New → Project**, import the repo. Vercel auto-detects the Vite
   framework preset — no configuration needed.
3. Every push to the production branch deploys to your production URL; every PR gets its own
   preview URL automatically.

Note this is a *separate* Vercel project from the backend — two repos, two projects, two URLs.

---

## 4. Connecting to your backend

Open the deployed app and, in the connection form at the top, paste the backend's URL
(`https://<your-backend>.vercel.app`) and the value of its `API_ACCESS_KEY`. Both are stored in that
browser's `localStorage` only.

Then go back and restrict the backend's `CORS_ALLOWED_ORIGIN` (see
`../wabtec_poc/deployment-vercel.md` §3) to this app's actual deployed origin — don't leave it on the
`*` default once you're sharing the link with anyone else. Changing it requires a backend redeploy
to take effect.

---

## 5. Large-file uploads

The app automatically switches to the three-step upload-URL / direct-to-Blob-Storage / process flow
for any file over 4MB (see `../wabtec_poc/deployment-vercel.md` §4 for why that limit exists) —
nothing to configure. `App.tsx` picks the path per file size and shows an "Uploading directly to
storage…" status while it runs.

---

## 6. Verify

```bash
open "https://<your-project>.vercel.app"
```

Connect to your backend (§4), upload a small test drawing, confirm it completes. Then try one over
4MB to exercise the large-file path — watch the Network tab for the three requests (`upload-url`, a
PUT straight to `*.blob.core.windows.net`, then `process`).

---

## 7. Updating after a code change

- **CLI path:** `npm run build && vercel --prod`
- **Git-connected path:** push to the production branch; Vercel handles the rest.

## 8. Teardown

Delete the project from the Vercel dashboard (Settings → Advanced → Delete Project), or:

```bash
vercel remove <project-name>
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every request 401s even though the backend is reachable | The key in the connection form doesn't match the backend's `API_ACCESS_KEY` — check for trailing whitespace if you pasted it, and confirm you set the variable in the same env scope (production vs. preview) as the deployment you're hitting. |
| Every request 500s with `ConfigurationError` | A backend env var is missing — that's a backend problem, see `../wabtec_poc/deployment-vercel.md` §9. |
| Upload fails with a browser-level network error and no JSON response | CORS — the backend's `CORS_ALLOWED_ORIGIN` doesn't include this app's origin. Remember preview deployments get a different hostname than production. |
| Mixed-content error connecting to a local backend from a deployed frontend | A page served over HTTPS can't call `http://127.0.0.1`. Test locally against a local backend (`npm run dev`), or deploy the backend. |
| A small file works but one over 4MB fails | Exercise the three-step flow directly with curl against the backend (`../wabtec_poc/deployment-vercel.md` §4) to find out which of the three requests is failing — most often the SAS PUT, from a Storage account whose keys or network rules changed. |
| `vercel --prod` succeeds but the live site shows an old build | Vercel's CDN can take a minute to propagate — hard-refresh, or wait briefly before re-checking. |
