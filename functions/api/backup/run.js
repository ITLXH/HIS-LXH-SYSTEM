import { ghRequest } from '../../_utils/gh-api.js';

// POST /api/backup/run
// Triggers GitHub Actions workflow_dispatch — server-side only
// Token never exposed to browser

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  try {
    const owner = env.BACKUP_GH_OWNER || 'it977';
    const repo = env.BACKUP_GH_REPO || 'HIS-sys';
    const workflowFile = env.BACKUP_WORKFLOW_FILE || 'supabase-backup.yml';

    const dispatchUrl = `/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

    await ghRequest(
      env,
      'POST',
      dispatchUrl,
      { ref: 'main' }
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
