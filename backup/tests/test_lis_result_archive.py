import importlib.util
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


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


if __name__ == "__main__":
    unittest.main()
