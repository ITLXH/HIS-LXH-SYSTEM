import { getDriveAccessToken, parseDriveCredentials } from './google-drive.js';

/** Called only after released-result metadata and patient access have been verified. */
export async function readClinicalFile(request, env, bucket, path, contentType) {
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const upstream = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (upstream.ok) return fileResponse(upstream, path, contentType);
  if (![400,404].includes(upstream.status)) throw Error('Storage temporarily unavailable');
  const root = String(env.GOOGLE_DRIVE_FOLDER_ID || '');
  if (!root) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bucket}/${path}`));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  const escape = value => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeRoot = escape(root);
  const query = `('${safeRoot}' in parents or appProperties has { key='his_archive_root_id' and value='${safeRoot}' }) and appProperties has { key='his_source_path_sha256' and value='${hash}' } and trashed=false`;
  const { candidates } = parseDriveCredentials(env);
  for (const candidate of candidates) {
    try {
      const token = await getDriveAccessToken(candidate.credentials);
      const options = { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) };
      const listed = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,appProperties)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`, options);
      if (!listed.ok) continue;
      const matches = (await listed.json()).files || [];
      const item = matches.find(file => file.appProperties?.his_source_bucket === bucket && file.appProperties?.his_source_path_sha256 === hash);
      if (!item) continue;
      const media = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`, options);
      if (media.ok) return fileResponse(media, path, contentType);
    } catch { /* Try the next configured archive credential without exposing details. */ }
  }
  return null;
}

function fileResponse(upstream, path, type) {
  return new Response(upstream.body, { status: upstream.status, headers: {
    'Content-Type': type,
    'Content-Disposition': `inline; filename="${path.split('/').pop().replace(/[^A-Za-z0-9._-]/g,'_').slice(-160)}"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
