# Deployment Guide — Vercel

Scope: deploying this React front end to **Vercel**, wired up to talk to the Vercel-hosted
`wabtec_poc` backend (see [`../wabtec_poc/deployment-vercel.md`](../wabtec_poc/deployment-vercel.md),
which must be done first — you need its URL and `API_ACCESS_KEY`). This app can equally be pointed
at an Azure Functions backend instead (the connection form's backend selector handles the header
difference — see §4) — nothing about deploying the frontend to Vercel requires the backend to also
be on Vercel, or vice versa. Like the backend, treat this as disposable POC infrastructure: no auth
beyond the key the user pastes into the connection form.

Much simpler than the backend port: this is a static Vite/React SPA, one of Vercel's best-supported
zero-config cases — no Python runtime concerns, no request-body caps, no entrypoint conventions to
get right.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| A deployed backend (either host) | Vercel-hosted: `../wabtec_poc/deployment-vercel.md`. Azure Functions: `../wabtec_poc/deployment.md`. You need its URL and key either way. |
| A Vercel account + the Vercel CLI | `npm install -g vercel`, then `vercel login`. Only needed for the CLI path (§3.1) — the Git-connected path (§3.2) doesn't require it locally. |
| Node.js 20+, npm | Same as local dev — `npm install && npm run build` must succeed first. |

No build-time environment variables are required — the backend URL and key are entered by the user
at runtime through the connection form and stored in that browser's `localStorage`, not baked into
the build. That also means the exact same build works against any backend without a redeploy.

---

## 2. What's actually in `vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [...]
}
```

The rewrite is a no-op today — this app has no client-side router, just one page — but it's the
standard SPA deep-linking fallback Vercel documents for Vite, and costs nothing to have in place
if routing gets added later. The headers mirror the security headers `staticwebapp.config.json`
sets for the Azure Static Web Apps path, for parity between the two deployment targets.

---

## 3. Deploy — two paths

### 3.1 One-off deploy with the Vercel CLI (fastest)

```bash
npm run build
vercel --prod
```

First run prompts you to link the directory to a Vercel project (or create one). Re-run
`vercel --prod` after any change you want live — no separate build/deploy split like the Azure SWA
CLI path needed, `vercel` handles both.

### 3.2 Git-connected deploys (recommended for anything beyond one-off testing)

Unlike the Azure Static Web Apps path, this doesn't need a custom GitHub Actions workflow — Vercel's
own Git integration builds and deploys on every push once connected:

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In the Vercel dashboard: **Add New → Project**, import the repo. Vercel auto-detects the Vite
   framework preset — no configuration needed.
3. Every push to the production branch deploys to your production URL; every PR gets its own
   preview URL automatically.

---

## 4. Connecting to your backend

Open the deployed app, and in the connection form at the top:

- Pick **Azure Functions** or **Vercel** in the **Backend** selector — this determines which
  header the app sends (`x-functions-key` vs `x-api-key`); getting it wrong doesn't fail loudly,
  it just means every request comes back `401 Unauthorized` from a backend that's actually up.
- Paste the backend's URL and key.

If the backend is also on Vercel, restrict its `CORS_ALLOWED_ORIGIN` (see
`../wabtec_poc/deployment-vercel.md` §3) to this app's actual deployed origin once you have it —
don't leave it on the `*` default once you're sharing the link with anyone else.

---

## 5. Large-file uploads

If the connected backend is on Vercel, this app automatically switches to the three-step
upload-URL / direct-to-Blob-Storage / process flow for any file over 4MB (see
`../wabtec_poc/deployment-vercel.md` §4 for why that limit exists) — nothing to configure, `App.tsx`
picks the right path per file size and shows an "Uploading directly to storage…" status while it
does. Against an Azure Functions backend, every file uses the single-call path regardless of size,
since Azure Functions has no equivalent request-size cap.

---

## 6. Verify

```bash
open "https://<your-project>.vercel.app"
```

Connect to your backend (§4), upload a small test drawing, confirm it completes. Then try one over
4MB against a Vercel backend specifically, to exercise the large-file path — watch the Network tab
for the three requests (`upload-url`, a PUT straight to `*.blob.core.windows.net`, then `process`).

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
| Every request 401s even though the backend is reachable | Wrong backend type selected in the connection form — Azure needs `x-functions-key`, Vercel needs `x-api-key`; picking the wrong one sends the right key under the wrong header name. |
| Upload fails with a browser-level network error, no JSON response | CORS — the backend's `CORS_ALLOWED_ORIGIN` (Vercel backend) or Function App CORS origins (Azure backend) don't include this app's deployed origin. |
| A file just under 4MB works but one just over hangs, then fails oddly | Confirm the backend is actually Vercel-flavored in the connection form — the 4MB threshold only matters (and the three-step flow only exists) when talking to a Vercel backend; against Azure it's irrelevant and every file uses the single-call path. |
| `vercel --prod` succeeds but the live site shows an old build | Vercel's CDN can take a minute to propagate — hard-refresh, or wait briefly before re-checking. |
