import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { onRequestGet } = await import('../functions/api/lis/result-file.js');

const objectPath = 'patients/HN0001/result.pdf';
const bucketPath = `order-result-files/${objectPath}`;
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bucketPath));
const pathHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'public-test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  GOOGLE_DRIVE_FOLDER_ID: 'drive-folder-test',
  GOOGLE_DRIVE_OAUTH_JSON: JSON.stringify({
    type: 'authorized_user',
    client_id: 'client-test',
    client_secret: 'secret-test',
    refresh_token: 'refresh-test',
  }),
};

const originalFetch = globalThis.fetch;
function staffRead(target, options) {
  if (target.endsWith('/auth/v1/user')) return Response.json({id:'STAFF-SYN'});
  if (target.includes('/HIS_One_Users?')) return Response.json([{Status:'active',Role:'doctor',Permissions:'opd'}]);
  if (target.includes('/lis_one_order_result_files?')) return Response.json([{order_id:'ORDER-SYN'}]);
  if (target.includes('/lis_one_test_orders?')) return Response.json([{patient_id:'HN0001'}]);
  if (target.includes('/HIS_One_Patients?')) {
    assert.equal(options.headers.Authorization,'Bearer staff-test');
    return Response.json([{Patient_ID:'HN0001'}]);
  }
  return null;
}
const staffHeaders={Authorization:'Bearer staff-test'};
try {
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    const verified=staffRead(target,options);if(verified)return verified;
    if (target.includes('/storage/v1/object/order-result-files/') && options.method === 'GET') {
      return new Response('%PDF-synthetic', { status: 200,headers:{'Content-Type':'application/pdf'} });
    }
    throw new Error(`Unexpected hot-path request: ${target}`);
  };
  const hot = await onRequestGet({
    request: new Request(`https://his.example/api/lis/result-file?path=${encodeURIComponent(objectPath)}`,{headers:staffHeaders}),
    env,
  });
  assert.equal(hot.status, 200);
  assert.equal(hot.headers.get('Location'),null);
  assert.equal(hot.headers.get('Cache-Control'),'private, no-store');
  assert.equal(await hot.text(),'%PDF-synthetic');

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    const verified=staffRead(target,options);if(verified)return verified;
    if (target.includes('/storage/v1/object/order-result-files/') && options.method === 'GET') {
      return new Response(null, { status: 404 });
    }
    if (target === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'access-test' });
    }
    if (target.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      return Response.json({
        files: [{
          id: 'drive-file-test',
          name: 'lis-result.bin',
          size: '4',
          mimeType: 'application/pdf',
          appProperties: {
            his_source_bucket: 'order-result-files',
            his_source_path_sha256: pathHash,
            his_content_type: 'application/pdf',
          },
        }],
      });
    }
    if (target.includes('/drive/v3/files/drive-file-test?alt=media')) {
      return new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }
    throw new Error(`Unexpected archive-path request: ${target}`);
  };
  const archived = await onRequestGet({
    request: new Request(`https://his.example/api/lis/result-file?path=${encodeURIComponent(objectPath)}`,{headers:staffHeaders}),
    env,
  });
  assert.equal(archived.status, 200);
  assert.equal(archived.headers.get('X-HIS-Storage-Source'), 'google-drive-archive');
  assert.equal((await archived.arrayBuffer()).byteLength, 4);

  const forced = await onRequestGet({
    request: new Request(
      `https://his.example/api/lis/result-file?path=${encodeURIComponent(objectPath)}&source=drive`,
      { headers: staffHeaders },
    ),
    env,
  });
  assert.equal(forced.status, 200);
  assert.equal(forced.headers.get('X-HIS-Storage-Source'), 'google-drive-archive');
  assert.equal((await forced.arrayBuffer()).byteLength, 4);

  const unauthorizedForced = await onRequestGet({
    request: new Request(
      `https://his.example/api/lis/result-file?path=${encodeURIComponent(objectPath)}&source=drive`,
    ),
    env,
  });
  assert.equal(unauthorizedForced.status, 401);

  const invalid = await onRequestGet({
    request: new Request('https://his.example/api/lis/result-file?path=../secret.pdf'),
    env,
  });
  assert.equal(invalid.status, 400);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('LIS result archive gateway tests passed');
