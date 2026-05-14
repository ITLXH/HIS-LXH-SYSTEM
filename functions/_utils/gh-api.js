/**
 * GitHub API helper for Cloudflare Functions
 * Reads env variables server-side, keeps token away from browser
 */

export async function ghRequest(env, method, path, body = null) {
  const baseUrl = 'https://api.github.com';
  const token = env.BACKUP_GH_TOKEN;

  if (!token) {
    throw new Error('BACKUP_GH_TOKEN not configured');
  }

  const url = `${baseUrl}${path}`;
  const init = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'HIS-sys-backup',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  };

  if (body !== null) {
    init.body = JSON.stringify(body);
  }

  const resp = await fetch(url, init);

  // 204 is valid for dispatches (no content)
  if (resp.status === 204 || resp.status === 200) {
    const text = await resp.text();
    return text ? JSON.parse(text) : {};
  }

  const errorText = await resp.text().catch(() => '');
  throw new Error(`GitHub API ${resp.status}: ${errorText || resp.statusText}`);
}
