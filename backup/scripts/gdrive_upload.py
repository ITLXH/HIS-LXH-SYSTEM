#!/usr/bin/env python3
"""Upload the HIS database archive to Google Drive.

Supabase remains the complete application backup destination, including every
application Storage object. Google Drive intentionally receives only the small
database/settings ZIP so its limited quota is not consumed by duplicate PDFs.

Usage: python gdrive_upload.py <zip_path> <folder_id>
Env: GOOGLE_DRIVE_OAUTH_JSON or GOOGLE_SERVICE_ACCOUNT_JSON
"""

import hashlib
import json
import os
import sys
from pathlib import Path

from gdrive_common import build_drive, credentials_configured, drive_create, drive_delete


def md5_file(path):
    digest = hashlib.md5()  # nosec B324 - Drive exposes MD5 for upload verification
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def upload_binary(drive, path, metadata, content_type=None):
    from googleapiclient.http import MediaFileUpload

    media = MediaFileUpload(
        str(path),
        mimetype=content_type or "application/octet-stream",
        resumable=True,
    )
    result = drive_create(
        drive,
        body=metadata,
        media_body=media,
        fields="id,name,size,md5Checksum,webViewLink,appProperties",
    )
    expected_size = path.stat().st_size
    expected_md5 = md5_file(path)
    if int(result.get("size", -1)) != expected_size:
        raise RuntimeError(f"Drive size verification failed for {path.name}")
    if result.get("md5Checksum") != expected_md5:
        raise RuntimeError(f"Drive MD5 verification failed for {path.name}")
    return result


def load_manifest(zip_path):
    output_dir = Path(os.environ.get("OUTPUT_DIR", "") or zip_path.parent)
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError(f"Backup manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if int(manifest.get("tables") or 0) <= 0:
        raise RuntimeError("Database backup manifest contains no exported tables")
    if manifest.get("failed_tables"):
        raise RuntimeError("Database backup manifest contains failed table exports")
    return manifest


def upload_database_backup(zip_path, root_folder_id):
    if not root_folder_id:
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is required")

    manifest = load_manifest(zip_path)
    drive = build_drive()
    uploaded = None
    drive_name = Path(manifest.get("storage_object") or zip_path.name).name
    try:
        uploaded = upload_binary(
            drive,
            zip_path,
            {
                "name": drive_name,
                "parents": [root_folder_id],
                "mimeType": "application/zip",
                "appProperties": {
                    "his_backup_type": "manifest",
                    "his_backup_scope": "database_only",
                    "his_tables": str(manifest.get("tables", 0)),
                    "his_rows": str(manifest.get("total_rows", 0)),
                },
            },
            "application/zip",
        )
        return {
            "file_id": uploaded["id"],
            "url": uploaded.get(
                "webViewLink", f"https://drive.google.com/file/d/{uploaded['id']}/view"
            ),
            "snapshot_folder_id": "",
            "sidecars": 0,
            "scope": "database_only",
        }
    except Exception:
        if uploaded:
            try:
                drive_delete(drive, uploaded["id"])
            except Exception:
                pass
        raise


def upload_complete_bundle(zip_path, root_folder_id):
    """Backward-compatible entry point; Drive is intentionally database-only."""
    return upload_database_backup(zip_path, root_folder_id)


def write_outputs(result):
    output_path = os.environ.get("GITHUB_OUTPUT", "")
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(f"drive_url={result['url']}\n")
        handle.write(f"drive_file_id={result['file_id']}\n")
        handle.write(f"drive_snapshot_folder_id={result['snapshot_folder_id']}\n")
        handle.write(f"drive_sidecars={result['sidecars']}\n")
        handle.write(f"drive_scope={result['scope']}\n")


def main():
    if len(sys.argv) < 3:
        print("Usage: gdrive_upload.py <file_path> <folder_id>")
        return 1
    zip_path = Path(sys.argv[1])
    folder_id = sys.argv[2].strip()
    if not zip_path.is_file():
        print(f"::error::File not found: {zip_path}")
        return 1
    if not credentials_configured():
        print("::error::Google Drive credentials are not configured")
        return 1

    try:
        result = upload_database_backup(zip_path, folder_id)
        write_outputs(result)
        print(f"Uploaded database-only backup to Google Drive: {result['url']}")
        return 0
    except Exception as exc:
        print(f"::error::Google Drive database backup failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
