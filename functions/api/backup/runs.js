import { ghRequest } from '../../_utils/gh-api.js';

// GET /api/backup/runs?limit=10
// Returns the last N workflow runs for the backup workflow — used by the
// "History" table in the Backup view so the user can see every recent run
// (success/failure/in_progress), not just the latest one.

export async function onRequestGet(ctx) {
  const { request, env } = ctx;

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50);

    const owner = env.BACKUP_GH_OWNER || 'ITLXH';
    const repo = env.BACKUP_GH_REPO || 'HIS-LXH-SYSTEM';
    const workflowFile = env.BACKUP_WORKFLOW_FILE || 'supabase-backup.yml';

    const runsData = await ghRequest(
      env,
      'GET',
      `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${limit}`,
      null,
    );

    const runs = (runsData.workflow_runs || []).map((r) => {
      let status = r.status || 'unknown';
      if (r.conclusion && (status === 'completed')) status = r.conclusion;
      return {
        run_id: r.id,
        run_number: r.run_number,
        status,
        conclusion: r.conclusion,
        created_at: r.created_at,
        updated_at: r.updated_at,
        run_started_at: r.run_started_at,
        trigger: r.event,
        html_url: r.html_url,
        duration_seconds: r.run_started_at
          ? Math.round((new Date(r.updated_at) - new Date(r.run_started_at)) / 1000)
          : null,
      };
    });

    return new Response(
      JSON.stringify({ owner, repo, count: runs.length, runs }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', error: err.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
