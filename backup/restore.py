#!/usr/bin/env python3
"""
HIS Auto Restore - download backup from Google Drive and restore to Supabase.

Usage:
    python restore.py                        # list available backups
    python restore.py backup-2025-01-15.zip  # restore a specific backup
    python restore.py --list                 # list all backups in Drive
    python restore.py --csv                  # restore from CSV files only (no pg_dump)
"""

import os
import sys
import csv
import json
import logging
from pathlib import Path

import requests
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")

CRED_FILE = SCRIPT_DIR.parent / "config" / "google-drive-credentials.json"
TOKEN_FILE = SCRIPT_DIR / "google-token.json"

RESTORE_DIR = SCRIPT_DIR / "restore_tmp"

LOG_FILE = SCRIPT_DIR / "restore.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("restore")

TABLES = [
    "users", "settings", "test_master", "test_parameters",
    "test_reagent_mapping", "stock_master", "inventory_lots",
    "stock_transactions", "test_orders", "test_results",
    "maintenance_log", "audit_log",
]

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


# ---------------------------------------------------------------------------
# Google Drive helpers
# ---------------------------------------------------------------------------
def get_drive_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if not CRED_FILE.exists():
            raise FileNotFoundError(f"Google credentials not found at: {CRED_FILE}")
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            raise RuntimeError(
                f"No valid token at {TOKEN_FILE}. Run: python get_oauth_token.py"
            )
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


def list_backups(service):
    q = "mimeType='application/zip' and name starts with 'backup-' and trashed=false"
    if GOOGLE_DRIVE_FOLDER_ID:
        q += f" and '{GOOGLE_DRIVE_FOLDER_ID}' in parents"

    files = []
    page_token = None
    while True:
        resp = service.files().list(
            q=q,
            fields="files(id,name,createdTime,size)",
            pageSize=100,
            pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    # Sort reverse chronological
    files.sort(key=lambda f: f["createdTime"], reverse=True)
    return files


def download_backup(service, file_id, dest_path):
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    with open(dest_path, "wb") as f:
        f.write(fh.getvalue())
    log.info(f"Downloaded to {dest_path} ({os.path.getsize(dest_path)} bytes)")


# ---------------------------------------------------------------------------
# Supabase restore via REST API
# ---------------------------------------------------------------------------
def upsert_csv_rows(csv_path):
    """Read CSV and upsert rows into Supabase for the table matching filename."""
    table = Path(csv_path).stem

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        log.warning(f"No data in {csv_path}")
        return 0

    # Supabase REST API: POST with upsert
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Convert numeric strings back to numbers
    for row in rows:
        for key in row:
            val = row[key]
            if val == "":
                row[key] = None
            elif val is not None:
                try:
                    if "." in val:
                        row[key] = float(val)
                    else:
                        row[key] = int(val)
                except (ValueError, TypeError):
                    pass

    # Batch upsert in chunks
    batch_size = 500
    total_inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        try:
            resp = requests.post(
                url, json=batch, headers=headers, timeout=30
            )
            if resp.status_code in (200, 201, 409):
                total_inserted += len(batch)
                log.info(f"  Upserted batch {i // batch_size + 1} ({len(batch)} rows)")
            else:
                log.error(
                    f"  Failed batch {i // batch_size + 1}: "
                    f"HTTP {resp.status_code}: {resp.text[:300]}"
                )
        except Exception as e:
            log.error(f"  Error upserting batch {i // batch_size + 1}: {e}")

    return total_inserted


def restore_sql_dump(sql_file):
    """Restore via psql (requires pg_dump compatible file)."""
    import subprocess

    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")

    if not all([host, password]):
        log.warning("Cannot restore SQL dump: missing DB credentials in .env")
        return False

    env = os.environ.copy()
    env["PGPASSWORD"] = password or ""

    cmd = [
        "psql",
        f"--host={host}",
        f"--port={port}",
        f"--username={user}",
        f"--dbname={dbname}",
        "-f",
        str(sql_file),
    ]

    log.info(f"Running psql restore...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=600)
        if result.returncode == 0:
            log.info("SQL restore complete.")
            return True
        else:
            log.error(f"psql failed (exit {result.returncode}): {result.stderr[:500]}")
            return False
    except Exception as e:
        log.error(f"psql error: {e}")
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def restore_from_backup(zip_path):
    """Extract and restore from a ZIP backup file."""
    import tempfile
    import zipfile

    log.info(f"Extracting {zip_path}...")
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmpdir)

        # Restore CSV files
        csv_files = sorted(Path(tmpdir).glob("*.csv"))
        log.info(f"Found {len(csv_files)} CSV files to restore.")

        total_rows = 0
        for csv_file in csv_files:
            table = csv_file.stem
            if table not in TABLES:
                log.warning(f"  Skipping unknown table: {table}")
                continue
            count = upsert_csv_rows(str(csv_file))
            total_rows += count
            log.info(f"  Restored {table}: {count} rows")

        log.info(f"  Total rows restored via REST: {total_rows}")

        # Try SQL restore if dump exists
        sql_file = Path(tmpdir) / "his-dump.sql"
        if sql_file.exists():
            log.info("SQL dump found, attempting psql restore...")
            restore_sql_dump(str(sql_file))

    log.info("Restore complete!")


def main():
    args = sys.argv[1:]

    if "--list" in args or not args:
        # List available backups
        service = get_drive_service()
        backups = list_backups(service)
        log.info(f"Found {len(backups)} backup(s) in Google Drive:")
        for b in backups:
            size = int(b.get("size", 0))
            log.info(
                f"  {b['name']}  "
                f"created={b['createdTime'][:10]}  "
                f"drive_id={b['id']}  "
                f"size={size:,} bytes"
            )

        if not args:
            print("\nTo restore: python restore.py backup-YYYY-MM-DD.zip")
            sys.exit(0)

    # Find and download specified backup
    target = args[-1]
    service = get_drive_service()
    backups = list_backups(service)

    file_id = None
    for b in backups:
        if b["name"] == target or target in b["name"]:
            file_id = b["id"]
            break

    if not file_id:
        log.error(f"Backup not found: {target}")
        sys.exit(1)

    log.info(f"Found backup: {target}")
    zip_path = RESTORE_DIR / target
    zip_path.parent.mkdir(exist_ok=True)
    download_backup(service, file_id, str(zip_path))

    # Restore
    restore_from_backup(str(zip_path))

    # Cleanup
    zip_path.unlink(missing_ok=True)


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        log.error("Missing credentials. Check backup/.env")
        sys.exit(1)
    try:
        main()
    except Exception as e:
        log.exception(f"Restore failed: {e}")
        sys.exit(1)
