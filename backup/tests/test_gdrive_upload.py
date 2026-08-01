import importlib.util
import json
import os
import sys
import tempfile
import unittest
import zipfile
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
    def test_safe_local_path_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(RuntimeError, "Unsafe"):
                gdrive_upload.safe_local_path(Path(tmp), "bucket", "../secret.txt")

    def test_complete_bundle_uploads_sidecars_index_and_main_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            (output / "storage" / "results" / "patient").mkdir(parents=True)
            (output / "storage" / "results" / "patient" / "scan.pdf").write_bytes(b"pdf")
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"zip")
            manifest = {
                "storage_object": "backups/2026/07/backup-unique.zip",
                "storage_objects": 1,
                "storage": {
                    "snapshot_id": "20260731_150037",
                    "buckets": [
                        {
                            "id": "results",
                            "objects": [
                                {
                                    "name": "patient/scan.pdf",
                                    "size_bytes": 3,
                                    "sha256": "hash",
                                    "content_type": "application/pdf",
                                    "backup_object": "snapshots/id/results/patient/scan.pdf",
                                }
                            ],
                        }
                    ],
                },
            }
            (output / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

            created = [
                {"id": "folder-id", "name": "folder"},
                {"id": "sidecar-id", "size": "3", "md5Checksum": "mock"},
                {"id": "index-id", "size": "1", "md5Checksum": "mock"},
                {
                    "id": "main-id",
                    "size": "3",
                    "md5Checksum": "mock",
                    "webViewLink": "https://drive.test/main-id",
                },
            ]

            def fake_binary(_drive, path, metadata, content_type=None):
                result = created.pop(0)
                result.setdefault("name", metadata["name"])
                return result

            with patch.object(gdrive_upload, "build_drive", return_value=Mock()), patch.object(
                gdrive_upload, "get_or_create_blob_pool", return_value={"id": "pool-id"}
            ), patch.object(gdrive_upload, "list_blob_pool", return_value={}), patch.object(
                gdrive_upload, "drive_create", return_value=created.pop(0)
            ), patch.object(gdrive_upload, "upload_binary", side_effect=fake_binary):
                result = gdrive_upload.upload_complete_bundle(zip_path, "root-folder")

            self.assertEqual(result["file_id"], "main-id")
            self.assertEqual(result["sidecars"], 1)
            self.assertEqual(result["new_blobs"], 1)
            self.assertEqual(result["snapshot_folder_id"], "folder-id")

    def test_complete_bundle_reuses_one_blob_for_duplicate_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            for name in ("first.pdf", "second.pdf"):
                path = output / "storage" / "results" / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"pdf")
            zip_path = output / "backup.zip"
            zip_path.write_bytes(b"zip")
            objects = [
                {
                    "name": name,
                    "size_bytes": 3,
                    "sha256": "same-hash",
                    "content_type": "application/pdf",
                    "backup_object": f"snapshots/id/results/{name}",
                }
                for name in ("first.pdf", "second.pdf")
            ]
            (output / "manifest.json").write_text(
                json.dumps(
                    {
                        "storage_object": "backups/backup.zip",
                        "storage_objects": 2,
                        "storage": {
                            "snapshot_id": "snapshot-id",
                            "buckets": [{"id": "results", "objects": objects}],
                        },
                    }
                ),
                encoding="utf-8",
            )
            binary_results = [
                {"id": "blob-id", "size": "3"},
                {"id": "index-id", "size": "1"},
                {"id": "main-id", "size": "3"},
            ]

            with patch.object(gdrive_upload, "build_drive", return_value=Mock()), patch.object(
                gdrive_upload, "get_or_create_blob_pool", return_value={"id": "pool-id"}
            ), patch.object(gdrive_upload, "list_blob_pool", return_value={}), patch.object(
                gdrive_upload, "drive_create", return_value={"id": "folder-id"}
            ), patch.object(
                gdrive_upload, "upload_binary", side_effect=binary_results
            ) as upload:
                result = gdrive_upload.upload_complete_bundle(zip_path, "root-folder")

            self.assertEqual(result["sidecars"], 2)
            self.assertEqual(result["new_blobs"], 1)
            self.assertEqual(upload.call_count, 3)

    def test_load_manifest_recovers_storage_inventory_from_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            storage = {
                "snapshot_id": "snapshot-1",
                "buckets": [
                    {
                        "id": "results",
                        "objects": [
                            {
                                "name": "patient/scan.pdf",
                                "size_bytes": 3,
                                "sha256": "hash",
                                "backup_object": "snapshots/id/results/patient/scan.pdf",
                            }
                        ],
                    }
                ],
            }
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("manifest.json", json.dumps({"storage": storage}))
            (output / "manifest.json").write_text(
                json.dumps({"storage_objects": 1}), encoding="utf-8"
            )

            _, manifest = gdrive_upload.load_manifest(zip_path)

            self.assertEqual(manifest["storage"], storage)

    def test_load_manifest_rejects_missing_sidecar_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            zip_path = output / "backup.zip"
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("manifest.json", json.dumps({"storage": {}}))
            (output / "manifest.json").write_text(
                json.dumps({"storage_objects": 1}), encoding="utf-8"
            )

            with self.assertRaisesRegex(RuntimeError, "sidecar manifest mismatch"):
                gdrive_upload.load_manifest(zip_path)


if __name__ == "__main__":
    unittest.main()
