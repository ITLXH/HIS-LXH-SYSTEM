// Read-only audit: execute actual UXI schema check against in-memory responses.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const uxiRoot = path.resolve(process.argv[2] || '../UXI-LXH-main');
const source = fs.readFileSync(path.join(uxiRoot, 'src/lib/supabase.ts'), 'utf8');
const app = fs.readFileSync(path.join(uxiRoot, 'src/App.tsx'), 'utf8');
const sql = fs.readFileSync(path.join(uxiRoot, 'supabase/cloud-migration.sql'), 'utf8');
const start = source.indexOf('export async function checkSchema()');
const end = source.indexOf('function toIsoOrNull', start);
assert.ok(start >= 0 && end > start, 'actual UXI schema check must be found');
const check = source.slice(start, end)
  .replace('export async function checkSchema(): Promise<SchemaStatus>', 'async function checkSchema()')
  .replace('const missing: string[]', 'const missing')
  .replace('.error as { code?: string; message?: string } | null', '.error');
const requests = [];
let responseCode = '22023';
const client = {
  from(table) { return {
    select() { return this; }, eq() { return this; },
    limit: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: { active: true }, error: null }),
  }; },
  auth: { getSession: async () => ({ data: { session: { user: { id: 'SYNTHETIC_ADMIN' } } } }) },
  rpc: async (name, args) => {
    requests.push({ name, args });
    return { data: null, error: { code: responseCode, message: responseCode === '22023' ? 'Invalid dataset' : 'Synthetic unexpected failure' } };
  },
};
const context = vm.createContext({ supabase: client, ORDER_TABLE: 'UXI_One_main_imaging_orders', EXAM_CATALOG_TABLE: 'UXI_One_main_imaging_exam_catalog', extensionColumns: [], missingOrderColumns: new Set(),
  classifyError: error => ({ ready: false, reason: 'unknown', message: error.message }),
});
vm.runInContext(check, context);
for (let i = 0; i < 3; i++) {
  const status = await context.checkSchema();
  assert.equal(status.ready, true, 'expected invalid probe does not fail UI readiness');
  assert.equal(status.writable, true);
}
assert.equal(requests.length, 3, 'every readiness call repeats the failed save probe');
for (const request of requests) {
  assert.equal(request.name, 'uxi_save_app_state');
  assert.equal(request.args.p_key, 'invalid');
  assert.equal(request.args.p_expected_revision, 0);
  assert.equal(Object.keys(request.args.p_data).length, 0);
}
responseCode = 'XX000';
assert.equal((await context.checkSchema()).ready, false, 'unexpected RPC errors still fail readiness');
const rpcSql = sql.slice(sql.indexOf('create or replace function public.uxi_save_app_state'));
assert.match(rpcSql, /raise exception 'Invalid dataset' using errcode = '22023'/);
assert.ok(rpcSql.indexOf("raise exception 'Invalid dataset'") < rpcSql.indexOf('insert into public."UXI_One_main_app_state"'), 'invalid-key validation precedes state writes');
const refresh = app.slice(app.indexOf('async function refreshCloudData()'), app.indexOf('async function retrySchemaCheck()'));
assert.match(refresh, /setSchemaStatus\(await checkSchema\(\)\)/);
assert.match(refresh, /setInterval\(retryPendingSync, 30000\)/);
console.log('PASS actual UXI schema check repeats the intentional invalid save probe while reporting readiness.');
console.log('PASS unexpected errors still fail readiness; source connects the probe to periodic sync.');
console.log('Synthetic in-memory audit only: no live RPCs, database execution or UXI source changes.');
