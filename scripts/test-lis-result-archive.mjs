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
try {
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/storage/v1/object/order-result-files/') && options.method === 'HEAD') {
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected hot-path request: ${target}`);
  };
  const hot = await onRequestGet({
    request: new Request(`https://his.example/api/lis/result-file?path=${encodeURIComponent(objectPath)}`),
    env,
  });
  assert.equal(hot.status, 302);
  assert.match(hot.headers.get('Location') || '', /storage\/v1\/object\/public\/order-result-files/);

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/storage/v1/object/order-result-files/') && options.method === 'HEAD') {
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
    request: new Request(`https://his.example/api/lis/result-file?path=${encodeURIComponent(objectPath)}`),
    env,
  });
  assert.equal(archived.status, 200);
  assert.equal(archived.headers.get('X-HIS-Storage-Source'), 'google-drive-archive');
  assert.equal((await archived.arrayBuffer()).byteLength, 4);

  const invalid = await onRequestGet({
    request: new Request('https://his.example/api/lis/result-file?path=../secret.pdf'),
    env,
  });
  assert.equal(invalid.status, 400);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('LIS result archive gateway tests passed');
