import importlib.util
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backup" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role")
os.environ.setdefault("LIS_RESULT_BUCKET", "order-result-files")

spec = importlib.util.spec_from_file_location(
    "lis_result_archive_under_test", SCRIPTS / "lis_result_archive.py"
)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class LisResultArchiveTests(unittest.TestCase):
    def test_order_id_is_taken_from_valid_storage_path_prefix(self):
        self.assertEqual(archive.order_id_from_path("ORD-000012/report.pdf"), "ORD-000012")
        self.assertEqual(archive.order_id_from_path("bad/path/../report.pdf"), "")

    def test_order_metadata_is_fetched_in_bounded_batches(self):
        response = Mock(status_code=200)
        response.json.return_value = [{
            "order_id": "ORD-1",
            "patient_id": "LXH2026-000001",
            "patient_name": "Synthetic Patient",
            "age": "42",
        }]
        with patch.object(archive, "request_with_retry", return_value=response) as request:
            records = archive.fetch_order_patient_metadata(["ORD-1"])

        self.assertEqual(records["ORD-1"]["patient_id"], "LXH2026-000001")
        self.assertEqual(request.call_args.kwargs["params"]["order_id"], "in.(ORD-1)")

    def test_archive_filename_uses_safe_hn_name_age_and_content_suffix(self):
        name = archive.archive_drive_filename(
            {"patient_id": "LXH2026-002256", "patient_name": "ສົມ ໃຈ/Patient", "age": "42"},
            "report.pdf",
            "a" * 64,
        )

        self.assertEqual(name, "HN-LXH2026-002256_ສົມ_ໃຈ_Patient_42y_aaaaaaaaaaaa.pdf")

    def test_archive_filename_rejects_missing_patient_identity(self):
        with self.assertRaisesRegex(RuntimeError, "patient identity"):
            archive.archive_drive_filename({}, "report.pdf", "a" * 64)

    def test_transient_http_520_is_retried(self):
        transient = Mock(status_code=520)
        success = Mock(status_code=200)
        with patch.object(
            archive.requests, "request", side_effect=[transient, success]
        ) as request, patch("time.sleep") as sleep:
            response = archive.request_with_retry("get", "https://example.test/object")

        self.assertIs(response, success)
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_download_restarts_when_storage_stream_drops_mid_file(self):
        first = Mock(status_code=200)
        second = Mock(status_code=200)

        def interrupted_stream(chunk_size=None):
            yield b"partial"
            raise archive.requests.RequestException("connection ended early")

        first.iter_content.side_effect = interrupted_stream
        second.iter_content.return_value = [b"complete file"]
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "synthetic.pdf"
            with patch.object(
                archive, "request_with_retry", side_effect=[first, second]
            ) as request, patch("time.sleep") as sleep:
                archive.download_object("synthetic/result.pdf", destination)

            self.assertEqual(destination.read_bytes(), b"complete file")
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_progress_payload_is_aggregate_and_uses_upsert(self):
        previous_run_id = archive.RUN_ID
        previous_state = archive.PROGRESS_STATE.copy()
        archive.RUN_ID = "12345"
        archive.PROGRESS_STATE.clear()
        response = Mock(status_code=200)
        try:
            with patch.object(archive, "request_with_retry", return_value=response) as request:
                archive.publish_progress(
                    status="in_progress",
                    stage="copying_and_verifying",
                    percent=25,
                    processed_object_count=5,
                )
            payload = request.call_args.kwargs["data"].decode("utf-8")
            self.assertNotIn("path", payload.lower())
            self.assertNotIn("patient", payload.lower())
            self.assertEqual(request.call_args.kwargs["headers"]["x-upsert"], "true")
            self.assertIn('"percent":25', payload)
        finally:
            archive.RUN_ID = previous_run_id
            archive.PROGRESS_STATE.clear()
            archive.PROGRESS_STATE.update(previous_state)

    def test_path_hash_does_not_expose_patient_path(self):
        digest = archive.path_hash("HN0001/report.pdf")
        self.assertEqual(len(digest), 64)
        self.assertNotIn("HN0001", digest)

    def test_matching_drive_copy_requires_size_and_source_version(self):
        item = {
            "path": "HN0001/report.pdf",
            "updated_at": "2026-01-01T00:00:00Z",
            "metadata": {"size": 42, "eTag": "source-etag"},
        }
        expected = {
            "id": "drive-id",
            "size": "42",
            "md5Checksum": "md5",
            "appProperties": {
                "his_source_size": "42",
                "his_source_version": archive.source_version(item),
                "his_sha256": "a" * 64,
            },
        }
        self.assertEqual(archive.matching_drive_copy(item, [expected]), expected)
        changed = {**item, "metadata": {"size": 43, "eTag": "source-etag"}}
        self.assertIsNone(archive.matching_drive_copy(changed, [expected]))

    def test_candidate_selection_excludes_recent_and_unknown_age(self):
        now = datetime.now(timezone.utc)
        old = {
            "path": "old.pdf",
            "created_at": (now - timedelta(days=60)).isoformat(),
            "metadata": {"size": 10},
        }
        recent = {
            "path": "recent.pdf",
            "created_at": (now - timedelta(days=2)).isoformat(),
            "metadata": {"size": 20},
        }
        unknown = {"path": "unknown.pdf", "metadata": {"size": 30}}
        candidates, unknown_age = archive.select_candidates(
            [recent, unknown, old], now - timedelta(days=30)
        )
        self.assertEqual([item["path"] for item in candidates], ["old.pdf"])
        self.assertEqual(unknown_age, 1)

    def test_deleted_bytes_are_zero_when_copy_mode_has_no_delete_targets(self):
        self.assertEqual(archive.deleted_bytes_for_report([], 0, 5), 0)

    def test_deleted_bytes_are_reported_only_after_all_targets_are_deleted(self):
        targets = ["old-a.pdf", "old-b.pdf"]
        self.assertEqual(archive.deleted_bytes_for_report(targets, 1, 42), 0)
        self.assertEqual(archive.deleted_bytes_for_report(targets, 2, 42), 42)

    def test_gateway_sample_compares_forced_drive_copy_without_key_in_url(self):
        previous_url = archive.GATEWAY_URL
        previous_key = archive.SERVICE_KEY
        archive.GATEWAY_URL = "https://his.example/api/lis/result-file"
        archive.SERVICE_KEY = "service-role-test"
        response = Mock(
            status_code=200,
            headers={"X-HIS-Storage-Source": "google-drive-archive"},
        )
        response.iter_content.return_value = [b"%PDF-test"]

        def write_source(_object_path, destination):
            Path(destination).write_bytes(b"%PDF-test")

        try:
            with patch.object(archive, "download_object", side_effect=write_source), patch.object(
                archive, "request_with_retry", return_value=response
            ) as request:
                archive.verify_gateway_sample({"path": "HN0001/result.pdf"})
            requested_url = request.call_args.args[1]
            self.assertIn("source=drive", requested_url)
            self.assertNotIn("service-role-test", requested_url)
            self.assertEqual(
                request.call_args.kwargs["headers"]["Authorization"],
                "Bearer service-role-test",
            )
        finally:
            archive.GATEWAY_URL = previous_url
            archive.SERVICE_KEY = previous_key


if __name__ == "__main__":
    unittest.main()
