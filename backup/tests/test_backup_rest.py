import importlib.util
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "backup" / "scripts" / "backup_rest.py"

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "his-backups")

spec = importlib.util.spec_from_file_location("backup_rest_under_test", SCRIPT)
backup_rest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup_rest)


class BackupRestTests(unittest.TestCase):
    def test_refuses_empty_table_discovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(backup_rest, "OUTPUT", Path(tmp)), patch.object(
                backup_rest, "discover_tables", return_value=[]
            ):
                self.assertFalse(backup_rest.main())
                self.assertEqual(list(Path(tmp).glob("backup-*.zip")), [])

    def test_refuses_to_upload_when_any_table_fails(self):
        def export(table):
            if table == "broken_table":
                raise RuntimeError("mock export failure")
            return [{"ID": 1}]

        with tempfile.TemporaryDirectory() as tmp:
            upload = Mock()
            with patch.object(backup_rest, "OUTPUT", Path(tmp)), patch.object(
                backup_rest, "discover_tables", return_value=["good_table", "broken_table"]
            ), patch.object(backup_rest, "export_table", side_effect=export), patch.object(
                backup_rest, "upload_supabase_storage", upload
            ):
                self.assertFalse(backup_rest.main())
                upload.assert_not_called()

    def test_success_archive_contains_typed_json_csv_and_manifest(self):
        rows = [{"ID": 1, "active": True, "meta": {"source": "test"}, "tags": ["a", "b"]}]
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            response = Mock(status_code=200, text="ok")
            with patch.object(backup_rest, "OUTPUT", output), patch.object(
                backup_rest, "discover_tables", return_value=["example_table"]
            ), patch.object(backup_rest, "export_table", return_value=rows), patch.object(
                backup_rest, "ensure_supabase_bucket"
            ), patch.object(
                backup_rest, "upload_supabase_storage", return_value=response
            ), patch.object(
                backup_rest, "verify_supabase_upload", return_value=True
            ), patch.object(backup_rest, "cleanup_supabase_storage", return_value=0):
                self.assertTrue(backup_rest.main())

            zip_path = next(output.glob("backup-*.zip"))
            with zipfile.ZipFile(zip_path) as archive:
                self.assertIn("json/example_table.json", archive.namelist())
                self.assertIn("csv/example_table.csv", archive.namelist())
                self.assertIn("manifest.json", archive.namelist())
                restored = json.loads(archive.read("json/example_table.json"))
                self.assertEqual(restored, rows)

            manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["tables"], 1)
            self.assertEqual(manifest["total_rows"], 1)
            self.assertTrue(manifest["storage_object"])

    def test_storage_upload_failure_fails_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            response = Mock(status_code=500, text="mock upload failure")
            with patch.object(backup_rest, "OUTPUT", Path(tmp)), patch.object(
                backup_rest, "discover_tables", return_value=["example_table"]
            ), patch.object(backup_rest, "export_table", return_value=[{"ID": 1}]), patch.object(
                backup_rest, "ensure_supabase_bucket"
            ), patch.object(
                backup_rest, "upload_supabase_storage", return_value=response
            ), patch.object(backup_rest, "cleanup_supabase_storage", return_value=0):
                self.assertFalse(backup_rest.main())

    def test_export_http_error_is_not_silently_accepted(self):
        response = Mock(status_code=500, text="server error", headers={})
        with patch.object(backup_rest.requests, "get", return_value=response):
            with self.assertRaisesRegex(RuntimeError, "HTTP 500"):
                backup_rest.export_table("example_table")

    def test_cleanup_walks_nested_backup_folders(self):
        def list_response(url, headers, data, timeout):
            prefix = json.loads(data)["prefix"]
            payloads = {
                "backups": [{"name": "2020", "id": None}],
                "backups/2020": [{"name": "01", "id": None}],
                "backups/2020/01": [
                    {
                        "name": "backup-old.zip",
                        "id": "object-id",
                        "created_at": "2020-01-01T00:00:00Z",
                    }
                ],
            }
            return Mock(status_code=200, json=Mock(return_value=payloads[prefix]))

        deleted = Mock(return_value=Mock(status_code=200))
        with patch.object(backup_rest.requests, "post", side_effect=list_response), patch.object(
            backup_rest.requests, "delete", deleted
        ):
            self.assertEqual(backup_rest.cleanup_supabase_storage(), 1)
            self.assertIn("backups/2020/01/backup-old.zip", deleted.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
