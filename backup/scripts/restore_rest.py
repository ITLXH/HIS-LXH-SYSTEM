#!/usr/bin/env python3
"""Validate and restore a HIS application backup from Supabase Storage or Drive.

The restore is intentionally merge-based: rows with matching primary keys are
updated and missing rows are inserted. Rows created after the backup are not
deleted. Version-2 archives restore typed JSON table data and application
Storage objects; version-1 archives remain supported for existing backups.
"""
import csv
import hashlib
import io
import json
import os
import sys
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import quote

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "his-backups") or "his-backups"
BACKUP_NAME = os.environ.get("BACKUP_NAME", "")
BACKUP_SOURCE = os.environ.get("BACKUP_SOURCE", "supabase").lower()
BACKUP_GDRIVE_FILE_ID = os.environ.get("BACKUP_GDRIVE_FILE_ID", "")
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
RESTORE_CONFIRMATION = os.environ.get("RESTORE_CONFIRMATION", "")
BATCH_SIZE = int(os.environ.get("RESTORE_BATCH_SIZE", "200"))
MAX_RESTORE_PASSES = int(os.environ.get("RESTORE_MAX_PASSES", "3"))
NON_RESTORABLE_TABLES = {
    item.strip()
    for item in os.environ.get(
        "RESTORE_EXCLUDE_TABLES", "opd_active_observations_by_bed"
    ).split(",")
    if item.strip()
}

REST_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation",
}


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def github_error(message):
    safe = str(message).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::error::{safe}")


def download_from_supabase():
    if not BACKUP_NAME:
        raise RuntimeError("BACKUP_NAME is required when BACKUP_SOURCE=supabase")
    print(f"==> Downloading {BACKUP_NAME} from Supabase bucket '{SUPABASE_BUCKET}'")
    response = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
        f"{quote(BACKUP_NAME, safe='/')}",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
        timeout=300,
    )
    response.raise_for_status()
    print(f"    Got {len(response.content):,} bytes")
    return response.content


def download_from_gdrive():
    if not BACKUP_GDRIVE_FILE_ID:
        raise RuntimeError("BACKUP_GDRIVE_FILE_ID is required when BACKUP_SOURCE=gdrive")
    credentials_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not credentials_json:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is required when BACKUP_SOURCE=gdrive")

    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload

    credentials = Credentials.from_service_account_info(
        json.loads(credentials_json), scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    request = build("drive", "v3", credentials=credentials).files().get_media(
        fileId=BACKUP_GDRIVE_FILE_ID
    )
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    blob = buffer.getvalue()
    print(f"    Got {len(blob):,} bytes")
    return blob


def download_zip():
    if BACKUP_SOURCE == "gdrive":
        return download_from_gdrive()
    if BACKUP_SOURCE != "supabase":
        raise RuntimeError('BACKUP_SOURCE must be "supabase" or "gdrive"')
    return download_from_supabase()


def _validate_member_name(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name:
        raise RuntimeError(f"Unsafe path in backup ZIP: {name}")


def _csv_rows(raw_bytes):
    reader = csv.DictReader(io.StringIO(raw_bytes.decode("utf-8-sig")))
    rows = []
    for raw in reader:
        converted = {}
        for key, value in raw.items():
            if value == "":
                converted[key] = None
            elif value.lower() in {"true", "false"}:
                converted[key] = value.lower() == "true"
            elif value.startswith(("[", "{")):
                try:
                    converted[key] = json.loads(value)
                except ValueError:
                    converted[key] = value
            else:
                converted[key] = value
        rows.append(converted)
    return rows


def validate_archive(blob):
    """Reject corrupt/incomplete archives before any production write occurs."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile as exc:
        raise RuntimeError("Backup is not a valid ZIP archive") from exc

    names = archive.namelist()
    for name in names:
        _validate_member_name(name)
    damaged = archive.testzip()
    if damaged:
        raise RuntimeError(f"ZIP CRC validation failed for {damaged}")
    if "manifest.json" not in names:
        raise RuntimeError("Backup manifest.json is missing")

    manifest = json.loads(archive.read("manifest.json"))
    declared_rows = manifest.get("table_rows", {})
    details = manifest.get("table_details", {})
    tables = {}
    json_members = {Path(name).stem: name for name in names if name.startswith("json/") and name.endswith(".json")}
    csv_members = {Path(name).stem: name for name in names if name.startswith("csv/") and name.endswith(".csv")}

    if not declared_rows:
        raise RuntimeError("Backup manifest does not declare any database tables")
    for table, expected_rows in declared_rows.items():
        member = json_members.get(table) or csv_members.get(table)
        if not member:
            raise RuntimeError(f"Backup data is missing for table {table}")
        raw = archive.read(member)
        rows = json.loads(raw) if member.startswith("json/") else _csv_rows(raw)
        if not isinstance(rows, list):
            raise RuntimeError(f"Backup data for {table} is not a row array")
        if len(rows) != int(expected_rows):
            raise RuntimeError(
                f"Row-count mismatch for {table}: archive={len(rows)}, manifest={expected_rows}"
            )
        expected_hash = (details.get(table) or {}).get("sha256")
        if expected_hash and sha256_bytes(raw) != expected_hash:
            raise RuntimeError(f"SHA-256 mismatch for table {table}")
        tables[table] = rows

    storage_files = {}
    for bucket in (manifest.get("storage") or {}).get("buckets", []):
        bucket_id = bucket.get("id")
        for obj in bucket.get("objects", []):
            object_name = obj.get("name", "")
            member = f"storage/{bucket_id}/{object_name}"
            if member not in names:
                raise RuntimeError(f"Storage object is missing from ZIP: {bucket_id}/{object_name}")
            raw = archive.read(member)
            if len(raw) != int(obj.get("size_bytes", len(raw))):
                raise RuntimeError(f"Storage size mismatch: {bucket_id}/{object_name}")
            if obj.get("sha256") and sha256_bytes(raw) != obj["sha256"]:
                raise RuntimeError(f"Storage SHA-256 mismatch: {bucket_id}/{object_name}")
            storage_files[(bucket_id, object_name)] = raw

    print(
        f"==> Archive verified: {len(tables)} tables, "
        f"{sum(len(rows) for rows in tables.values()):,} rows, "
        f"{len(storage_files)} Storage objects"
    )
    return archive, manifest, tables, storage_files


def restore_table(table, rows):
    if not rows:
        print(f"    {table}: empty, no rows to write")
        return 0
    if DRY_RUN:
        print(f"    {table}: DRY-RUN — verified {len(rows)} typed rows")
        return len(rows)

    written = 0
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start : start + BATCH_SIZE]
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/{quote(table, safe='')}",
            headers=REST_HEADERS,
            data=json.dumps(chunk, ensure_ascii=False),
            timeout=120,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}: {response.text[:300]}")
        try:
            returned = response.json()
        except ValueError:
            returned = None
        if isinstance(returned, list) and len(returned) != len(chunk):
            raise RuntimeError(
                f"write verification mismatch: sent {len(chunk)}, returned {len(returned)}"
            )
        written += len(chunk)
    print(f"    {table}: upserted and verified {written} rows")
    return written


def restore_tables(manifest, tables):
    details = manifest.get("table_details", {})
    pending = {}
    skipped = []
    for table, rows in tables.items():
        restorable = (details.get(table) or {}).get("restorable", True)
        if not restorable or table in NON_RESTORABLE_TABLES:
            skipped.append(table)
            print(f"    {table}: read-only view, skipped (data remains derivable from source tables)")
        else:
            pending[table] = rows

    restored_rows = 0
    errors = {}
    for attempt in range(1, MAX_RESTORE_PASSES + 1):
        if not pending:
            break
        next_pending = {}
        for table, rows in pending.items():
            try:
                restored_rows += restore_table(table, rows)
                errors.pop(table, None)
            except Exception as exc:
                errors[table] = str(exc)
                next_pending[table] = rows
                print(f"    {table}: pass {attempt} deferred — {exc}")
        if len(next_pending) == len(pending):
            pending = next_pending
            break
        pending = next_pending

    if pending:
        summary = "; ".join(f"{table}: {errors[table]}" for table in sorted(pending))
        raise RuntimeError(f"Unable to restore {len(pending)} table(s): {summary}")
    return len(tables) - len(skipped), restored_rows, skipped


def _ensure_storage_bucket(bucket):
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
    }
    response = requests.get(
        f"{SUPABASE_URL}/storage/v1/bucket/{quote(bucket['id'], safe='')}",
        headers=headers,
        timeout=60,
    )
    if response.status_code == 200:
        return
    create = requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=headers,
        data=json.dumps(
            {
                "id": bucket["id"],
                "name": bucket["id"],
                "public": bool(bucket.get("public", False)),
                "file_size_limit": bucket.get("file_size_limit"),
                "allowed_mime_types": bucket.get("allowed_mime_types"),
            }
        ),
        timeout=60,
    )
    if create.status_code not in (200, 201, 409):
        raise RuntimeError(
            f"Unable to create Storage bucket {bucket['id']}: HTTP {create.status_code} {create.text[:200]}"
        )


def restore_storage(manifest, storage_files):
    if not storage_files:
        return 0
    if DRY_RUN:
        print(f"==> Storage DRY-RUN — verified {len(storage_files)} objects")
        return len(storage_files)

    restored = 0
    for bucket in (manifest.get("storage") or {}).get("buckets", []):
        _ensure_storage_bucket(bucket)
        for obj in bucket.get("objects", []):
            key = (bucket["id"], obj["name"])
            raw = storage_files[key]
            url = (
                f"{SUPABASE_URL}/storage/v1/object/{quote(bucket['id'], safe='')}/"
                f"{quote(obj['name'], safe='/')}"
            )
            headers = {
                "Authorization": f"Bearer {SERVICE_KEY}",
                "apikey": SERVICE_KEY,
                "Content-Type": obj.get("content_type") or "application/octet-stream",
                "x-upsert": "true",
            }
            upload = requests.post(url, headers=headers, data=raw, timeout=300)
            if upload.status_code not in (200, 201):
                raise RuntimeError(
                    f"Storage restore failed for {bucket['id']}/{obj['name']}: "
                    f"HTTP {upload.status_code} {upload.text[:200]}"
                )
            verify = requests.get(url, headers=headers, timeout=300)
            if verify.status_code != 200 or sha256_bytes(verify.content) != obj["sha256"]:
                raise RuntimeError(f"Storage verification failed for {bucket['id']}/{obj['name']}")
            restored += 1
    print(f"==> Storage restored and verified: {restored} objects")
    return restored


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    if not DRY_RUN and RESTORE_CONFIRMATION != "RESTORE":
        raise RuntimeError('RESTORE_CONFIRMATION must be the literal string "RESTORE"')

    print(f"==> HIS restore: {BACKUP_NAME} (dry-run={DRY_RUN})")
    blob = download_zip()
    archive, manifest, tables, storage_files = validate_archive(blob)
    try:
        table_count, row_count, skipped = restore_tables(manifest, tables)
        storage_count = restore_storage(manifest, storage_files)
    finally:
        archive.close()
    print(
        f"==> RESTORE COMPLETE: {row_count:,} rows across {table_count} writable tables; "
        f"{storage_count} Storage objects; {len(skipped)} read-only views skipped."
    )
    return True


if __name__ == "__main__":
    try:
        sys.exit(0 if main() else 1)
    except Exception as exc:
        github_error(exc)
        print(f"FATAL: {exc}", file=sys.stderr)
        sys.exit(1)
