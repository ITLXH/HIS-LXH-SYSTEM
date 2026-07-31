#!/usr/bin/env python3
"""Delete complete Google Drive backup bundles older than retention."""

import os
import sys
from datetime import datetime, timedelta, timezone

from gdrive_common import build_drive, credentials_configured, drive_delete


def list_backup_manifests(drive, folder_id):
    query = (
        f"'{folder_id}' in parents and mimeType='application/zip' "
        "and trashed=false"
    )
    files = []
    page_token = None
    while True:
        response = (
            drive.files()
            .list(
                q=query,
                fields="nextPageToken,files(id,name,createdTime,appProperties)",
                pageSize=1000,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return files


def cleanup(folder_id, retention_days):
    drive = build_drive()
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    deleted = 0
    for item in list_backup_manifests(drive, folder_id):
        created = datetime.fromisoformat(item["createdTime"].replace("Z", "+00:00"))
        if created >= cutoff:
            continue
        sidecar_folder_id = (item.get("appProperties") or {}).get(
            "his_sidecar_folder_id"
        )
        if sidecar_folder_id:
            drive_delete(drive, sidecar_folder_id)
        drive_delete(drive, item["id"])
        print(f"Deleted Drive backup bundle: {item['name']} ({item['createdTime']})")
        deleted += 1
    print(f"Cleanup done — removed {deleted} backup bundle(s) older than {retention_days} days")
    return deleted


def main():
    folder_id = (
        sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
    ).strip()
    retention_days = int(os.environ.get("RETENTION_DAYS", "30"))
    if not folder_id or not credentials_configured():
        print("Skipping cleanup — Google Drive credentials/folder are not configured")
        return 0
    cleanup(folder_id, retention_days)
    return 0


if __name__ == "__main__":
    sys.exit(main())
