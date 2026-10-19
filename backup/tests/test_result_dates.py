import sys
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import gdrive_upload as drive
import lis_result_archive as lis
import uxi_result_archive as uxi
import organize_drive_backups as organizer


class ResultDateTests(unittest.TestCase):
    def test_apply_repairs_only_verified_metadata_and_journals_original_parent(self):
        import organize_result_dates as repair
        drive_mock = Mock()
        raw = b'synthetic archive'
        backup = {'id': 'snapshot', 'name': 'backup-2026-10-20.zip', 'size': str(len(raw)),
            'mimeType': 'application/zip', 'md5Checksum': hashlib.md5(raw).hexdigest(),
            'appProperties': {'his_backup_scope': 'complete_incremental', 'his_sha256': hashlib.sha256(raw).hexdigest()}}
        source_hash = hashlib.sha256(b'order-result-files/ORD-1/result.pdf').hexdigest()
        result = {'id': 'result-1', 'parents': ['root'], 'size': '100', 'md5Checksum': 'unchanged',
            'appProperties': {'his_archive_type': 'lis_result', 'his_source_bucket': 'order-result-files',
                              'his_archive_root_id': 'root', 'his_source_path_sha256': source_hash}}
        tables = {'lis_one_test_orders': [{'order_id': 'ORD-1', 'order_datetime': '2026-10-05T02:00:00Z'}],
            'lis_one_order_result_files': [{'order_id': 'ORD-1', 'storage_path': 'ORD-1/result.pdf'}]}
        drive_mock.files.return_value.get_media.return_value.execute.return_value = raw
        def moved(**kwargs):
            return Mock(execute=Mock(return_value={**result, 'parents': [kwargs['addParents']],
                                                   'appProperties': kwargs['body']['appProperties']}))
        drive_mock.files.return_value.update.side_effect = moved
        with tempfile.TemporaryDirectory() as temp:
            journal = Path(temp) / 'journal.jsonl'
            with patch.object(sys, 'argv', ['repair', '--root-folder', 'root', '--apply', '--journal', str(journal)]), \
                 patch.object(repair, 'build_drive', return_value=drive_mock), \
                 patch.object(repair, 'verify_root_folder'), \
                 patch.object(repair, 'list_tagged', side_effect=[[backup], [result]]), \
                 patch.object(repair, 'validate_archive', return_value=(Mock(), {}, tables, [])), \
                 patch.object(repair, 'children', return_value=[]), \
                 patch.object(repair, 'ensure_drive_folder', side_effect=['lis', 'year', 'month', 'day']) as ensure:
                repair.main()
            self.assertEqual(json.loads(journal.read_text())['source'], 'root')
        self.assertEqual(ensure.call_args.args[-1], '05/10/2026')
        update = drive_mock.files.return_value.update.call_args.kwargs
        self.assertEqual(update['fileId'], 'result-1')
        self.assertEqual(update['body']['appProperties']['his_clinical_date'], '2026-10-05')

    def test_upload_parents_and_lookup_tags_use_clinical_day(self):
        content = b'%PDF-synthetic'
        for module in [lis, uxi]:
            def download(_path, target):
                target.write_bytes(content)
            def upload(_drive, path, metadata, *_args):
                self.assertEqual(metadata['appProperties']['his_clinical_date'], '2026-10-05')
                return {**metadata, 'id': 'copy', 'size': str(len(content)),
                        'md5Checksum': hashlib.md5(content).hexdigest()}
            with self.subTest(module=module.__name__), \
                 patch.object(module, 'download_object', side_effect=download), \
                 patch.object(module, 'ensure_drive_folder_path', return_value='clinical-day') as folder, \
                 patch.object(module, 'upload_binary', side_effect=upload):
                module.upload_archive_copy(Mock(), {'path': 'ORD-1/result.pdf', 'metadata': {'size': len(content)}},
                    {'patient_id': 'SYN-1', 'patient_name': 'Synthetic', 'age': 28, 'clinical_date': '2026-10-05'})
            self.assertEqual(folder.call_args.args[-1][-1], '05/10/2026')

    def test_existing_files_match_persisted_path_not_patient_filename(self):
        from organize_result_dates import build_date_index
        import hashlib
        tables = {
            'lis_one_test_orders': [{'order_id': 'ORD-1', 'order_datetime': '2026-10-05T02:00:00Z'}],
            'lis_one_order_result_files': [{'order_id': 'ORD-1', 'storage_path': 'ORD-1/one.pdf'}],
            'UXI_One_main_imaging_orders': [{'id': 'uxi-1', 'ordered_at': '2026-10-04T18:00:00Z',
                'result_files': [{'storagePath': 'uxi-1/result.pdf'}, {'storagePath': 'other/result.pdf'}]}],
        }
        index = build_date_index(tables)
        key = lambda bucket, path: (bucket, hashlib.sha256(f'{bucket}/{path}'.encode()).hexdigest())
        self.assertEqual(index[key('order-result-files', 'ORD-1/one.pdf')], '2026-10-05')
        self.assertEqual(index[key('uxi-results', 'uxi-1/result.pdf')], '2026-10-05')
        self.assertNotIn(key('uxi-results', 'other/result.pdf'), index)
        tables['lis_one_test_orders'].append({'order_id': 'ORD-1', 'order_datetime': '2026-10-06T00:00:00Z'})
        self.assertNotIn(key('order-result-files', 'ORD-1/one.pdf'), build_date_index(tables))

    def test_clinical_date_uses_bangkok_not_upload_time(self):
        self.assertEqual(drive.clinical_archive_date('2026-10-04T18:27:54Z'), '2026-10-05')
        self.assertEqual(drive.clinical_archive_date('2026-10-05'), '2026-10-05')
        for value in ['', None, '2026-02-30', '2026-10-05T09:00:00']:
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                drive.clinical_archive_date(value)

    def test_lis_date_matches_order_datetime_used_by_pdf(self):
        response = Mock(status_code=200)
        response.json.return_value = [{'order_id': 'ORD-1', 'patient_id': 'SYN-1',
            'patient_name': 'Synthetic Patient', 'age': '28',
            'order_datetime': '2026-10-05T02:27:54Z', 'completed_at': '2026-10-06T01:00:00Z'}]
        with patch.object(lis, 'request_with_retry', return_value=response) as request:
            identity = lis.fetch_order_patient_metadata(['ORD-1'])['ORD-1']
        self.assertEqual(identity['clinical_date'], '2026-10-05')
        self.assertIn('order_datetime', request.call_args.kwargs['params']['select'])

    def test_uxi_date_matches_exam_date_used_by_pdf(self):
        rows = [{'id': 'order-1', 'cn': 'SYN-1', 'patient': {'name': 'Synthetic', 'age': 28},
            'ordered_at': '2026-10-04T18:00:00Z', 'reported_at': '2026-10-06T01:00:00Z',
            'result_files': [{'storagePath': 'order-1/result.pdf'}]}]
        self.assertEqual(uxi.build_patient_metadata_index(rows)['order-1/result.pdf']['clinical_date'], '2026-10-05')

    def test_organizer_never_reverts_to_drive_creation_date(self):
        meta = {'name': 'report.pdf', 'createdTime': '2026-10-20T00:00:00Z',
            'appProperties': {'his_source_bucket': 'order-result-files', 'his_clinical_date': '2026-10-05'}}
        self.assertEqual(organizer.destination_parts(meta), ['LIS Backup', '2026', 'Oct', '05/10/2026'])
        meta['appProperties'].pop('his_clinical_date')
        self.assertIsNone(organizer.destination_parts(meta))

    def test_uploads_fail_closed_without_clinical_date_before_downloading(self):
        for module in [lis, uxi]:
            with self.subTest(module=module.__name__), patch.object(module, 'download_object') as download:
                with self.assertRaises(RuntimeError):
                    module.upload_archive_copy(Mock(), {'path': 'order-1/result.pdf'}, {})
                download.assert_not_called()
