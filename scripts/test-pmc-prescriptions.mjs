import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/pmc/v1/prescriptions.js';

const env = { PMC_PRESCRIPTION_API_ENABLED: 'true', SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'synthetic-public', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server' };
const visit = { Visit_ID: 'VISIT-SYN', Patient_ID: 'PATIENT-SYN', EMR_Revision: 2,
  Prescription_JSON: JSON.stringify([{ prescriptionItemId: 'LINE-SYN', prescriptionBatchId: 'BATCH-SYN', name: 'Synthetic medicine', instructions: 'Synthetic instructions', quantity: '2', status: 'sent_to_pharmacy' }]) };
let role = 'admin'; let active = true; let rows = [visit]; let requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), options });
  if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'synthetic-actor' });
  if (String(url).includes('HIS_One_Users')) return Response.json([{ Role: role, Status: active ? 'active' : 'inactive' }]);
  return Response.json(rows);
};
function run(query = '?visitId=VISIT-SYN&patientId=PATIENT-SYN', token = 'synthetic-user', settings = env) {
  requests = [];
  return onRequestGet({ env: settings, request: new Request(`https://his.example/api/pmc/v1/prescriptions${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }) });
}
try {
  assert.equal((await run('', '', { ...env, PMC_PRESCRIPTION_API_ENABLED: 'false' })).status, 503);
  assert.equal(requests.length, 0);
  assert.equal((await run(undefined, '')).status, 401);
  assert.equal((await run('?visitId=bad&visitId=duplicate&patientId=PATIENT-SYN')).status, 400);
  assert.equal((await run('?visitId=eq.bad&patientId=PATIENT-SYN&extra=1')).status, 400);
  role = 'doctor'; assert.equal((await run()).status, 403);
  role = 'admin'; active = false; assert.equal((await run()).status, 403); active = true;
  let response = await run(); assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  let body = await response.json();
  assert.equal(body.schema, 'his-pmc-source-snapshot-v1');
  assert.equal(body.dispensingAuthorized, false);
  assert.equal(body.lines[0].instructions, 'Synthetic instructions');
  assert.equal(body.lines[0].lineId, 'LINE-SYN');
  assert.ok(body.lines[0].holds.includes('ITEM_MAPPING_REQUIRED'));
  assert.ok(!JSON.stringify(body).includes('synthetic-server'));
  const read = requests.find(item => item.url.includes('HIS_One_Visits'));
  assert.equal(read.options.headers.Authorization, 'Bearer synthetic-user');
  assert.equal(read.options.headers.apikey, 'synthetic-public');
  const filter = new URL(read.url).searchParams;
  assert.equal(filter.get('Visit_ID'), 'eq.VISIT-SYN');
  assert.equal(filter.get('Patient_ID'), 'eq.PATIENT-SYN');
  assert.equal(filter.get('limit'), '2');
  rows = [{ ...visit, Patient_ID: 'OTHER-SYN' }]; assert.equal((await run()).status, 409);
  rows = []; assert.equal((await run()).status, 404);
  rows = [visit, visit]; assert.equal((await run()).status, 409);
  rows = [{ ...visit, EMR_Revision: 0 }]; assert.equal((await run()).status, 409);
  rows = [{ ...visit, Prescription_JSON: '{bad' }]; assert.equal((await run()).status, 409);
  rows = [{ ...visit, Prescription_JSON: JSON.stringify([{ name: 'Legacy synthetic' }]) }];
  body = await (await run()).json(); assert.ok(body.lines[0].holds.includes('STABLE_LINE_ID_REQUIRED'));
  rows = [{ ...visit, Prescription_JSON: JSON.stringify([{ prescriptionItemId: 'DUP' }, { prescriptionItemId: 'DUP' }]) }];
  assert.equal((await run()).status, 409);
  rows = [{ ...visit, Prescription_JSON: JSON.stringify([{ prescriptionItemId: 'LINE', instructions: 'x'.repeat(2001) }]) }];
  assert.equal((await run()).status, 409);
  rows = [{ ...visit, Prescription_JSON: JSON.stringify([{ prescriptionItemId: 'LINE', quantity: '0.5' }]) }];
  body = await (await run()).json(); assert.ok(!body.lines[0].holds.includes('QUANTITY_REVIEW_REQUIRED'));
  globalThis.fetch = async () => { throw new Error('private failure details'); };
  response = await run(); assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private failure details'));
  console.log('PMC prescription API synthetic checks passed');
} finally { globalThis.fetch = originalFetch; }
