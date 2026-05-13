#!/usr/bin/env python3
"""
Lightweight backup trigger API for HIS Manual Backup UI.
Runs locally alongside the Vite dev server (default port 8765).

Usage:
    python backup_api.py
    # API available at http://localhost:8765
    # GET  /backup/status
    # POST /backup/run
    # GET  /backup/history
    # GET  /backup/logs
"""

import json
import os
import re
import subprocess
import threading
import logging
import csv
import io
import zipfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

from dotenv import load_dotenv
import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))

BACKUP_DIR = SCRIPT_DIR / "tmp"
BACKUP_DIR.mkdir(exist_ok=True)
LOG_FILE = SCRIPT_DIR / "backup.log"
HISTORY_FILE = SCRIPT_DIR / "backup_history.json"

# Google
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CRED_FILE = SCRIPT_DIR.parent / "config" / "google-drive-credentials.json"
TOKEN_FILE = SCRIPT_DIR / "google-token.json"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Tables to export
TABLES = [
    "users", "settings", "test_master", "test_parameters",
    "test_reagent_mapping", "stock_master", "inventory_lots",
    "stock_transactions", "test_orders", "test_results",
    "maintenance_log", "audit_log",
]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger("backup_api")
log_fmt = logging.Formatter("%(asctime)s  %(levelname)s  %(message)s")

fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
fh.setFormatter(log_fmt)
sh = logging.StreamHandler()
sh.setFormatter(log_fmt)
logger.addHandler(fh)
logger.addHandler(sh)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# History management
# ---------------------------------------------------------------------------
def load_history():
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_history(entries):
    with open(HISTORY_FILE, "w") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def append_history(entry):
    entries = load_history()
    entries.insert(0, entry)
    # Keep last 90 entries
    save_history(entries[:90])


# ---------------------------------------------------------------------------
# Backup logic
# ---------------------------------------------------------------------------
backup_running = False
backup_progress = {"running": False, "step": "", "percent": 0}


def supabase_headers():
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "count=exact",
    }


def download_table(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = supabase_headers()
    offset = 0
    limit = 1000
    all_rows = []
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
                if offset >= 50000:
                    break
            else:
                break
        except Exception:
            break

    # Deduplicate
    seen = set()
    unique = []
    for row in all_rows:
        key = row.get("id", str(row))
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


def save_csv(table, rows, path):
    if not rows:
        return 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def get_drive_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
        else:
            raise RuntimeError("No valid Google token. Run get_oauth_token.py first.")
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("drive", "v3", credentials=creds)


def list_drive_backups(service):
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
    return files


def delete_old_drive_backups(service, cutoff_date):
    backups = list_drive_backups(service)
    deleted = 0
    for f in backups:
        created = datetime.fromisoformat(f["createdTime"].replace("Z", "+00:00"))
        if created < cutoff_date:
            service.files().delete(fileId=f["id"]).execute()
            deleted += 1
    return deleted


def run_backup():
    global backup_running, backup_progress
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    zip_name = f"backup-{today_str}.zip"
    zip_path = BACKUP_DIR / zip_name

    backup_running = True
    backup_progress = {"running": True, "step": "Starting...", "percent": 0}

    entry = {
        "id": today_str + "_manual_" + now.strftime("%H%M%S"),
        "date": now.isoformat(),
        "date_short": today_str,
        "time": now.strftime("%H:%M"),
        "filename": zip_name,
        "status": "running",
        "error": "",
        "size": 0,
        "drive_status": "",
        "error_message": "",
    }

    error_msgs = []
    total_rows = 0
    csv_paths = []

    try:
        # 1) Export tables as CSV
        for i, table in enumerate(TABLES):
            backup_progress["step"] = f"Exporting {table}... ({i+1}/{len(TABLES)})"
            backup_progress["percent"] = int((i / len(TABLES)) * 40)

            logger.info(f"Exporting table: {table}")
            rows = download_table(table)
            csv_path = BACKUP_DIR / f"{table}.csv"
            count = save_csv(table, rows, csv_path)
            total_rows += count
            csv_paths.append(str(csv_path))
            logger.info(f"  {table}: {count} rows")

        # 2) Zip
        backup_progress["step"] = "Creating zip archive..."
        backup_progress["percent"] = 45
        logger.info("Creating zip...")
        if csv_paths:
            with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
                for fp in csv_paths:
                    zf.write(fp, Path(fp).name)
            size = os.path.getsize(zip_path)
            entry["size"] = size
            logger.info(f"  Zip: {size} bytes")

        # Remove temp CSV files
        for fp in csv_paths:
            try:
                os.remove(fp)
            except OSError:
                pass

        # 3) Upload to Google Drive
        backup_progress["step"] = "Uploading to Google Drive..."
        backup_progress["percent"] = 60

        try:
            service = get_drive_service()

            # Remove duplicates for today
            today_backups = list_drive_backups(service)
            for b in today_backups:
                if today_str in b["name"]:
                    service.files().delete(fileId=b["id"]).execute()

            # Upload
            file_metadata = {"name": zip_name}
            if GOOGLE_DRIVE_FOLDER_ID:
                file_metadata["parents"] = [GOOGLE_DRIVE_FOLDER_ID]
            media = MediaFileUpload(
                str(zip_path), mimetype="application/zip", resumable=True
            )
            uploaded = (
                service.files()
                .create(body=file_metadata, media_body=media, fields="id,name,createdTime")
                .execute()
            )
            entry["drive_status"] = "success"
            entry["drive_id"] = uploaded["id"]
            entry["drive_link"] = f"https://drive.google.com/file/d/{uploaded['id']}/view"
            logger.info(f"  Uploaded: {uploaded['name']} ({uploaded['id']})")

            # Delete old backups
            cutoff = now - timedelta(days=RETENTION_DAYS)
            deleted = delete_old_drive_backups(service, cutoff)
            if deleted:
                logger.info(f"  Deleted {deleted} old backup(s)")

        except Exception as e:
            msg = f"Google Drive upload failed: {e}"
            error_msgs.append(msg)
            entry["drive_status"] = "failed: " + msg
            logger.error(msg)

        # Success
        entry["status"] = "success"
        entry["total_rows"] = total_rows
        entry["file_size"] = os.path.getsize(zip_path) if zip_path.exists() else 0

        backup_progress["step"] = "Backup complete!"
        backup_progress["percent"] = 100
        logger.info(f"Backup complete: {zip_name} ({total_rows} rows)")

    except Exception as e:
        entry["status"] = "failed"
        entry["error"] = str(e)
        error_msgs.append(str(e))
        backup_progress["step"] = "Backup failed"
        backup_progress["percent"] = 0
        logger.error(f"Backup failed: {e}")

    finally:
        backup_running = False
        entry["error_message"] = "; ".join(str(m) for m in error_msgs) if error_msgs else ""
        append_history(entry)

    return entry


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------
class BackupAPIHandler(SimpleHTTPRequestHandler):
    """Simple API handler for backup triggers."""

    def do_GET(self):
        self._send_json(200, self._handle_get())

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""
        self._send_json(200, self._handle_post(body))

    def do_OPTIONS(self):
        self._send_json(204, {})

    def _handle_get(self):
        if self.path == "/backup/status":
            return {
                "running": backup_running,
                "progress": backup_progress,
                "history": load_history()[:30],
            }

        if self.path == "/backup/history":
            return {"history": load_history()}

        if self.path == "/backup/logs":
            try:
                with open(LOG_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()[-200:]  # Last 200 lines
                return {"logs": "".join(lines)}
            except FileNotFoundError:
                return {"logs": "No logs yet."}

        if self.path.startswith("/backup/drive-link"):
            entries = load_history()
            for e in reversed(entries):
                if e.get("drive_link"):
                    return {"url": e["drive_link"]}
            return {"url": "https://drive.google.com"}

        return {"error": "Unknown path"}

    def _handle_post(self, body):
        if self.path == "/backup/run":
            if backup_running:
                return {"status": "already_running", "progress": backup_progress}
            result = run_backup()
            return {
                "status": result["status"],
                "progress": backup_progress,
                "history": load_history()[:10],
            }
        return {"error": "Unknown endpoint"}

    def _send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Silence default logging


def main():
    port = 8765
    server = HTTPServer(("127.0.0.1", port), BackupAPIHandler)
    logger.info(f"Backup API server starting on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down.")


if __name__ == "__main__":
    main()
