export const HIS_ROLE_PAGE_DEFAULTS = Object.freeze({
  admin: ['all'],
  doctor: [
    'dashboard', 'report', 'visit_history', 'patients', 'triage', 'opd',
    'opd_observation', 'appointments', 'vaccines', 'ipd_ward_bed', 'ipd_inpatient_list'
  ],
  nurse: [
    'dashboard', 'report', 'visit_history', 'patients', 'triage',
    'opd_observation', 'appointments', 'vaccines', 'ipd_ward_bed', 'ipd_inpatient_list'
  ],
  lab: ['dashboard', 'report', 'patients', 'labs'],
  reception: ['dashboard', 'report', 'patients', 'appointments'],
  cashier: ['dashboard', 'report', 'patients'],
  staff: ['dashboard', 'patients']
});

export const HIS_PROTECTED_ADMIN_EMAILS = Object.freeze([
  'admin@his.com',
  'admin@his-sys.com'
]);

export function isHisProtectedAdminEmail(email) {
  return HIS_PROTECTED_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

export function resolveHisEffectiveRole(role, email) {
  return isHisProtectedAdminEmail(email) ? 'admin' : normalizeHisRole(role);
}

export const HIS_ROLE_ACTION_DEFAULTS = Object.freeze({
  admin: {
    patients: { view: true, add: true, edit: true, delete: true, triage: true, print_qr: true },
    triage: { view: true, edit: true, delete: true, call: true },
    opd: { view: true, edit: true, delete: true, print: true },
    opd_observation: { view: true, add: true, note: true, convert: true, discharge: true },
    labs: { view: true, add: true, edit: true, delete: true },
    drugs: { view: true, add: true, edit: true, delete: true },
    appointments: { view: true, add: true, edit: true, delete: true },
    ipd: { view: true, admit: true, transfer: true, discharge: true, chart_edit: true },
    ipd_config: { view: true, add: true, edit: true, delete: true }
  },
  doctor: {
    patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
    triage: { view: true, edit: false, delete: false, call: false },
    opd: { view: true, edit: true, delete: false, print: true },
    opd_observation: { view: true, add: true, note: true, convert: true, discharge: true },
    labs: { view: true, add: true, edit: false, delete: false },
    drugs: { view: false, add: false, edit: false, delete: false },
    appointments: { view: true, add: true, edit: true, delete: false },
    ipd: { view: true, admit: true, transfer: true, discharge: true, chart_edit: true },
    ipd_config: { view: false, add: false, edit: false, delete: false }
  },
  nurse: {
    patients: { view: true, add: false, edit: false, delete: false, triage: true, print_qr: false },
    triage: { view: true, edit: true, delete: false, call: true },
    opd: { view: false, edit: false, delete: false, print: false },
    opd_observation: { view: true, add: true, note: true, convert: false, discharge: false },
    labs: { view: true, add: false, edit: false, delete: false },
    drugs: { view: false, add: false, edit: false, delete: false },
    appointments: { view: true, add: true, edit: false, delete: false },
    ipd: { view: true, admit: true, transfer: true, discharge: false, chart_edit: true },
    ipd_config: { view: false, add: false, edit: false, delete: false }
  },
  lab: {
    patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
    triage: { view: false, edit: false, delete: false, call: false },
    opd: { view: false, edit: false, delete: false, print: false },
    opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
    labs: { view: true, add: true, edit: true, delete: false },
    drugs: { view: false, add: false, edit: false, delete: false },
    appointments: { view: false, add: false, edit: false, delete: false },
    ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
    ipd_config: { view: false, add: false, edit: false, delete: false }
  },
  reception: {
    patients: { view: true, add: true, edit: true, delete: false, triage: true, print_qr: true },
    triage: { view: false, edit: false, delete: false, call: false },
    opd: { view: false, edit: false, delete: false, print: false },
    opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
    labs: { view: false, add: false, edit: false, delete: false },
    drugs: { view: false, add: false, edit: false, delete: false },
    appointments: { view: true, add: true, edit: true, delete: false },
    ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
    ipd_config: { view: false, add: false, edit: false, delete: false }
  },
  cashier: {
    patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
    triage: { view: false, edit: false, delete: false, call: false },
    opd: { view: false, edit: false, delete: false, print: false },
    opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
    labs: { view: false, add: false, edit: false, delete: false },
    drugs: { view: false, add: false, edit: false, delete: false },
    appointments: { view: true, add: false, edit: false, delete: false },
    ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
    ipd_config: { view: false, add: false, edit: false, delete: false }
  },
  staff: {
    patients: { view: true, add: false, edit: false, delete: false, triage: false, print_qr: false },
    triage: { view: false, edit: false, delete: false, call: false },
    opd: { view: false, edit: false, delete: false, print: false },
    opd_observation: { view: false, add: false, note: false, convert: false, discharge: false },
    labs: { view: false, add: false, edit: false, delete: false },
    drugs: { view: false, add: false, edit: false, delete: false },
    appointments: { view: false, add: false, edit: false, delete: false },
    ipd: { view: false, admit: false, transfer: false, discharge: false, chart_edit: false },
    ipd_config: { view: false, add: false, edit: false, delete: false }
  }
});

export function normalizeHisRole(role) {
  return String(role || '').trim().toLowerCase();
}

export function parseHisPagePermissions(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

export function sanitizeHisPagePermissions(role, requested, { defaultsWhenMissing = true } = {}) {
  const normalizedRole = normalizeHisRole(role);
  if (normalizedRole === 'admin') return 'all';
  const ceiling = HIS_ROLE_PAGE_DEFAULTS[normalizedRole] || [];
  const requestedList = requested === undefined || requested === null
    ? (defaultsWhenMissing ? ceiling : [])
    : parseHisPagePermissions(requested);
  const allowed = new Set(ceiling);
  return [...new Set(requestedList.filter(permission => allowed.has(permission)))].join(',');
}

export function sanitizeHisActionPermissions(role, requested) {
  const normalizedRole = normalizeHisRole(role);
  const ceiling = HIS_ROLE_ACTION_DEFAULTS[normalizedRole] || HIS_ROLE_ACTION_DEFAULTS.staff;
  const source = requested && typeof requested === 'object' ? requested : ceiling;
  const result = {};
  Object.entries(ceiling).forEach(([moduleName, actions]) => {
    result[moduleName] = {};
    Object.entries(actions).forEach(([actionName, maximum]) => {
      result[moduleName][actionName] = maximum === true && source?.[moduleName]?.[actionName] === true;
    });
  });
  return result;
}

export function roleAllowsHisPage(role, permission) {
  const normalizedRole = normalizeHisRole(role);
  return normalizedRole === 'admin' || (HIS_ROLE_PAGE_DEFAULTS[normalizedRole] || []).includes(permission);
}

export function roleAllowsHisAction(role, moduleName, actionName) {
  const normalizedRole = normalizeHisRole(role);
  return normalizedRole === 'admin' || HIS_ROLE_ACTION_DEFAULTS[normalizedRole]?.[moduleName]?.[actionName] === true;
}
