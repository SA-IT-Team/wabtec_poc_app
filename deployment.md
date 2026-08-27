# Deployment Guide — POC Web App

Scope: deploying [`wabtec_poc_app/`](.) — the React front end — to **Azure Static Web Apps**, and wiring
it up to talk to the already-deployed `poc/` Function App backend (see
[`../wabtec_poc/deployment.md`](../wabtec_poc/deployment.md), which must be done first). Like the backend, treat
this as disposable POC infrastructure, not a production deployment — no auth beyond the function
key the user pastes into the UI.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| The `poc/` Function App already deployed | Follow `../wabtec_poc/deployment.md` first — you need its URL and a function key. |
| Azure CLI (`az`) | v2.60+, logged in (`az login`). |
| Node.js 20+, npm | Same as for local dev — `npm install && npm run build` must succeed first. |
| **Either** a GitHub repo you can push this project to, **or** the SWA CLI for a direct one-off deploy | Two paths below — pick one. |

---

## 2. Create the Static Web App resource

```bash
SUFFIX="poc01"                 # match the suffix you used for the Function App, for clarity
RG="bdx-${SUFFIX}-rg"           # same resource group as the Function App is fine
LOCATION="eastus2"               # Static Web Apps is only available in a subset of regions —
                                   # confirm eastus2/westus2/centralus/westeurope/eastasia still
                                   # covers your subscription before picking one
SWA_NAME="bdx-${SUFFIX}-webapp"

az staticwebapp create \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Free
```

The Free tier is sufficient for a POC (custom domains and staging environments are supported even
on Free; the paid Standard tier only matters for private endpoints / higher traffic).

---

## 3. Configure CORS on the Function App

**This is the step most likely to bite you.** The browser calls the Function App directly
(there's no server-side proxy in this POC), so the Function App must explicitly allow the Static
Web App's origin or every request will fail with a CORS error the browser reports as a generic
network failure, not a helpful message.

```bash
SWA_HOSTNAME=$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)
FUNCAPP="bdx-${SUFFIX}-func"     # from poc/deployment.md

az functionapp cors add \
  --name "$FUNCAPP" --resource-group "$RG" \
  --allowed-origins "https://${SWA_HOSTNAME}"
```

If you're also testing from `npm run dev` (localhost:5173) against the real deployed Function App,
add that origin too:

```bash
az functionapp cors add --name "$FUNCAPP" --resource-group "$RG" --allowed-origins "http://localhost:5173"
```

---

## 4. Deploy the app — two paths

### 4.1 One-off deploy with the SWA CLI (fastest, no GitHub needed)

```bash
npm install -g @azure/static-web-apps-cli
cd wabtec_poc_app
npm run build

DEPLOYMENT_TOKEN=$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG" --query "properties.apiKey" -o tsv)
swa deploy ./dist --deployment-token "$DEPLOYMENT_TOKEN" --env production
```

Good for iterating quickly while you're still testing against a live Function App. Re-run after
every `npm run build` to push a new version.

### 4.2 GitHub Actions (repeatable CI/CD)

The workflow at [`.github/workflows/azure-static-web-apps.yml`](.github/workflows/azure-static-web-apps.yml)
is already set up to build, test, and deploy `wabtec_poc_app/` on every push to `main`.

1. Push this repo to GitHub.
2. Get the deployment token and add it as a GitHub Actions secret:
   ```bash
   az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG" --query "properties.apiKey" -o tsv
   ```
   GitHub → repo → Settings → Secrets and variables → Actions → New repository secret →
   name it `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Push to `main` (or open a PR — the workflow also builds preview environments for PRs, and
   tears them down on close).

The workflow runs `npm test` before deploying — a failing test blocks the deploy, which is the
point of having it in CI rather than just locally.

---

## 5. Verify

```bash
open "https://${SWA_HOSTNAME}"     # or just paste it into a browser
```

Paste in the Function App URL and key (§4 of `../wabtec_poc/deployment.md`), upload a test drawing, and
confirm the request succeeds. If it fails at the network level (not a JSON error response), it's
almost always the CORS step (§3) — check the browser console for the specific blocked-origin
message.

---

## 6. Updating after a code change

- **SWA CLI path:** `npm run build && swa deploy ./dist --deployment-token "$DEPLOYMENT_TOKEN" --env production`
- **GitHub Actions path:** push to `main`; the workflow handles the rest.

## 7. Teardown

```bash
az staticwebapp delete --name "$SWA_NAME" --resource-group "$RG" --yes
```

If you're tearing down the whole POC (backend included), `az group delete` on the shared resource
group (see `../wabtec_poc/deployment.md` §7) removes this too.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Upload fails with no error message, browser console shows a CORS error | Function App CORS doesn't allow the Static Web App's origin — re-run §3, and double check you used `https://` and the exact `defaultHostname`. |
| App loads but "Save" on the connection form does nothing useful, then the extract call 401/403s | Function key is wrong or was regenerated — re-run `az functionapp keys list` against the Function App and re-paste it. |
| GitHub Actions deploy step fails with an auth error | `AZURE_STATIC_WEB_APPS_API_TOKEN` secret is missing, wrong, or the SWA's deployment token was rotated — regenerate via `az staticwebapp secrets list` and update the GitHub secret. |
| `swa deploy` succeeds but the site still shows the old build | Static Web Apps' CDN can take a minute or two to invalidate — hard-refresh, or wait briefly before re-checking. |
| Build fails in CI but works locally | Confirm `wabtec_poc_app/package-lock.json` is committed — `npm ci` (used in the workflow) requires it and will fail without one, unlike `npm install`. |
