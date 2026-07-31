import importlib.util
import hashlib
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
    def test_transient_502_is_retried(self):
        transient = Mock(status_code=502, text="temporary gateway error")
        success = Mock(status_code=200, text="ok")
        with patch.object(
            backup_rest.requests, "get", side_effect=[transient, success]
        ) as request, patch.object(backup_rest.time, "sleep") as sleep:
            response = backup_rest.request_with_retry("get", "https://example.test/file")

        self.assertIs(response, success)
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)

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
                "snapshots": [],
            }
            return Mock(status_code=200, json=Mock(return_value=payloads[prefix]))

        deleted = Mock(return_value=Mock(status_code=200))
        with patch.object(backup_rest.requests, "post", side_effect=list_response), patch.object(
            backup_rest.requests, "delete", deleted
        ):
            self.assertEqual(backup_rest.cleanup_supabase_storage(), 1)
            self.assertIn("backups/2020/01/backup-old.zip", deleted.call_args.args[0])

    def test_required_customer_and_settings_tables_are_enforced(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(backup_rest, "OUTPUT", Path(tmp)), patch.object(
                backup_rest, "REQUIRED_TABLES", ["HIS_One_Patients", "HIS_One_Settings"]
            ), patch.object(
                backup_rest, "discover_tables", return_value=["HIS_One_Patients"]
            ):
                self.assertFalse(backup_rest.main())

    def test_application_storage_objects_are_downloaded_with_hashes(self):
        bucket_response = Mock(
            status_code=200,
            json=Mock(return_value=[{"id": "order-result-files", "public": False}]),
        )
        object_response = Mock(status_code=200, content=b"result-pdf")
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(backup_rest, "OUTPUT", Path(tmp)), patch.object(
                backup_rest, "INCLUDE_STORAGE", True
            ), patch.object(
                backup_rest.requests, "get", side_effect=[bucket_response, object_response]
            ), patch.object(
                backup_rest,
                "list_storage_objects",
                return_value=[("patients/result.pdf", {"metadata": {"mimetype": "application/pdf"}})],
            ):
                result = backup_rest.backup_storage_buckets()

            self.assertEqual(result["total_objects"], 1)
            self.assertEqual(result["total_bytes"], len(b"result-pdf"))
            self.assertEqual(
                result["buckets"][0]["objects"][0]["sha256"],
                hashlib.sha256(b"result-pdf").hexdigest(),
            )
            self.assertEqual(
                (Path(tmp) / "storage" / "order-result-files" / "patients" / "result.pdf").read_bytes(),
                b"result-pdf",
            )

    def test_storage_snapshots_are_uploaded_as_sidecars(self):
        storage_backup = {
            "enabled": True,
            "total_objects": 1,
            "total_bytes": 4,
            "buckets": [
                {
                    "id": "order-result-files",
                    "objects": [
                        {
                            "name": "patient/file.pdf",
                            "size_bytes": 4,
                            "sha256": hashlib.sha256(b"data").hexdigest(),
                            "content_type": "application/pdf",
                        }
                    ],
                }
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            file_path = output / "storage" / "order-result-files" / "patient" / "file.pdf"
            file_path.parent.mkdir(parents=True)
            file_path.write_bytes(b"data")
            uploaded = Mock(status_code=200, text="ok")
            verified = Mock(status_code=200, content=b"data")
            with patch.object(backup_rest, "OUTPUT", output), patch.object(
                backup_rest.requests, "post", return_value=uploaded
            ), patch.object(backup_rest.requests, "get", return_value=verified):
                result = backup_rest.upload_storage_snapshots(
                    storage_backup, backup_rest.datetime(2026, 7, 31, 12, 0, 0)
                )
        self.assertEqual(
            result["buckets"][0]["objects"][0]["backup_object"],
            "snapshots/2026/07/20260731_120000/order-result-files/patient/file.pdf",
        )


if __name__ == "__main__":
    unittest.main()
