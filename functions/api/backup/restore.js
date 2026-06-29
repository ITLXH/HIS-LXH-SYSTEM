import { ghRequest } from '../../_utils/gh-api.js';

// POST /api/backup/restore
//   Body for Supabase source (default):
//     { source: "supabase", backup_name: "backup-2026-06-28.zip", confirm: "RESTORE", dry_run?: false }
//   Body for Google Drive source:
//     { source: "gdrive",   gdrive_file_id: "1AbC...",            confirm: "RESTORE", dry_run?: false }
//
// Triggers the supabase-restore.yml workflow on GitHub. Requires the literal
// string "RESTORE" in `confirm` as a safety gate.

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, error: 'Invalid JSON body' });
  }

  const source = String(body?.source || 'supabase').toLowerCase();
  const confirm = String(body?.confirm || '').trim();
  const dryRun = body?.dry_run === true || body?.dry_run === 'true';

  if (confirm !== 'RESTORE') {
    return json({ success: false, error: 'confirm must be the literal string "RESTORE"' });
  }

  const inputs = { source, dry_run: dryRun ? 'true' : 'false' };

  if (source === 'gdrive') {
    const fileId = String(body?.gdrive_file_id || '').trim();
    if (!fileId) return json({ success: false, error: 'gdrive_file_id is required when source=gdrive' });
    if (!/^[A-Za-z0-9_-]+$/.test(fileId)) return json({ success: false, error: 'Invalid gdrive_file_id' });
    inputs.gdrive_file_id = fileId;
    inputs.backup_name = String(body?.backup_name || '').trim(); // optional display name
  } else if (source === 'supabase') {
    const backupName = String(body?.backup_name || '').trim();
    if (!backupName) return json({ success: false, error: 'backup_name is required when source=supabase' });
    if (backupName.includes('..') || backupName.startsWith('/')) {
      return json({ success: false, error: 'Invalid backup_name' });
    }
    inputs.backup_name = backupName;
  } else {
    return json({ success: false, error: 'source must be "supabase" or "gdrive"' });
  }

  try {
    const owner = env.BACKUP_GH_OWNER || 'ITLXH';
    const repo = env.BACKUP_GH_REPO || 'HIS-LXH-SYSTEM';
    const workflowFile = env.RESTORE_WORKFLOW_FILE || 'supabase-restore.yml';

    await ghRequest(
      env,
      'POST',
      `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
      { ref: 'main', inputs },
    );

    return json({ success: true, message: 'Restore workflow dispatched', source, inputs });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
