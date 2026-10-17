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
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-role")
os.environ.setdefault("UXI_RESULT_BUCKET", "uxi-results")

spec = importlib.util.spec_from_file_location(
    "uxi_result_archive_under_test", SCRIPTS / "uxi_result_archive.py"
)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class UxiResultArchiveTests(unittest.TestCase):
    def test_transient_520_is_retried_and_response_is_closed(self):
        transient = Mock(status_code=520)
        success = Mock(status_code=200)
        with patch.object(archive.requests, "request", side_effect=[transient, success]) as request, patch.object(archive.time, "sleep") as sleep:
            response = archive.request_with_retry("get", "https://example.test/uxi")

        self.assertIs(response, success)
        self.assertEqual(request.call_count, 2)
        transient.close.assert_called_once_with()
        sleep.assert_called_once_with(1)

    def test_metadata_index_uses_persisted_storage_path_and_patient_identity(self):
        rows = [{
            "id": "order-1",
            "cn": "CN-0001",
            "patient": {"cn": "CN-0001", "name": "Synthetic Patient", "age": 42},
            "result_files": [
                {"storagePath": "order-1/result-1.pdf"},
                {"name": "offline-only.pdf"},
            ],
        }]

        index = archive.build_patient_metadata_index(rows)

        self.assertEqual(
            index["order-1/result-1.pdf"],
            {"patient_id": "CN-0001", "patient_name": "Synthetic Patient", "age": 42},
        )
        self.assertNotIn("offline-only.pdf", index)

    def test_metadata_index_rejects_unlinked_or_ambiguous_paths(self):
        rows = [
            {
                "id": "order-1",
                "cn": "CN-0001",
                "patient": {"name": "Synthetic Patient", "age": 42},
                "result_files": [{"storagePath": "order-2/result.pdf"}],
            },
            {
                "id": "order-2",
                "cn": "CN-0002",
                "patient": {"name": "Another Patient", "age": 38},
                "result_files": [{"storagePath": "order-2/result.pdf"}],
            },
            {
                "id": "order-3",
                "cn": "CN-0003",
                "patient": {"name": "Third Patient"},
                "result_files": [{"storagePath": "order-3/missing-age.pdf"}],
            },
        ]

        index = archive.build_patient_metadata_index(rows)

        self.assertNotIn("order-2/result.pdf", index)
        self.assertNotIn("order-3/missing-age.pdf", index)

    def test_archive_filename_contains_safe_hn_name_age_and_extension(self):
        name = archive.archive_drive_filename(
            {"patient_id": "CN-0001", "patient_name": "Synthetic Patient", "age": 42},
            "order-1/result.pdf",
            "a" * 64,
        )

        self.assertEqual(name, "HN-CN-0001_Synthetic_Patient_42y_aaaaaaaaaaaa.pdf")

    def test_archive_filename_rejects_missing_identity(self):
        with self.assertRaisesRegex(RuntimeError, "patient identity"):
            archive.archive_drive_filename({}, "order-1/result.pdf", "a" * 64)

    def test_candidate_selection_excludes_recent_and_unknown_timestamps(self):
        now = datetime.now(timezone.utc)
        old = {"path": "order-1/old.pdf", "created_at": (now - timedelta(days=30)).isoformat(), "metadata": {"size": 10}}
        recent = {"path": "order-2/recent.pdf", "created_at": (now - timedelta(days=2)).isoformat(), "metadata": {"size": 20}}
        unknown = {"path": "order-3/unknown.pdf", "metadata": {"size": 30}}

        candidates, unknown_age = archive.select_candidates(
            [recent, unknown, old], now - timedelta(days=14)
        )

        self.assertEqual([item["path"] for item in candidates], ["order-1/old.pdf"])
        self.assertEqual(unknown_age, 1)


if __name__ == "__main__":
    unittest.main()