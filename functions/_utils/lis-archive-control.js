import { ghRequest } from './gh-api.js';

export function lisArchiveConfig(env) {
  return {
    owner: env.BACKUP_GH_OWNER || 'ITLXH',
    repo: env.BACKUP_GH_REPO || 'HIS-LXH-SYSTEM',
    workflowFile: env.LIS_ARCHIVE_WORKFLOW_FILE || 'lis-result-archive.yml',
    progressBucket: env.LIS_ARCHIVE_PROGRESS_BUCKET || 'his-backups',
    progressPath: env.LIS_ARCHIVE_PROGRESS_PATH || '_system/lis-archive-progress.json',
  };
}

export async function getLatestLisArchiveRun(env) {
  const config = lisArchiveConfig(env);
  const data = await ghRequest(
    env,
    'GET',
    `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/runs?per_page=1`,
  );
  return (data.workflow_runs || [])[0] || null;
}

function encodeStoragePath(value) {
  return String(value || '').split('/').map(encodeURIComponent).join('/');
}

export async function readLisArchiveProgress(env) {
  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!supabaseUrl || !serviceKey) return null;

  const config = lisArchiveConfig(env);
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeStoragePath(config.progressBucket)}/${encodeStoragePath(config.progressPath)}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Cache-Control': 'no-cache',
      },
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Archive progress HTTP ${response.status}`);
  return response.json();
}

export function sanitizeLisArchiveProgress(progress) {
  if (!progress || typeof progress !== 'object') return null;
  const textFields = ['run_id', 'run_number', 'status', 'stage', 'started_at', 'updated_at', 'finished_at'];
  const numberFields = [
    'archive_after_days', 'storage_object_count', 'storage_bytes',
    'eligible_object_count', 'eligible_bytes', 'processed_object_count', 'processed_bytes',
    'verified_copy_count', 'verified_copy_bytes', 'copied_now_count', 'copied_now_bytes',
    'failure_count', 'percent',
  ];
  const safe = {};
  for (const key of textFields) {
    if (progress[key] !== undefined && progress[key] !== null) safe[key] = String(progress[key]).slice(0, 80);
  }
  for (const key of numberFields) {
    const value = Number(progress[key]);
    if (Number.isFinite(value) && value >= 0) safe[key] = value;
  }
  return safe;
}

export function presentLisArchiveRun(run, progress, now = new Date()) {
  if (!run) return { status: 'none', progress: null };

  const runStatus = run.status === 'completed' && run.conclusion ? run.conclusion : (run.status || 'unknown');
  const safeProgress = sanitizeLisArchiveProgress(progress);
  const currentProgress = safeProgress && String(safeProgress.run_id) === String(run.id) ? safeProgress : null;
  const started = run.run_started_at ? new Date(run.run_started_at) : null;
  const ended = run.status === 'completed' && run.updated_at ? new Date(run.updated_at) : now;
  const elapsedSeconds = started && !Number.isNaN(started.valueOf())
    ? Math.max(0, Math.round((ended - started) / 1000))
    : null;

  let percent = Number(currentProgress?.percent || 0);
  if (runStatus === 'success') percent = 100;
  if ((runStatus === 'queued' || runStatus === 'in_progress') && !currentProgress) percent = 0;

  return {
    status: runStatus,
    conclusion: run.conclusion || null,
    run_id: run.id,
    run_number: run.run_number,
    created_at: run.created_at,
    started_at: run.run_started_at,
    updated_at: run.updated_at,
    trigger: run.event,
    html_url: run.html_url,
    elapsed_seconds: elapsedSeconds,
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    progress: currentProgress,
  };
}
