import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backup" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

spec = importlib.util.spec_from_file_location(
    "gdrive_upload_under_test", SCRIPTS / "gdrive_upload.py"
)
gdrive_upload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gdrive_upload)


class GoogleDriveUploadTests(unittest.TestCase):
    def test_legacy_database_upload_is_database_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"database-zip")
            (output / "manifest.json").write_text(
                json.dumps(
                    {
                        "tables": 54,
                        "total_rows": 51687,
                        "storage_objects": 380,
                        "storage_object": "backups/2026/08/backup-production.zip",
                        "failed_tables": [],
                    }
                ),
                encoding="utf-8",
            )
            uploaded = {
                "id": "drive-file-id",
                "size": str(zip_path.stat().st_size),
                "md5Checksum": gdrive_upload.md5_file(zip_path),
                "webViewLink": "https://drive.test/database",
            }

            with patch.object(gdrive_upload, "build_drive", return_value=Mock()), patch.object(
                gdrive_upload, "verify_root_folder"
            ), patch.object(gdrive_upload, "upload_binary", return_value=uploaded) as upload:
                result = gdrive_upload.upload_database_backup(zip_path, "root-folder")

            metadata = upload.call_args.args[2]
            self.assertEqual(metadata["appProperties"]["his_backup_scope"], "database_only")
            self.assertNotIn("his_sidecar_index_id", metadata["appProperties"])
            self.assertEqual(result["sidecars"], 0)
            self.assertEqual(result["scope"], "database_only")
            self.assertEqual(upload.call_count, 1)

    def test_complete_upload_reuses_existing_blob_and_creates_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"database-zip")
            storage_raw = b"patient-result"
            storage_sha = gdrive_upload.hashlib.sha256(storage_raw).hexdigest()
            (output / "manifest.json").write_text(
                json.dumps(
                    {
                        "tables": 54,
                        "total_rows": 51687,
                        "storage_object": "backups/2026/09/backup.zip",
                        "failed_tables": [],
                    }
                ),
                encoding="utf-8",
            )
            (output / "archive-manifest.json").write_text(
                json.dumps(
                    {
                        "backup_scope": "application-data-settings-and-storage",
                        "time": "2026-09-06T01:00:00Z",
                        "storage": {
                            "enabled": True,
                            "buckets": [
                                {
                                    "id": "order-result-files",
                                    "objects": [
                                        {
                                            "name": "patient/result.pdf",
                                            "size_bytes": len(storage_raw),
                                            "sha256": storage_sha,
                                            "backup_object": f"blobs/sha256/aa/{storage_sha}",
                                        }
                                    ],
                                }
                            ],
                        },
                    }
                ),
                encoding="utf-8",
            )
            existing = {
                storage_sha: [
                    {"id": "existing-blob", "size": str(len(storage_raw))}
                ]
            }
            uploads = [
                {
                    "id": "index-id",
                    "size": "1",
                    "md5Checksum": "index",
                },
                {
                    "id": "manifest-id",
                    "size": str(zip_path.stat().st_size),
                    "md5Checksum": gdrive_upload.md5_file(zip_path),
                    "webViewLink": "https://drive.test/complete",
                },
            ]
            with patch.object(gdrive_upload, "build_drive", return_value=Mock()), patch.object(
                gdrive_upload, "verify_root_folder"
            ), patch.object(
                gdrive_upload, "list_drive_blobs", return_value=existing
            ), patch.object(
                gdrive_upload, "upload_binary", side_effect=uploads
            ) as upload:
                result = gdrive_upload.upload_complete_bundle(zip_path, "root-folder")

            self.assertEqual(result["scope"], "complete_incremental")
            self.assertEqual(result["sidecars"], 1)
            self.assertEqual(result["uploaded_sidecars"], 0)
            self.assertEqual(upload.call_count, 2)
            manifest_metadata = upload.call_args_list[1].args[2]
            self.assertEqual(
                manifest_metadata["appProperties"]["his_sidecar_index_id"], "index-id"
            )

    def test_complete_upload_supports_parallel_blob_workers(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"database-zip")
            blobs = {
                gdrive_upload.hashlib.sha256(raw).hexdigest(): raw
                for raw in (b"first", b"second")
            }
            (output / "manifest.json").write_text(
                json.dumps({"tables": 1, "total_rows": 1, "failed_tables": []}),
                encoding="utf-8",
            )
            objects = [
                {
                    "name": f"{sha}.bin",
                    "size_bytes": len(raw),
                    "sha256": sha,
                    "backup_object": f"blobs/sha256/{sha[:2]}/{sha}",
                }
                for sha, raw in blobs.items()
            ]
            (output / "archive-manifest.json").write_text(
                json.dumps(
                    {
                        "backup_scope": "application-data-settings-and-storage",
                        "time": "2026-09-06T01:00:00Z",
                        "storage": {
                            "enabled": True,
                            "buckets": [{"id": "results", "objects": objects}],
                        },
                    }
                ),
                encoding="utf-8",
            )

            def materialize(_output_dir, _bucket, obj, temp_dir):
                path = Path(temp_dir) / obj["sha256"]
                path.write_bytes(blobs[obj["sha256"]])
                return path

            def upload(_drive, path, metadata, _content_type=None):
                kind = metadata["appProperties"]["his_backup_type"]
                return {
                    "id": f"{kind}-{metadata['name']}",
                    "size": str(path.stat().st_size),
                    "md5Checksum": gdrive_upload.md5_file(path),
                    "webViewLink": "https://drive.test/file",
                }

            with patch.dict(os.environ, {"GDRIVE_UPLOAD_WORKERS": "2"}), patch.object(
                gdrive_upload, "build_drive", return_value=Mock()
            ), patch.object(gdrive_upload, "verify_root_folder"), patch.object(
                gdrive_upload, "list_drive_blobs", return_value={}
            ), patch.object(
                gdrive_upload, "_materialize_blob", side_effect=materialize
            ), patch.object(gdrive_upload, "upload_binary", side_effect=upload):
                result = gdrive_upload.upload_complete_bundle(zip_path, "root-folder")

            self.assertEqual(result["sidecars"], 2)
            self.assertEqual(result["uploaded_sidecars"], 2)
            self.assertEqual(result["uploaded_bytes"], len(b"first") + len(b"second"))

    def test_materialized_supabase_blob_is_hash_verified(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            raw = b"verified-storage"
            obj = {
                "name": "patient/result.pdf",
                "size_bytes": len(raw),
                "sha256": gdrive_upload.hashlib.sha256(raw).hexdigest(),
                "backup_object": "blobs/sha256/aa/verified",
            }

            def fake_download(_backup_object, destination):
                Path(destination).write_bytes(raw)

            with patch.object(
                gdrive_upload, "_download_supabase_blob", side_effect=fake_download
            ):
                path = gdrive_upload._materialize_blob(
                    output, "order-result-files", obj, tmp
                )
            self.assertEqual(path.read_bytes(), raw)

    def test_materialized_supabase_blob_rejects_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            obj = {
                "name": "patient/result.pdf",
                "size_bytes": 7,
                "sha256": "0" * 64,
                "backup_object": "blobs/sha256/aa/bad",
            }

            def fake_download(_backup_object, destination):
                Path(destination).write_bytes(b"corrupt")

            with patch.object(
                gdrive_upload, "_download_supabase_blob", side_effect=fake_download
            ):
                with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                    gdrive_upload._materialize_blob(
                        output, "order-result-files", obj, tmp
                    )

    def test_manifest_rejects_empty_database_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"zip")
            (output / "manifest.json").write_text(
                json.dumps({"tables": 0, "failed_tables": []}), encoding="utf-8"
            )

            with self.assertRaisesRegex(RuntimeError, "no exported tables"):
                gdrive_upload.load_manifest(zip_path)

    def test_manifest_rejects_failed_table_exports(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"zip")
            (output / "manifest.json").write_text(
                json.dumps({"tables": 54, "failed_tables": ["patients"]}),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(RuntimeError, "failed table exports"):
                gdrive_upload.load_manifest(zip_path)


if __name__ == "__main__":
    unittest.main()
