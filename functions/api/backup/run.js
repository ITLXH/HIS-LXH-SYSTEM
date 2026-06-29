import { ghRequest } from '../../_utils/gh-api.js';

// POST /api/backup/run
// Triggers GitHub Actions workflow_dispatch — server-side only
// Token never exposed to browser

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  try {
    // Repo is now ITLXH/HIS-LXH-SYSTEM. Env vars still override if needed.
    const owner = env.BACKUP_GH_OWNER || 'ITLXH';
    const repo = env.BACKUP_GH_REPO || 'HIS-LXH-SYSTEM';
    const workflowFile = env.BACKUP_WORKFLOW_FILE || 'supabase-backup.yml';

    // Parse optional reason from body
    let reason = 'manual';
    try {
      const body = await request.json();
      if (body && typeof body.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 80);
      }
    } catch (_) { /* no body or invalid json — keep default */ }

    await ghRequest(
      env,
      'POST',
      `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
      { ref: 'main', inputs: { reason } }
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Backup started', owner, repo, workflowFile }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Backup dispatch error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
