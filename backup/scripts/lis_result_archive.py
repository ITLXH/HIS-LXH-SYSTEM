#!/usr/bin/env python3
"""Archive old LIS result files from Supabase Storage to Google Drive safely.

The workflow is fail-closed: application files are deleted only in cleanup mode,
after each object has a verified Drive copy, after the production read gateway
has passed a restore drill, and after an exact cleanup confirmation is supplied.
Reports contain aggregate counts and hashes, never patient-bearing object paths.
"""

import hashlib
import json
import mimetypes
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests

from gdrive_common import build_drive, credentials_configured
from gdrive_upload import upload_binary, verify_root_folder


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = os.environ.get("LIS_RESULT_BUCKET", "order-result-files") or "order-result-files"
DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
MODE = (os.environ.get("LIS_ARCHIVE_MODE", "audit") or "audit").strip().lower()
ARCHIVE_AFTER_DAYS = int(os.environ.get("LIS_ARCHIVE_AFTER_DAYS", "14") or "14")
MAX_OBJECTS = int(os.environ.get("LIS_ARCHIVE_MAX_OBJECTS", "0") or "0")
CLEANUP_CONFIRMATION = os.environ.get("LIS_ARCHIVE_CLEANUP_CONFIRMATION", "")
RESTORE_VERIFIED = os.environ.get("LIS_ARCHIVE_RESTORE_VERIFIED", "0") == "1"
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "output"))


def request_with_retry(method, url, attempts=5, **kwargs):
    last_error = None
    for attempt in range(attempts):
        try:
            response = requests.request(method, url, **kwargs)
            if response.status_code not in {429, 500, 502, 503, 504}:
                return response
            last_error = RuntimeError(f"HTTP {response.status_code}")
        except requests.RequestException as exc:
            last_error = exc
        if attempt + 1 < attempts:
            import time

            time.sleep(min(2**attempt, 15))
    raise RuntimeError(f"Request failed after {attempts} attempts: {last_error}")


def storage_headers(content_type="application/json"):
    return {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": content_type,
    }


def list_objects(prefix="", depth=0):
    if depth > 20:
        raise RuntimeError("Storage folder nesting exceeds the safe limit")
    endpoint = f"{SUPABASE_URL}/storage/v1/object/list/{quote(BUCKET, safe='')}"
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
            raise RuntimeError(f"Storage inventory failed: HTTP {response.status_code}")
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError("Storage inventory returned invalid data")
        for item in payload:
            name = str(item.get("name") or "")
            if not name:
                continue
            path = f"{prefix}/{name}" if prefix else name
            if item.get("id") is None:
                found.extend(list_objects(path, depth + 1))
            else:
                copied = dict(item)
                copied["path"] = path
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
            continue
    return 0


def object_timestamp(item):
    value = item.get("created_at") or item.get("updated_at") or item.get("created")
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def path_hash(path):
    return hashlib.sha256(f"{BUCKET}/{path}".encode("utf-8")).hexdigest()


def source_version(item):
    metadata = item.get("metadata") or {}
    value = (
        metadata.get("eTag")
        or metadata.get("etag")
        or metadata.get("lastModified")
        or item.get("updated_at")
        or item.get("created_at")
        or ""
    )
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def content_type(item):
    metadata = item.get("metadata") or {}
    return str(metadata.get("mimetype") or metadata.get("contentType") or "application/octet-stream")[:120]


def escape_query(value):
    return str(value).replace("\\", "\\\\").replace("'", "\\'")


def list_drive_archives(drive):
    query = (
        f"'{escape_query(DRIVE_FOLDER_ID)}' in parents and "
        "appProperties has { key='his_archive_type' and value='lis_result' } and "
        "trashed=false"
    )
    files = []
    page_token = None
    while True:
        response = (
            drive.files()
            .list(
                q=query,
                fields="nextPageToken,files(id,name,size,md5Checksum,mimeType,appProperties,trashed)",
                pageSize=1000,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files.extend(response.get("files") or [])
        page_token = response.get("nextPageToken")
        if not page_token:
            return files


def index_drive_files(files):
    index = {}
    for item in files:
        props = item.get("appProperties") or {}
        digest = props.get("his_source_path_sha256")
        if digest:
            index.setdefault(digest, []).append(item)
    return index


def matching_drive_copy(item, candidates):
    expected_size = object_size(item)
    expected_version = source_version(item)
    for candidate in candidates:
        props = candidate.get("appProperties") or {}
        try:
            drive_size = int(candidate.get("size", -1))
            property_size = int(props.get("his_source_size", -1))
        except (TypeError, ValueError):
            continue
        if (
            drive_size == expected_size
            and property_size == expected_size
            and props.get("his_source_version") == expected_version
            and len(str(props.get("his_sha256") or "")) == 64
            and candidate.get("md5Checksum")
        ):
            return candidate
    return None


def download_object(path, destination):
    endpoint = (
        f"{SUPABASE_URL}/storage/v1/object/{quote(BUCKET, safe='')}/"
        f"{quote(path, safe='/')}"
    )
    response = request_with_retry(
        "get",
        endpoint,
        headers=storage_headers("application/octet-stream"),
        stream=True,
        timeout=(15, 600),
    )
    if response.status_code != 200:
        raise RuntimeError(f"Storage download failed: HTTP {response.status_code}")
    with open(destination, "wb") as handle:
        for chunk in response.iter_content(chunk_size=8 * 1024 * 1024):
            if chunk:
                handle.write(chunk)


def digest_file(path, algorithm):
    digest = hashlib.new(algorithm)
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def upload_archive_copy(drive, item):
    digest = path_hash(item["path"])
    suffix = Path(item["path"]).suffix.lower()
    if not suffix or len(suffix) > 10 or not suffix[1:].isalnum():
        suffix = mimetypes.guess_extension(content_type(item)) or ".bin"
    with tempfile.TemporaryDirectory(prefix="his-lis-archive-") as temp_dir:
        local_path = Path(temp_dir) / f"source{suffix}"
        download_object(item["path"], local_path)
        if local_path.stat().st_size != object_size(item):
            raise RuntimeError("Downloaded object size does not match Storage metadata")
        sha256 = digest_file(local_path, "sha256")
        uploaded = upload_binary(
            drive,
            local_path,
            {
                "name": f"lis-result-{digest}{suffix}",
                "parents": [DRIVE_FOLDER_ID],
                "mimeType": content_type(item),
                "appProperties": {
                    "his_archive_type": "lis_result",
                    "his_source_bucket": BUCKET,
                    "his_source_path_sha256": digest,
                    "his_source_size": str(object_size(item)),
                    "his_source_version": source_version(item),
                    "his_content_type": content_type(item),
                    "his_sha256": sha256,
                },
            },
            content_type(item),
        )
        props = uploaded.get("appProperties") or {}
        if (
            int(uploaded.get("size", -1)) != local_path.stat().st_size
            or uploaded.get("md5Checksum") != digest_file(local_path, "md5")
            or props.get("his_sha256") != sha256
        ):
            raise RuntimeError("Drive verification failed after upload")
        return uploaded


def delete_objects(paths):
    if not paths:
        return 0
    endpoint = f"{SUPABASE_URL}/storage/v1/object/{quote(BUCKET, safe='')}"
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
        if response.status_code not in {200, 204}:
            raise RuntimeError(f"Storage cleanup failed: HTTP {response.status_code}")
        deleted += len(batch)
    return deleted


def deleted_bytes_for_report(delete_targets, deleted, verified_bytes):
    if delete_targets and deleted == len(delete_targets):
        return verified_bytes
    return 0


def select_candidates(objects, cutoff):
    candidates = []
    unknown_age = 0
    for item in objects:
        created = object_timestamp(item)
        if created is None:
            unknown_age += 1
            continue
        if created < cutoff:
            candidates.append(item)
    candidates.sort(key=lambda item: object_timestamp(item) or datetime.max.replace(tzinfo=timezone.utc))
    if MAX_OBJECTS > 0:
        candidates = candidates[:MAX_OBJECTS]
    return candidates, unknown_age


def write_report(report):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / "lis-result-archive-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report: {report_path}")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("\n## LIS Result Archive\n\n")
            for label, key in (
                ("Mode", "mode"),
                ("Storage objects", "storage_object_count"),
                ("Eligible objects", "eligible_object_count"),
                ("Eligible bytes", "eligible_bytes"),
                ("Verified Drive copies", "verified_copy_count"),
                ("Copied now", "copied_now_count"),
                ("Deleted from Supabase", "deleted_count"),
                ("Failures", "failure_count"),
            ):
                handle.write(f"- {label}: **{report[key]}**\n")


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    if BUCKET != "order-result-files":
        raise RuntimeError("LIS archive is restricted to the order-result-files bucket")
    if MODE not in {"audit", "copy", "cleanup"}:
        raise RuntimeError("LIS_ARCHIVE_MODE must be audit, copy, or cleanup")
    if ARCHIVE_AFTER_DAYS < 7:
        raise RuntimeError("LIS_ARCHIVE_AFTER_DAYS must be at least 7")
    if MAX_OBJECTS < 0:
        raise RuntimeError("LIS_ARCHIVE_MAX_OBJECTS cannot be negative")
    if not DRIVE_FOLDER_ID or not credentials_configured():
        raise RuntimeError("Google Drive credentials and folder are required")
    if MODE == "cleanup":
        if CLEANUP_CONFIRMATION != "ARCHIVE_VERIFIED_ORDER_RESULTS":
            raise RuntimeError("Cleanup confirmation is missing or incorrect")
        if not RESTORE_VERIFIED:
            raise RuntimeError("Cleanup blocked until the production Drive fallback is verified")

    drive = build_drive()
    verify_root_folder(drive, DRIVE_FOLDER_ID)
    drive_index = index_drive_files(list_drive_archives(drive))
    objects = list_objects()
    cutoff = datetime.now(timezone.utc) - timedelta(days=ARCHIVE_AFTER_DAYS)
    candidates, unknown_age = select_candidates(objects, cutoff)
    failures = []
    verified = []
    copied_now = 0

    for item in candidates:
        digest = path_hash(item["path"])
        try:
            match = matching_drive_copy(item, drive_index.get(digest, []))
            if match is None and MODE in {"copy", "cleanup"}:
                match = upload_archive_copy(drive, item)
                drive_index.setdefault(digest, []).append(match)
                copied_now += 1
            if match is not None:
                verified.append(item)
        except Exception as exc:
            failures.append({"path_sha256": digest, "error": str(exc)[:300]})

    delete_targets = []
    if MODE == "cleanup":
        if failures:
            raise RuntimeError("Cleanup blocked because one or more archive copies failed")
        if len(verified) != len(candidates):
            raise RuntimeError("Cleanup blocked because not every eligible object is verified")
        delete_targets = [item["path"] for item in verified]
    deleted = delete_objects(delete_targets)

    total_bytes = sum(object_size(item) for item in objects)
    eligible_bytes = sum(object_size(item) for item in candidates)
    verified_bytes = sum(object_size(item) for item in verified)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": MODE,
        "bucket": BUCKET,
        "archive_after_days": ARCHIVE_AFTER_DAYS,
        "max_objects": MAX_OBJECTS,
        "storage_object_count": len(objects),
        "storage_bytes": total_bytes,
        "eligible_object_count": len(candidates),
        "eligible_bytes": eligible_bytes,
        "unknown_age_count": unknown_age,
        "verified_copy_count": len(verified),
        "verified_copy_bytes": verified_bytes,
        "copied_now_count": copied_now,
        "planned_delete_count": len(delete_targets),
        "planned_delete_bytes": verified_bytes if delete_targets else 0,
        "deleted_count": deleted,
        "deleted_bytes": deleted_bytes_for_report(
            delete_targets, deleted, verified_bytes
        ),
        "failure_count": len(failures),
        "failures": failures,
    }
    write_report(report)
    print(
        f"LIS archive {MODE}: {len(objects)} objects, {len(candidates)} eligible, "
        f"{len(verified)} verified, {copied_now} copied, {deleted} deleted"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"::error::LIS result archive failed: {exc}")
        sys.exit(1)
