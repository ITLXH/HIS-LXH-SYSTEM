import assert from 'node:assert/strict';
import { requireHisAdmin } from '../functions/_utils/his-auth.js';
import { onRequestPatch as patchAdminUser } from '../functions/api/admin/users.js';
import {
  isHisProtectedAdminEmail,
  resolveHisEffectiveRole,
  roleAllowsHisAction,
  roleAllowsHisPage,
  sanitizeHisActionPermissions,
  sanitizeHisPagePermissions,
} from '../shared/his-permissions.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-test-key',
};

function context(token = 'valid-token') {
  return {
    env,
    request: new Request('https://his.example/api/backup/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  };
}

function patchContext(body, token = 'valid-token') {
  return {
    env,
    request: new Request('https://his.example/api/admin/users', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  };
}

async function responseStatus(result) {
  return result.response?.status || 200;
}

const originalFetch = globalThis.fetch;
try {
  let role = 'admin';
  let profileEmail = 'test@example.com';
  globalThis.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'auth-user-1' }), { status: 200 });
    }
    if (String(url).includes('/rest/v1/HIS_One_Users')) {
      return new Response(JSON.stringify([{ ID: 1, Name: 'Test', Email: profileEmail, Role: role, Status: 'active' }]), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  assert.equal(await responseStatus(await requireHisAdmin(context(''))), 401);
  role = 'nurse';
  assert.equal(await responseStatus(await requireHisAdmin(context())), 403);
  role = 'admin';
  const admin = await requireHisAdmin(context());
  assert.equal(admin.response, undefined);
  assert.equal(admin.profile.Role, 'admin');
  assert.equal(isHisProtectedAdminEmail('ADMIN@HIS.COM'), true);
  assert.equal(isHisProtectedAdminEmail(' admin@his-sys.com '), true);
  assert.equal(isHisProtectedAdminEmail('doctor@his.com'), false);
  assert.equal(resolveHisEffectiveRole('staff', 'admin@his.com'), 'admin');
  assert.equal(resolveHisEffectiveRole('nurse', 'nurse@his.com'), 'nurse');

  profileEmail = 'admin@his.com';
  assert.equal((await patchAdminUser(patchContext({ id: 1, status: 'inactive' }))).status, 403);
  profileEmail = 'test@example.com';

  const doctorPages = sanitizeHisPagePermissions('doctor', 'all,dashboard,opd,users,settings,activity_log,labs');
  assert.equal(doctorPages, 'dashboard,opd');
  assert.equal(roleAllowsHisPage('doctor', 'users'), false);
  assert.equal(roleAllowsHisPage('doctor', 'visit_history'), true);

  const nursePages = sanitizeHisPagePermissions('nurse', 'dashboard,triage,opd,users');
  assert.equal(nursePages, 'dashboard,triage');
  assert.equal(roleAllowsHisAction('nurse', 'opd', 'edit'), false);
  assert.equal(roleAllowsHisAction('nurse', 'triage', 'edit'), true);

  const doctorActions = sanitizeHisActionPermissions('doctor', {
    patients: { view: true, add: true, delete: true },
    opd: { view: true, edit: true, delete: true },
    ipd_config: { view: true, add: true, delete: true },
  });
  assert.equal(doctorActions.patients.view, true);
  assert.equal(doctorActions.patients.add, false);
  assert.equal(doctorActions.patients.delete, false);
  assert.equal(doctorActions.opd.edit, true);
  assert.equal(doctorActions.opd.delete, false);
  assert.equal(doctorActions.ipd_config.view, false);

  console.log('Auth guard checks passed');
} finally {
  globalThis.fetch = originalFetch;
}
