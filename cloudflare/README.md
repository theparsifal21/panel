# PANEL MangaDex backend setup

1. Sign in to Cloudflare → Workers & Pages → your Worker at `https://royal-violet-a780.galroland0826.workers.dev`.
2. Open **Edit code** and replace the default Worker with the complete contents of [worker.js](worker.js).
3. Click **Deploy**. No secrets or API keys are required.
4. Test `https://royal-violet-a780.galroland0826.workers.dev/health` — it should return `{"ok":true,"source":"MangaDex","version":1}`.
5. Merge the GitHub pull request to publish the updated `index.html` and `mangadex-source.js` to GitHub Pages.
6. In PANEL, open a title, click **Find on MangaDex**, select the match, and try reading an available English chapter.

Notes: GitHub Pages cannot deploy a Cloudflare Worker automatically without a Cloudflare API token or a linked Cloudflare deployment. The Worker must be deployed in your own account. MangaDex chapter availability differs from Comix. The integration checks updates every six hours while the website is open. Respect MangaDex attribution, scanlation group removal requests and no-monetization policy. The Worker does not bypass access controls.