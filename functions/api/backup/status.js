import { ghRequest } from '../../_utils/gh-api.js';

// GET /api/backup/status
// Fetches latest workflow run from GitHub Actions
// Token never exposed to browser

export async function onRequestGet(ctx) {
  const { env } = ctx;

  try {
    // Use numeric workflow ID as primary key — immune to renaming
    const owner = env.BACKUP_GH_OWNER || 'it977';
    const repo = env.BACKUP_GH_REPO || 'HIS-sys';
    const workflowId = env.BACKUP_WORKFLOW_ID || '275980961';

    const runsData = await ghRequest(
      env,
      'GET',
      `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=1`,
      null
    );

    const runs = runsData.workflow_runs || [];
    if (runs.length === 0) {
      return new Response(
        JSON.stringify({ status: 'none', message: 'No backup runs yet' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const latest = runs[0];

    // Determine status
    let status = latest.status || 'unknown';
    if (latest.conclusion && (status === 'completed' || status === 'success' || status === 'failure')) {
      status = latest.conclusion;
    }

    // Extract backup info from run
    return new Response(
      JSON.stringify({
        status: status,
        run_id: latest.id,
        run_number: latest.run_number,
        created_at: latest.created_at,
        updated_at: latest.updated_at,
        trigger: latest.event,
        html_url: latest.html_url,
        duration: latest.run_started_at
          ? Math.round((new Date(latest.updated_at) - new Date(latest.run_started_at)) / 1000)
          : null,
        error: latest.conclusion === 'failure' ? 'Workflow failed — check logs for details' : null
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', error: err.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
