import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import organize_drive_backups as organize


class DriveOrganizationTests(unittest.TestCase):
    def test_routes_known_backups_and_leaves_unclassified_files_alone(self):
        cases = [
            ({'name': 'backup-2026-08-08_20260808_011021.zip'}, None,
             ['HIS Backup', '2026', 'Aug', '08/08/2026']),
            ({'name': 'lis-result-abc.pdf', 'createdTime': '2026-10-17T18:57:00Z'}, None,
             ['LIS Backup', '2026', 'Oct', '18/10/2026']),
            ({'name': 'report.pdf', 'createdTime': '2026-10-18T19:00:00Z'}, 'UXI Backup',
             ['UXI Backup', '2026', 'Oct', '19/10/2026']),
            ({'name': 'report.pdf', 'createdTime': '2026-10-18T19:00:00Z'}, 'PMC Backup',
             ['PMC Backup', '2026', 'Oct', '19/10/2026']),
            ({'name': 'unknown.pdf', 'createdTime': '2026-10-17T00:00:00Z'}, None, None),
        ]
        for metadata, system, expected in cases:
            with self.subTest(metadata=metadata):
                self.assertEqual(organize.destination_parts(metadata, system), expected)

    def test_move_preserves_id_hash_and_archive_lookup_properties(self):
        drive = Mock()
        original = {'id': 'file-1', 'parents': ['source'], 'size': '10', 'md5Checksum': 'same-md5',
                    'appProperties': {'his_source_path_sha256': 'source-hash'}}
        drive.files.return_value.update.return_value.execute.return_value = {
            **original, 'parents': ['destination'],
            'appProperties': {**original['appProperties'], 'his_archive_root_id': 'backup-root'},
        }
        result = organize.move_file(drive, original, 'source', 'destination', 'backup-root', 'LIS Backup')
        self.assertEqual(result['id'], 'file-1')
        self.assertEqual(result['md5Checksum'], 'same-md5')
        update = drive.files.return_value.update.call_args.kwargs
        self.assertEqual(update['removeParents'], 'source')
        self.assertEqual(update['body']['appProperties']['his_source_path_sha256'], 'source-hash')

    def test_move_refuses_unverified_parent(self):
        with self.assertRaisesRegex(RuntimeError, 'parent'):
            organize.move_file(Mock(), {'id': 'f', 'parents': ['elsewhere']}, 'source', 'dest', 'root', 'HIS Backup')
