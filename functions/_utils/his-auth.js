export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function requireHisAdmin(ctx) {
  const { request, env } = ctx;
  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  const authHeader = String(request.headers.get('Authorization') || '');
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!supabaseUrl || !serviceKey) {
    return { response: jsonResponse({ success: false, error: 'Server authentication is not configured' }, 503) };
  }
  if (!accessToken) {
    return { response: jsonResponse({ success: false, error: 'Authentication required' }, 401) };
  }

  const authResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY || serviceKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!authResp.ok) {
    return { response: jsonResponse({ success: false, error: 'Invalid or expired session' }, 401) };
  }

  const authUser = await authResp.json();
  const profileResp = await fetch(
    `${supabaseUrl}/rest/v1/HIS_One_Users?Auth_User_ID=eq.${encodeURIComponent(authUser.id)}&select=ID,Name,Email,Role,Status&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!profileResp.ok) {
    return { response: jsonResponse({ success: false, error: 'Unable to verify staff permissions' }, 503) };
  }

  const profiles = await profileResp.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile || profile.Status !== 'active') {
    return { response: jsonResponse({ success: false, error: 'Staff account is inactive or not linked' }, 403) };
  }
  if (String(profile.Role || '').toLowerCase() !== 'admin') {
    return { response: jsonResponse({ success: false, error: 'Administrator permission required' }, 403) };
  }

  return { authUser, profile, accessToken };
}
