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

  try {
    // Storage list API: POST {prefix, limit, sortBy}
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
          prefix: '',
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        }),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({ status: 'error', error: `Storage list HTTP ${resp.status}: ${text.slice(0, 200)}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const items = await resp.json();
    const zips = (Array.isArray(items) ? items : [])
      .filter((it) => it && it.name && it.name.toLowerCase().endsWith('.zip'))
      .map((it) => ({
        name: it.name,
        size: it.metadata?.size ?? null,
        created_at: it.created_at || it.updated_at || null,
        // Public download URL via signed-URL endpoint (the FE will request one when restoring)
        path: it.name,
      }));

    return new Response(
      JSON.stringify({ bucket, count: zips.length, files: zips }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', error: err.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
