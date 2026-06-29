// POST /api/backup/signed-url  { path: "backup-2026-06-28.zip", expires?: 3600 }
// Returns a one-time signed download URL for a backup ZIP in Supabase Storage.

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = env.SUPABASE_STORAGE_BUCKET || 'his-backups';

  if (!supabaseUrl || !serviceKey) {
    return json({ status: 'error', error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ status: 'error', error: 'Invalid JSON body' });
  }

  const path = String(body?.path || '').trim();
  if (!path) return json({ status: 'error', error: 'path is required' });
  if (path.includes('..') || path.startsWith('/')) {
    return json({ status: 'error', error: 'Invalid path' });
  }

  const expiresIn = Math.min(Math.max(parseInt(body?.expires || '3600', 10) || 3600, 60), 86400);

  try {
    const resp = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      return json({ status: 'error', error: `Sign HTTP ${resp.status}: ${text.slice(0, 200)}` });
    }

    const data = await resp.json();
    const signedPath = data.signedURL || data.signedUrl;
    if (!signedPath) return json({ status: 'error', error: 'No signedURL in response' });

    // Supabase returns a path like /object/sign/bucket/file?token=... — make absolute
    const url = signedPath.startsWith('http')
      ? signedPath
      : `${supabaseUrl}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;

    return json({ url, expires_in: expiresIn });
  } catch (err) {
    return json({ status: 'error', error: err.message });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
