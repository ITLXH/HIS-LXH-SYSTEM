import { requireHisStaff, jsonResponse } from './his-auth.js';

export const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
export const released = row => ['Reported', 'Approved'].includes(row?.status);
export const fail = (status, error) => jsonResponse({ error }, status);

export function readIdentity(request, keys) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => !keys.includes(key)) || keys.some(key => params.getAll(key).length !== 1 || !identifier(params.get(key)))) return null;
  return Object.fromEntries(keys.map(key => [key, params.get(key)]));
}

/** Establish active clinical staff and caller-RLS visibility before any service read. */
export async function clinicalAccess(request, env, identity) {
  const auth = await requireHisStaff({ request, env });
  if (auth.response) return auth;
  if (auth.authUser?.app_metadata?.password_change_required === true) return { response: fail(403, 'Password change required') };
  if (!['admin', 'doctor', 'nurse', 'lab', 'pharmacy'].includes(String(auth.profile.Role).toLowerCase())) return { response: fail(403, 'Clinical permission required') };
  if (!env.SUPABASE_ANON_KEY) return { response: fail(503, 'Clinical reads are not configured') };
  const table = identity.visitId ? 'HIS_One_Visits' : 'HIS_One_Patients';
  const query = new URLSearchParams({ select: identity.visitId ? 'Visit_ID,Patient_ID' : 'Patient_ID', Patient_ID: `eq.${identity.patientId}`, limit: '2' });
  if (identity.visitId) query.set('Visit_ID', `eq.${identity.visitId}`);
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/${table}?${query}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.accessToken}` }, redirect: 'manual', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return { response: fail([401,403].includes(response.status) ? response.status : 503, 'Clinical access could not be verified') };
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].Patient_ID !== identity.patientId || (identity.visitId && rows[0].Visit_ID !== identity.visitId)) return { response: fail(404, 'Patient/visit not found or access denied') };
  return auth;
}

export async function readUxi(env, patientId, orderId) {
  const query = new URLSearchParams({ select: 'id,cn,status,ordered_at,reported_at,approved_at,report,exams,result_files', cn: `eq.${patientId}`, status: 'in.(Reported,Approved)', order: 'ordered_at.desc,id.asc', limit: orderId ? '2' : '51' });
  if (orderId) query.set('id', `eq.${orderId}`);
  const response = await fetch(`${String(env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1/UXI_One_main_imaging_orders?${query}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, redirect: 'manual', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Error('UXI results unavailable');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw Error('Invalid UXI response');
  return rows.filter(row => row.cn === patientId && released(row) && (!orderId || row.id === orderId));
}

export function safeUxiFiles(row) {
  const allowed = ['application/pdf','image/bmp','image/png','image/jpeg','image/webp'];
  return (Array.isArray(row.result_files) ? row.result_files : []).filter(file => identifier(file?.id) && allowed.includes(file.type) && typeof file.storagePath === 'string' && file.storagePath.startsWith(`${row.id}/`) && !/[\\\x00-\x1f]/.test(file.storagePath) && !file.storagePath.split('/').some(segment => !segment || segment === '.' || segment === '..') && file.storagePath.length <= 1024).slice(0,100);
}
