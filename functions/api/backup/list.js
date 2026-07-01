// GET /api/backup/list
// Lists backup ZIP files in the Supabase Storage bucket so the UI can show
// real artifact history and offer a restore picker.

export async function onRequestGet(ctx) {
  const { env } = ctx;

  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = env.SUPABASE_STORAGE_BUCKET || 'his-backups';

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        status: 'error',
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in Cloudflare Pages env',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Supabase Storage `object/list` is NOT recursive — a given prefix returns
  // only its immediate children (sub-"folders" come back as entries with a
  // null `id`/`metadata`). The backup workflow stores zips under
  // `backups/YYYY/MM/backup-*.zip` (see backup/scripts/backup_rest.py), so a
  // flat list of the root finds zero zips. Walk the tree instead.
  async function listPrefix(prefix) {
    const resp = await fetch(
      `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix,
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        }),
      },
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Storage list HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const items = await resp.json();
    return Array.isArray(items) ? items : [];
  }

  // Recursively collect .zip files. Depth cap guards against runaway loops.
  async function collectZips(prefix, depth, acc) {
    if (depth > 5) return;
    const items = await listPrefix(prefix);
    for (const it of items) {
      if (!it || !it.name) continue;
      const full = prefix ? `${prefix}/${it.name}` : it.name;
      const isFolder = it.id === null || it.id === undefined;
      if (isFolder) {
        await collectZips(full, depth + 1, acc);
      } else if (it.name.toLowerCase().endsWith('.zip')) {
        acc.push({
          name: full,
          size: it.metadata?.size ?? null,
          created_at: it.created_at || it.updated_at || it.metadata?.lastModified || null,
          // Full object path — used by signed-url / restore endpoints
          path: full,
        });
      }
    }
  }

  try {
    const zips = [];
    // Walk from the root so both legacy root-level zips and the current
    // backups/YYYY/MM/ layout are covered.
    await collectZips('', 0, zips);
    zips.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return new Response(
      JSON.stringify({ bucket, count: zips.length, files: zips.slice(0, 100) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', error: err.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
