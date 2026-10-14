import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional read-only cross-repository test. Supply the inspected LIS checkout.
const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node scripts/test-lis-upstream-errors.mjs <LIS checkout>');
const { onRequest } = await import(pathToFileURL(path.resolve(checkout, 'functions/api/data.js')));
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalLog = console.log;
let calls = 0;
try {
  console.error = () => {};
  console.log = () => {};
  globalThis.fetch = async url => {
    calls++;
    assert.equal(String(url).startsWith('https://supabase.invalid/rest/v1/'), true);
    return Response.json({ code: '42703', message: 'test missing column' }, { status: 400 });
  };
  const response = await onRequest({
    request: new Request('https://lis.invalid/api/data', { method: 'POST', body: JSON.stringify({ action: 'select', table: 'lis_one_test_orders' }) }),
    env: { SUPABASE_URL: 'https://supabase.invalid', SUPABASE_ANON_KEY: 'test-key' },
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, '42703');
  assert.equal(calls, 1, 'LIS proxy forwards one read without a retry loop');
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  console.log = originalLog;
}
console.log('LIS proxy upstream SQL-error propagation check passed (mocked network).');
