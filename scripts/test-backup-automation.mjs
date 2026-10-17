import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectBackupZipFiles } from '../functions/api/backup/list.js';

const calls = [];
const tree = {
  '': [
    { id: 'legacy', name: 'legacy-backup.zip', created_at: '2026-08-01T00:00:00Z' },
    { id: null, name: 'backups' },
    { id: null, name: 'HIS Backup' },
    { id: null, name: 'blobs' },
    { id: null, name: 'snapshots' },
  ],
  backups: [{ id: null, name: '2026' }],
  'backups/2026': [{ id: null, name: '08' }],
  'backups/2026/08': [
    {
      id: 'current',
      name: 'backup-20260817.zip',
      created_at: '2026-08-17T00:00:00Z',
      metadata: { size: 42 },
    },
  ],
  'HIS Backup': [{ id: null, name: '17' }],
  'HIS Backup/17': [{ id: null, name: '10' }],
  'HIS Backup/17/10': [{ id: null, name: '2026' }],
  'HIS Backup/17/10/2026': [
    {
      id: 'current-his',
      name: 'backup-2026-10-17_20261017_230000.zip',
      created_at: '2026-10-17T16:00:00Z',
      metadata: { size: 84 },
    },
  ],
};

const files = await collectBackupZipFiles(async (prefix) => {
  calls.push(prefix);
  return tree[prefix] || [];
});

assert.deepEqual(
  files.map((file) => file.path),
  [
    'legacy-backup.zip',
    'backups/2026/08/backup-20260817.zip',
    'HIS Backup/17/10/2026/backup-2026-10-17_20261017_230000.zip',
  ],
);
assert.deepEqual(calls, [
  '',
  'backups',
  'backups/2026',
  'backups/2026/08',
  'HIS Backup',
  'HIS Backup/17',
  'HIS Backup/17/10',
  'HIS Backup/17/10/2026',
]);
assert.equal(calls.some((prefix) => prefix.startsWith('blobs')), false);
assert.equal(calls.some((prefix) => prefix.startsWith('snapshots')), false);

const workflow = fs.readFileSync(new URL('../.github/workflows/supabase-backup.yml', import.meta.url), 'utf8');
const offloadWorkflow = fs.readFileSync(new URL('../.github/workflows/supabase-storage-offload.yml', import.meta.url), 'utf8');
const lisArchiveWorkflow = fs.readFileSync(new URL('../.github/workflows/lis-result-archive.yml', import.meta.url), 'utf8');
const driveBackupList = fs.readFileSync(new URL('../functions/api/backup/gdrive-list.js', import.meta.url), 'utf8');
const lisResultRoute = fs.readFileSync(new URL('../functions/api/lis/result-file.js', import.meta.url), 'utf8');
assert.match(workflow, /cron:\s*['"]0 16 \* \* \*['"]/);
assert.match(workflow, /group:\s*his-daily-backup-window\s+queue:\s*max/);
assert.match(workflow, /- name: Upload to Google Drive[\s\S]*?continue-on-error:\s*true/);
assert.match(workflow, /SUPABASE_RETENTION_DAYS:\s*['"]14['"]?/);
assert.match(workflow, /SUPABASE_OFFLOAD_AFTER_DRIVE:\s*['"]0['"]?/);
assert.match(workflow, /DRIVE_RESTORE_VERIFIED:\s*\$\{\{\s*vars\.DRIVE_RESTORE_VERIFIED/);
assert.match(offloadWorkflow, /cron:\s*['"]30 1 \* \* 0['"]?/);
assert.match(offloadWorkflow, /default:\s*['"]audit['"]?/);
assert.match(offloadWorkflow, /retention_days:[\s\S]*?default:\s*['"]14['"]?/);
assert.match(offloadWorkflow, /OFFLOAD_VERIFIED_BACKUPS/);
assert.match(offloadWorkflow, /safe_drive_offload\.py/);
assert.match(offloadWorkflow, /github\.event_name == 'workflow_dispatch'[\s\S]*?SUPABASE_CLEANUP_ENABLED/);
assert.match(offloadWorkflow, /FAIL_ON_STORAGE_WARNING:/);
assert.match(lisArchiveWorkflow, /name:\s*LIS Result File Safe Archive/);
assert.match(lisArchiveWorkflow, /group:\s*his-daily-backup-window\s+queue:\s*max/);
assert.match(lisArchiveWorkflow, /cron:\s*['"]30 16 \* \* \*['"]?/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_RESTORE_VERIFIED/);
assert.match(lisArchiveWorkflow, /ARCHIVE_VERIFIED_ORDER_RESULTS/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_AUTOMATION_ENABLED/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_VERIFY_GATEWAY/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_GATEWAY_URL:\s*https:\/\/his-lxh-system\.pages\.dev/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_PROGRESS_BUCKET:\s*his-backups/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_PROGRESS_PATH:\s*_system\/lis-archive-progress\.json/);
assert.match(driveBackupList, /his_backup_root_id/);
assert.match(lisResultRoute, /his_archive_root_id/);
assert.match(lisArchiveWorkflow, /archive_after_days:[\s\S]*?default:\s*['"]14['"]?/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_AFTER_DAYS:[\s\S]*?\|\| '14'/);
assert.match(lisArchiveWorkflow, /github\.event_name == 'schedule' && 'copy'/);
assert.match(workflow, /BACKUP_REQUIRED_TABLES:[^\n]*UXI_One_main_imaging_orders/);
assert.match(lisArchiveWorkflow, /Archive verified UXI imaging results to Google Drive/);
assert.match(lisArchiveWorkflow, /UXI_RESULT_BUCKET:\s*uxi-results/);
assert.match(lisArchiveWorkflow, /GOOGLE_DRIVE_OAUTH_JSON:[^\n]*secrets\.GOOGLE_DRIVE_OAUTH_JSON/);
assert.match(lisArchiveWorkflow, /GOOGLE_SERVICE_ACCOUNT_JSON:[^\n]*secrets\.GOOGLE_SERVICE_ACCOUNT_JSON/);
assert.match(lisArchiveWorkflow, /UXI_ARCHIVE_AFTER_DAYS:[^\n]*'14'/);
assert.match(lisArchiveWorkflow, /UXI_ARCHIVE_MAX_OBJECTS:\s*'0'/);

console.log('Backup automation checks passed.');
