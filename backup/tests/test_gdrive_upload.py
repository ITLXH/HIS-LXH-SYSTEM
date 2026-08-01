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
    def test_upload_is_database_only_and_does_not_upload_storage_sidecars(self):
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
                gdrive_upload, "upload_binary", return_value=uploaded
            ) as upload:
                result = gdrive_upload.upload_database_backup(zip_path, "root-folder")

            metadata = upload.call_args.args[2]
            self.assertEqual(metadata["appProperties"]["his_backup_scope"], "database_only")
            self.assertNotIn("his_sidecar_index_id", metadata["appProperties"])
            self.assertEqual(result["sidecars"], 0)
            self.assertEqual(result["scope"], "database_only")
            self.assertEqual(upload.call_count, 1)

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
