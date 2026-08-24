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
assert.match(workflow, /cron:\s*['"]0 0 \* \* \*['"]/);
assert.match(workflow, /- name: Upload to Google Drive[\s\S]*?continue-on-error:\s*true/);
assert.match(workflow, /RETENTION_DAYS:\s*['"]?30['"]?/);

console.log('Backup automation checks passed.');
