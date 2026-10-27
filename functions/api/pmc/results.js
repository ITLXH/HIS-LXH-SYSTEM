import { clinicalAccess, readIdentity, fail } from '../../_utils/clinical-results.js';
import { jsonResponse } from '../../_utils/his-auth.js';

export async function onRequestGet({ request, env }) {
  const identity = readIdentity(request, ['patientId','visitId']);
  if (!identity) return fail(400, 'One valid patientId and visitId are required');
  try {
    const auth = await clinicalAccess(request, env, identity);
    if (auth.response) return auth.response;
    const origin = new URL(env.PMC_RESULTS_ORIGIN || 'https://pmc.luckxayhospitallaos.com');
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return fail(503, 'PMC results are not configured');
    const upstream = await fetch(new URL(`/api/his/results?${new URLSearchParams(identity)}`, origin), { headers: { Authorization: `Bearer ${auth.accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!upstream.ok) return fail([401,403,404].includes(upstream.status) ? upstream.status : 503, 'PMC results are temporarily unavailable');
    const body = await upstream.json();
    if (body?.schema !== 'pmc-his-results-v1' || body.patientId !== identity.patientId || body.visitId !== identity.visitId || !Array.isArray(body.rows) || body.rows.length > 50 || typeof body.clinicalEnabled !== 'boolean') return fail(502, 'Invalid PMC result identity');
    return jsonResponse(body);
  } catch { return fail(503, 'PMC results are temporarily unavailable'); }
}
