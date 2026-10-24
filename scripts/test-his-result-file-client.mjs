import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

function assignment(name) {
  const start = main.indexOf(`window.${name} = `);
  assert.notEqual(start, -1, `missing window.${name}`);
  const end = main.indexOf('\n};', start);
  assert.notEqual(end, -1, `unterminated window.${name}`);
  return main.slice(start, end + 3);
}

const names = [
  'normalizeLisResultNotification',
  'fetchHisResultBlob',
  'openHisResultFile',
  'openLisResultNotification',
  'opdTestOpenLisResult',
];
const snippets = names.map(assignment);
const requests = [];
const revoked = [];
const popup = { location: { replace(value) { this.value = value; } }, close() {}, opener: {} };
let modalOptions;
class TestURL extends URL {}
TestURL.createObjectURL = () => 'blob:synthetic-result';
TestURL.revokeObjectURL = value => revoked.push(value);
const context = {
  window: {
    isLisResultNotificationRecipient: () => true,
    location: { href: 'https://his.example/app', origin: 'https://his.example' },
    opdTestLisPublicFileUrl: path => `/api/lis/result-file?path=${encodeURIComponent(path)}`,
    opdTestState: { lisResults: [{ publicUrl: '/api/lis/result-file?path=patients%2FSYN-1%2Fresult.pdf', fileName: 'synthetic.pdf', orderId: 'ORDER-SYN-1' }] },
    opdTestSelectedVisit: { patientId: 'SYN-1', patientName: 'Synthetic Patient' },
    opdTestHtml: value => String(value ?? ''),
    opdTestLisResultSequence: () => 1,
    opdTestSimpleAlert() {},
    Swal: { fire(options) { modalOptions = options; return Promise.resolve({ isDenied: false }); } },
    open() { return popup; },
    setTimeout() {},
  },
  supabaseClient: { auth: { async getSession() { return { data: { session: { access_token: 'synthetic-session' } } }; } } },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return new Response(new Blob(['synthetic-pdf'], { type: 'application/pdf' }), { status: 200 });
  },
  URL: TestURL,
  document: { getElementById() { return { textContent: 'Synthetic Patient' }; } },
};

vm.runInNewContext(`let lisActiveResultAlerts = [{ fileId: 'FILE-SYN-1', publicUrl: '/api/lis/result-file?path=patients%2FSYN-1%2Fresult.pdf' }];\n${snippets.join('\n')}`, context);

const normalized = await vm.runInNewContext(`window.normalizeLisResultNotification({ id: 'FILE-SYN-1', storagePath: 'patients/SYN-1/result.pdf', publicUrl: 'https://public.example/result.pdf', order: { patient_id: 'SYN-1', patient_name: 'Synthetic Patient' } })`, context);
assert.equal(normalized.publicUrl, '/api/lis/result-file?path=patients%2FSYN-1%2Fresult.pdf');
assert.equal(normalized.storagePath, 'patients/SYN-1/result.pdf');

const blob = await vm.runInNewContext(`window.fetchHisResultBlob('/api/lis/result-file?path=patients%2FSYN-1%2Fresult.pdf')`, context);
assert.equal(blob.type, 'application/pdf');
assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer synthetic-session');
const requestCount = requests.length;
await assert.rejects(
  vm.runInNewContext(`window.fetchHisResultBlob('https://public.example/result.pdf')`, context),
  /Invalid result-file URL/
);
assert.equal(requests.length, requestCount);

await vm.runInNewContext(`window.openLisResultNotification('FILE-SYN-1')`, context);
assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer synthetic-session');
assert.equal(popup.location.value, 'blob:synthetic-result');

await vm.runInNewContext(`window.opdTestOpenLisResult(0, 1)`, context);
await new Promise(resolve => setImmediate(resolve));
assert.match(modalOptions.html, /src="blob:synthetic-result#/);
assert.doesNotMatch(modalOptions.html, /src="\/api\/lis\/result-file/);
assert.ok(revoked.includes('blob:synthetic-result'));

context.supabaseClient.auth.getSession = async () => ({ data: { session: null }, error: null });
const requestCountBeforeLogout = requests.length;
await assert.rejects(
  vm.runInNewContext(`window.fetchHisResultBlob('/api/lis/result-file?path=patients%2FSYN-1%2Fresult.pdf')`, context),
  /login/
);
assert.equal(requests.length, requestCountBeforeLogout);

context.supabaseClient.auth.getSession = async () => ({ data: { session: { access_token: 'synthetic-session' } } });
context.fetch = async () => { context.window.clinicalPresentationEpoch = 1; return new Response(new Blob(['synthetic'])); };
await assert.rejects(vm.runInNewContext(`window.fetchHisResultBlob('/api/lis/result-file?path=synthetic.pdf')`, context), /login/);
console.log('Authenticated LIS result-file client checks passed.');
