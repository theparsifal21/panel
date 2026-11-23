# PANEL background chapter archive (Google Drive)

**Status:** opt-in backend prototype; not deployed or connected to the PANEL reader yet. This uses GitHub Actions every six hours, so it can run while the PANEL tab is closed. Scheduled runs are best-effort and may be delayed.

## Sources and permission

Only add image sources that expressly authorize downloading and private cloud storage. Do not enter unauthorized scanlation URLs, paywalled pages, or sites requiring bypassing access controls. The workflow does not scrape arbitrary sites.

Edit `drive-library/sources.json`:

```json
{
  "series": [
    {
      "title": "Example authorized comic",
      "permission_confirmed": true,
      "allowed_image_hosts": ["cdn.example.org"],
      "manifest_url": "https://cdn.example.org/panel-manifest.json"
    }
  ]
}
```

The manifest must be JSON, e.g.:

```json
{
  "chapters": [
    {
      "number": "1",
      "pages": [
        "https://cdn.example.org/comic/ch1/001.jpg",
        "https://cdn.example.org/comic/ch1/002.jpg"
      ]
    }
  ]
}
```

Alternatively, put a `chapters` array directly inside the series object in `sources.json`. A publisher-controlled manifest can be updated with new chapters without changing the GitHub repository. Hostnames must be in `allowed_image_hosts`, including the manifest hostname. HTTPS only; redirects are rejected. This is **not** general-purpose chapter discovery across the web.

## Google Drive authorization

This workflow uses a Google OAuth refresh token with the limited `https://www.googleapis.com/auth/drive.file` scope. The Google Drive folder **PANEL Library** and its subfolders are created by this application. It does not access arbitrary pre-existing Drive folders.

1. In Google Cloud Console create a project, enable **Google Drive API**, configure OAuth consent, and create a **Desktop** OAuth client.
2. Authorize that client as your own Google user with the `drive.file` scope, and obtain a refresh token using a trusted local OAuth flow with offline access. Google OAuth Playground with your own client is an option. Note: refresh tokens for external apps in Testing status can expire after seven days; publish/verify the app as appropriate to your use case.
3. Add three GitHub repository **Actions secrets**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Never put these values in source files or chat.
4. Add at least one explicitly authorized source to `sources.json`.
5. Merge this PR into `main`, then go to **Actions → Archive permitted chapters to Google Drive → Run workflow**.
6. Verify a `PANEL Library` folder and CBZ files appear in your Google Drive.

The archive skips existing files with the same name and parent folder, uploads at most 12 chapters per run, and limits image/chapter size. Chapter data is private to the authorized Drive account. This is a file archive only; the PANEL web reader does **not yet** browse or stream these Google Drive CBZ files. A separate OAuth login + Drive file-picker/reader integration is needed for that.

For testing, use your own original comics or another source with explicit permission to download and archive.
