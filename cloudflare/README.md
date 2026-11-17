# PANEL — Cloudflare Worker deployment

The GitHub Actions workflow deploys `cloudflare/worker.js` to the existing Cloudflare Worker `royal-violet-a780` at `https://royal-violet-a780.galroland0826.workers.dev`.

## One-time setup

1. In Cloudflare dashboard, open **My Profile → API Tokens → Create Token**. Choose **Edit Cloudflare Workers** template (or a custom token limited to your account with Workers Scripts: Edit). Scope it to your own account.
2. Find your **Cloudflare Account ID** in the dashboard (Workers & Pages overview or account details).
3. In GitHub open **theparsifal21/panel → Settings → Secrets and variables → Actions → New repository secret**.
4. Add `CLOUDFLARE_API_TOKEN` with the Cloudflare token and `CLOUDFLARE_ACCOUNT_ID` with your account ID. **Never put either value in a repository file, issue, or chat.**
5. Merge pull request #2 into `main`. GitHub Actions will deploy the Worker when the workflow and Worker files arrive on main.
6. In GitHub **Actions → Deploy PANEL Cloudflare Worker**, inspect the latest run. If needed, use **Run workflow**.
7. Visit `https://royal-violet-a780.galroland0826.workers.dev/health`; the response should include `"ok":true`.

## Usage

Open PANEL, choose a title, select **Find on MangaDex**, match the correct manga, and open a chapter that MangaDex actually hosts.

The Worker provides search, chapter metadata and image delivery. It does not bypass MangaDex access controls. MangaDex coverage and translation availability vary. PANEL checks linked titles every six hours **while open**, not continuously in the background. If the Worker health check fails, inspect the GitHub Actions logs before troubleshooting PANEL.

The workflow uses GitHub repository secrets; no Cloudflare credentials are embedded in source code.
