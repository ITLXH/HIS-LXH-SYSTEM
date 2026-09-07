"""One-off, hash-locked offload of Supabase backup sidecars to Google Drive.

Default mode is read-only.  Apply mode removes objects only from the
``his-backups`` bucket after every retained manifest reference has a Drive
blob with the same SHA-256 and size.  Application buckets and database tables
are read-only and are compared before and after deletion.
"""

import hashlib
import io
import json
import os
import re
import zipfile
from pathlib import Path
from urllib.parse import quote

import requests

from gdrive_common import build_drive


URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET") or "his-backups"
DRIVE_FOLDER = os.environ["GOOGLE_DRIVE_FOLDER_ID"]

assert URL == "https://pzyrowzghrcfpmhkreag.supabase.co", "Unexpected project"
assert BUCKET == "his-backups", "Unexpected backup bucket"
assert DRIVE_FOLDER == "1svbM0oba83r6Pi8wPl4noF0WLcB-d0s3", "Unexpected Drive folder"

HEADERS = {"apikey": KEY, "Authorization": "Bearer " + KEY}
ROOT = URL + "/storage/v1"


def request(method, path, **kwargs):
    response = requests.request(
        method,
        ROOT + path,
        headers=HEADERS,
        timeout=(15, 120),
        **kwargs,
    )
    if response.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"Storage API {method} failed: HTTP {response.status_code}"
        )
    return response


def inventory(bucket, prefix="", depth=0):
    assert depth < 20
    result = {}
    offset = 0
    while True:
        items = request(
            "POST",
            "/object/list/" + quote(bucket, safe=""),
            json={
                "prefix": prefix,
                "limit": 1000,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            },
        ).json()
        assert isinstance(items, list), "Invalid listing"
        for item in items:
            assert item.get("name"), "Unnamed object"
            name = prefix + "/" + item["name"] if prefix else item["name"]
            if item.get("id") is None:
                result.update(inventory(bucket, name, depth + 1))
            else:
                assert name not in result
                result[name] = item
        if len(items) < 1000:
            return result
        offset += len(items)


def size(item):
    value = int(item["metadata"]["size"])
    assert value >= 0
    return value


def fingerprint(item):
    return [item["id"], item.get("updated_at"), size(item)]


def drive_blobs():
    drive = build_drive()
    files = []
    page_token = None
    while True:
        response = (
            drive.files()
            .list(
                q=f"'{DRIVE_FOLDER}' in parents and trashed = false",
                fields="nextPageToken,files(id,name,size,appProperties)",
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


def validate_manifest(name, content, objects, drive_by_sha):
    refs = {}
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert archive.testzip() is None, "Archive CRC failed"
        manifest = json.loads(archive.read("manifest.json"))
        assert not manifest.get("failed_tables"), "Incomplete backup"
        assert manifest.get("format_version") == 3, "Unexpected manifest format"
        assert manifest.get("backup_scope") == "application-data-settings-and-storage"
        assert manifest.get("storage", {}).get("enabled") is True
        assert manifest.get("table_details"), "Missing table verification metadata"
        for table, details in manifest["table_details"].items():
            raw = archive.read("json/" + table + ".json")
            assert hashlib.sha256(raw).hexdigest() == details["sha256"], "Table hash failed"

        counted = 0
        for source_bucket in manifest["storage"]["buckets"]:
            assert source_bucket["id"] != BUCKET
            for obj in source_bucket["objects"]:
                path = obj["backup_object"]
                sha = obj["sha256"]
                expected_size = int(obj["size_bytes"])
                assert path.startswith(("snapshots/", "blobs/sha256/"))
                assert path in objects, f"Retained backup references missing object: {path}"
                assert size(objects[path]) == expected_size, "Supabase blob size mismatch"
                assert re.fullmatch("[a-f0-9]{64}", sha)
                copies = drive_by_sha.get(sha, [])
                assert any(int(item.get("size", -1)) == expected_size for item in copies), (
                    f"Drive blob missing or wrong size: {sha}"
                )
                existing = refs.setdefault(path, [sha, expected_size])
                assert existing == [sha, expected_size], "Conflicting manifest reference"
                counted += 1
        assert counted == manifest["storage"]["total_objects"]
    return refs


def main():
    objects = inventory(BUCKET)
    archives = sorted(
        name
        for name in objects
        if name.startswith("backups/") and name.endswith(".zip")
    )
    assert archives, "No retained backup archives"
    drive_by_sha = drive_blobs()
    refs = {}
    for index, name in enumerate(archives):
        content = request(
            "GET", "/object/" + BUCKET + "/" + quote(name, safe="/")
        ).content
        current = validate_manifest(name, content, objects, drive_by_sha)
        for path, identity in current.items():
            existing = refs.setdefault(path, identity)
            assert existing == identity, "Conflicting retained references"
        print(f"Validated Drive coverage for archive {index + 1}/{len(archives)}", flush=True)

    all_sidecars = sorted(
        name
        for name in objects
        if name.startswith(("snapshots/", "blobs/sha256/"))
    )
    candidates = sorted(refs)
    unreferenced = sorted(set(all_sidecars) - set(refs))
    assert candidates, "No Drive-verified Supabase backup sidecars found"

    plan = {name: fingerprint(objects[name]) for name in candidates}
    digest = hashlib.sha256(
        json.dumps(plan, sort_keys=True).encode("utf-8")
    ).hexdigest()
    unique_shas = {identity[0] for identity in refs.values()}
    report = {
        "plan_sha256": digest,
        "retained_archives": len(archives),
        "drive_verified_unique_blobs": len(unique_shas),
        "delete_objects": len(plan),
        "delete_bytes": sum(size(objects[name]) for name in plan),
        "preserved_unreferenced_objects": len(unreferenced),
        "preserved_unreferenced_bytes": sum(size(objects[name]) for name in unreferenced),
    }
    print(json.dumps(report, indent=2), flush=True)
    Path("drive-offload-cleanup-report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )

    if os.environ.get("CLEANUP_APPLY", "false") != "true":
        print("AUDIT ONLY: nothing deleted", flush=True)
        return

    assert os.environ.get("EXPECTED_PLAN_SHA256") == digest, (
        "Plan changed; rerun audit"
    )

    buckets = request("GET", "/bucket").json()
    originals = {
        bucket["id"]: inventory(bucket["id"])
        for bucket in buckets
        if bucket["id"] != BUCKET
    }
    refreshed = inventory(BUCKET)
    assert {name: fingerprint(item) for name, item in refreshed.items()} == {
        name: fingerprint(item) for name, item in objects.items()
    }, "Backup inventory changed"

    for offset in range(0, len(candidates), 100):
        batch = candidates[offset : offset + 100]
        request("DELETE", "/object/" + BUCKET, json={"prefixes": batch})
        print(
            f"Offload deletion completed: {min(offset + 100, len(candidates))}/{len(candidates)}",
            flush=True,
        )

    after = inventory(BUCKET)
    assert not set(plan).intersection(after), "Some offloaded sidecars remain"
    for name, item in objects.items():
        if name not in plan:
            assert name in after and fingerprint(after[name]) == fingerprint(item), (
                "Protected backup archive changed"
            )
    for bucket, before in originals.items():
        current = inventory(bucket)
        for name, item in before.items():
            assert name in current and fingerprint(current[name]) == fingerprint(item), (
                "Original object changed"
            )

    report.update(
        {
            "verified_deleted_bytes": report["delete_bytes"],
            "verified_deleted_objects": len(plan),
            "original_buckets_unchanged": True,
            "remaining_backup_bytes": sum(size(item) for item in after.values()),
        }
    )
    Path("drive-offload-cleanup-report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
