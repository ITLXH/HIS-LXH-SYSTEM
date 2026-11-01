const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sourceId = /^[A-Za-z0-9_-]{1,120}$/;
const reply = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function sameToken(actual, expected) {
  if (!actual || !expected) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(actual), digest(expected)]);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}

export async function onRequestPost({ request, env }, fetcher = fetch) {
  if (env.HIS_DELIVERY_ENABLED !== 'true') return reply(503, { error: 'DELIVERY_DISABLED' });
  if (typeof env.HIS_DELIVERY_TOKEN !== 'string' || env.HIS_DELIVERY_TOKEN.length < 32 || !env.SUPABASE_SERVICE_ROLE_KEY) return reply(503, { error: 'DELIVERY_NOT_CONFIGURED' });
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.length <= 4200 && /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  if (!match || !await sameToken(match[1], env.HIS_DELIVERY_TOKEN)) return reply(401, { error: 'UNAUTHORIZED' });
  let db;
  try {
    db = new URL(env.SUPABASE_URL);
    if (db.protocol !== 'https:' || db.username || db.password || db.pathname !== '/' || db.search || db.hash) throw Error();
  } catch { return reply(503, { error: 'DELIVERY_NOT_CONFIGURED' }); }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return reply(400, { error: 'INVALID_RECEIPT' });
  let input;
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048) throw Error();
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    const decoder = new TextDecoder();let raw = '', size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 2048) { await reader.cancel();throw Error(); }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    input = JSON.parse(raw);
    if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'eventId,patientId,revision,status,visitId'
      || !uuid.test(input.eventId) || !sourceId.test(input.patientId) || !sourceId.test(input.visitId)
      || !Number.isSafeInteger(input.revision) || input.revision < 1 || input.status !== 'ACCEPTED'
      || request.headers.get('idempotency-key') !== input.eventId) throw Error();
  } catch { return reply(400, { error: 'INVALID_RECEIPT' }); }
  try {
    const result = await fetcher(new URL('/rest/v1/rpc/pmc_record_order_receipt_v1', db), {
      method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_event_id: input.eventId, p_patient_id: input.patientId, p_visit_id: input.visitId, p_revision: input.revision }),
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!result.ok) return reply(result.status === 409 ? 409 : 503, { error: 'RECEIPT_UNAVAILABLE' });
    const saved = await result.json();
    if (saved?.status !== 'ACKNOWLEDGED' || saved?.eventId !== input.eventId) return reply(502, { error: 'INVALID_PERSISTED_RECEIPT' });
    return reply(200, { status: 'ACKNOWLEDGED', eventId: input.eventId });
  } catch { return reply(503, { error: 'RECEIPT_UNAVAILABLE' }); }
}
