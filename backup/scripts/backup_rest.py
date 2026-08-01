#!/usr/bin/env python3
"""Supabase backup via REST API - works from GitHub Actions (no direct DB access needed)."""
import io
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


def _integer(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _source_metadata(item):
    """Return stable Storage metadata used to avoid downloading unchanged files."""
    nested = item.get("metadata") or {}
    return {
        "source_updated_at": (
            item.get("updated_at")
            or item.get("updatedAt")
            or nested.get("lastModified")
        ),
        "source_etag": nested.get("eTag") or nested.get("etag") or item.get("version"),
        "source_size_bytes": _integer(
            nested.get("size") or nested.get("contentLength") or item.get("size")
        ),
    }


def _storage_index(manifest):
    index = {}
    for bucket in (manifest.get("storage") or {}).get("buckets", []):
        bucket_id = bucket.get("id")
        for obj in bucket.get("objects", []):
            if bucket_id and obj.get("name"):
                index[(bucket_id, obj["name"])] = obj
    return index


def list_backup_bucket_objects(prefix, depth=0):
    """Recursively list objects below a prefix in the private backup bucket."""
    if depth > 20:
        raise RuntimeError(f"Backup folder nesting is too deep below {prefix}")
    found = []
    offset = 0
    while True:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/list/{quote(SUPABASE_BUCKET, safe='')}",
            headers=storage_headers(),
            data=json.dumps({"prefix": prefix, "limit": 1000, "offset": offset}),
            timeout=60,
        )
        if response.status_code != 200:
            raise RuntimeError(f"Backup object list failed for {prefix}: HTTP {response.status_code}")
        payload = response.json()
        payload = payload if isinstance(payload, list) else []
        for item in payload:
            name = item.get("name", "")
            if not name:
                continue
            full_name = f"{prefix}/{name}" if prefix else name
            if item.get("id") is None:
                found.extend(list_backup_bucket_objects(full_name, depth + 1))
            else:
                found.append((full_name, item))
        if len(payload) < 1000:
            break
        offset += len(payload)
    return found


def download_backup_manifest(object_path):
    response = request_with_retry(
        "get",
        f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
        f"{quote(object_path, safe='/')}",
        headers=storage_headers(content_type="application/octet-stream"),
        timeout=(15, 120),
    )
    if response.status_code != 200:
        raise RuntimeError(f"Unable to download manifest archive {object_path}")
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        return json.loads(archive.read("manifest.json"))


def load_latest_storage_index():
    """Load the newest successful backup so unchanged Storage objects can be reused."""
    backups = [
        (path, metadata)
        for path, metadata in list_backup_bucket_objects("backups")
        if path.endswith(".zip")
    ]
    if not backups:
        print("  No previous backup manifest found; all Storage objects require hashing once")
        return {}
    object_path, _ = max(backups, key=lambda item: item[0])
    manifest = download_backup_manifest(object_path)
    index = _storage_index(manifest)
    print(f"  Previous manifest loaded: {object_path} ({len(index)} Storage objects)")
    return index


def _can_reuse_storage_object(previous, current_source):
    if not previous or not previous.get("backup_object") or not previous.get("sha256"):
        return False
    previous_size = _integer(previous.get("size_bytes"))
    current_size = current_source.get("source_size_bytes")
    if previous_size is not None and current_size is not None and previous_size != current_size:
        return False
    etag = current_source.get("source_etag")
    if etag and previous.get("source_etag"):
        return etag == previous["source_etag"]
    updated_at = current_source.get("source_updated_at")
    if updated_at and previous.get("source_updated_at"):
        return updated_at == previous["source_updated_at"]
    return False


def backup_storage_buckets(previous_index=None):
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

    previous_index = previous_index or {}
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
            source = _source_metadata(metadata)
            previous = previous_index.get((bucket, object_name))
            if _can_reuse_storage_object(previous, source):
                reused = dict(previous)
                reused.update({key: value for key, value in source.items() if value is not None})
                reused["content_type"] = (
                    (metadata.get("metadata") or {}).get("mimetype")
                    or previous.get("content_type")
                )
                reused["_state"] = "unchanged"
                return reused

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
            result = {
                "name": object_name,
                "size_bytes": size,
                "sha256": sha256(destination),
                "content_type": (metadata.get("metadata") or {}).get("mimetype"),
                "_state": "changed",
            }
            result.update({key: value for key, value in source.items() if value is not None})
            # Migration path for legacy dated snapshots: the first incremental
            # run may need to hash the source once, but it must not upload the
            # same 10+ GiB again when the previous SHA-256 still matches.
            if (
                previous
                and previous.get("backup_object")
                and previous.get("sha256") == result["sha256"]
                and _integer(previous.get("size_bytes")) == size
            ):
                result["backup_object"] = previous["backup_object"]
                result["_state"] = "unchanged"
            return result

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
    """Store changed application files as content-addressed, reusable blobs.

    Keeping each original file separate respects Supabase's 50 MB global upload
    limit. SHA-256 paths let every daily manifest reference the same physical
    object until the source content actually changes.
    """
    if not storage_backup.get("enabled") or not storage_backup.get("total_objects"):
        return storage_backup

    tasks = []
    for bucket in storage_backup["buckets"]:
        for obj in bucket["objects"]:
            if obj.get("_state") != "unchanged":
                tasks.append((bucket["id"], obj))

    def upload_one(task):
        bucket_id, obj = task
        local_path = _safe_storage_destination(OUTPUT / "storage", bucket_id, obj["name"])
        backup_object = f"blobs/sha256/{obj['sha256'][:2]}/{obj['sha256']}"
        url = (
            f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
            f"{quote(backup_object, safe='/')}"
        )
        raw = local_path.read_bytes()
        headers = {
            "Authorization": f"Bearer {SERVICE_KEY}",
            "apikey": SERVICE_KEY,
            "Content-Type": obj.get("content_type") or "application/octet-stream",
            "x-upsert": "false",
        }

        existing = request_with_retry(
            "get", url, headers=headers, timeout=(15, 180)
        )
        if existing.status_code == 200:
            if (
                len(existing.content) != obj["size_bytes"]
                or sha256_bytes(existing.content) != obj["sha256"]
            ):
                raise RuntimeError(f"Existing content blob failed verification: {backup_object}")
            return obj, backup_object, False
        if existing.status_code not in (400, 404):
            raise RuntimeError(
                f"Content blob check failed for {bucket_id}/{obj['name']}: "
                f"HTTP {existing.status_code} {existing.text[:200]}"
            )

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
        return obj, backup_object, True

    uploaded_paths = []
    uploaded_bytes = 0
    reused_changed_objects = 0
    try:
        with ThreadPoolExecutor(max_workers=STORAGE_WORKERS) as pool:
            futures = [pool.submit(upload_one, task) for task in tasks]
            for completed, future in enumerate(as_completed(futures), start=1):
                obj, backup_object, created = future.result()
                obj["backup_object"] = backup_object
                if created:
                    uploaded_paths.append(backup_object)
                    uploaded_bytes += int(obj["size_bytes"])
                else:
                    reused_changed_objects += 1
                if completed % 25 == 0 or completed == len(futures):
                    print(f"      Changed blobs handled and verified: {completed}/{len(futures)}")
    except Exception:
        delete_backup_objects(uploaded_paths)
        raise

    unchanged_objects = storage_backup["total_objects"] - len(tasks)
    storage_backup["incremental"] = {
        "changed_objects": len(tasks),
        "uploaded_objects": len(uploaded_paths),
        "uploaded_bytes": uploaded_bytes,
        "reused_objects": unchanged_objects + reused_changed_objects,
        "reused_bytes": storage_backup["total_bytes"] - uploaded_bytes,
    }
    storage_backup["_new_backup_objects"] = uploaded_paths
    for bucket in storage_backup["buckets"]:
        for obj in bucket["objects"]:
            obj.pop("_state", None)
    print(
        "  Incremental Storage: "
        f"{len(uploaded_paths)} uploaded ({uploaded_bytes:,} bytes), "
        f"{storage_backup['incremental']['reused_objects']} reused"
    )
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
    return delete_backup_objects(storage_backup.get("_new_backup_objects", []))


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
    """Apply retention without deleting blobs referenced by a retained manifest."""
    cutoff = datetime.now().astimezone() - timedelta(days=RETENTION_DAYS)

    def created_at(metadata):
        value = metadata.get("created_at") or metadata.get("created") or metadata.get("updated_at")
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=cutoff.tzinfo)
        except (TypeError, ValueError):
            return None

    def delete_object(name):
        response = requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
            f"{quote(name, safe='/')}",
            headers=storage_headers(),
            timeout=60,
        )
        if response.status_code in (200, 204):
            print(f"  Deleted from Supabase: {name}")
            return True
        print(f"  Cleanup delete failed for {name}: HTTP {response.status_code}")
        return False

    backup_archives = [
        (name, metadata)
        for name, metadata in list_backup_bucket_objects("backups")
        if name.endswith(".zip")
    ]
    retained_archives = []
    deleted = 0
    for name, metadata in backup_archives:
        created = created_at(metadata)
        if created is not None and created < cutoff:
            deleted += int(delete_object(name))
        else:
            retained_archives.append(name)

    referenced_objects = set()
    try:
        for archive_path in retained_archives:
            manifest = download_backup_manifest(archive_path)
            for obj in _storage_index(manifest).values():
                if obj.get("backup_object"):
                    referenced_objects.add(obj["backup_object"])
    except Exception as exc:
        print(f"  Sidecar cleanup skipped: retained manifest scan failed: {exc}")
        return deleted

    sidecars = list_backup_bucket_objects("snapshots") + list_backup_bucket_objects("blobs")
    for name, metadata in sidecars:
        created = created_at(metadata)
        if name in referenced_objects or created is None or created >= cutoff:
            continue
        deleted += int(delete_object(name))

    print(
        f"  Retained {len(retained_archives)} manifests referencing "
        f"{len(referenced_objects)} unique Storage blobs"
    )
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
        ensure_supabase_bucket()
        previous_storage_index = load_latest_storage_index() if INCLUDE_STORAGE else {}
        storage_backup = backup_storage_buckets(previous_storage_index)
        storage_backup = upload_storage_snapshots(storage_backup, now)
        new_backup_objects = list(storage_backup.pop("_new_backup_objects", []))
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
        "format_version": 3,
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
        "storage_uploaded_objects": (storage_backup.get("incremental") or {}).get(
            "uploaded_objects", storage_backup["total_objects"]
        ),
        "storage_uploaded_bytes": (storage_backup.get("incremental") or {}).get(
            "uploaded_bytes", storage_backup["total_bytes"]
        ),
        "storage_reused_objects": (storage_backup.get("incremental") or {}).get(
            "reused_objects", 0
        ),
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
            f.write(
                "storage_uploaded_bytes="
                f"{(storage_backup.get('incremental') or {}).get('uploaded_bytes', storage_backup['total_bytes'])}\n"
            )
            f.write(
                "storage_uploaded_objects="
                f"{(storage_backup.get('incremental') or {}).get('uploaded_objects', storage_backup['total_objects'])}\n"
            )
            f.write(
                "storage_reused_objects="
                f"{(storage_backup.get('incremental') or {}).get('reused_objects', 0)}\n"
            )
            if sb_url_out:
                f.write(f"supabase_url={sb_url_out}\n")

    if not sb_url_out:
        try:
            delete_backup_objects(new_backup_objects)
        except Exception as exc:
            print(f"  Incomplete snapshot cleanup failed: {exc}")
        print("\nFATAL: backup ZIP was created but was not uploaded to Supabase Storage.")
        github_error("Backup ZIP was created but was not uploaded to Supabase Storage")
        return False

    return len(failed) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
