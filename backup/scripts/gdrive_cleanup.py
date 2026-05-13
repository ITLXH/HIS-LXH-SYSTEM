#!/usr/bin/env python3
"""Delete backups older than N days from Google Drive."""
import json, os, sys
from datetime import datetime, timedelta


def main():
    folder_id = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
    creds_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    retention_days = int(os.environ.get("RETENTION_DAYS", "30"))

    if not folder_id or not creds_json:
        print("Skipping cleanup — no credentials configured")
        return

    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/drive"],
    )
    drive = build("drive", "v3", credentials=creds)

    cutoff = datetime.now() - timedelta(days=retention_days)
    query = f"'{folder_id}' in parents and mimeType='application/zip' and trashed=false"
    results = drive.files().list(q=query, fields="files(id, name, createdTime)").execute()
    files = results.get("files", [])
    deleted = 0

    for f in files:
        created = datetime.fromisoformat(f["createdTime"].replace("Z", "+00:00"))
        if created < cutoff:
            print(f"Deleting: {f['name']} ({f['createdTime']})")
            drive.files().delete(fileId=f["id"]).execute()
            deleted += 1

    print(f"Cleanup done — removed {deleted} backup(s) older than {retention_days} days")


if __name__ == "__main__":
    main()
