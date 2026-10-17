#!/usr/bin/env python3
"""Copy aged UXI result files to a patient-organized, verified Drive archive.

This job only copies. The private Supabase source files are never deleted.
The complete HIS backup also captures the UXI tables and Storage bucket.
"""

import hashlib
import json
import mimetypes
import os
import re
import tempfile
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, unquote

import requests

from gdrive_common import build_drive, credentials_configured
from gdrive_upload import (
    dated_drive_folder_path,
    ensure_drive_folder_path,
    upload_binary,
    verify_root_folder,
)


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = os.environ.get("UXI_RESULT_BUCKET", "uxi-results") or "uxi-results"
DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "")
ARCHIVE_AFTER_DAYS = int(os.environ.get("UXI_ARCHIVE_AFTER_DAYS", "14") or "14")
MAX_OBJECTS = int(os.environ.get("UXI_ARCHIVE_MAX_OBJECTS", "0") or "0")
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "output"))

ORDER_TABLE = "UXI_One_main_imaging_orders"
RETRY_STATUSES = {408, 425, 429, 500, 502, 503, 504, 520}


def request_with_retry(method, url, attempts=5, **kwargs):
    last_error = None
    for attempt in range(attempts):
        try:
            response = requests.request(method, url, **kwargs)
            if response.status_code not in RETRY_STATUSES:
                return response
            last_error = RuntimeError(f"HTTP {response.status_code}")
            response.close()
        except requests.RequestException as exc:
            last_error = exc
        if attempt + 1 < attempts:
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
        raise RuntimeError("UXI Storage folder nesting exceeds the safe limit")
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
            raise RuntimeError(f"UXI Storage inventory failed: HTTP {response.status_code}")
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError("UXI Storage inventory returned invalid data")
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


def order_id_from_path(path):
    parts = str(path or "").split("/")
    if len(parts) != 2 or any(part in {"", ".", ".."} for part in parts):
        return ""
    order_id = unquote(parts[0])
    return order_id if re.fullmatch(r"[A-Za-z0-9_-]{1,80}", order_id) else ""


def normalize_age(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        age = value
    elif isinstance(value, float) and value.is_integer():
        age = int(value)
    elif isinstance(value, str) and re.fullmatch(r"\d{1,3}", value.strip()):
        age = int(value.strip())
    else:
        return None
    return age if 0 <= age <= 150 else None


def build_patient_metadata_index(order_rows):
    index = {}
    ambiguous = set()
    for row in order_rows:
        order_id = str(row.get("id") or "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", order_id):
            continue
        cn = str(row.get("cn") or "").strip()
        patient = row.get("patient") if isinstance(row.get("patient"), dict) else {}
        name = str(patient.get("name") or "").strip()
        age = normalize_age(patient.get("age"))
        if not cn or not name or age is None:
            continue
        identity = {"patient_id": cn, "patient_name": name, "age": age}
        for result in row.get("result_files") or []:
            if not isinstance(result, dict):
                continue
            path = str(result.get("storagePath") or "")
            if not path or len(path) > 1024 or "\\" in path or "\0" in path:
                continue
            parts = path.split("/")
            if len(parts) != 2 or any(part in {"", ".", ".."} for part in parts):
                continue
            if unquote(parts[0]) != order_id:
                # A conflicting order-to-path reference makes patient identity unsafe.
                ambiguous.add(path)
                continue
            if path in index and index[path] != identity:
                ambiguous.add(path)
            else:
                index[path] = identity
    for path in ambiguous:
        index.pop(path, None)
    return index


def fetch_order_patient_metadata(order_ids):
    order_ids = sorted({str(value) for value in order_ids if value})
    rows = []
    endpoint = f"{SUPABASE_URL}/rest/v1/{quote(ORDER_TABLE, safe='')}"
    for offset in range(0, len(order_ids), 100):
        batch = order_ids[offset : offset + 100]
        for order_id in batch:
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", order_id):
                raise RuntimeError("Invalid UXI order identifier in Storage path")
        response = request_with_retry(
            "get",
            endpoint,
            headers=storage_headers(),
            params={
                "select": "id,cn,patient,result_files",
                "id": "in.(" + ",".join(batch) + ")",
                "limit": str(len(batch)),
            },
            timeout=(15, 120),
        )
        if response.status_code != 200:
            raise RuntimeError(f"UXI order metadata lookup failed: HTTP {response.status_code}")
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError("UXI order metadata lookup returned invalid data")
        rows.extend(payload)
    return build_patient_metadata_index(rows)


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


def escape_query(value):
    return str(value).replace("\\", "\\\\").replace("'", "\\'")


def list_drive_archives(drive):
    safe_folder = escape_query(DRIVE_FOLDER_ID)
    query = (
        f"('{safe_folder}' in parents or appProperties has "
        f"{{ key='his_archive_root_id' and value='{safe_folder}' }}) and "
        "appProperties has { key='his_archive_type' and value='uxi_result' } and "
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


def safe_component(value, limit=64):
    normalized = unicodedata.normalize("NFKC", str(value or "")).strip()
    output = []
    previous_separator = False
    for char in normalized:
        if char.isalnum():
            output.append(char)
            previous_separator = False
        elif char in {"-", "_"} and output:
            output.append(char)
            previous_separator = False
        elif output and not previous_separator:
            output.append("_")
            previous_separator = True
    return "".join(output).strip("_-")[:limit].strip("_-")


def archive_drive_filename(patient_identity, object_path, content_sha256):
    patient_id = safe_component(patient_identity.get("patient_id"))
    patient_name = safe_component(patient_identity.get("patient_name"))
    age = normalize_age(patient_identity.get("age"))
    if not patient_id or not patient_name or age is None:
        raise RuntimeError("UXI result file has no valid patient identity")
    suffix = Path(object_path).suffix.lower()
    if not suffix or len(suffix) > 10 or not suffix[1:].isalnum():
        suffix = ".bin"
    if not re.fullmatch(r"[0-9a-f]{64}", str(content_sha256 or "")):
        raise RuntimeError("UXI result content hash is invalid")
    return f"HN-{patient_id}_{patient_name}_{age}y_{content_sha256[:12]}{suffix}"


def download_object(path, destination):
    endpoint = (
        f"{SUPABASE_URL}/storage/v1/object/{quote(BUCKET, safe='')}/"
        f"{quote(path, safe='/')}"
    )
    for attempt in range(3):
        response = request_with_retry(
            "get",
            endpoint,
            attempts=3,
            headers=storage_headers("application/octet-stream"),
            stream=True,
            timeout=(15, 600),
        )
        try:
            if response.status_code != 200:
                raise RuntimeError(f"UXI Storage download failed: HTTP {response.status_code}")
            with open(destination, "wb") as handle:
                for chunk in response.iter_content(chunk_size=8 * 1024 * 1024):
                    if chunk:
                        handle.write(chunk)
            return
        except requests.RequestException:
            if attempt >= 2:
                raise
            time.sleep(min(2**attempt, 15))
        finally:
            response.close()


def digest_file(path, algorithm):
    digest = hashlib.new(algorithm)
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def content_type(item):
    metadata = item.get("metadata") or {}
    return str(metadata.get("mimetype") or metadata.get("contentType") or "application/octet-stream")[:120]


def upload_archive_copy(drive, item, patient_identity):
    digest = path_hash(item["path"])
    suffix = Path(item["path"]).suffix.lower()
    if not suffix or len(suffix) > 10 or not suffix[1:].isalnum():
        suffix = mimetypes.guess_extension(content_type(item)) or ".bin"
    with tempfile.TemporaryDirectory(prefix="his-uxi-archive-") as temp_dir:
        local_path = Path(temp_dir) / f"source{suffix}"
        download_object(item["path"], local_path)
        if local_path.stat().st_size != object_size(item):
            raise RuntimeError("Downloaded UXI object size does not match Storage metadata")
        sha256 = digest_file(local_path, "sha256")
        archive_folder_id = ensure_drive_folder_path(
            drive,
            DRIVE_FOLDER_ID,
            dated_drive_folder_path("UXI Backup", datetime.now(timezone.utc)),
        )
        uploaded = upload_binary(
            drive,
            local_path,
            {
                "name": archive_drive_filename(patient_identity, item["path"], sha256),
                "parents": [archive_folder_id],
                "mimeType": content_type(item),
                "appProperties": {
                    "his_archive_type": "uxi_result",
                    "his_archive_root_id": DRIVE_FOLDER_ID,
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
            raise RuntimeError("Google Drive verification failed for UXI result copy")
        return uploaded


def write_report(report):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / "uxi-result-archive-report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("\n## UXI Result Archive\n\n")
            for label, key in (
                ("Supabase Storage objects", "storage_object_count"),
                ("Eligible objects", "eligible_object_count"),
                ("Verified Google Drive copies", "verified_copy_count"),
                ("Copied now", "copied_now_count"),
                ("Unmapped identity records", "unmapped_object_count"),
                ("Transfer failures", "failure_count"),
            ):
                handle.write(f"- {label}: **{report[key]}**\n")
            handle.write("\nSource files in Supabase were not deleted.\n")


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    if BUCKET != "uxi-results":
        raise RuntimeError("UXI archive is restricted to the uxi-results bucket")
    if ARCHIVE_AFTER_DAYS < 7:
        raise RuntimeError("UXI_ARCHIVE_AFTER_DAYS must be at least 7")
    if MAX_OBJECTS < 0:
        raise RuntimeError("UXI_ARCHIVE_MAX_OBJECTS cannot be negative")
    if not DRIVE_FOLDER_ID or not credentials_configured():
        raise RuntimeError("Google Drive credentials and folder are required")

    drive = build_drive()
    verify_root_folder(drive, DRIVE_FOLDER_ID)
    drive_index = index_drive_files(list_drive_archives(drive))
    objects = list_objects()
    cutoff = datetime.now(timezone.utc) - timedelta(days=ARCHIVE_AFTER_DAYS)
    candidates, unknown_age = select_candidates(objects, cutoff)
    pending = [
        item for item in candidates
        if matching_drive_copy(item, drive_index.get(path_hash(item["path"]), [])) is None
    ]
    order_ids = {order_id_from_path(item["path"]) for item in pending}
    if "" in order_ids:
        order_ids.remove("")
    patient_index = fetch_order_patient_metadata(order_ids) if order_ids else {}

    verified = 0
    copied_now = 0
    unmapped = 0
    failures = []
    for item in candidates:
        digest = path_hash(item["path"])
        if matching_drive_copy(item, drive_index.get(digest, [])) is not None:
            verified += 1
            continue
        patient_identity = patient_index.get(item["path"])
        if patient_identity is None:
            unmapped += 1
            continue
        try:
            uploaded = upload_archive_copy(drive, item, patient_identity)
            drive_index.setdefault(digest, []).append(uploaded)
            if matching_drive_copy(item, drive_index[digest]) is None:
                raise RuntimeError("Uploaded UXI result copy failed metadata verification")
            verified += 1
            copied_now += 1
        except Exception as exc:
            failures.append({
                "source_path_sha256": digest,
                "error_type": type(exc).__name__,
            })

    report = {
        "system": "UXI",
        "mode": "copy",
        "archive_after_days": ARCHIVE_AFTER_DAYS,
        "storage_object_count": len(objects),
        "unknown_age_object_count": unknown_age,
        "eligible_object_count": len(candidates),
        "eligible_bytes": sum(object_size(item) for item in candidates),
        "verified_copy_count": verified,
        "copied_now_count": copied_now,
        "unmapped_object_count": unmapped,
        "failure_count": len(failures),
        "failures": failures,
        "source_deletes": 0,
    }
    write_report(report)
    print(
        f"UXI archive copy: {len(objects)} objects, {len(candidates)} eligible, "
        f"{verified} verified, {copied_now} copied, {unmapped} unmapped, "
        f"{len(failures)} failed; 0 source files deleted"
    )
    if failures or unmapped:
        raise RuntimeError("UXI archive is incomplete; source files remain safely in Supabase")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"::error::UXI result archive failed: {type(exc).__name__}")
        raise