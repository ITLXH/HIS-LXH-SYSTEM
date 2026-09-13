import { ghRequest } from '../../_utils/gh-api.js';
import { jsonResponse, requireHisAdmin } from '../../_utils/his-auth.js';
import { getLatestLisArchiveRun, lisArchiveConfig } from '../../_utils/lis-archive-control.js';

// Starts a safe copy-and-verify pass. This endpoint never requests cleanup and
// therefore never removes a source object from Supabase.
export async function onRequestPost(ctx) {
  const { env } = ctx;
  const auth = await requireHisAdmin(ctx);
  if (auth.response) return auth.response;

  try {
    const latest = await getLatestLisArchiveRun(env);
    if (latest && ['queued', 'in_progress', 'pending', 'waiting'].includes(latest.status)) {
      return jsonResponse({
        success: false,
        status: 'already_running',
        error: 'A LIS archive run is already active',
        run_id: latest.id,
        run_number: latest.run_number,
        html_url: latest.html_url,
      }, 409);
    }

    const config = lisArchiveConfig(env);
    await ghRequest(
      env,
      'POST',
      `/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowFile)}/dispatches`,
      {
        ref: 'main',
        inputs: {
          mode: 'copy',
          archive_after_days: '14',
          max_objects: '0',
          confirmation: '',
          verify_gateway: 'true',
        },
      },
    );

    return jsonResponse({
      success: true,
      message: 'LIS archive copy and verification started',
      previous_run_id: latest?.id || null,
      archive_after_days: 14,
      destructive: false,
    });
  } catch (error) {
    console.error('LIS archive dispatch error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
