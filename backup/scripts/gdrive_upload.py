#!/usr/bin/env python3
"""Upload a complete HIS backup bundle to Google Drive.

The database ZIP is stored in the configured root folder so the web UI can
list it. Application Storage files are uploaded into a dedicated sidecar
folder, with an index referenced by Drive appProperties on the ZIP. This makes
Drive an independent restore source instead of relying on Supabase sidecars.

Usage: python gdrive_upload.py <zip_path> <folder_id>
Env: GOOGLE_DRIVE_OAUTH_JSON or GOOGLE_SERVICE_ACCOUNT_JSON
"""

import hashlib
import json
import mimetypes
import os
import sys
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path, PurePosixPath

from gdrive_common import build_drive, credentials_configured, drive_create, drive_delete


WORKERS = max(1, min(12, int(os.environ.get("GDRIVE_STORAGE_WORKERS", "6"))))
_thread_local = threading.local()


def md5_file(path):
    digest = hashlib.md5()  # nosec B324 - Drive exposes MD5 for upload verification
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_local_path(storage_root, bucket_id, object_name):
    relative = PurePosixPath(bucket_id) / PurePosixPath(object_name)
    if relative.is_absolute() or ".." in relative.parts or "\\" in object_name:
        raise RuntimeError(f"Unsafe Storage object path: {bucket_id}/{object_name}")
    root = storage_root.resolve()
    candidate = root.joinpath(*relative.parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise RuntimeError(f"Storage path escaped output directory: {object_name}") from exc
    return candidate


def worker_drive():
    if not getattr(_thread_local, "drive", None):
        _thread_local.drive = build_drive()
    return _thread_local.drive


def upload_binary(drive, path, metadata, content_type=None):
    from googleapiclient.http import MediaFileUpload

    media = MediaFileUpload(
        str(path),
        mimetype=content_type or "application/octet-stream",
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


def load_manifest(zip_path):
    output_dir = Path(os.environ.get("OUTPUT_DIR", "") or zip_path.parent)
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError(f"Backup manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    # backup_rest.py keeps the detailed Storage inventory in the archive's
    # manifest.json.  The small workflow manifest beside the ZIP contains only
    # aggregate counts, so recover the detailed inventory before uploading the
    # independent Drive sidecars.
    if not manifest.get("storage"):
        try:
            with zipfile.ZipFile(zip_path, "r") as archive:
                archive_manifest = json.loads(
                    archive.read("manifest.json").decode("utf-8")
                )
        except (
            KeyError,
            OSError,
            UnicodeDecodeError,
            json.JSONDecodeError,
            zipfile.BadZipFile,
        ) as exc:
            if int(manifest.get("storage_objects") or 0):
                raise RuntimeError(
                    "Backup reports application Storage objects but its detailed "
                    "Storage manifest could not be read"
                ) from exc
        else:
            if archive_manifest.get("storage"):
                manifest["storage"] = archive_manifest["storage"]

    expected_objects = int(manifest.get("storage_objects") or 0)
    storage = manifest.get("storage") or {}
    detailed_objects = sum(
        len(bucket.get("objects", [])) for bucket in storage.get("buckets", [])
    )
    if expected_objects != detailed_objects:
        raise RuntimeError(
            "Google Drive sidecar manifest mismatch: "
            f"backup reports {expected_objects} objects but {detailed_objects} are listed"
        )

    return output_dir, manifest


def upload_complete_bundle(zip_path, root_folder_id):
    if not root_folder_id:
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is required")

    output_dir, manifest = load_manifest(zip_path)
    storage = manifest.get("storage") or {}
    snapshot_id = storage.get("snapshot_id") or zip_path.stem
    root_drive = build_drive()
    snapshot_folder = None
    main_file = None

    try:
        snapshot_folder = drive_create(
            root_drive,
            body={
                "name": f"HIS sidecars {snapshot_id}",
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [root_folder_id],
                "appProperties": {
                    "his_backup_type": "sidecars",
                    "his_snapshot_id": snapshot_id,
                },
            },
            fields="id,name,webViewLink",
        )
        sidecar_folder_id = snapshot_folder["id"]

        tasks = []
        for bucket in storage.get("buckets", []):
            for obj in bucket.get("objects", []):
                tasks.append((bucket["id"], obj))

        def upload_sidecar(task):
            bucket_id, obj = task
            local_path = safe_local_path(output_dir / "storage", bucket_id, obj["name"])
            if not local_path.is_file():
                raise RuntimeError(f"Storage sidecar missing locally: {bucket_id}/{obj['name']}")
            content_type = obj.get("content_type") or mimetypes.guess_type(obj["name"])[0]
            result = upload_binary(
                worker_drive(),
                local_path,
                {
                    "name": Path(obj["name"]).name or "storage-object",
                    "parents": [sidecar_folder_id],
                    "appProperties": {
                        "his_backup_type": "sidecar",
                        "his_snapshot_id": snapshot_id,
                    },
                },
                content_type,
            )
            if int(result["size"]) != int(obj["size_bytes"]):
                raise RuntimeError(f"Manifest size mismatch for {bucket_id}/{obj['name']}")
            return obj["backup_object"], {
                "file_id": result["id"],
                "size_bytes": obj["size_bytes"],
                "sha256": obj["sha256"],
                "bucket": bucket_id,
                "name": obj["name"],
            }

        sidecar_index = {}
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = [pool.submit(upload_sidecar, task) for task in tasks]
            for completed, future in enumerate(as_completed(futures), start=1):
                backup_object, entry = future.result()
                sidecar_index[backup_object] = entry
                if completed % 25 == 0 or completed == len(futures):
                    print(f"  Drive sidecars uploaded and verified: {completed}/{len(futures)}")

        index_path = output_dir / "gdrive-sidecars.json"
        index_payload = {
            "format_version": 1,
            "snapshot_id": snapshot_id,
            "total_objects": len(sidecar_index),
            "objects": sidecar_index,
        }
        index_path.write_text(
            json.dumps(index_payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        index_file = upload_binary(
            root_drive,
            index_path,
            {
                "name": "sidecars.json",
                "parents": [sidecar_folder_id],
                "appProperties": {
                    "his_backup_type": "sidecar_index",
                    "his_snapshot_id": snapshot_id,
                },
            },
            "application/json",
        )

        drive_name = Path(manifest.get("storage_object") or zip_path.name).name
        main_file = upload_binary(
            root_drive,
            zip_path,
            {
                "name": drive_name,
                "parents": [root_folder_id],
                "mimeType": "application/zip",
                "appProperties": {
                    "his_backup_type": "manifest",
                    "his_snapshot_id": snapshot_id,
                    "his_sidecar_index_id": index_file["id"],
                    "his_sidecar_folder_id": sidecar_folder_id,
                },
            },
            "application/zip",
        )
        return {
            "file_id": main_file["id"],
            "url": main_file.get(
                "webViewLink", f"https://drive.google.com/file/d/{main_file['id']}/view"
            ),
            "snapshot_folder_id": sidecar_folder_id,
            "sidecars": len(sidecar_index),
        }
    except Exception:
        if main_file:
            try:
                drive_delete(root_drive, main_file["id"])
            except Exception:
                pass
        if snapshot_folder:
            try:
                drive_delete(root_drive, snapshot_folder["id"])
            except Exception:
                pass
        raise


def write_outputs(result):
    output_path = os.environ.get("GITHUB_OUTPUT", "")
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(f"drive_url={result['url']}\n")
        handle.write(f"drive_file_id={result['file_id']}\n")
        handle.write(f"drive_snapshot_folder_id={result['snapshot_folder_id']}\n")
        handle.write(f"drive_sidecars={result['sidecars']}\n")


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
    except Exception as exc:
        print(f"::error::Google Drive complete backup failed: {exc}")
        return 1
    print(
        f"Uploaded complete backup to Google Drive: {result['url']} "
        f"({result['sidecars']} sidecars verified)"
    )
    write_outputs(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
