#!/usr/bin/env python3
"""
HIS Auto Backup - daily backup to Google Drive
Exports all Supabase tables as CSV + SQL dump, zips them, uploads to drive.
"""

import os
import sys
import csv
import json
import zipfile
import logging
import hashlib
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import requests
import psycopg
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")

RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))

CRED_FILE = SCRIPT_DIR.parent / "config" / "google-drive-credentials.json"
TOKEN_FILE = SCRIPT_DIR / "google-token.json"

BACKUP_DIR = SCRIPT_DIR / "tmp"
BACKUP_DIR.mkdir(exist_ok=True)

LOG_FILE = SCRIPT_DIR / "backup.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("backup")

TABLES = [
    "users", "settings", "test_master", "test_parameters",
    "test_reagent_mapping", "stock_master", "inventory_lots",
    "stock_transactions", "test_orders", "test_results",
    "maintenance_log", "audit_log",
]

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def supabase_headers(role_key=False):
    key = SUPABASE_SERVICE_ROLE_KEY if (role_key and SUPABASE_SERVICE_ROLE_KEY) else SUPABASE_ANON_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "count=exact",
    }


def download_csv_via_rest(table):
    """Fetch all rows from a Supabase table via REST API with pagination."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = supabase_headers()
    offset = 0
    limit = 1000
    all_rows = []

    log.info(f"  Downloading {table} (REST)...")
    while True:
        try:
            resp = requests.get(
                url,
                params={"select": "*", "limit": str(limit), "offset": str(offset)},
                headers=headers,
                timeout=30,
            )
            if resp.status_code == 200:
                rows = resp.json()
                if not rows:
                    break
                all_rows.extend(rows)
                offset += limit
                if offset >= 50000:  # safety cap
                    break
                log.info(f"    Fetched {len(all_rows)} rows so far...")
            else:
                log.warning(f"    HTTP {resp.status_code}: {resp.text[:200]}")
                break
        except requests.RequestException as e:
            log.error(f"    Error fetching {table}: {e}, retrying in 5s...")
            import time
            time.sleep(5)

    # Deduplicate by id
    seen = set()
    unique_rows = []
    for row in all_rows:
        key = row.get("id", str(row))
        if key not in seen:
            seen.add(key)
            unique_rows.append(row)

    return unique_rows


def save_csv(table, rows, path):
    """Save list of dicts to a CSV file."""
    if not rows:
        log.warning(f"  No rows for {table}, skipping CSV.")
        return False
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    log.info(f"  Saved {path} ({len(rows)} rows, {os.path.getsize(path)} bytes).")
    return True


def pg_dump_sql(output_path):
    """Try pg_dump to Supabase (needs DB connection credentials in .env)."""
    host = os.getenv("SUPABASE_DB_HOST")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    dbname = os.getenv("SUPABASE_DB_NAME", "postgres")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    password = os.getenv("SUPABASE_DB_PASSWORD")

    if not all([host, password]):
        log.warning("  pg_dump: missing DB credentials, skipping SQL dump.")
        return False

    # Set password via PGPASSWORD env var
    env = os.environ.copy()
    env["PGPASSWORD"] = password or ""
    cmd = [
        "pg_dump",
        f"--host={host}",
        f"--port={port}",
        f"--username={user}",
        f"--dbname={dbname}",
        "--format=plain",
        "--no-owner",
        "--no-privileges",
    ]
    log.info(f"  Running pg_dump -> {output_path}")
    try:
        import subprocess
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=300)
        if result.returncode == 0:
            with open(output_path, "w") as f:
                f.write(result.stdout)
            size = os.path.getsize(output_path)
            log.info(f"  pg_dump done: {size} bytes.")
            return True
        else:
            log.error(f"  pg_dump failed (exit {result.returncode}): {result.stderr[:500]}")
            return False
    except FileNotFoundError:
        log.error("  pg_dump not found. Install postgresql-client.")
        return False
    except Exception as e:
        log.error(f"  pg_dump error: {e}")
        return False


def zip_files(file_list, zip_path):
    """Create a zip archive from a list of files."""
    log.info(f"  Creating zip: {zip_path}")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in file_list:
            zf.write(fp, Path(fp).name)
    log.info(f"  Zip done: {os.path.getsize(zip_path)} bytes.")
    return zip_path


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Google Drive helpers
# ---------------------------------------------------------------------------
def get_drive_service():
    """Authenticate and return Drive API service."""
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if not CRED_FILE.exists():
            raise FileNotFoundError(f"Google credentials not found at: {CRED_FILE}")
        if creds and creds.expired and creds.refresh_token:
            log.info("  Refreshing Google OAuth token...")
            creds.refresh(Request())
        else:
            raise RuntimeError(
                f"No valid token at {TOKEN_FILE}. Run: python get_oauth_token.py"
            )

        # Save updated token
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


def upload_to_drive(service, file_path, filename):
    """Upload a file to Google Drive."""
    file_metadata = {"name": filename}
    if GOOGLE_DRIVE_FOLDER_ID:
        file_metadata["parents"] = [GOOGLE_DRIVE_FOLDER_ID]

    media = MediaFileUpload(
        str(file_path), mimetype="application/zip", resumable=True
    )
    file = (
        service.files()
        .create(body=file_metadata, media_body=media, fields="id,name,createdTime")
        .execute()
    )
    log.info(f"  Uploaded to Drive: name={file['name']}, id={file['id']}")
    return file


def list_backups(service):
    """List all backup ZIP files in the target folder."""
    q = "mimeType='application/zip' and name starts with 'backup-' and trashed=false"
    if GOOGLE_DRIVE_FOLDER_ID:
        q += f" and '{GOOGLE_DRIVE_FOLDER_ID}' in parents"

    files = []
    page_token = None
    while True:
        resp = service.files().list(
            q=q, fields="files(id,name,createdTime)", pageSize=100,
            pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def delete_old_backups(service, cutoff_date):
    """Delete backups older than cutoff_date."""
    backups = list_backups(service)
    deleted = 0
    for f in backups:
        created = datetime.fromisoformat(f["createdTime"].replace("Z", "+00:00"))
        if created < cutoff_date:
            log.info(f"  Deleting old backup: {f['name']} ({f['createdTime'][:10]})")
            service.files().delete(fileId=f["id"]).execute()
            deleted += 1
    log.info(f"  Deleted {deleted} old backup(s) older than {cutoff_date.strftime('%Y-%m-%d')}.")
    return deleted


def cleanup_drive_backups(service):
    """Delete all existing backup ZIPs with the same date (avoid duplicates)."""
    today_str = datetime.now().strftime("%Y-%m-%d")
    backups = list_backups(service)
    deleted = 0
    for f in backups:
        if today_str in f["name"]:
            log.info(f"  Removing duplicate: {f['name']} ({f['createdTime'][:10]})")
            service.files().delete(fileId=f["id"]).execute()
            deleted += 1
    return deleted


# ---------------------------------------------------------------------------
# Main backup flow
# ---------------------------------------------------------------------------
def run_backup():
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    zip_name = f"backup-{today_str}.zip"
    zip_path = BACKUP_DIR / zip_name

    log.info("=" * 60)
    log.info(f"HIS Auto Backup - {today_str}")
    log.info("=" * 60)

    files_to_zip = []
    errors = []

    # 1) Export tables as CSV
    log.info("[Step 1/4] Exporting tables as CSV...")
    for table in TABLES:
        try:
            rows = download_csv_via_rest(table)
            csv_path = BACKUP_DIR / f"{table}.csv"
            if save_csv(table, rows, csv_path):
                files_to_zip.append(str(csv_path))
        except Exception as e:
            log.error(f"  Failed to export {table}: {e}")
            errors.append(table)

    # 2) SQL dump via pg_dump (if credentials available)
    log.info("[Step 2/4] SQL dump (pg_dump)...")
    sql_path = BACKUP_DIR / "his-dump.sql"
    if pg_dump_sql(str(sql_path)):
        files_to_zip.append(str(sql_path))
    else:
        log.info("  SQL dump skipped or failed (will rely on CSV exports).")

    # 3) Zip
    log.info("[Step 3/4] Creating zip archive...")
    if not files_to_zip:
        log.error("No files to archive! Exiting.")
        sys.exit(1)

    zip_files(files_to_zip, str(zip_path))

    # Checksum for verification
    sha = sha256(zip_path)
    log.info(f"  SHA-256: {sha[:16]}...")

    # 4) Upload to Google Drive
    log.info("[Step 4/4] Uploading to Google Drive...")
    try:
        service = get_drive_service()

        # Remove duplicates for today
        cleanup_drive_backups(service)

        # Upload
        uploaded = upload_to_drive(service, str(zip_path), zip_name)

        # Delete old backups
        cutoff = now - timedelta(days=RETENTION_DAYS)
        delete_old_backups(service, cutoff)

        # Write manifest
        manifest_path = BACKUP_DIR / f"backup-{today_str}.manifest.json"
        manifest = {
            "date": today_str,
            "time": now.isoformat(),
            "filename": zip_name,
            "drive_id": uploaded["id"],
            "sha256": sha,
            "tables_exported": len(files_to_zip),
            "failed_tables": errors,
            "file_size_bytes": os.path.getsize(zip_path),
        }
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

        log.info("=" * 60)
        log.info(f"BACKUP COMPLETE: {zip_name}")
        log.info(f"  Drive ID: {uploaded['id']}")
        log.info(f"  Size: {os.path.getsize(zip_path):,} bytes")
        if errors:
            log.warning(f"  Failed tables: {', '.join(errors)}")
        log.info(f"  Log: {LOG_FILE}")
        log.info("=" * 60)
        return True

    except Exception as e:
        log.error(f"Drive upload failed: {e}")
        sys.exit(1)

    finally:
        # Clean up temp files (keep manifest)
        for fp in files_to_zip:
            try:
                os.remove(fp)
            except OSError:
                pass


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        log.error("Missing credentials. Check backup/.env")
        sys.exit(1)
    try:
        success = run_backup()
        sys.exit(0 if success else 1)
    except Exception as e:
        log.exception(f"Backup failed: {e}")
        sys.exit(1)
