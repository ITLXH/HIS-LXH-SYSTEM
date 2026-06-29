#!/usr/bin/env python3
"""Restore a HIS backup ZIP back into the public tables.

Source of the ZIP:
  - SUPABASE_STORAGE_BUCKET (default) — downloaded by name from the same
    Supabase project the backup workflow uploads to, OR
  - Google Drive — when BACKUP_SOURCE=gdrive AND BACKUP_GDRIVE_FILE_ID is
    set, downloaded via the Google Drive service-account credentials.

Triggered by .github/workflows/supabase-restore.yml. Receives:
  - BACKUP_SOURCE: "supabase" | "gdrive"  (default "supabase")
  - BACKUP_NAME: the file name in the storage bucket
  - BACKUP_GDRIVE_FILE_ID: the Drive file ID (when source=gdrive)
  - DRY_RUN: "1" to walk through without writing

WARNING — destructive. We upsert with "Prefer: resolution=merge-duplicates"
so existing rows are overwritten where primary keys collide; rows in
production that don't appear in the backup are LEFT ALONE.
"""
import csv
import io
import json
import os
import sys
import zipfile
from pathlib import Path

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "his-backups")
BACKUP_NAME = os.environ.get("BACKUP_NAME", "")
BACKUP_SOURCE = os.environ.get("BACKUP_SOURCE", "supabase").lower()
BACKUP_GDRIVE_FILE_ID = os.environ.get("BACKUP_GDRIVE_FILE_ID", "")
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
BATCH_SIZE = int(os.environ.get("RESTORE_BATCH_SIZE", "200"))

REST_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    # Upsert: if the row's PK collides with an existing row, overwrite it.
    "Prefer": "resolution=merge-duplicates,return=minimal",
}


def download_from_supabase() -> bytes:
    if not BACKUP_NAME:
        raise SystemExit("BACKUP_NAME is required when BACKUP_SOURCE=supabase")
    print(f"==> Downloading {BACKUP_NAME} from Supabase bucket '{SUPABASE_BUCKET}'")
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{BACKUP_NAME}"
    resp = requests.get(
        url,
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
        timeout=180,
    )
    resp.raise_for_status()
    print(f"    Got {len(resp.content):,} bytes")
    return resp.content


def download_from_gdrive() -> bytes:
    if not BACKUP_GDRIVE_FILE_ID:
        raise SystemExit("BACKUP_GDRIVE_FILE_ID is required when BACKUP_SOURCE=gdrive")
    creds_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not creds_json:
        raise SystemExit("GOOGLE_SERVICE_ACCOUNT_JSON is required when BACKUP_SOURCE=gdrive")

    print(f"==> Downloading file_id={BACKUP_GDRIVE_FILE_ID} from Google Drive")
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload

    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    drive = build("drive", "v3", credentials=creds)
    request = drive.files().get_media(fileId=BACKUP_GDRIVE_FILE_ID)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    blob = buf.getvalue()
    print(f"    Got {len(blob):,} bytes")
    return blob


def download_zip() -> bytes:
    if BACKUP_SOURCE == "gdrive":
        return download_from_gdrive()
    return download_from_supabase()


def iter_csv_members(zip_bytes: bytes):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if not name.lower().endswith(".csv"):
                continue
            # CSVs are stored under csv/<table>.csv
            stem = Path(name).stem
            with zf.open(name) as fh:
                data = fh.read().decode("utf-8-sig")
            yield stem, data


def coerce_value(value: str):
    if value == "":
        return None
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    # Try JSON for nested objects/arrays preserved by csv-writer
    if value.startswith(("[", "{")):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def restore_table(table: str, csv_text: str) -> int:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for raw in reader:
        rows.append({k: coerce_value(v) for k, v in raw.items()})

    if not rows:
        print(f"    {table}: empty CSV, skipped")
        return 0

    if DRY_RUN:
        print(f"    {table}: DRY-RUN — would upsert {len(rows)} rows")
        return len(rows)

    written = 0
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start:start + BATCH_SIZE]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=REST_HEADERS,
            data=json.dumps(chunk),
            timeout=60,
        )
        if resp.status_code >= 400:
            print(f"    {table}: HTTP {resp.status_code} — {resp.text[:200]}")
            resp.raise_for_status()
        written += len(chunk)
    print(f"    {table}: upserted {written} rows")
    return written


def main():
    print(f"==> HIS restore: {BACKUP_NAME}  (dry-run={DRY_RUN})")
    blob = download_zip()
    total_tables = 0
    total_rows = 0
    for table, csv_text in iter_csv_members(blob):
        total_tables += 1
        total_rows += restore_table(table, csv_text)
    print(f"==> Done. Restored {total_rows:,} rows across {total_tables} tables.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FATAL: {exc}", file=sys.stderr)
        sys.exit(1)
