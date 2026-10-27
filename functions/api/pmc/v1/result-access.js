import { clinicalAccess, readIdentity, fail } from '../../../_utils/clinical-results.js';
import { jsonResponse } from '../../../_utils/his-auth.js';

/** Read authorization only; never returns prescriptions or confers dispensing authority. */
export async function onRequestGet({ request, env }) {
  const identity = readIdentity(request, ['patientId','visitId']);
  if (!identity) return fail(400, 'One valid patientId and visitId are required');
  try {
    const auth = await clinicalAccess(request, env, identity);
    return auth.response || jsonResponse({ schema: 'his-pmc-result-access-v1', ...identity });
  } catch { return fail(503, 'Clinical access could not be verified'); }
}
