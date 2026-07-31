#!/usr/bin/env python3
"""Supabase backup via REST API - works from GitHub Actions (no direct DB access needed)."""
import json, os, sys, csv, zipfile
import hashlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "his-backups").strip() or "his-backups"
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "30"))
OUTPUT = Path(os.environ.get("OUTPUT_DIR", "output"))
INCLUDE_STORAGE = os.environ.get("BACKUP_INCLUDE_STORAGE", "0") == "1"
STORAGE_WORKERS = max(1, min(16, int(os.environ.get("BACKUP_STORAGE_WORKERS", "8"))))
REQUIRED_TABLES = [
    item.strip()
    for item in os.environ.get("BACKUP_REQUIRED_TABLES", "").split(",")
    if item.strip()
]
OPENAPI_SPEC = {}

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "count=exact",
}


def github_error(message):
    """Expose a safe failure reason in the GitHub Actions run annotation."""
    safe = str(message).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::error::{safe}")


def request_with_retry(method, url, attempts=5, **kwargs):
    """Retry transient Supabase/CDN failures with bounded exponential backoff."""
    retry_statuses = {408, 425, 429, 500, 502, 503, 504}
    last_error = None
    for attempt in range(attempts):
        try:
            response = getattr(requests, method)(url, **kwargs)
            if response.status_code not in retry_statuses:
                return response
            last_error = RuntimeError(f"HTTP {response.status_code}: {response.text[:200]}")
        except requests.RequestException as exc:
            last_error = exc
        if attempt + 1 < attempts:
            delay = min(8, 2 ** attempt)
            print(f"      Transient {method.upper()} failure; retry {attempt + 2}/{attempts} in {delay}s")
            time.sleep(delay)
    if last_error:
        raise last_error
    raise RuntimeError(f"{method.upper()} request failed without a response")

# Fallback table names - HIS_One_ prefix as used in this project
KNOWN_TABLES = [
    "HIS_One_Users", "HIS_One_Settings", "HIS_One_Patients",
    "HIS_One_Appointments", "HIS_One_Locations", "HIS_One_Organizations",
    "HIS_One_OrgUsers", "HIS_One_MasterData",
    "HIS_One_activity_logs", "HIS_One_PatientVaccines",
    "HIS_One_TriageLogs", "HIS_One_OPDRecords", "HIS_One_IPDRecords",
    "HIS_One_LabOrders", "HIS_One_LabResults",
    "HIS_One_Inventory", "HIS_One_Reagents", "HIS_One_Drugs",
    "HIS_One_Sessions", "HIS_One_Notifications",
]


def discover_tables():
    """Use OpenAPI spec or HEAD probes to find real public tables."""
    global OPENAPI_SPEC
    # Try OpenAPI spec
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/?apikey={SERVICE_KEY}",
            headers={"Accept": "application/json"},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                tables = []
                for item in data:
                    if isinstance(item, dict):
                        name = item.get("name") or item.get("table") or item.get("entity")
                        if name:
                            tables.append(name)
                    elif isinstance(item, str):
                        tables.append(item)
                tables = sorted(set(tables))
                if tables:
                    print(f"  OpenAPI discovery found {len(tables)} tables")
                    return tables
            elif isinstance(data, dict):
                OPENAPI_SPEC = data
                defs = data.get("definitions", data.get("components", {}).get("schemas", {}))
                if isinstance(defs, dict):
                    tables = sorted(defs.keys())
                    if tables:
                        print(f"  OpenAPI definitions found {len(tables)} tables")
                        return tables
    except Exception as e:
        print(f"  OpenAPI discovery skipped: {e}")

    # Fallback: probe known table names
    print("  Probing known table names...")
    existing = []
    for t in KNOWN_TABLES:
        try:
            r = requests.head(f"{SUPABASE_URL}/rest/v1/{t}", headers=HEADERS, timeout=10)
            if r.status_code in (200, 206):
                existing.append(t)
                print(f"    Found: {t} (HTTP {r.status_code})")
        except Exception:
            pass
    return existing


def table_is_restorable(table):
    """Use PostgREST's OpenAPI paths to distinguish writable tables from views."""
    if not OPENAPI_SPEC:
        return True
    operations = OPENAPI_SPEC.get("paths", {}).get(f"/{table}", {})
    return "post" in operations


def storage_headers(content_type="application/json"):
    return {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": content_type,
    }


def _safe_storage_destination(root, bucket, object_name):
    candidate = (root / bucket / Path(object_name.replace("\\", "/"))).resolve()
    root_resolved = root.resolve()
    if root_resolved not in candidate.parents:
        raise RuntimeError(f"Unsafe Storage object path: {bucket}/{object_name}")
    return candidate


def list_storage_objects(bucket):
    """Recursively list every object in a Supabase Storage bucket."""
    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{quote(bucket, safe='')}"

    def walk(prefix="", depth=0):
        if depth > 20:
            raise RuntimeError(f"Storage folder nesting is too deep in bucket {bucket}")
        found = []
        offset = 0
        while True:
            resp = requests.post(
                list_url,
                headers=storage_headers(),
                data=json.dumps({"prefix": prefix, "limit": 1000, "offset": offset}),
                timeout=60,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Storage list failed for {bucket}/{prefix}: HTTP {resp.status_code} {resp.text[:200]}"
                )
            payload = resp.json()
            if not isinstance(payload, list):
                raise RuntimeError(f"Storage list returned invalid data for {bucket}/{prefix}")
            for item in payload:
                name = item.get("name", "")
                if not name:
                    continue
                full_name = f"{prefix}/{name}" if prefix else name
                if item.get("id") is None:
                    found.extend(walk(full_name, depth + 1))
                else:
                    found.append((full_name, item))
            if len(payload) < 1000:
                break
            offset += len(payload)
        return found

    return walk()


def backup_storage_buckets():
    """Download all application Storage objects except the backup destination itself."""
    if not INCLUDE_STORAGE:
        return {"enabled": False, "buckets": [], "total_objects": 0, "total_bytes": 0}

    response = requests.get(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=storage_headers(),
        timeout=60,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Storage bucket list failed: HTTP {response.status_code} {response.text[:200]}")

    storage_root = OUTPUT / "storage"
    bucket_entries = []
    total_objects = 0
    total_bytes = 0
    bucket_payload = response.json()
    for bucket_info in bucket_payload if isinstance(bucket_payload, list) else []:
        bucket = bucket_info.get("id") or bucket_info.get("name")
        if not bucket or bucket == SUPABASE_BUCKET:
            continue
        listed_objects = list_storage_objects(bucket)

        def download_object(item):
            object_name, metadata = item
            destination = _safe_storage_destination(storage_root, bucket, object_name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            object_url = (
                f"{SUPABASE_URL}/storage/v1/object/{quote(bucket, safe='')}/"
                f"{quote(object_name, safe='/')}"
            )
            download = request_with_retry(
                "get",
                object_url,
                headers=storage_headers(content_type="application/octet-stream"),
                timeout=(15, 120),
            )
            if download.status_code != 200:
                raise RuntimeError(
                    f"Storage download failed for {bucket}/{object_name}: "
                    f"HTTP {download.status_code} {download.text[:200]}"
                )
            destination.write_bytes(download.content)
            size = len(download.content)
            return {
                "name": object_name,
                "size_bytes": size,
                "sha256": sha256(destination),
                "content_type": (metadata.get("metadata") or {}).get("mimetype"),
            }

        objects = []
        with ThreadPoolExecutor(max_workers=STORAGE_WORKERS) as pool:
            futures = [pool.submit(download_object, item) for item in listed_objects]
            for completed, future in enumerate(as_completed(futures), start=1):
                objects.append(future.result())
                if completed % 25 == 0 or completed == len(futures):
                    print(f"      {bucket}: downloaded {completed}/{len(futures)} objects")
        objects.sort(key=lambda item: item["name"])
        total_objects += len(objects)
        total_bytes += sum(item["size_bytes"] for item in objects)
        bucket_entries.append(
            {
                "id": bucket,
                "public": bool(bucket_info.get("public", False)),
                "file_size_limit": bucket_info.get("file_size_limit"),
                "allowed_mime_types": bucket_info.get("allowed_mime_types"),
                "objects": objects,
            }
        )
        print(f"    Storage {bucket}: {len(objects)} objects")

    return {
        "enabled": True,
        "buckets": bucket_entries,
        "total_objects": total_objects,
        "total_bytes": total_bytes,
    }


def upload_storage_snapshots(storage_backup, now):
    """Copy application files into the backup bucket as individually restorable objects.

    Keeping each original file separate respects Supabase's 50 MB global upload
    limit when Spend Cap is enabled, while the small database ZIP remains the
    atomic manifest that makes the snapshot visible to the restore UI.
    """
    if not storage_backup.get("enabled") or not storage_backup.get("total_objects"):
        return storage_backup

    snapshot_id = now.strftime("%Y%m%d_%H%M%S")
    tasks = []
    for bucket in storage_backup["buckets"]:
        for obj in bucket["objects"]:
            tasks.append((bucket["id"], obj))

    def upload_one(task):
        bucket_id, obj = task
        local_path = _safe_storage_destination(OUTPUT / "storage", bucket_id, obj["name"])
        backup_object = (
            f"snapshots/{now.strftime('%Y/%m')}/{snapshot_id}/"
            f"{bucket_id}/{obj['name']}"
        )
        url = (
            f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
            f"{quote(backup_object, safe='/')}"
        )
        raw = local_path.read_bytes()
        headers = {
            "Authorization": f"Bearer {SERVICE_KEY}",
            "apikey": SERVICE_KEY,
            "Content-Type": obj.get("content_type") or "application/octet-stream",
            "x-upsert": "true",
        }
        response = request_with_retry(
            "post", url, headers=headers, data=raw, timeout=(15, 180)
        )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Snapshot upload failed for {bucket_id}/{obj['name']}: "
                f"HTTP {response.status_code} {response.text[:200]}"
            )
        verification = request_with_retry(
            "get", url, headers=headers, timeout=(15, 180)
        )
        if (
            verification.status_code != 200
            or len(verification.content) != obj["size_bytes"]
            or sha256_bytes(verification.content) != obj["sha256"]
        ):
            raise RuntimeError(f"Snapshot verification failed for {bucket_id}/{obj['name']}")
        return obj, backup_object

    uploaded_paths = []
    try:
        with ThreadPoolExecutor(max_workers=STORAGE_WORKERS) as pool:
            futures = [pool.submit(upload_one, task) for task in tasks]
            for completed, future in enumerate(as_completed(futures), start=1):
                obj, backup_object = future.result()
                obj["backup_object"] = backup_object
                uploaded_paths.append(backup_object)
                if completed % 25 == 0 or completed == len(futures):
                    print(f"      Snapshots uploaded and verified: {completed}/{len(futures)}")
    except Exception:
        delete_backup_objects(uploaded_paths)
        raise
    storage_backup["snapshot_id"] = snapshot_id
    return storage_backup


def delete_backup_objects(object_paths):
    """Remove sidecars from an incomplete backup attempt."""
    deleted = 0
    for object_path in object_paths:
        response = requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
            f"{quote(object_path, safe='/')}",
            headers=storage_headers(),
            timeout=60,
        )
        if response.status_code in (200, 204):
            deleted += 1
    if deleted:
        print(f"  Removed {deleted} sidecar objects from incomplete backup")
    return deleted


def delete_storage_snapshots(storage_backup):
    paths = []
    for bucket in storage_backup.get("buckets", []):
        for obj in bucket.get("objects", []):
            if obj.get("backup_object"):
                paths.append(obj["backup_object"])
    return delete_backup_objects(paths)


def export_table(table):
    """Export a table via REST API with pagination."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    offset = 0
    limit = 1000
    all_rows = []
    expected_total = None

    while True:
        resp = requests.get(
            url,
            params={"select": "*", "limit": str(limit), "offset": str(offset)},
            headers=HEADERS,
            timeout=60,
        )
        if resp.status_code in (200, 206):
            rows = resp.json()
            content_range = resp.headers.get("Content-Range", "")
            if "/" in content_range:
                total_text = content_range.rsplit("/", 1)[-1]
                if total_text.isdigit():
                    expected_total = int(total_text)
            if not rows:
                break
            all_rows.extend(rows)
            offset += len(rows)
            if len(rows) < limit:
                break
        elif resp.status_code == 416:
            break
        else:
            raise RuntimeError(
                f"HTTP {resp.status_code} on {table} at offset {offset}: {resp.text[:200]}"
            )

    if expected_total is not None and len(all_rows) != expected_total:
        raise RuntimeError(
            f"row-count mismatch for {table}: exported {len(all_rows)}, expected {expected_total}"
        )
    return all_rows


def save_csv(table, rows, path):
    if not rows:
        return 0
    fieldnames = []
    seen_fields = set()
    for row in rows:
        for key in row.keys():
            if key not in seen_fields:
                seen_fields.add(key)
                fieldnames.append(key)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            encoded = {
                key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
                for key, value in row.items()
            }
            writer.writerow(encoded)
    return len(rows)


def save_json(rows, path):
    """Preserve Postgres/PostgREST value types for disaster recovery."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    return len(rows)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def upload_supabase_storage(zip_path, object_path):
    """Upload file to Supabase Storage bucket."""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{object_path}"
    with open(zip_path, "rb") as f:
        resp = request_with_retry(
            "post",
            url,
            headers={
                "Authorization": f"Bearer {SERVICE_KEY}",
                "Content-Type": "application/zip",
            },
            data=f,
            timeout=300,
        )
    return resp


def verify_supabase_upload(object_path, expected_size):
    """Confirm the uploaded object exists and has the expected byte size."""
    parent, filename = object_path.rsplit("/", 1)
    resp = request_with_retry(
        "post",
        f"{SUPABASE_URL}/storage/v1/object/list/{SUPABASE_BUCKET}",
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "apikey": SERVICE_KEY,
            "Content-Type": "application/json",
        },
        data=json.dumps({"prefix": parent, "limit": 100, "search": filename}),
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  Verification list failed (HTTP {resp.status_code}): {resp.text[:200]}")
        return False

    items = resp.json()
    for item in items if isinstance(items, list) else []:
        if item.get("name") != filename:
            continue
        actual_size = (item.get("metadata") or {}).get("size")
        if actual_size is None or int(actual_size) == int(expected_size):
            return True
        print(f"  Verification size mismatch: Storage={actual_size}, local={expected_size}")
        return False
    print(f"  Verification failed: {object_path} was not returned by Storage list")
    return False


def ensure_supabase_bucket():
    """Create the private backup bucket when it does not already exist."""
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
    }
    bucket_url = f"{SUPABASE_URL}/storage/v1/bucket/{SUPABASE_BUCKET}"
    resp = requests.get(bucket_url, headers=headers, timeout=30)
    if resp.status_code == 200:
        print(f"  Bucket ready: {SUPABASE_BUCKET}")
        return
    if resp.status_code not in (400, 404):
        raise RuntimeError(f"Bucket check failed (HTTP {resp.status_code}): {resp.text[:300]}")

    create_resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=headers,
        data=json.dumps({"id": SUPABASE_BUCKET, "name": SUPABASE_BUCKET, "public": False}),
        timeout=30,
    )
    if create_resp.status_code in (200, 201, 409):
        print(f"  Bucket ready: {SUPABASE_BUCKET}")
        return
    raise RuntimeError(f"Bucket create failed (HTTP {create_resp.status_code}): {create_resp.text[:300]}")


def cleanup_supabase_storage():
    """Delete old backups from Supabase Storage."""
    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{SUPABASE_BUCKET}"
    storage_headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
    }

    def walk(prefix, depth=0):
        if depth > 5:
            return []
        resp = requests.post(
            list_url,
            headers=storage_headers,
            data=json.dumps({"prefix": prefix, "limit": 1000}),
            timeout=30,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Storage list failed for {prefix!r}: HTTP {resp.status_code}")
        found = []
        items = resp.json()
        for obj in items if isinstance(items, list) else []:
            name = obj.get("name", "")
            if not name:
                continue
            full_name = f"{prefix}/{name}" if prefix else name
            if obj.get("id") is None:
                found.extend(walk(full_name, depth + 1))
            else:
                found.append((full_name, obj))
        return found

    objects = walk("backups") + walk("snapshots")
    cutoff = datetime.now().astimezone() - timedelta(days=RETENTION_DAYS)
    deleted = 0
    for name, obj in objects:
        if not (name.endswith(".zip") or name.startswith("snapshots/")):
            continue
        try:
            created_text = obj.get("created_at") or obj.get("updated_at") or ""
            created = datetime.fromisoformat(created_text.replace("Z", "+00:00"))
        except Exception:
            continue
        if created < cutoff:
            del_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{name}"
            dr = requests.delete(del_url, headers=storage_headers, timeout=30)
            if dr.status_code in (200, 204):
                print(f"  Deleted from Supabase: {name}")
                deleted += 1
    return deleted


def main():
    print("=" * 60)
    print("HIS Database Backup - REST API mode")
    print("=" * 60)

    if not SUPABASE_URL or not SERVICE_KEY:
        print("\nFATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
        print("Set both values as GitHub Actions secrets for this repository.")
        github_error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing")
        sys.exit(2)

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    zip_name = f"backup-{today}.zip"
    zip_path = OUTPUT / zip_name

    # Discover tables
    print("\n[1/5] Discovering tables...")
    tables = discover_tables()
    print(f"  Found {len(tables)} tables: {', '.join(tables)}")
    if not tables:
        print("\nFATAL: no tables were discovered; refusing to create an empty backup.")
        github_error("No Supabase tables were discovered; check the service-role key and PostgREST access")
        return False
    missing_required = [table for table in REQUIRED_TABLES if table not in tables]
    if missing_required:
        print(f"\nFATAL: required customer/settings tables are missing: {', '.join(missing_required)}")
        github_error(f"Required backup tables are missing: {', '.join(missing_required)}")
        return False

    # Export each table
    print("\n[2/5] Exporting tables via REST API...")
    (OUTPUT / "csv").mkdir(parents=True, exist_ok=True)
    csv_files = []
    json_files = []
    total_rows = 0
    failed = []
    table_rows = {}
    table_details = {}

    for i, table in enumerate(tables):
        try:
            rows = export_table(table)
            csv_path = OUTPUT / "csv" / f"{table}.csv"
            json_path = OUTPUT / "json" / f"{table}.json"
            json_path.parent.mkdir(parents=True, exist_ok=True)
            save_json(rows, json_path)
            json_files.append(str(json_path))
            count = save_csv(table, rows, csv_path)
            if count > 0:
                csv_files.append(str(csv_path))
            table_rows[table] = count
            table_details[table] = {
                "rows": count,
                "sha256": sha256(json_path),
                "restorable": table_is_restorable(table),
            }
            total_rows += count
            print(f"    {table}: {count} rows")
        except Exception as e:
            print(f"    {table}: FAILED - {e}")
            failed.append(table)

    print(f"\n  Total: {total_rows} rows across {len(table_rows)} tables ({len(failed)} failed)")

    if failed:
        print(f"\nFATAL: {len(failed)} table(s) failed; refusing to create an incomplete backup.")
        github_error(f"{len(failed)} table export(s) failed: {', '.join(failed)}")
        return False

    print("\n[3/5] Backing up application Storage objects...")
    try:
        storage_backup = backup_storage_buckets()
        ensure_supabase_bucket()
        storage_backup = upload_storage_snapshots(storage_backup, now)
    except Exception as exc:
        print(f"  Storage backup FAILED: {exc}")
        github_error(f"Application Storage backup failed: {exc}")
        return False

    metadata_dir = OUTPUT / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    openapi_path = metadata_dir / "postgrest-openapi.json"
    openapi_path.write_text(
        json.dumps(OPENAPI_SPEC, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    archive_manifest = {
        "format_version": 2,
        "backup_scope": "application-data-settings-and-storage",
        "date": today,
        "time": now.isoformat(),
        "tables_discovered": len(tables),
        "tables_exported": len(table_rows),
        "total_rows": total_rows,
        "table_rows": table_rows,
        "table_details": table_details,
        "required_tables": REQUIRED_TABLES,
        "failed_tables": failed,
        "formats": ["json", "csv"],
        "storage": storage_backup,
        "metadata": {"postgrest_openapi": "metadata/postgrest-openapi.json"},
    }
    archive_manifest_path = OUTPUT / "archive-manifest.json"
    with open(archive_manifest_path, "w", encoding="utf-8") as f:
        json.dump(archive_manifest, f, ensure_ascii=False, indent=2)

    # Zip everything
    print(f"\n[4/5] Creating zip archive: {zip_name}")
    csv_paths = [Path(fp) for fp in csv_files]
    json_paths = [Path(fp) for fp in json_files]
    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in csv_paths:
            zf.write(fp, "csv/" + fp.name)
        for fp in json_paths:
            zf.write(fp, "json/" + fp.name)
        # Storage files are copied as individual sidecar snapshots in the
        # backup bucket so every upload remains below Supabase's file limit.
        for root_name in ("metadata",):
            root = OUTPUT / root_name
            if root.exists():
                for fp in root.rglob("*"):
                    if fp.is_file():
                        zf.write(fp, fp.relative_to(OUTPUT).as_posix())
        zf.write(archive_manifest_path, "manifest.json")

    size = zip_path.stat().st_size
    sha = sha256(str(zip_path))
    print(f"  Size: {size:,} bytes ({size / 1024 / 1024:.1f} MB)")
    print(f"  SHA-256: {sha}")

    # Upload to Supabase Storage
    print(f"\n[5/5] Uploading to Supabase Storage...")
    sb_url_out = None
    ts_suffix = now.strftime("%Y%m%d_%H%M%S")
    zip_name_ts = f"backup-{today}_{ts_suffix}.zip"
    object_path = f"backups/{now.strftime('%Y/%m')}/{zip_name_ts}"
    try:
        ensure_supabase_bucket()
        resp = upload_supabase_storage(str(zip_path), object_path)
        if resp.status_code in (200, 201):
            if verify_supabase_upload(object_path, size):
                sb_url_out = object_path
                print(f"  SUCCESS + VERIFIED: {SUPABASE_BUCKET}/{object_path}")
            else:
                print("  FAILED: upload returned success but verification did not pass")
                github_error("Supabase Storage upload could not be verified")
        else:
            print(f"  FAILED (HTTP {resp.status_code}): {resp.text[:300]}")
            github_error(
                f"Supabase Storage upload failed with HTTP {resp.status_code}: {resp.text[:200]}"
            )
    except Exception as e:
        print(f"  FAILED: {e}")
        github_error(f"Supabase Storage setup/upload failed: {e}")

    # Cleanup old backups
    print(f"\nCleaning up old backups (>{RETENTION_DAYS} days)...")
    try:
        sb_deleted = cleanup_supabase_storage()
        print(f"  Supabase: {sb_deleted} deleted")
    except Exception as e:
        print(f"  Supabase cleanup error: {e}")

    # Manifest
    manifest = {
        "date": today,
        "time": now.isoformat(),
        "filename": zip_name,
        "tables": len(table_rows),
        "total_rows": total_rows,
        "table_rows": table_rows,
        "storage_objects": storage_backup["total_objects"],
        "storage_bytes": storage_backup["total_bytes"],
        "failed_tables": failed,
        "sha256": sha,
        "size_bytes": size,
        "storage_bucket": SUPABASE_BUCKET,
        "storage_object": sb_url_out,
    }
    manifest_path = OUTPUT / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 60)
    print("BACKUP COMPLETE")
    print("=" * 60)

    # GitHub Actions outputs
    outputs_path = os.environ.get("GITHUB_OUTPUT", "")
    if outputs_path:
        with open(outputs_path, "a") as f:
            f.write(f"zip_size={size}\n")
            f.write(f"total_rows={total_rows}\n")
            f.write(f"backup_tables={len(table_rows)}\n")
            if sb_url_out:
                f.write(f"supabase_url={sb_url_out}\n")

    if not sb_url_out:
        try:
            delete_storage_snapshots(storage_backup)
        except Exception as exc:
            print(f"  Incomplete snapshot cleanup failed: {exc}")
        print("\nFATAL: backup ZIP was created but was not uploaded to Supabase Storage.")
        github_error("Backup ZIP was created but was not uploaded to Supabase Storage")
        return False

    return len(failed) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
