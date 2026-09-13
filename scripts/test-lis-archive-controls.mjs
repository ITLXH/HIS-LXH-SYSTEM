import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  presentLisArchiveRun,
  sanitizeLisArchiveProgress,
} from '../functions/_utils/lis-archive-control.js';

const run = {
  id: 12345,
  run_number: 7,
  status: 'in_progress',
  conclusion: null,
  created_at: '2026-09-13T00:00:00Z',
  run_started_at: '2026-09-13T00:01:00Z',
  updated_at: '2026-09-13T00:02:00Z',
  event: 'workflow_dispatch',
  html_url: 'https://github.example/run/12345',
};
const progress = {
  run_id: '12345',
  run_number: '7',
  status: 'in_progress',
  stage: 'copying_and_verifying',
  percent: 42,
  eligible_object_count: 100,
  processed_object_count: 42,
  verified_copy_count: 42,
  patient_path: 'HN0001/private-result.pdf',
};
const presented = presentLisArchiveRun(run, progress, new Date('2026-09-13T00:11:00Z'));
assert.equal(presented.status, 'in_progress');
assert.equal(presented.percent, 42);
assert.equal(presented.elapsed_seconds, 600);
assert.equal(presented.progress.processed_object_count, 42);
assert.equal('patient_path' in presented.progress, false);

const stale = presentLisArchiveRun(run, { ...progress, run_id: '999' });
assert.equal(stale.progress, null);
assert.equal(stale.percent, 0);

const complete = presentLisArchiveRun({ ...run, status: 'completed', conclusion: 'success' }, progress);
assert.equal(complete.status, 'success');
assert.equal(complete.percent, 100);

assert.deepEqual(sanitizeLisArchiveProgress(null), null);

const html = fs.readFileSync(new URL('../public/partials/views/backup.html', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/lisArchiveDashboard.js', import.meta.url), 'utf8');
const dispatch = fs.readFileSync(new URL('../functions/api/backup/lis-archive-run.js', import.meta.url), 'utf8');
assert.match(html, /id="btnLisArchiveNow"/);
assert.match(html, /id="lisArchiveProgressBar"/);
assert.match(html, /id="lisArchivePercent"/);
assert.match(dashboard, /setInterval\(refresh, POLL_MS\)/);
assert.match(dispatch, /mode:\s*'copy'/);
assert.match(dispatch, /archive_after_days:\s*'14'/);
assert.match(dispatch, /destructive:\s*false/);
assert.doesNotMatch(dispatch, /mode:\s*'cleanup'/);

console.log('LIS archive controls checks passed.');
