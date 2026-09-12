#!/usr/bin/env python3
"""Safely migrate old HIS backup archives from Supabase Storage to Drive.

The script is intentionally fail-closed:

* it can read and copy only the dedicated ``his-backups`` bucket;
* application buckets are never changed;
* Drive uploads are verified by size and checksum;
* every archived backup receives a Drive sidecar index used by restore_rest.py;
* deletion is disabled unless three independent opt-in gates are present;
* sidecars needed by a hot or unverified archive are always retained;
* unreferenced/orphaned objects are reported but never deleted automatically.

Default execution is audit-only. See docs/STORAGE_OFFLOAD_RUNBOOK_LO.md.
"""

import hashlib
import io
import json
import os
import sys
import tempfile
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests

from gdrive_common import build_drive, credentials_configured
from gdrive_upload import (
    file_digest,
    list_drive_blobs,
    upload_binary,
    verify_root_folder,
)


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = (
    os.environ.get("SUPABASE_STORAGE_BUCKET", "his-backups").strip()
    or "his-backups"
)
DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "").strip()
RETENTION_DAYS = int(os.environ.get("SUPABASE_RETENTION_DAYS", "30"))
MIGRATION_ENABLED = os.environ.get("SUPABASE_ARCHIVE_MIGRATION_ENABLED", "0") == "1"
CLEANUP_ENABLED = os.environ.get("SUPABASE_CLEANUP_ENABLED", "0") == "1"
CLEANUP_CONFIRMATION = os.environ.get("SUPABASE_CLEANUP_CONFIRMATION", "")
DRIVE_RESTORE_VERIFIED = os.environ.get("DRIVE_RESTORE_VERIFIED", "0") == "1"
DRIVE_REQUIRED = os.environ.get("DRIVE_REQUIRED", "0") == "1"
WARN_BYTES = int(os.environ.get("SUPABASE_BACKUP_WARN_BYTES", str(70 * 1024**3)))
FAIL_ON_STORAGE_WARNING = os.environ.get("FAIL_ON_STORAGE_WARNING", "0") == "1"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "output"))


def storage_headers(content_type="application/json"):
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": content_type,
    }


def request_with_retry(method, url, attempts=5, **kwargs):
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
            import time

            time.sleep(min(8, 2**attempt))
    raise last_error or RuntimeError(f"{method.upper()} failed without a response")


def list_supabase_objects(prefix, depth=0, bucket=None):
    """Recursively list files below one prefix in a Storage bucket."""
    bucket = bucket or SUPABASE_BUCKET
    if depth > 20:
        raise RuntimeError(f"Storage nesting is too deep below {prefix}")
    endpoint = (
        f"{SUPABASE_URL}/storage/v1/object/list/{quote(bucket, safe='')}"
    )
    found = []
    offset = 0
    while True:
        response = request_with_retry(
            "post",
            endpoint,
            headers=storage_headers(),
            json={"prefix": prefix, "limit": 1000, "offset": offset},
            timeout=(15, 120),
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"Storage list failed for {prefix}: HTTP {response.status_code} "
                f"{response.text[:200]}"
            )
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError(f"Storage list returned invalid data for {prefix}")
        for item in payload:
            name = item.get("name", "")
            if not name:
                continue
            full_name = f"{prefix}/{name}" if prefix else name
            if item.get("id") is None:
                found.extend(list_supabase_objects(full_name, depth + 1, bucket=bucket))
            else:
                copied = dict(item)
                copied["path"] = full_name
                found.append(copied)
        if len(payload) < 1000:
            return found
        offset += len(payload)


def list_root_archives():
    endpoint = (
        f"{SUPABASE_URL}/storage/v1/object/list/{quote(SUPABASE_BUCKET, safe='')}"
    )
    found = []
    offset = 0
    while True:
        response = request_with_retry(
            "post",
            endpoint,
            headers=storage_headers(),
            json={"prefix": "", "limit": 1000, "offset": offset},
            timeout=(15, 120),
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"Storage root list failed: HTTP {response.status_code} {response.text[:200]}"
            )
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError("Storage root list returned invalid data")
        for item in payload:
            name = item.get("name", "")
            if item.get("id") is not None and name.lower().endswith(".zip"):
                copied = dict(item)
                copied["path"] = name
                found.append(copied)
        if len(payload) < 1000:
            return found
        offset += len(payload)


def object_size(item):
    metadata = item.get("metadata") or {}
    for value in (metadata.get("size"), item.get("size")):
        try:
            return int(value)
        except (TypeError, ValueError):
            pass
    return 0


def object_created_at(item):
    value = item.get("created_at") or item.get("created") or item.get("updated_at")
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def inventory_application_buckets():
    """Return aggregate-only usage for non-backup buckets."""
    response = request_with_retry(
        "get",
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=storage_headers(),
        timeout=(15, 120),
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Storage bucket inventory failed: HTTP {response.status_code} {response.text[:200]}"
        )
    payload = response.json()
    if not isinstance(payload, list):
        raise RuntimeError("Storage bucket inventory returned invalid data")
    summaries = []
    for bucket_info in payload:
        bucket_id = bucket_info.get("id") or bucket_info.get("name")
        if not bucket_id or bucket_id == SUPABASE_BUCKET:
            continue
        objects = list_supabase_objects("", bucket=bucket_id)
        summaries.append(
            {
                "bucket": bucket_id,
                "public": bool(bucket_info.get("public", False)),
                "object_count": len(objects),
                "size_bytes": sum(object_size(item) for item in objects),
            }
        )
    return sorted(summaries, key=lambda item: item["size_bytes"], reverse=True)


def download_supabase(path, destination=None):
    url = (
        f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}/"
        f"{quote(path, safe='/')}"
    )
    response = request_with_retry(
        "get",
        url,
        headers=storage_headers("application/octet-stream"),
        stream=destination is not None,
        timeout=(15, 300),
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Storage download failed for {path}: HTTP {response.status_code} "
            f"{response.text[:200]}"
        )
    if destination is None:
        return response.content
    with open(destination, "wb") as handle:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                handle.write(chunk)
    return destination


def parse_archive(raw, path):
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
        damaged = archive.testzip()
        if damaged:
            raise RuntimeError(f"ZIP CRC validation failed for {damaged}")
        if "manifest.json" not in archive.namelist():
            raise RuntimeError("manifest.json is missing")
        manifest = json.loads(archive.read("manifest.json"))
    except Exception as exc:
        raise RuntimeError(f"Invalid backup archive {path}: {exc}") from exc
    finally:
        if "archive" in locals():
            archive.close()

    references = {}
    for bucket in (manifest.get("storage") or {}).get("buckets", []):
        for obj in bucket.get("objects", []):
            backup_object = str(obj.get("backup_object") or "")
            sha = str(obj.get("sha256") or "")
            try:
                size = int(obj.get("size_bytes"))
            except (TypeError, ValueError):
                size = -1
            if not backup_object or len(sha) != 64 or size < 0:
                raise RuntimeError(
                    f"Archive {path} has an incomplete Storage reference for "
                    f"{bucket.get('id')}/{obj.get('name')}"
                )
            if not backup_object.startswith(("blobs/sha256/", "snapshots/")):
                raise RuntimeError(f"Archive {path} has unsafe sidecar path {backup_object}")
            references[backup_object] = {"sha256": sha, "size_bytes": size}
    return manifest, references


def list_drive_files(drive, folder_id):
    safe_folder = str(folder_id).replace("\\", "\\\\").replace("'", "\\'")
    query = f"'{safe_folder}' in parents and trashed=false"
    files = []
    page_token = None
    while True:
        response = (
            drive.files()
            .list(
                q=query,
                fields=(
                    "nextPageToken,files(id,name,size,md5Checksum,createdTime,"
                    "appProperties,webViewLink)"
                ),
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


def drive_json(drive, file_id):
    from googleapiclient.http import MediaIoBaseDownload

    request = drive.files().get_media(fileId=file_id, supportsAllDrives=True)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return json.loads(buffer.getvalue())


def matching_drive_manifest(files, archive_path, archive_name, size, md5):
    for item in files:
        props = item.get("appProperties") or {}
        if props.get("his_backup_type") != "manifest":
            continue
        if props.get("his_backup_scope") != "complete_incremental":
            continue
        same_source = props.get("his_supabase_object") == archive_path
        legacy_match = item.get("name") == archive_name
        if not (same_source or legacy_match):
            continue
        if int(item.get("size", -1)) != size or item.get("md5Checksum") != md5:
            continue
        if not props.get("his_sidecar_index_id"):
            continue
        return item
    return None


def verify_drive_bundle(drive, drive_files, drive_blobs, drive_manifest, references):
    props = drive_manifest.get("appProperties") or {}
    index = drive_json(drive, props["his_sidecar_index_id"])
    objects = index.get("objects") or {}
    if int(index.get("total_objects", -1)) != len(objects):
        raise RuntimeError("Drive sidecar index count is inconsistent")
    if set(objects) != set(references):
        raise RuntimeError("Drive sidecar index does not match the backup manifest")
    for path, expected in references.items():
        entry = objects.get(path) or {}
        if entry.get("sha256") != expected["sha256"]:
            raise RuntimeError(f"Drive index SHA-256 mismatch for {path}")
        if int(entry.get("size_bytes", -1)) != expected["size_bytes"]:
            raise RuntimeError(f"Drive index size mismatch for {path}")
        candidates = drive_blobs.get(expected["sha256"], [])
        candidate = next(
            (
                item
                for item in candidates
                if item.get("id") == entry.get("file_id")
                and int(item.get("size", -1)) == expected["size_bytes"]
            ),
            None,
        )
        if candidate is None:
            raise RuntimeError(f"Drive blob is missing for {path}")
    return True


def migrate_archive(drive, drive_blobs, archive_path, raw, manifest, references):
    with tempfile.TemporaryDirectory(prefix="his-safe-offload-") as temp_dir:
        temp_root = Path(temp_dir)
        sidecar_index = {}
        for number, (path, expected) in enumerate(references.items(), start=1):
            candidates = drive_blobs.get(expected["sha256"], [])
            drive_blob = next(
                (
                    item
                    for item in candidates
                    if int(item.get("size", -1)) == expected["size_bytes"]
                ),
                None,
            )
            if drive_blob is None:
                local_blob = temp_root / f"blob-{number}"
                download_supabase(path, local_blob)
                if local_blob.stat().st_size != expected["size_bytes"]:
                    raise RuntimeError(f"Supabase sidecar size mismatch for {path}")
                if file_digest(local_blob, "sha256") != expected["sha256"]:
                    raise RuntimeError(f"Supabase sidecar SHA-256 mismatch for {path}")
                drive_blob = upload_binary(
                    drive,
                    local_blob,
                    {
                        "name": f"blob-{expected['sha256']}",
                        "parents": [DRIVE_FOLDER_ID],
                        "appProperties": {
                            "his_backup_type": "storage_blob",
                            "his_sha256": expected["sha256"],
                            "his_size_bytes": str(expected["size_bytes"]),
                        },
                    },
                )
                drive_blobs.setdefault(expected["sha256"], []).append(drive_blob)
            sidecar_index[path] = {
                "file_id": drive_blob["id"],
                "size_bytes": expected["size_bytes"],
                "sha256": expected["sha256"],
            }

        index_payload = {
            "format_version": 1,
            "created_at": manifest.get("time") or datetime.now(timezone.utc).isoformat(),
            "total_objects": len(sidecar_index),
            "unique_blobs": len({entry["sha256"] for entry in sidecar_index.values()}),
            "objects": sidecar_index,
        }
        index_path = temp_root / f"{Path(archive_path).stem}-storage-index.json"
        index_path.write_text(json.dumps(index_payload, ensure_ascii=False), encoding="utf-8")
        index_file = upload_binary(
            drive,
            index_path,
            {
                "name": index_path.name,
                "parents": [DRIVE_FOLDER_ID],
                "mimeType": "application/json",
                "appProperties": {
                    "his_backup_type": "storage_index",
                    "his_total_objects": str(len(sidecar_index)),
                    "his_source": archive_path,
                },
            },
            "application/json",
        )

        archive_file = temp_root / Path(archive_path).name
        archive_file.write_bytes(raw)
        uploaded = upload_binary(
            drive,
            archive_file,
            {
                "name": archive_file.name,
                "parents": [DRIVE_FOLDER_ID],
                "mimeType": "application/zip",
                "appProperties": {
                    "his_backup_type": "manifest",
                    "his_backup_scope": "complete_incremental",
                    "his_sidecar_index_id": index_file["id"],
                    "his_sha256": file_digest(archive_file, "sha256"),
                    "his_size_bytes": str(archive_file.stat().st_size),
                    "his_supabase_object": archive_path,
                    "his_tables": str(manifest.get("tables_exported") or len(manifest.get("table_rows") or {})),
                    "his_rows": str(manifest.get("total_rows") or 0),
                    "his_storage_objects": str(len(sidecar_index)),
                },
            },
            "application/zip",
        )
        return uploaded, index_file, list(sidecar_index.values())


def build_cleanup_plan(archives, sidecars, assessment_complete=True):
    """Pure deletion planner used by production code and unit tests."""
    protected = set()
    mirrored_references = set()
    all_references = set()
    archive_deletes = []
    for archive in archives:
        refs = set(archive.get("references") or [])
        all_references.update(refs)
        if archive.get("old") and archive.get("mirrored"):
            archive_deletes.append(archive["path"])
            mirrored_references.update(refs)
        else:
            protected.update(refs)

    existing_sidecars = {item["path"] for item in sidecars}
    sidecar_deletes = sorted((mirrored_references - protected) & existing_sidecars)
    if not assessment_complete:
        sidecar_deletes = []
    orphans = sorted(existing_sidecars - all_references)
    return {
        "archive_deletes": sorted(archive_deletes),
        "sidecar_deletes": sidecar_deletes,
        "orphans_report_only": orphans,
        "protected_sidecars": sorted(protected & existing_sidecars),
    }


def delete_supabase_objects(paths):
    if not paths:
        return 0
    if SUPABASE_BUCKET != "his-backups":
        raise RuntimeError("Cleanup is restricted to the his-backups bucket")
    endpoint = (
        f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET, safe='')}"
    )
    deleted = 0
    for offset in range(0, len(paths), 100):
        batch = paths[offset : offset + 100]
        response = request_with_retry(
            "delete",
            endpoint,
            headers=storage_headers(),
            json={"prefixes": batch},
            timeout=(15, 180),
        )
        if response.status_code not in (200, 204):
            raise RuntimeError(
                f"Supabase cleanup failed: HTTP {response.status_code} {response.text[:200]}"
            )
        deleted += len(batch)
    return deleted


def write_report(report):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / "storage-offload-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report: {report_path}")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("\n## Safe Storage Offload\n\n")
            handle.write(f"- Mode: **{report['mode']}**\n")
            handle.write(f"- Supabase archives: **{report['archive_count']}**\n")
            handle.write(f"- Supabase sidecars: **{report['sidecar_count']}**\n")
            handle.write(f"- Project Storage bytes: **{report['project_storage_bytes']}**\n")
            handle.write(f"- Verified old archives: **{report['verified_old_archives']}**\n")
            handle.write(f"- Planned/deleted objects: **{report['planned_delete_count']}**\n")
            handle.write(f"- Planned reclaim bytes: **{report['planned_delete_bytes']}**\n")
            handle.write(f"- Protected objects: **{report['protected_sidecars']}**\n")
            handle.write(f"- Orphans (report only): **{report['orphan_count']}**\n")


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    if SUPABASE_BUCKET != "his-backups":
        raise RuntimeError("Safe offload is restricted to the his-backups bucket")
    if RETENTION_DAYS < 7:
        raise RuntimeError("SUPABASE_RETENTION_DAYS must be at least 7 days")
    if not DRIVE_FOLDER_ID or not credentials_configured():
        if DRIVE_REQUIRED:
            raise RuntimeError(
                "Google Drive backup credentials/folder are required for safe offload"
            )
        print("Drive is not configured; producing a Supabase inventory only")
        drive = None
        drive_files = []
        drive_blobs = {}
    else:
        drive = build_drive()
        verify_root_folder(drive, DRIVE_FOLDER_ID)
        drive_files = list_drive_files(drive, DRIVE_FOLDER_ID)
        drive_blobs = list_drive_blobs(drive, DRIVE_FOLDER_ID)

    archives = list_supabase_objects("backups") + list_root_archives()
    archives = [item for item in archives if item["path"].lower().endswith(".zip")]
    sidecars = list_supabase_objects("blobs") + list_supabase_objects("snapshots")
    application_buckets = inventory_application_buckets()
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    assessed = []
    failures = []

    for item in sorted(archives, key=lambda value: value["path"]):
        path = item["path"]
        created = object_created_at(item)
        old = created is not None and created < cutoff
        try:
            raw = download_supabase(path)
            manifest, references = parse_archive(raw, path)
            size = len(raw)
            md5 = hashlib.md5(raw).hexdigest()  # nosec B324 - Drive integrity field
            drive_manifest = (
                matching_drive_manifest(
                    drive_files, path, Path(path).name, size, md5
                )
                if drive
                else None
            )
            migrated_now = False
            if old and drive and not drive_manifest and MIGRATION_ENABLED:
                drive_manifest, index_file, _ = migrate_archive(
                    drive, drive_blobs, path, raw, manifest, references
                )
                drive_files.extend([drive_manifest, index_file])
                migrated_now = True
            mirrored = False
            if drive and drive_manifest:
                mirrored = verify_drive_bundle(
                    drive, drive_files, drive_blobs, drive_manifest, references
                )
            assessed.append(
                {
                    "path": path,
                    "created_at": created.isoformat() if created else None,
                    "size_bytes": size,
                    "old": old,
                    "mirrored": mirrored,
                    "migrated_now": migrated_now,
                    "drive_file_id": drive_manifest.get("id") if mirrored else None,
                    "references": sorted(references),
                }
            )
        except Exception as exc:
            failures.append({"path": path, "error": str(exc)})
            assessed.append(
                {
                    "path": path,
                    "created_at": created.isoformat() if created else None,
                    "size_bytes": object_size(item),
                    "old": old,
                    "mirrored": False,
                    "migrated_now": False,
                    "drive_file_id": None,
                    "references": [],
                    "assessment_failed": True,
                }
            )

    # A damaged/unreadable archive may reference any sidecar. We cannot prove
    # that a sidecar is unused until every archive has been parsed, so retain
    # all sidecars whenever assessment is incomplete.
    plan = build_cleanup_plan(assessed, sidecars, assessment_complete=not failures)
    delete_paths = plan["archive_deletes"] + plan["sidecar_deletes"]
    size_by_path = {
        item["path"]: int(item.get("size_bytes") or 0) for item in assessed
    }
    size_by_path.update({item["path"]: object_size(item) for item in sidecars})
    planned_delete_bytes = sum(size_by_path.get(path, 0) for path in delete_paths)
    mode = "audit"
    deleted = 0
    if CLEANUP_ENABLED:
        if CLEANUP_CONFIRMATION != "OFFLOAD_VERIFIED_BACKUPS":
            raise RuntimeError(
                "Cleanup blocked: SUPABASE_CLEANUP_CONFIRMATION must equal "
                "OFFLOAD_VERIFIED_BACKUPS"
            )
        if not DRIVE_RESTORE_VERIFIED:
            raise RuntimeError(
                "Cleanup blocked: run a successful Drive restore dry-run and set "
                "DRIVE_RESTORE_VERIFIED=1"
            )
        if not drive:
            raise RuntimeError("Cleanup blocked: Google Drive is unavailable")
        deleted = delete_supabase_objects(delete_paths)
        mode = "cleanup"
    elif MIGRATION_ENABLED:
        mode = "copy-and-verify"

    report_archives = []
    for item in assessed:
        safe_item = {key: value for key, value in item.items() if key != "references"}
        safe_item["reference_count"] = len(item.get("references") or [])
        report_archives.append(safe_item)
    archive_bytes = sum(item.get("size_bytes", 0) for item in assessed)
    sidecar_bytes = sum(object_size(item) for item in sidecars)
    backup_bucket_bytes = archive_bytes + sidecar_bytes
    project_storage_bytes = backup_bucket_bytes + sum(
        item["size_bytes"] for item in application_buckets
    )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "bucket": SUPABASE_BUCKET,
        "retention_days": RETENTION_DAYS,
        "archive_count": len(archives),
        "sidecar_count": len(sidecars),
        "archive_bytes": archive_bytes,
        "sidecar_bytes": sidecar_bytes,
        "backup_bucket_bytes": backup_bucket_bytes,
        "project_storage_bytes": project_storage_bytes,
        "bucket_summary": [
            {
                "bucket": SUPABASE_BUCKET,
                "public": False,
                "object_count": len(archives) + len(sidecars),
                "size_bytes": backup_bucket_bytes,
            },
            *application_buckets,
        ],
        "verified_old_archives": sum(
            bool(item.get("old") and item.get("mirrored")) for item in assessed
        ),
        "planned_delete_count": len(delete_paths),
        "planned_delete_bytes": planned_delete_bytes,
        "deleted_count": deleted,
        "deleted_bytes": planned_delete_bytes if deleted == len(delete_paths) else 0,
        "protected_sidecars": len(plan["protected_sidecars"]),
        "orphan_count": len(plan["orphans_report_only"]),
        "failures": failures,
        # Do not write patient-bearing object paths to workflow artifacts.
        "archives": report_archives,
        "cleanup_plan": {
            "archive_delete_count": len(plan["archive_deletes"]),
            "sidecar_delete_count": len(plan["sidecar_deletes"]),
            "orphan_report_only_count": len(plan["orphans_report_only"]),
            "protected_sidecar_count": len(plan["protected_sidecars"]),
        },
    }
    write_report(report)
    print(
        f"Safe offload {mode}: {len(archives)} archives, {len(sidecars)} sidecars, "
        f"{len(delete_paths)} verified cleanup candidates, {deleted} deleted"
    )
    if failures:
        print(f"::warning::{len(failures)} archive(s) could not be assessed; they were retained")
    if project_storage_bytes >= WARN_BYTES:
        gib = project_storage_bytes / 1024**3
        print(
            f"::warning::Supabase project Storage is {gib:.2f} GiB, "
            f"above the configured {WARN_BYTES / 1024**3:.2f} GiB threshold"
        )
        if FAIL_ON_STORAGE_WARNING:
            print("::error::Scheduled storage audit exceeded its warning threshold")
            return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"::error::Safe Drive offload failed: {exc}")
        sys.exit(1)
