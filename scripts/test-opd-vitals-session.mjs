import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const names = ['fetchLatestOpdVitalsByVisitIds', 'fetchLatestOpdVitalForPatient'];
function harness(session, result = { data: [], error: null }) {
  const reads = [];
  const query = { select() { return this; }, in() { return this; }, eq() { return this; },
    order() { return this; }, limit() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
  const context = vm.createContext({ window: { ipdNeedsMigration: () => false },
    supabaseClient: { auth: { getSession: async () => ({ data: { session }, error: null }) },
      from(table) { reads.push(table); return query; } },
    dbTable: name => `HIS_One_${name}`, console: { warn() {} } });
  for (const name of names) {
    const start = source.indexOf(`window.${name} = async function`);
    assert.ok(start > 0);
    const end = source.indexOf('\n};', start) + 3;
    vm.runInContext(source.slice(start, end), context);
  }
  return { api: context.window, reads };
}
for (const session of [null, {}]) {
  for (const name of names) {
    const h = harness(session);
    await assert.rejects(h.api[name](name === names[0] ? ['SYN-V'] : 'SYN-P'), e => e.code === 'HIS_AUTH_REQUIRED');
    assert.equal(h.reads.length, 0, 'missing session must not issue anonymous clinical queries');
  }
}
for (const name of names) {
  const h = harness({ access_token: 'synthetic-token', user: { id: 'synthetic-staff' } },
    { data: null, error: { code: '42501', message: 'Synthetic permission denied' } });
  await assert.rejects(h.api[name](name === names[0] ? ['SYN-V'] : 'SYN-P'), e => e.code === '42501');
  assert.deepEqual(h.reads, ['HIS_One_OPD_Vital_Signs'], 'authorization failure must not fall through to Visits');
}
const staff = harness({ access_token: 'synthetic-token', user: { id: 'synthetic-staff' } },
  { data: [{ Visit_ID: 'SYN-V', Patient_ID: 'SYN-P', Temperature: 37 }], error: null });
assert.equal((await staff.api.fetchLatestOpdVitalsByVisitIds(['SYN-V']))['SYN-V'].Temperature, 37);
assert.equal((await staff.api.fetchLatestOpdVitalForPatient('SYN-P')).Temperature, 37);
assert.equal(Object.keys(await harness(null).api.fetchLatestOpdVitalsByVisitIds([])).length, 0);
console.log('PASS OPD vitals: signed-out requests blocked before SQL, authorization failures preserved, signed-in reads unchanged.');
