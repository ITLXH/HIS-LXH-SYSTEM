#!/usr/bin/env python3
"""Upload a complete, incremental HIS backup to Google Drive.

The database/settings ZIP is uploaded for every snapshot. Application Storage
objects are stored once by SHA-256 and referenced by a small sidecar index.
Existing Supabase backup blobs are only read; this script never deletes or
modifies production data.

Usage: python gdrive_upload.py <zip_path> <folder_id>
Env: GOOGLE_DRIVE_OAUTH_JSON or GOOGLE_SERVICE_ACCOUNT_JSON
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET
"""

import hashlib
import json
import mimetypes
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

import requests

from gdrive_common import (
    build_drive,
    credentials_configured,
    drive_create,
    drive_delete,
    drive_get,
)


def file_digest(path, algorithm="md5"):
    digest = hashlib.new(algorithm)
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def md5_file(path):
    # Drive exposes MD5 for ordinary binary uploads.
    return file_digest(path, "md5")  # nosec B324


def upload_binary(drive, path, metadata, content_type=None):
    from googleapiclient.http import MediaFileUpload

    media = MediaFileUpload(
        str(path),
        mimetype=content_type or "application/octet-stream",
        chunksize=8 * 1024 * 1024,
        resumable=True,
    )
    result = drive_create(
        drive,
        body=metadata,
        media_body=media,
        fields="id,name,size,md5Checksum,webViewLink,appProperties",
    )
    expected_size = path.stat().st_size
    expected_md5 = md5_file(path)
    if int(result.get("size", -1)) != expected_size:
        raise RuntimeError(f"Drive size verification failed for {path.name}")
    if result.get("md5Checksum") != expected_md5:
        raise RuntimeError(f"Drive MD5 verification failed for {path.name}")
    return result


def load_summary_manifest(zip_path):
    output_dir = Path(os.environ.get("OUTPUT_DIR", "") or zip_path.parent)
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError(f"Backup manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if int(manifest.get("tables") or 0) <= 0:
        raise RuntimeError("Database backup manifest contains no exported tables")
    if manifest.get("failed_tables"):
        raise RuntimeError("Database backup manifest contains failed table exports")
    return manifest


# Compatibility alias for existing callers.
load_manifest = load_summary_manifest


def load_archive_manifest(zip_path):
    output_dir = Path(os.environ.get("OUTPUT_DIR", "") or zip_path.parent)
    manifest_path = output_dir / "archive-manifest.json"
    if not manifest_path.exists():
        raise RuntimeError(f"Complete archive manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    storage = manifest.get("storage") or {}
    if manifest.get("backup_scope") != "application-data-settings-and-storage":
        raise RuntimeError("Archive is not a complete application backup")
    if not storage.get("enabled"):
        raise RuntimeError("Application Storage backup is not enabled")
    return manifest


def _escape_query(value):
    return str(value).replace("\\", "\\\\").replace("'", "\\'")


def verify_root_folder(drive, folder_id):
    metadata = drive_get(
        drive,
        fileId=folder_id,
        fields="id,name,mimeType,trashed,capabilities(canAddChildren)",
    )
    if metadata.get("trashed"):
        raise RuntimeError("Google Drive backup folder is in Trash")
    if metadata.get("mimeType") != "application/vnd.google-apps.folder":
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID does not identify a folder")
    if not (metadata.get("capabilities") or {}).get("canAddChildren", False):
        raise RuntimeError("Google Drive credentials cannot write to the backup folder")
    return metadata


def list_drive_blobs(drive, folder_id):
    query = f"'{_escape_query(folder_id)}' in parents and trashed=false"
    files = []
    page_token = None
    while True:
        response = (
            drive.files()
            .list(
                q=query,
                fields=(
                    "nextPageToken,files("
                    "id,name,size,md5Checksum,appProperties,webViewLink)"
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
            break

    by_sha = {}
    for item in files:
        props = item.get("appProperties") or {}
        sha = props.get("his_sha256")
        if props.get("his_backup_type") == "storage_blob" and sha:
            by_sha.setdefault(sha, []).append(item)
    return by_sha


def iter_storage_objects(archive_manifest):
    for bucket in (archive_manifest.get("storage") or {}).get("buckets", []):
        bucket_id = bucket.get("id")
        for obj in bucket.get("objects", []):
            if not obj.get("backup_object") or not obj.get("sha256"):
                raise RuntimeError(
                    f"Incomplete Storage manifest entry: {bucket_id}/{obj.get('name', '')}"
                )
            yield bucket_id, obj


def _local_storage_path(output_dir, bucket_id, object_name):
    candidate = (output_dir / "storage" / bucket_id / Path(object_name)).resolve()
    storage_root = (output_dir / "storage").resolve()
    if storage_root not in candidate.parents:
        raise RuntimeError(f"Unsafe Storage object path: {bucket_id}/{object_name}")
    return candidate


def _download_supabase_blob(backup_object, destination):
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "his-backups") or "his-backups"
    if not supabase_url or not service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Drive Storage upload"
        )
    url = (
        f"{supabase_url}/storage/v1/object/{quote(bucket, safe='')}/"
        f"{quote(backup_object, safe='/')}"
    )
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    with requests.get(url, headers=headers, stream=True, timeout=(15, 300)) as response:
        if response.status_code != 200:
            raise RuntimeError(
                f"Supabase backup blob download failed: HTTP {response.status_code} "
                f"{response.text[:200]}"
            )
        with open(destination, "wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)


def _materialize_blob(output_dir, bucket_id, obj, temp_dir):
    local_path = _local_storage_path(output_dir, bucket_id, obj["name"])
    if local_path.is_file():
        candidate = local_path
    else:
        candidate = Path(temp_dir) / obj["sha256"]
        _download_supabase_blob(obj["backup_object"], candidate)

    expected_size = int(obj["size_bytes"])
    if candidate.stat().st_size != expected_size:
        raise RuntimeError(f"Storage size mismatch before Drive upload: {bucket_id}/{obj['name']}")
    if file_digest(candidate, "sha256") != obj["sha256"]:
        raise RuntimeError(f"Storage SHA-256 mismatch before Drive upload: {bucket_id}/{obj['name']}")
    return candidate


def upload_database_backup(zip_path, root_folder_id):
    """Upload the legacy database-only copy."""
    if not root_folder_id:
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is required")
    manifest = load_summary_manifest(zip_path)
    drive = build_drive()
    verify_root_folder(drive, root_folder_id)
    uploaded = None
    drive_name = Path(manifest.get("storage_object") or zip_path.name).name
    try:
        uploaded = upload_binary(
            drive,
            zip_path,
            {
                "name": drive_name,
                "parents": [root_folder_id],
                "mimeType": "application/zip",
                "appProperties": {
                    "his_backup_type": "manifest",
                    "his_backup_scope": "database_only",
                    "his_tables": str(manifest.get("tables", 0)),
                    "his_rows": str(manifest.get("total_rows", 0)),
                },
            },
            "application/zip",
        )
        return {
            "file_id": uploaded["id"],
            "url": uploaded.get(
                "webViewLink", f"https://drive.google.com/file/d/{uploaded['id']}/view"
            ),
            "snapshot_folder_id": "",
            "sidecars": 0,
            "uploaded_sidecars": 0,
            "uploaded_bytes": 0,
            "scope": "database_only",
        }
    except Exception:
        if uploaded:
            try:
                drive_delete(drive, uploaded["id"])
            except Exception:
                pass
        raise


def upload_complete_bundle(zip_path, root_folder_id):
    """Upload and verify a full Drive snapshot with deduplicated Storage files."""
    if not root_folder_id:
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is required")

    summary = load_summary_manifest(zip_path)
    archive = load_archive_manifest(zip_path)
    drive = build_drive()
    verify_root_folder(drive, root_folder_id)
    existing = list_drive_blobs(drive, root_folder_id)
    output_dir = Path(os.environ.get("OUTPUT_DIR", "") or zip_path.parent)
    sidecar_index = {}
    uploaded_count = 0
    uploaded_bytes = 0

    objects = list(iter_storage_objects(archive))
    unique_objects = {}
    objects_by_sha = {}
    for bucket_id, obj in objects:
        unique_objects.setdefault(obj["sha256"], (bucket_id, obj))
        objects_by_sha.setdefault(obj["sha256"], []).append((bucket_id, obj))

    with tempfile.TemporaryDirectory(prefix="his-drive-") as temp_dir:
        for completed, (sha, (bucket_id, obj)) in enumerate(unique_objects.items(), start=1):
            expected_size = int(obj["size_bytes"])
            candidates = existing.get(sha, [])
            drive_blob = next(
                (item for item in candidates if int(item.get("size", -1)) == expected_size),
                None,
            )
            if not drive_blob:
                local_path = _materialize_blob(output_dir, bucket_id, obj, temp_dir)
                content_type = obj.get("content_type") or mimetypes.guess_type(obj["name"])[0]
                drive_blob = upload_binary(
                    drive,
                    local_path,
                    {
                        "name": f"blob-{sha}",
                        "parents": [root_folder_id],
                        "mimeType": content_type or "application/octet-stream",
                        "appProperties": {
                            "his_backup_type": "storage_blob",
                            "his_sha256": sha,
                            "his_size_bytes": str(expected_size),
                        },
                    },
                    content_type,
                )
                existing.setdefault(sha, []).append(drive_blob)
                uploaded_count += 1
                uploaded_bytes += expected_size
                if local_path.parent == Path(temp_dir):
                    local_path.unlink(missing_ok=True)

            for _source_bucket, source_obj in objects_by_sha[sha]:
                sidecar_index[source_obj["backup_object"]] = {
                    "file_id": drive_blob["id"],
                    "size_bytes": int(source_obj["size_bytes"]),
                    "sha256": sha,
                }
            if completed % 25 == 0 or completed == len(unique_objects):
                print(
                    f"    Drive Storage verified: {completed}/{len(unique_objects)} unique blobs "
                    f"({uploaded_count} uploaded)"
                )

        index_payload = {
            "format_version": 1,
            "created_at": archive.get("time"),
            "total_objects": len(sidecar_index),
            "unique_blobs": len(unique_objects),
            "objects": sidecar_index,
        }
        index_path = Path(temp_dir) / f"{zip_path.stem}-storage-index.json"
        index_path.write_text(json.dumps(index_payload, ensure_ascii=False), encoding="utf-8")
        index_file = upload_binary(
            drive,
            index_path,
            {
                "name": index_path.name,
                "parents": [root_folder_id],
                "mimeType": "application/json",
                "appProperties": {
                    "his_backup_type": "storage_index",
                    "his_total_objects": str(len(sidecar_index)),
                    "his_unique_blobs": str(len(unique_objects)),
                },
            },
            "application/json",
        )

    try:
        drive_name = Path(summary.get("storage_object") or zip_path.name).name
        manifest_file = upload_binary(
            drive,
            zip_path,
            {
                "name": drive_name,
                "parents": [root_folder_id],
                "mimeType": "application/zip",
                "appProperties": {
                    "his_backup_type": "manifest",
                    "his_backup_scope": "complete_incremental",
                    "his_sidecar_index_id": index_file["id"],
                    "his_tables": str(summary.get("tables", 0)),
                    "his_rows": str(summary.get("total_rows", 0)),
                    "his_storage_objects": str(len(sidecar_index)),
                },
            },
            "application/zip",
        )
    except Exception:
        drive_delete(drive, index_file["id"])
        raise

    return {
        "file_id": manifest_file["id"],
        "url": manifest_file.get(
            "webViewLink", f"https://drive.google.com/file/d/{manifest_file['id']}/view"
        ),
        "snapshot_folder_id": "",
        "sidecars": len(sidecar_index),
        "uploaded_sidecars": uploaded_count,
        "uploaded_bytes": uploaded_bytes,
        "scope": "complete_incremental",
    }


def write_outputs(result):
    output_path = os.environ.get("GITHUB_OUTPUT", "")
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(f"drive_url={result['url']}\n")
        handle.write(f"drive_file_id={result['file_id']}\n")
        handle.write(f"drive_snapshot_folder_id={result['snapshot_folder_id']}\n")
        handle.write(f"drive_sidecars={result['sidecars']}\n")
        handle.write(f"drive_uploaded_sidecars={result['uploaded_sidecars']}\n")
        handle.write(f"drive_uploaded_bytes={result['uploaded_bytes']}\n")
        handle.write(f"drive_scope={result['scope']}\n")


def main():
    if len(sys.argv) < 3:
        print("Usage: gdrive_upload.py <file_path> <folder_id>")
        return 1
    zip_path = Path(sys.argv[1])
    folder_id = sys.argv[2].strip()
    if not zip_path.is_file():
        print(f"::error::File not found: {zip_path}")
        return 1
    if not credentials_configured():
        print("::error::Google Drive credentials are not configured")
        return 1

    try:
        result = upload_complete_bundle(zip_path, folder_id)
        write_outputs(result)
        print(
            f"Uploaded complete incremental backup to Google Drive: {result['url']} "
            f"({result['sidecars']} Storage objects, {result['uploaded_sidecars']} new blobs)"
        )
        return 0
    except Exception as exc:
        print(f"::error::Google Drive complete backup failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
