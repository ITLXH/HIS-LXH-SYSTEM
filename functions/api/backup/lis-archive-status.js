import { jsonResponse, requireHisAdmin } from '../../_utils/his-auth.js';
import {
  getLatestLisArchiveRun,
  presentLisArchiveRun,
  readLisArchiveProgress,
} from '../../_utils/lis-archive-control.js';

export async function onRequestGet(ctx) {
  const { env } = ctx;
  const auth = await requireHisAdmin(ctx);
  if (auth.response) return auth.response;

  try {
    const [run, progressResult] = await Promise.all([
      getLatestLisArchiveRun(env),
      readLisArchiveProgress(env).catch((error) => ({ _read_error: error.message })),
    ]);
    const progress = progressResult && !progressResult._read_error ? progressResult : null;
    return jsonResponse({
      success: true,
      ...presentLisArchiveRun(run, progress),
      progress_available: Boolean(progress),
      progress_error: progressResult?._read_error || null,
      server_time: new Date().toISOString(),
      archive_after_days: 14,
      destructive: false,
    });
  } catch (error) {
    return jsonResponse({ success: false, status: 'error', error: error.message }, 500);
  }
}
