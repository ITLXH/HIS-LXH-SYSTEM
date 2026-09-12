import { requireHisAdmin } from '../../_utils/his-auth.js';
import { getDriveAccessToken, parseDriveCredentials } from '../../_utils/google-drive.js';

// GET /api/backup/gdrive-list
// Lists backup ZIP files in the configured Google Drive folder using the
// OAuth or service-account credentials stored in Cloudflare Pages env. This lets
// the Backup view show Drive backups alongside Supabase Storage backups.
//
// Env vars (Cloudflare Pages):
//   GOOGLE_DRIVE_OAUTH_JSON      — authorized-user JSON with a refresh token
//   GOOGLE_SERVICE_ACCOUNT_JSON  — service-account fallback
//   GOOGLE_DRIVE_FOLDER_ID       — Drive folder ID the SA has access to

export async function onRequestGet(ctx) {
  const { env } = ctx;
  const auth = await requireHisAdmin(ctx);
  if (auth.response) return auth.response;

  const oauthJson = env.GOOGLE_DRIVE_OAUTH_JSON || '';
  const serviceJson = env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID || '';

  if (!oauthJson && !serviceJson) {
    return json({
      status: 'disabled',
      message: 'Google Drive credentials are not configured',
      files: [],
    });
  }
  if (!folderId) {
    return json({ status: 'error', error: 'GOOGLE_DRIVE_FOLDER_ID not set', files: [] });
  }

  const { candidates, failures: parseErrors } = parseDriveCredentials({
    GOOGLE_DRIVE_OAUTH_JSON: oauthJson,
    GOOGLE_SERVICE_ACCOUNT_JSON: serviceJson,
  });
  if (!candidates.length) {
    return json({ status: 'error', error: parseErrors.join('; '), files: [] });
  }

  const q = `'${folderId}' in parents and mimeType='application/zip' and trashed=false`;
  const url =
    'https://www.googleapis.com/drive/v3/files' +
    `?q=${encodeURIComponent(q)}` +
    '&fields=files(id,name,size,createdTime,webViewLink)' +
    '&orderBy=createdTime%20desc' +
    '&pageSize=100' +
    '&supportsAllDrives=true' +
    '&includeItemsFromAllDrives=true';

  const failures = [...parseErrors];
  for (const candidate of candidates) {
    try {
      const token = await getDriveAccessToken(candidate.credentials);
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Drive list HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      const data = await resp.json();
      const files = (data.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size ? parseInt(f.size, 10) : null,
        created_at: f.createdTime || null,
        web_view_link: f.webViewLink || null,
      }));

      return json({
        folder_id: folderId,
        count: files.length,
        files,
        credential_source: candidate.label,
      });
    } catch (err) {
      failures.push(`${candidate.label}: ${err.message}`);
    }
  }

  return json({
    status: 'error',
    error: `Google Drive is unavailable (${failures.join('; ')})`,
    files: [],
    primary_backup_active: true,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
