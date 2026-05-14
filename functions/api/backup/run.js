import { ghRequest } from '../../_utils/gh-api.js';

// POST /api/backup/run
// Triggers GitHub Actions workflow_dispatch — server-side only
// Token never exposed to browser

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  try {
    // Use hardcoded defaults — env vars are optional overrides
    const owner = env.BACKUP_GH_OWNER || 'it977';
    const repo = env.BACKUP_GH_REPO || 'HIS-sys';
    const workflowFile = env.BACKUP_WORKFLOW_FILE || 'supabase-backup.yml';

    // Try workflow filename first; if that fails, fallback to workflow ID
    // (avoids issues with filename changes or renamed workflows)
    try {
      await ghRequest(
        env,
        'POST',
        `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
        { ref: 'main' }
      );
    } catch (primaryErr) {
      // If filename lookup fails, try the numeric workflow ID
      if (primaryErr.message && primaryErr.message.includes('404')) {
        await ghRequest(
          env,
          'POST',
          `/repos/${owner}/${repo}/actions/workflows/275980961/dispatches`,
          { ref: 'main' }
        );
      } else {
        throw primaryErr;
      }
    }

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
