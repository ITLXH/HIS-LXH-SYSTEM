import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backup" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role")
os.environ.setdefault("SUPABASE_STORAGE_BUCKET", "his-backups")

spec = importlib.util.spec_from_file_location(
    "safe_drive_offload_under_test", SCRIPTS / "safe_drive_offload.py"
)
offload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offload)


class SafeDriveOffloadTests(unittest.TestCase):
    def test_bucket_inventory_is_aggregate_only_and_excludes_backup_bucket(self):
        response = Mock(
            status_code=200,
            json=Mock(
                return_value=[
                    {"id": "his-backups", "public": False},
                    {"id": "patient-photos", "public": True},
                ]
            ),
        )
        objects = [
            {"path": "patient-a.jpg", "metadata": {"size": 10}},
            {"path": "patient-b.jpg", "metadata": {"size": 20}},
        ]
        with patch.object(
            offload, "request_with_retry", return_value=response
        ), patch.object(
            offload, "list_supabase_objects", return_value=objects
        ) as list_objects:
            result = offload.inventory_application_buckets()

        self.assertEqual(
            result,
            [
                {
                    "bucket": "patient-photos",
                    "public": True,
                    "object_count": 2,
                    "size_bytes": 30,
                }
            ],
        )
        list_objects.assert_called_once_with("", bucket="patient-photos")

    def test_cleanup_plan_never_removes_hot_or_unverified_references(self):
        archives = [
            {
                "path": "backups/2026/09/hot.zip",
                "old": False,
                "mirrored": True,
                "references": ["blobs/sha256/aa/shared", "blobs/sha256/bb/hot"],
            },
            {
                "path": "backups/2026/01/old-verified.zip",
                "old": True,
                "mirrored": True,
                "references": ["blobs/sha256/aa/shared", "blobs/sha256/cc/old"],
            },
            {
                "path": "backups/2025/12/old-unverified.zip",
                "old": True,
                "mirrored": False,
                "references": ["snapshots/legacy/protected"],
            },
        ]
        sidecars = [
            {"path": "blobs/sha256/aa/shared"},
            {"path": "blobs/sha256/bb/hot"},
            {"path": "blobs/sha256/cc/old"},
            {"path": "snapshots/legacy/protected"},
            {"path": "blobs/sha256/dd/orphan"},
        ]

        plan = offload.build_cleanup_plan(archives, sidecars)

        self.assertEqual(
            plan["archive_deletes"], ["backups/2026/01/old-verified.zip"]
        )
        self.assertEqual(plan["sidecar_deletes"], ["blobs/sha256/cc/old"])
        self.assertIn("blobs/sha256/aa/shared", plan["protected_sidecars"])
        self.assertIn("snapshots/legacy/protected", plan["protected_sidecars"])
        self.assertEqual(
            plan["orphans_report_only"], ["blobs/sha256/dd/orphan"]
        )

    def test_incomplete_archive_assessment_retains_all_sidecars(self):
        archives = [
            {
                "path": "backups/2026/01/old-verified.zip",
                "old": True,
                "mirrored": True,
                "references": ["blobs/sha256/cc/old"],
            }
        ]
        sidecars = [{"path": "blobs/sha256/cc/old"}]

        plan = offload.build_cleanup_plan(
            archives, sidecars, assessment_complete=False
        )

        self.assertEqual(plan["sidecar_deletes"], [])
        self.assertEqual(
            plan["archive_deletes"], ["backups/2026/01/old-verified.zip"]
        )

    def test_delete_is_restricted_to_dedicated_backup_bucket(self):
        response = Mock(status_code=200, text="ok")
        with patch.object(offload, "SUPABASE_BUCKET", "patient-photos"), patch.object(
            offload.requests, "delete", return_value=response
        ) as delete:
            with self.assertRaisesRegex(RuntimeError, "his-backups"):
                offload.delete_supabase_objects(["patient/file.jpg"])
        delete.assert_not_called()

    def test_exact_paths_are_deleted_in_one_storage_api_batch(self):
        response = Mock(status_code=200, text="ok")
        paths = ["backups/2026/01/old.zip", "blobs/sha256/aa/value"]
        with patch.object(offload, "SUPABASE_BUCKET", "his-backups"), patch.object(
            offload.requests, "delete", return_value=response
        ) as delete:
            self.assertEqual(offload.delete_supabase_objects(paths), 2)

        self.assertEqual(delete.call_args.kwargs["json"], {"prefixes": paths})


if __name__ == "__main__":
    unittest.main()
