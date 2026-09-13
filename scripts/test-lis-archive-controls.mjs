import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  presentLisArchiveRun,
  sanitizeLisArchiveProgress,
} from '../functions/_utils/lis-archive-control.js';
import { onRequestPost as startArchive } from '../functions/api/backup/lis-archive-run.js';
import { onRequestGet as getArchiveStatus } from '../functions/api/backup/lis-archive-status.js';

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

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SUPABASE_ANON_KEY: 'anon-key',
  BACKUP_GH_TOKEN: 'github-token',
};
const authResponses = (url) => {
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'auth-user' });
  if (url.includes('/rest/v1/HIS_One_Users')) {
    return Response.json([{ ID: 1, Role: 'admin', Status: 'active' }]);
  }
  return null;
};

const originalFetch = globalThis.fetch;
try {
  let dispatchedBody = null;
  globalThis.fetch = async (url, options = {}) => {
    const authResponse = authResponses(String(url));
    if (authResponse) return authResponse;
    if (String(url).includes('/actions/workflows/lis-result-archive.yml/runs')) {
      return Response.json({ workflow_runs: [{ ...run, status: 'completed', conclusion: 'success' }] });
    }
    if (String(url).includes('/actions/workflows/lis-result-archive.yml/dispatches')) {
      dispatchedBody = JSON.parse(options.body);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected dispatch request: ${url}`);
  };
  const startResponse = await startArchive({
    request: new Request('https://his.example/api/backup/lis-archive-run', {
      method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: '{}',
    }),
    env,
  });
  assert.equal(startResponse.status, 200);
  assert.equal((await startResponse.json()).destructive, false);
  assert.equal(dispatchedBody.inputs.mode, 'copy');
  assert.equal(dispatchedBody.inputs.archive_after_days, '14');
  assert.equal(dispatchedBody.inputs.verify_gateway, 'true');

  globalThis.fetch = async (url) => {
    const authResponse = authResponses(String(url));
    if (authResponse) return authResponse;
    if (String(url).includes('/actions/workflows/lis-result-archive.yml/runs')) {
      return Response.json({ workflow_runs: [run] });
    }
    if (String(url).includes('/storage/v1/object/his-backups/_system/lis-archive-progress.json')) {
      return Response.json(progress);
    }
    throw new Error(`Unexpected status request: ${url}`);
  };
  const statusResponse = await getArchiveStatus({
    request: new Request('https://his.example/api/backup/lis-archive-status', {
      headers: { Authorization: 'Bearer user-token' },
    }),
    env,
  });
  const statusBody = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(statusBody.percent, 42);
  assert.equal(statusBody.progress.processed_object_count, 42);
  assert.equal('patient_path' in statusBody.progress, false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('LIS archive controls checks passed.');
