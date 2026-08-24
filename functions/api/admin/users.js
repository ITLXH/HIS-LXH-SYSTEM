import { jsonResponse, requireHisAdmin } from '../../_utils/his-auth.js';
import {
  HIS_ROLE_ACTION_DEFAULTS,
  isHisProtectedAdminEmail,
  sanitizeHisActionPermissions,
  sanitizeHisPagePermissions,
} from '../../../shared/his-permissions.js';

const ALLOWED_ROLES = new Set(['admin', 'doctor', 'nurse', 'lab', 'reception', 'cashier', 'staff']);
const MIN_PASSWORD_LENGTH = 6;

function config(env) {
  return {
    url: String(env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || ''),
  };
}

function serviceHeaders(key, prefer = '') {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

export async function onRequestPost(ctx) {
  const admin = await requireHisAdmin(ctx);
  if (admin.response) return admin.response;

  const { url, key } = config(ctx.env);
  let body;
  try { body = await ctx.request.json(); }
  catch { return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400); }

  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const role = String(body?.role || '').trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < MIN_PASSWORD_LENGTH || !ALLOWED_ROLES.has(role)) {
    return jsonResponse({ success: false, error: `Name, valid email, role and password (minimum ${MIN_PASSWORD_LENGTH} characters) are required` }, 400);
  }
  if (isHisProtectedAdminEmail(email)) {
    return jsonResponse({ success: false, error: 'Protected administrator accounts are managed by the system' }, 403);
  }

  const authResp = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders(key),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, must_change_password: true },
    }),
  });
  const authUser = await authResp.json();
  if (!authResp.ok) return jsonResponse({ success: false, error: authUser.message || 'Unable to create Auth user' }, authResp.status);

  const safePagePermissions = sanitizeHisPagePermissions(
    role,
    Object.prototype.hasOwnProperty.call(body || {}, 'permissions') ? body.permissions : undefined
  );
  if (role !== 'admin' && !safePagePermissions) {
    await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`, {
      method: 'DELETE',
      headers: serviceHeaders(key),
    });
    return jsonResponse({ success: false, error: 'At least one page permission is required; Auth user was rolled back' }, 400);
  }

  const profile = {
    Name: name,
    Email: email,
    Role: role,
    Permissions: safePagePermissions,
    ButtonPermissions: sanitizeHisActionPermissions(role, body?.buttonPermissions || HIS_ROLE_ACTION_DEFAULTS[role]),
    Status: 'active',
    Auth_User_ID: authUser.id,
    Must_Change_Password: true,
  };
  const profileResp = await fetch(`${url}/rest/v1/HIS_One_Users`, {
    method: 'POST',
    headers: serviceHeaders(key, 'return=representation'),
    body: JSON.stringify(profile),
  });
  const profileData = await profileResp.json();
  if (!profileResp.ok) {
    await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`, {
      method: 'DELETE',
      headers: serviceHeaders(key),
    });
    return jsonResponse({ success: false, error: profileData.message || 'Unable to create staff profile; Auth user was rolled back' }, profileResp.status);
  }

  return jsonResponse({ success: true, user: Array.isArray(profileData) ? profileData[0] : profileData }, 201);
}

export async function onRequestPatch(ctx) {
  const admin = await requireHisAdmin(ctx);
  if (admin.response) return admin.response;

  const { url, key } = config(ctx.env);
  let body;
  try { body = await ctx.request.json(); }
  catch { return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400); }
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return jsonResponse({ success: false, error: 'Valid profile id is required' }, 400);

  const lookup = await fetch(`${url}/rest/v1/HIS_One_Users?ID=eq.${id}&select=ID,Auth_User_ID,Name,Email,Role,Permissions,ButtonPermissions,Status&limit=1`, {
    headers: serviceHeaders(key),
  });
  const rows = await lookup.json();
  const existing = Array.isArray(rows) ? rows[0] : null;
  if (!lookup.ok || !existing) return jsonResponse({ success: false, error: 'Staff profile not found' }, 404);
  if (isHisProtectedAdminEmail(existing.Email)) {
    return jsonResponse({ success: false, error: 'Protected administrator account cannot be modified' }, 403);
  }

  const role = String(body?.role || existing.Role).toLowerCase();
  if (!ALLOWED_ROLES.has(role)) return jsonResponse({ success: false, error: 'Invalid role' }, 400);
  const newPassword = String(body?.password || '');
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
    return jsonResponse({ success: false, error: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters` }, 400);
  }
  const safePagePermissions = sanitizeHisPagePermissions(
    role,
    Object.prototype.hasOwnProperty.call(body || {}, 'permissions') ? body.permissions : existing.Permissions
  );
  if (role !== 'admin' && !safePagePermissions) {
    return jsonResponse({ success: false, error: 'At least one page permission is required' }, 400);
  }
  const update = {
    Name: String(body?.name || '').trim() || existing.Name,
    Role: role,
    Permissions: safePagePermissions,
    ButtonPermissions: sanitizeHisActionPermissions(
      role,
      Object.prototype.hasOwnProperty.call(body || {}, 'buttonPermissions')
        ? body.buttonPermissions
        : (existing.ButtonPermissions || HIS_ROLE_ACTION_DEFAULTS[role])
    ),
    Status: body?.status === 'inactive' ? 'inactive' : (body?.status === 'active' ? 'active' : existing.Status),
  };
  Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

  if (existing.Auth_User_ID) {
    const authUpdate = { user_metadata: { name: update.Name, role, must_change_password: false } };
    if (newPassword) {
      authUpdate.password = newPassword;
      authUpdate.user_metadata.must_change_password = true;
      update.Must_Change_Password = true;
    }
    const authResp = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(existing.Auth_User_ID)}`, {
      method: 'PUT', headers: serviceHeaders(key), body: JSON.stringify(authUpdate),
    });
    if (!authResp.ok) return jsonResponse({ success: false, error: 'Unable to update Auth user' }, authResp.status);
  }

  const updateResp = await fetch(`${url}/rest/v1/HIS_One_Users?ID=eq.${id}`, {
    method: 'PATCH', headers: serviceHeaders(key, 'return=representation'), body: JSON.stringify(update),
  });
  const updateData = await updateResp.json();
  if (!updateResp.ok) return jsonResponse({ success: false, error: updateData.message || 'Unable to update staff profile' }, updateResp.status);
  return jsonResponse({ success: true, user: Array.isArray(updateData) ? updateData[0] : updateData });
}
