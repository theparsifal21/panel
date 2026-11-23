#!/usr/bin/env python3
"""Archive explicitly authorized HTTPS image chapters to a private Google Drive folder."""
import io
import json
import os
import re
import sys
import zipfile
from urllib.parse import urlparse
import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

ROOT = "PANEL Library"
SCOPE = "https://www.googleapis.com/auth/drive.file"
API = "https://www.googleapis.com/drive/v3/files"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
MAX_IMAGE = 20 * 1024 * 1024
MAX_CHAPTER = 150 * 1024 * 1024

def fail(message):
    raise RuntimeError(message)

def safe_name(name):
    return re.sub(r'[^a-zA-Z0-9 _().-]', "_", str(name)).strip(" .")[:100] or "Untitled"

def checked_url(url, allowed):
    u = urlparse(url)
    if u.scheme != "https" or not u.hostname or u.username or u.password or u.port not in (None, 443):
        fail("Only normal HTTPS image URLs are allowed")
    if u.hostname.lower() not in allowed:
        fail("Image host is not explicitly allowlisted: " + u.hostname)
    return url

def request_image(session, url, allowed):
    checked_url(url, allowed)
    # Disable redirects to prevent leaving the explicitly permitted image host.
    with session.get(url, timeout=30, stream=True, allow_redirects=False) as resp:
        resp.raise_for_status()
        if resp.status_code in (301, 302, 303, 307, 308):
            fail("Redirects are not permitted")
        if not resp.headers.get("Content-Type", "").lower().startswith("image/"):
            fail("URL did not return an image")
        data = bytearray()
        for chunk in resp.iter_content(65536):
            data.extend(chunk)
            if len(data) > MAX_IMAGE:
                fail("Image exceeds size limit")
        return bytes(data)

def drive_session():
    for key in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"):
        if not os.getenv(key):
            fail("Missing GitHub Actions secret " + key)
    cred = Credentials(None, refresh_token=os.environ["GOOGLE_REFRESH_TOKEN"],
                       token_uri="https://oauth2.googleapis.com/token",
                       client_id=os.environ["GOOGLE_CLIENT_ID"],
                       client_secret=os.environ["GOOGLE_CLIENT_SECRET"], scopes=[SCOPE])
    cred.refresh(Request())
    session = requests.Session()
    session.headers.update({"Authorization": "Bearer " + cred.token})
    return session

def drive_json(session, method, url, **kwargs):
    r = session.request(method, url, timeout=60, **kwargs)
    r.raise_for_status()
    return r.json()

def find_file(session, name, parent=None, folder=False):
    escaped = name.replace("\\", "\\\\").replace("'", "\\'")
    q = "name = '" + escaped + "' and trashed = false"
    if parent:
        q += " and '" + parent + "' in parents"
    if folder:
        q += " and mimeType = 'application/vnd.google-apps.folder'"
    result = drive_json(session, "GET", API, params={"q": q, "fields": "nextPageToken,files(id,name,mimeType)", "page_size": 100})
    return next((x["id"] for x in result.get("files", []) if x["name"] == name), None)

def folder(session, name, parent=None):
    existing = find_file(session, name, parent, True)
    if existing:
        return existing
    meta = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent:
        meta["parents"] = [parent]
    return drive_json(session, "POST", API, json=meta, params={"fields": "id"})["id"]

def upload_cbz(session, parent, filename, data):
    metadata = {"name": filename, "parents": [parent], "mimeType": "application/vnd.comicbook+zip"}
    boundary = "panel-upload-boundary"
    body = (("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").encode()
            + json.dumps(metadata).encode()
            + ("\r\n--" + boundary + "\r\nContent-Type: application/vnd.comicbook+zip\r\n\r\n").encode()
            + data + ("\r\n--" + boundary + "--\r\n").encode())
    return drive_json(session, "POST", UPLOAD, params={"uploadType": "multipart", "fields": "id,name"},
                      data=body, headers={"Content-Type": "multipart/related; boundary=" + boundary})

def main():
    with open("drive-library/sources.json", encoding="utf-8") as f:
        config = json.load(f)
    sources = config.get("series", [])
    if not sources:
        print("No authorized chapter sources configured. Nothing to download.")
        return
    session = drive_session()
    image_session = requests.Session()
    root = folder(session, ROOT)
    uploaded = 0
    for series in sources:
        title = safe_name(series["title"])
        allowed = {h.lower() for h in series.get("allowed_image_hosts", [])}
        if not allowed or not series.get("permission_confirmed", False):
            print("Skipping unapproved series:", title)
            continue
        series_folder = folder(session, title, root)
        for chapter in series.get("chapters", []):
            if uploaded >= 12:
                print("Per-run upload cap reached")
                return
            number = safe_name(chapter["number"])
            filename = "Chapter " + number + ".cbz"
            if find_file(session, filename, series_folder):
                print("Already stored:", title, filename)
                continue
            pages = chapter.get("pages", [])
            if not 1 <= len(pages) <= 250:
                fail("Invalid page count for " + filename)
            archive = io.BytesIO()
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=5) as z:
                for i, page in enumerate(pages, 1):
                    data = request_image(image_session, page, allowed)
                    if archive.tell() + len(data) > MAX_CHAPTER:
                        fail("Chapter exceeds size limit")
                    ext = ".png" if data.startswith(b"\\x89PNG") else ".webp" if data.startswith(b"RIFF") and data[8:12] == b"WEBP" else ".jpg"
                    z.writestr(f"{i:04d}{ext}", data)
            if archive.tell() > MAX_CHAPTER:
                fail("Chapter exceeds size limit")
            result = upload_cbz(session, series_folder, filename, archive.getvalue())
            print("Uploaded:", title, result["name"])
            uploaded += 1

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Archive failed:", exc, file=sys.stderr)
        sys.exit(1)
