import { clinicalAccess, readIdentity, readUxi, safeUxiFiles, fail } from '../../_utils/clinical-results.js';
import { readClinicalFile } from '../../_utils/clinical-file.js';

export async function onRequestGet({ request, env }) {
  const identity = readIdentity(request, ['patientId','orderId','fileId']);
  if (!identity) return fail(400, 'One valid patientId, orderId and fileId are required');
  try {
    const auth = await clinicalAccess(request, env, identity);
    if (auth.response) return auth.response;
    const rows = await readUxi(env, identity.patientId, identity.orderId);
    if (rows.length !== 1) return fail(404, 'Released result not found');
    const matches = safeUxiFiles(rows[0]).filter(file => file.id === identity.fileId);
    if (matches.length !== 1) return fail(404, 'Released result file not found');
    const file = matches[0];
    return await readClinicalFile(request, env, 'uxi-results', file.storagePath, file.type) || fail(404, 'File not found in Storage or verified Drive archive');
  } catch { return fail(503, 'UXI file is temporarily unavailable'); }
}
