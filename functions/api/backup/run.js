import { ghRequest } from '../_utils/gh-api.js';

// POST /api/backup/run
// Triggers GitHub Actions workflow_dispatch — server-side only
// Token never exposed to browser

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  try {
    await ghRequest(
      env,
      'POST',
      `/repos/${env.BACKUP_GH_OWNER}/${env.BACKUP_GH_REPO}/actions/workflows/${env.BACKUP_WORKFLOW_FILE || 'supabase-backup.yml'}/dispatches`,
      { ref: 'main' }
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Backup started' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
