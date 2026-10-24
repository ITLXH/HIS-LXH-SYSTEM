import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('window.opdTestLisRequest = async function');
const code = source.slice(start, source.indexOf('\n};', start) + 3);
let token = '', requests = [];
const context = vm.createContext({
  currentUser: { id: 'synthetic-staff' }, AbortController,
  window: { setTimeout: () => 1, clearTimeout() {}, opdTestLisApiBase: () => 'https://lis.synthetic.invalid' },
  supabaseClient: { auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } },
  fetch: async (url, init) => { requests.push({ url, init }); return Response.json({ success: true, data: [] }); },
});
vm.runInContext(code, context);
await assert.rejects(context.window.opdTestLisRequest('/api/data', { table: 'lis_one_test_orders' }));
assert.equal(requests.length, 0, 'Missing session must never fall back to public LIS reads');
token = 'synthetic.jwt.token';
await context.window.opdTestLisRequest('/api/data', { table: 'lis_one_test_orders' });
assert.equal(requests[0].init.headers.Authorization, `Bearer ${token}`);
assert.ok(!requests[0].url.includes(token), 'Session token must not enter a URL');
console.log('HIS LIS read client: missing session denied, valid bearer header preserved.');
