import importlib.util
import os
import sys
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
