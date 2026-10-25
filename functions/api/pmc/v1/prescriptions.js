import { requireHisStaff, jsonResponse } from '../../../_utils/pmc-read-auth.js';

const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const fail = (status, error) => jsonResponse({ error }, status);

/** Source snapshot only. It never grants dispensing authority or changes HIS/PMC state. */
export async function onRequestGet({ request, env }) {
  if (env.PMC_PRESCRIPTION_API_ENABLED !== 'true') return fail(503, 'Pharmacy export is not enabled');
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some(key => !['visitId', 'patientId'].includes(key))
    || ['visitId', 'patientId'].some(key => url.searchParams.getAll(key).length !== 1 || !identifier(url.searchParams.get(key)))) {
    return fail(400, 'One valid visitId and patientId are required');
  }
  try {
    const auth = await requireHisStaff({ request, env });
    if (auth.response) return auth.response;
    // Existing user JWT/RLS is still authoritative for the exact clinical row.
    if (!['admin', 'pharmacy'].includes(String(auth.profile.Role).toLowerCase())) return fail(403, 'Pharmacy role required');
    if (!env.SUPABASE_ANON_KEY) return fail(503, 'Pharmacy export is not configured');
    const query = new URLSearchParams({
      select: 'Visit_ID,Patient_ID,EMR_Revision,Prescription_JSON',
      Visit_ID: `eq.${url.searchParams.get('visitId')}`,
      Patient_ID: `eq.${url.searchParams.get('patientId')}`,
      limit: '2',
    });
    const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/HIS_One_Visits?${query}`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.accessToken}` },
    });
    if (response.status === 401 || response.status === 403) return fail(response.status, 'Clinical access denied');
    if (!response.ok) return fail(503, 'Prescription source is unavailable');
    const rows = await response.json();
    if (!Array.isArray(rows)) return fail(503, 'Invalid source response');
    if (!rows.length) return fail(404, 'Visit not found or access denied');
    if (rows.length !== 1) return fail(409, 'Ambiguous visit identity');
    const row = rows[0];
    if (row.Visit_ID !== url.searchParams.get('visitId') || row.Patient_ID !== url.searchParams.get('patientId')) return fail(409, 'Visit identity mismatch');
    if (!Number.isSafeInteger(row.EMR_Revision) || row.EMR_Revision < 1) return fail(409, 'Reliable encounter revision required');
    let medications;
    try { medications = typeof row.Prescription_JSON === 'string' ? JSON.parse(row.Prescription_JSON || '[]') : row.Prescription_JSON; }
    catch { return fail(409, 'Invalid stored prescription'); }
    if (!Array.isArray(medications) || medications.length > 100) return fail(409, 'Invalid stored prescription');
    const seen = new Set();
    const lines = [];
    for (const source of medications) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return fail(409, 'Invalid prescription line');
      if (['prescriptionItemId', 'localMedicationId', 'prescriptionBatchId', 'batchId', 'name', 'instructions', 'dose', 'route', 'frequency', 'duration', 'quantity', 'pharmacyStatus', 'status']
        .some(key => typeof source[key] === 'string' && source[key].length > 2000)) return fail(409, 'Prescription field exceeds export limit');
      const lineId = text(source.prescriptionItemId || source.localMedicationId);
      if (lineId && seen.has(lineId)) return fail(409, 'Duplicate prescription line identity');
      if (lineId) seen.add(lineId);
      const holds = ['ITEM_MAPPING_REQUIRED', 'UNIT_MAPPING_REQUIRED', 'SOURCE_CONFIRMATION_REQUIRED'];
      if (!identifier(lineId)) holds.push('STABLE_LINE_ID_REQUIRED');
      if (!text(source.instructions)) holds.push('PRESCRIBER_INSTRUCTIONS_REQUIRED');
      const quantity = text(source.quantity);
      if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(quantity) || Number(quantity) <= 0) holds.push('QUANTITY_REVIEW_REQUIRED');
      lines.push({ lineId: identifier(lineId) ? lineId : null,
        batchId: text(source.prescriptionBatchId || source.batchId) || null,
        medicineName: text(source.name), instructions: text(source.instructions),
        dose: text(source.dose), route: text(source.route), frequency: text(source.frequency),
        duration: text(source.duration), quantity, sourceStatus: text(source.pharmacyStatus || source.status), holds });
    }
    return jsonResponse({ schema: 'his-pmc-source-snapshot-v1',
      patientVisit: { canonicalPatientId: row.Patient_ID, visitId: row.Visit_ID },
      encounterRevision: row.EMR_Revision, dispensingAuthorized: false,
      cancellationComplete: false, lines });
  } catch { return fail(503, 'Prescription source is unavailable'); }
}
