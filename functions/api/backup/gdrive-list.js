// GET /api/backup/gdrive-list
// Lists backup ZIP files in the configured Google Drive folder using the
// service-account credentials stored in Cloudflare Pages env. This lets
// the Backup view show Drive backups alongside Supabase Storage backups.
//
// Env vars (Cloudflare Pages):
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full JSON contents of the service account key
//   GOOGLE_DRIVE_FOLDER_ID       — Drive folder ID the SA has access to

export async function onRequestGet(ctx) {
  const { env } = ctx;

  const saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID || '';

  if (!saJson) {
    return json({
      status: 'disabled',
      message: 'Google Drive not configured (GOOGLE_SERVICE_ACCOUNT_JSON missing)',
      files: [],
    });
  }
  if (!folderId) {
    return json({ status: 'error', error: 'GOOGLE_DRIVE_FOLDER_ID not set', files: [] });
  }

  let sa;
  try {
    sa = JSON.parse(saJson);
  } catch (_) {
    return json({ status: 'error', error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON', files: [] });
  }

  try {
    const token = await getDriveAccessToken(sa);
    const q = `'${folderId}' in parents and mimeType='application/zip' and trashed=false`;
    const url =
      'https://www.googleapis.com/drive/v3/files' +
      `?q=${encodeURIComponent(q)}` +
      '&fields=files(id,name,size,createdTime,webViewLink)' +
      '&orderBy=createdTime%20desc' +
      '&pageSize=100';

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      return json({ status: 'error', error: `Drive list HTTP ${resp.status}: ${text.slice(0, 200)}`, files: [] });
    }
    const data = await resp.json();
    const files = (data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size ? parseInt(f.size, 10) : null,
      created_at: f.createdTime || null,
      web_view_link: f.webViewLink || null,
    }));

    return json({ folder_id: folderId, count: files.length, files });
  } catch (err) {
    return json({ status: 'error', error: err.message, files: [] });
  }
}

// ---------------------------------------------------------------------------
// Service-account → access-token exchange (RS256 JWT).
// Runs inside the Cloudflare Workers runtime, which exposes WebCrypto.
// ---------------------------------------------------------------------------
async function getDriveAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(claim)}`;

  const key = await importPkcs8(sa.private_key);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
      '&assertion=' + encodeURIComponent(jwt),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth token exchange HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.access_token;
}

function base64url(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function importPkcs8(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
