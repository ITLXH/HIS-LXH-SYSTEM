#!/usr/bin/env python3
"""Upload a file to Google Drive.

Usage: python gdrive_upload.py <file_path> <folder_id>

Env: GOOGLE_SERVICE_ACCOUNT_JSON
"""
import json, os, sys


def main():
    if len(sys.argv) < 3:
        print("Usage: gdrive_upload.py <file_path> <folder_id>")
        sys.exit(1)

    file_path = sys.argv[1]
    folder_id = sys.argv[2]
    creds_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

    if not os.path.exists(file_path):
        print(f"::error::File not found: {file_path}")
        sys.exit(1)

    if not creds_json:
        print("::warning::GOOGLE_SERVICE_ACCOUNT_JSON not set")
        sys.exit(0)

    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/drive.file"],
    )
    drive = build("drive", "v3", credentials=creds)

    meta = {"name": os.path.basename(file_path), "mimeType": "application/zip"}
    if folder_id:
        meta["parents"] = [folder_id]

    media = MediaFileUpload(file_path, mimetype="application/zip", resumable=True)
    result = drive.files().create(body=meta, media_body=media, fields="id, webViewLink").execute()

    fid = result.get("id")
    url = result.get("webViewLink", f"https://drive.google.com/file/d/{fid}/view")
    print(f"Uploaded to Google Drive: {url}")
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"drive_url={url}\n")


if __name__ == "__main__":
    main()
