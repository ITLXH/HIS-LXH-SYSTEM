import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectBackupZipFiles } from '../functions/api/backup/list.js';

const calls = [];
const tree = {
  '': [
    { id: 'legacy', name: 'legacy-backup.zip', created_at: '2026-08-01T00:00:00Z' },
    { id: null, name: 'backups' },
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
};

const files = await collectBackupZipFiles(async (prefix) => {
  calls.push(prefix);
  return tree[prefix] || [];
});

assert.deepEqual(
  files.map((file) => file.path),
  ['legacy-backup.zip', 'backups/2026/08/backup-20260817.zip'],
);
assert.deepEqual(calls, ['', 'backups', 'backups/2026', 'backups/2026/08']);
assert.equal(calls.some((prefix) => prefix.startsWith('blobs')), false);
assert.equal(calls.some((prefix) => prefix.startsWith('snapshots')), false);

const workflow = fs.readFileSync(new URL('../.github/workflows/supabase-backup.yml', import.meta.url), 'utf8');
const offloadWorkflow = fs.readFileSync(new URL('../.github/workflows/supabase-storage-offload.yml', import.meta.url), 'utf8');
const lisArchiveWorkflow = fs.readFileSync(new URL('../.github/workflows/lis-result-archive.yml', import.meta.url), 'utf8');
assert.match(workflow, /cron:\s*['"]0 0 \* \* \*['"]/);
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
assert.match(lisArchiveWorkflow, /cron:\s*['"]30 2 \* \* \*['"]?/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_RESTORE_VERIFIED/);
assert.match(lisArchiveWorkflow, /ARCHIVE_VERIFIED_ORDER_RESULTS/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_AUTOMATION_ENABLED/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_VERIFY_GATEWAY/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_GATEWAY_URL:\s*https:\/\/his-lxh-system\.pages\.dev/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_PROGRESS_BUCKET:\s*his-backups/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_PROGRESS_PATH:\s*_system\/lis-archive-progress\.json/);
assert.match(lisArchiveWorkflow, /archive_after_days:[\s\S]*?default:\s*['"]14['"]?/);
assert.match(lisArchiveWorkflow, /LIS_ARCHIVE_AFTER_DAYS:[\s\S]*?\|\| '14'/);
assert.match(lisArchiveWorkflow, /github\.event_name == 'schedule' && 'copy'/);

console.log('Backup automation checks passed.');
