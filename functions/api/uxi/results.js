import { clinicalAccess, readIdentity, readUxi, safeUxiFiles, fail } from '../../_utils/clinical-results.js';
import { jsonResponse } from '../../_utils/his-auth.js';

export async function onRequestGet({ request, env }) {
  const identity = readIdentity(request, ['patientId']);
  if (!identity) return fail(400, 'One valid patientId is required');
  try {
    const auth = await clinicalAccess(request, env, identity);
    if (auth.response) return auth.response;
    const rows = await readUxi(env, identity.patientId);
    return jsonResponse({ schema: 'his-uxi-results-v1', patientId: identity.patientId, hasMore: rows.length > 50, results: rows.slice(0,50).map(row => ({
      id: row.id, scope: 'patient-history', status: row.status, orderedAt: row.ordered_at, reportedAt: row.approved_at || row.reported_at,
      report: typeof row.report === 'string' ? row.report.slice(0,60000) : '',
      exams: (Array.isArray(row.exams) ? row.exams : []).slice(0,100).map(exam => ({ name: String(exam.name || '').slice(0,300), modality: String(exam.modality || '').slice(0,80) })),
      files: safeUxiFiles(row).map(file => ({ id: file.id, name: String(file.name || 'Result').slice(0,200), type: file.type, url: `/api/uxi/result-file?${new URLSearchParams({patientId:identity.patientId,orderId:row.id,fileId:file.id})}` })),
    })) });
  } catch { return fail(503, 'UXI results are temporarily unavailable'); }
}
