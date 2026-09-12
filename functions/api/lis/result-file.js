import { getDriveAccessToken, parseDriveCredentials } from '../../_utils/google-drive.js';

const RESULT_BUCKET = 'order-result-files';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const objectPath = normalizeObjectPath(url.searchParams.get('path'));
  if (!objectPath) return json({ error: 'A valid result-file path is required' }, 400);

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Result-file gateway is not configured' }, 503);

  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const supabaseObjectUrl = `${supabaseUrl}/storage/v1/object/${RESULT_BUCKET}/${encodedPath}`;
  const supabaseResponse = await fetch(supabaseObjectUrl, {
    method: 'HEAD',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (supabaseResponse.ok) {
    return Response.redirect(
      `${supabaseUrl}/storage/v1/object/public/${RESULT_BUCKET}/${encodedPath}`,
      302,
    );
  }
  if (supabaseResponse.status !== 404 && supabaseResponse.status !== 400) {
    return json({ error: `Supabase lookup failed (${supabaseResponse.status})` }, 502);
  }

  const folderId = String(env.GOOGLE_DRIVE_FOLDER_ID || '');
  const { candidates, failures } = parseDriveCredentials(env);
  if (!folderId || !candidates.length) return json({ error: 'Archived result-file storage is unavailable' }, 503);

  const pathHash = await sha256Hex(`${RESULT_BUCKET}/${objectPath}`);
  const query = [
    `'${escapeDriveQuery(folderId)}' in parents`,
    `appProperties has { key='his_source_path_sha256' and value='${pathHash}' }`,
    "trashed=false",
  ].join(' and ');
  const listUrl =
    'https://www.googleapis.com/drive/v3/files' +
    `?q=${encodeURIComponent(query)}` +
    '&fields=files(id,name,size,mimeType,appProperties)' +
    '&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true';

  for (const candidate of candidates) {
    try {
      const token = await getDriveAccessToken(candidate.credentials);
      const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!listResponse.ok) throw new Error(`Drive lookup HTTP ${listResponse.status}`);
      const matches = (await listResponse.json()).files || [];
      const archived = matches.find((item) => {
        const props = item.appProperties || {};
        return props.his_source_bucket === RESULT_BUCKET && props.his_source_path_sha256 === pathHash;
      });
      if (!archived) continue;

      const mediaHeaders = { Authorization: `Bearer ${token}` };
      const requestedRange = request.headers.get('Range');
      if (requestedRange) mediaHeaders.Range = requestedRange;
      const mediaResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(archived.id)}?alt=media&supportsAllDrives=true`,
        { headers: mediaHeaders },
      );
      if (!mediaResponse.ok) throw new Error(`Drive download HTTP ${mediaResponse.status}`);
      const headers = new Headers(mediaResponse.headers);
      headers.set('Content-Type', archived.mimeType || propsContentType(archived.appProperties) || 'application/octet-stream');
      headers.set('Content-Disposition', `inline; filename="${safeFileName(objectPath)}"`);
      headers.set('Cache-Control', 'private, max-age=300');
      headers.set('X-HIS-Storage-Source', 'google-drive-archive');
      return new Response(mediaResponse.body, { status: mediaResponse.status, headers });
    } catch (error) {
      failures.push(`${candidate.label}: ${error.message}`);
    }
  }

  return json({ error: 'Result file was not found in Supabase or the verified Drive archive' }, 404);
}

function normalizeObjectPath(value) {
  const path = String(value || '').trim().replace(/^\/+/, '');
  if (!path || path.length > 1024 || path.includes('..') || path.includes('\\') || path.includes('\0')) return '';
  return path.split('/').filter(Boolean).join('/');
}

function safeFileName(path) {
  return (path.split('/').pop() || 'laboratory-result.pdf').replace(/[^A-Za-z0-9._-]/g, '_').slice(-160);
}

function propsContentType(properties = {}) {
  return String(properties.his_content_type || '').slice(0, 120);
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
