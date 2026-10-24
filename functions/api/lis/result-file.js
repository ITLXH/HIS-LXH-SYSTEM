import { getDriveAccessToken, parseDriveCredentials } from '../../_utils/google-drive.js';
import { requireHisStaff } from '../../_utils/his-auth.js';

const RESULT_BUCKET = 'order-result-files';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const objectPath = normalizeObjectPath(url.searchParams.get('path'));
  if (!objectPath) return json({ error: 'A valid result-file path is required' }, 400);

  const auth = await requireHisStaff({ request, env });
  if (auth.response) return auth.response;
  if (!canViewResultFiles(auth.profile)) return json({ error: 'Permission to view result files is required' }, 403);

  const patientId = patientIdFromPath(objectPath);
  if (!patientId) return json({ error: 'The result-file path is not linked to a patient' }, 400);

  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Result-file gateway is not configured' }, 503);

  const forceDrive = url.searchParams.get('source') === 'drive';
  const patientResponse = await fetch(
    `${supabaseUrl}/rest/v1/HIS_One_Patients?Patient_ID=eq.${encodeURIComponent(patientId)}&select=Patient_ID&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_ANON_KEY || serviceKey,
        Authorization: `Bearer ${auth.accessToken}`,
      },
    },
  );
  if (patientResponse.status === 401) return json({ error: 'Invalid or expired session' }, 401);
  if (patientResponse.status === 403) return json({ error: 'Patient access is not permitted' }, 403);
  if (!patientResponse.ok) return json({ error: 'Unable to verify patient access' }, 503);
  const patientRows = await patientResponse.json();
  if (!Array.isArray(patientRows) || !patientRows.some(row => String(row.Patient_ID) === patientId)) {
    return json({ error: 'Patient not found or access is not permitted' }, 404);
  }

  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const supabaseObjectUrl = `${supabaseUrl}/storage/v1/object/${RESULT_BUCKET}/${encodedPath}`;
  if (!forceDrive) {
    const supabaseResponse = await fetch(supabaseObjectUrl, {
      method: 'GET',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (supabaseResponse.ok) {
      return resultResponse(supabaseResponse, objectPath, 'supabase-storage');
    }
    if (supabaseResponse.status !== 404 && supabaseResponse.status !== 400) {
      return json({ error: `Supabase lookup failed (${supabaseResponse.status})` }, 502);
    }
  }

  const folderId = String(env.GOOGLE_DRIVE_FOLDER_ID || '');
  const { candidates, failures } = parseDriveCredentials(env);
  if (!folderId || !candidates.length) return json({ error: 'Archived result-file storage is unavailable' }, 503);

  const pathHash = await sha256Hex(`${RESULT_BUCKET}/${objectPath}`);
  const safeFolderId = escapeDriveQuery(folderId);
  const query = [
    `('${safeFolderId}' in parents or appProperties has { key='his_archive_root_id' and value='${safeFolderId}' })`,
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
      const response = resultResponse(mediaResponse, objectPath, 'google-drive-archive');
      response.headers.set('Content-Type', archived.mimeType || propsContentType(archived.appProperties) || 'application/octet-stream');
      return response;
    } catch (error) {
      failures.push(`${candidate.label}: ${error.message}`);
    }
  }

  return json({ error: 'Result file was not found in Supabase or the verified Drive archive' }, 404);
}

function canViewResultFiles(profile) {
  if (String(profile?.Role || '').toLowerCase() === 'admin') return true;
  const pages = String(profile?.Permissions || '').toLowerCase().split(',').map(value => value.trim());
  return ['opd', 'visit_history', 'patients', 'labs', 'report'].some(page => pages.includes(page));
}

function patientIdFromPath(path) {
  const segments = path.split('/');
  const id = ['patient', 'patients'].includes(String(segments[0] || '').toLowerCase())
    ? segments[1]
    : segments[0];
  return /^[A-Za-z0-9_-]{2,40}$/.test(id || '') ? id : '';
}

function resultResponse(upstream, objectPath, source) {
  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
    'Content-Disposition': `inline; filename="${safeFileName(objectPath)}"`,
    'Cache-Control': 'private, no-store',
    'X-HIS-Storage-Source': source,
    'X-Content-Type-Options': 'nosniff',
  });
  for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
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
