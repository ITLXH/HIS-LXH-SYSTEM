export async function getDriveAccessToken(credentials, scope = 'https://www.googleapis.com/auth/drive.readonly') {
  if (credentials.type === 'authorized_user' || credentials.refresh_token) {
    const resp = await fetch(credentials.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'client_id=' + encodeURIComponent(credentials.client_id) +
        '&client_secret=' + encodeURIComponent(credentials.client_secret) +
        '&refresh_token=' + encodeURIComponent(credentials.refresh_token) +
        '&grant_type=refresh_token',
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OAuth refresh HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    return (await resp.json()).access_token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: credentials.private_key_id };
  const claim = {
    iss: credentials.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(claim)}`;
  const key = await importPkcs8(credentials.private_key);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
      '&assertion=' + encodeURIComponent(jwt),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth token exchange HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()).access_token;
}

export function parseDriveCredentials(env) {
  const candidates = [];
  const failures = [];
  for (const [label, raw] of [
    ['OAuth', env.GOOGLE_DRIVE_OAUTH_JSON || ''],
    ['Service account', env.GOOGLE_SERVICE_ACCOUNT_JSON || ''],
  ]) {
    if (!raw) continue;
    try {
      candidates.push({ label, credentials: JSON.parse(raw) });
    } catch (_) {
      failures.push(`${label} credential JSON is invalid`);
    }
  }
  return { candidates, failures };
}

function base64url(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function importPkcs8(pem) {
  const body = String(pem || '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}
