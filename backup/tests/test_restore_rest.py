import hashlib
import importlib.util
import io
import json
import os
import unittest
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "backup" / "scripts" / "restore_rest.py"

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")

spec = importlib.util.spec_from_file_location("restore_rest_under_test", SCRIPT)
restore_rest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore_rest)


def make_archive(rows=None, expected_hash=None, storage_payload=None):
    rows = rows if rows is not None else [{"ID": 1, "active": True, "amount": 12.5}]
    table_raw = json.dumps(rows, ensure_ascii=False, indent=2).encode()
    table_hash = expected_hash or hashlib.sha256(table_raw).hexdigest()
    storage_payload = storage_payload if storage_payload is not None else b"patient-file"
    storage_hash = hashlib.sha256(storage_payload).hexdigest()
    manifest = {
        "format_version": 2,
        "table_rows": {"HIS_One_Patients": len(rows), "HIS_One_Settings": 0},
        "table_details": {
            "HIS_One_Patients": {"rows": len(rows), "sha256": table_hash, "restorable": True},
            "HIS_One_Settings": {
                "rows": 0,
                "sha256": hashlib.sha256(b"[]").hexdigest(),
                "restorable": True,
            },
        },
        "storage": {
            "buckets": [
                {
                    "id": "order-result-files",
                    "public": False,
                    "objects": [
                        {
                            "name": "patient/result.pdf",
                            "size_bytes": len(storage_payload),
                            "sha256": storage_hash,
                            "content_type": "application/pdf",
                        }
                    ],
                }
            ]
        },
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("json/HIS_One_Patients.json", table_raw)
        archive.writestr("json/HIS_One_Settings.json", b"[]")
        archive.writestr("storage/order-result-files/patient/result.pdf", storage_payload)
        archive.writestr("manifest.json", json.dumps(manifest))
    return buffer.getvalue()


class RestoreRestTests(unittest.TestCase):
    def test_validates_typed_rows_settings_and_storage(self):
        archive, manifest, tables, storage = restore_rest.validate_archive(make_archive())
        try:
            self.assertIs(tables["HIS_One_Patients"][0]["active"], True)
            self.assertEqual(tables["HIS_One_Patients"][0]["amount"], 12.5)
            self.assertEqual(tables["HIS_One_Settings"], [])
            self.assertEqual(storage[("order-result-files", "patient/result.pdf")], b"patient-file")
            self.assertEqual(manifest["format_version"], 2)
        finally:
            archive.close()

    def test_rejects_table_hash_mismatch_before_restore(self):
        with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
            restore_rest.validate_archive(make_archive(expected_hash="0" * 64))

    def test_rejects_storage_hash_mismatch_before_restore(self):
        blob = make_archive()
        source = zipfile.ZipFile(io.BytesIO(blob))
        manifest = json.loads(source.read("manifest.json"))
        manifest["storage"]["buckets"][0]["objects"][0]["sha256"] = "0" * 64
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as target:
            for name in source.namelist():
                target.writestr(name, json.dumps(manifest) if name == "manifest.json" else source.read(name))
        source.close()
        with self.assertRaisesRegex(RuntimeError, "Storage SHA-256 mismatch"):
            restore_rest.validate_archive(buffer.getvalue())

    def test_dry_run_never_writes_to_rest_api(self):
        rows = {"HIS_One_Patients": [{"ID": 1}], "HIS_One_Settings": []}
        manifest = {"table_details": {}}
        with patch.object(restore_rest, "DRY_RUN", True), patch.object(
            restore_rest.requests, "post"
        ) as post:
            table_count, row_count, skipped = restore_rest.restore_tables(manifest, rows)
        self.assertEqual((table_count, row_count, skipped), (2, 1, []))
        post.assert_not_called()

    def test_actual_restore_requires_confirmation(self):
        with patch.object(restore_rest, "DRY_RUN", False), patch.object(
            restore_rest, "RESTORE_CONFIRMATION", ""
        ):
            with self.assertRaisesRegex(RuntimeError, "RESTORE_CONFIRMATION"):
                restore_rest.main()

    def test_external_storage_snapshot_is_downloaded_and_verified(self):
        blob = make_archive()
        source = zipfile.ZipFile(io.BytesIO(blob))
        manifest = json.loads(source.read("manifest.json"))
        obj = manifest["storage"]["buckets"][0]["objects"][0]
        obj["backup_object"] = "snapshots/2026/07/id/order-result-files/patient/result.pdf"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as target:
            for name in source.namelist():
                if name.startswith("storage/"):
                    continue
                target.writestr(name, json.dumps(manifest) if name == "manifest.json" else source.read(name))
        source.close()

        archive, parsed_manifest, _, storage = restore_rest.validate_archive(buffer.getvalue())
        try:
            response = Mock(status_code=200, content=b"patient-file")
            with patch.object(restore_rest.requests, "get", return_value=response):
                hydrated = restore_rest.hydrate_storage_snapshots(parsed_manifest, storage)
            self.assertEqual(
                hydrated[("order-result-files", "patient/result.pdf")], b"patient-file"
            )
        finally:
            archive.close()

    def test_google_drive_sidecar_is_downloaded_from_drive_index(self):
        backup_object = "snapshots/2026/07/id/order-result-files/patient/result.pdf"
        manifest = {
            "storage": {
                "buckets": [
                    {
                        "id": "order-result-files",
                        "objects": [
                            {
                                "name": "patient/result.pdf",
                                "size_bytes": len(b"patient-file"),
                                "sha256": hashlib.sha256(b"patient-file").hexdigest(),
                                "backup_object": backup_object,
                            }
                        ],
                    }
                ]
            }
        }
        storage = {("order-result-files", "patient/result.pdf"): None}
        index = {
            backup_object: {
                "file_id": "drive-sidecar-id",
                "size_bytes": len(b"patient-file"),
                "sha256": hashlib.sha256(b"patient-file").hexdigest(),
            }
        }
        response = Mock(status_code=200, content=b"patient-file")
        with patch.object(restore_rest, "BACKUP_SOURCE", "gdrive"), patch.object(
            restore_rest, "GDRIVE_SIDECAR_INDEX", index
        ), patch.object(
            restore_rest, "GDRIVE_ACCESS_TOKEN", "access-token"
        ), patch.object(
            restore_rest, "request_with_retry", return_value=response
        ) as request:
            hydrated = restore_rest.hydrate_storage_snapshots(manifest, storage)

        self.assertEqual(
            hydrated[("order-result-files", "patient/result.pdf")], b"patient-file"
        )
        self.assertIn("drive/v3/files/drive-sidecar-id", request.call_args.args[1])

    def test_drive_dry_run_streams_snapshot_without_retaining_bytes(self):
        backup_object = "snapshots/2026/07/id/order-result-files/patient/result.pdf"
        payload = b"patient-file"
        manifest = {
            "storage": {
                "buckets": [
                    {
                        "id": "order-result-files",
                        "objects": [
                            {
                                "name": "patient/result.pdf",
                                "size_bytes": len(payload),
                                "sha256": hashlib.sha256(payload).hexdigest(),
                                "backup_object": backup_object,
                            }
                        ],
                    }
                ]
            }
        }
        storage = {("order-result-files", "patient/result.pdf"): None}
        index = {
            backup_object: {
                "file_id": "drive-sidecar-id",
                "size_bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        }
        response = Mock(status_code=200)
        response.iter_content.return_value = [payload[:4], payload[4:]]
        with patch.object(restore_rest, "BACKUP_SOURCE", "gdrive"), patch.object(
            restore_rest, "GDRIVE_SIDECAR_INDEX", index
        ), patch.object(
            restore_rest, "GDRIVE_ACCESS_TOKEN", "access-token"
        ), patch.object(
            restore_rest, "DRY_RUN", True
        ), patch.object(
            restore_rest, "request_with_retry", return_value=response
        ) as request:
            hydrated = restore_rest.hydrate_storage_snapshots(manifest, storage)

        self.assertIsNone(hydrated[("order-result-files", "patient/result.pdf")])
        self.assertTrue(request.call_args.kwargs["stream"])
        response.iter_content.assert_called_once_with(chunk_size=1024 * 1024)

    def test_database_only_drive_restore_skips_storage_hydration_and_writes(self):
        with patch.object(restore_rest, "BACKUP_SOURCE", "gdrive"), patch.object(
            restore_rest, "GDRIVE_DATABASE_ONLY", True
        ), patch.object(restore_rest, "DRY_RUN", True), patch.object(
            restore_rest, "download_zip", return_value=make_archive()
        ), patch.object(
            restore_rest, "hydrate_storage_snapshots"
        ) as hydrate, patch.object(
            restore_rest, "restore_storage", wraps=restore_rest.restore_storage
        ) as storage_restore:
            self.assertTrue(restore_rest.main())

        hydrate.assert_not_called()
        self.assertEqual(storage_restore.call_args.args[1], {})


if __name__ == "__main__":
    unittest.main()
