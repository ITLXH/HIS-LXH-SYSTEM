import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MANPOWER_HISTORY_STORAGE_KEY,
  MANPOWER_STORAGE_KEY,
  calculateManpowerSummary,
  filterManpowerHistory,
  resolveManpowerStaffType
} from '../src/manpowerDashboard.js';
import {
  assignmentPayload,
  createManpowerSupabaseBackend,
  mapAssignmentRow,
  mapHistoryRow
} from '../src/manpowerSupabase.js';

const [view, main, navbar, style, staffView, dashboard, supabaseBackend, migration, hardeningMigration, leaveMigration] = await Promise.all([
  readFile(new URL('../public/partials/views/manpower.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/navbar.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/manpowerDashboard.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/views/staff.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/manpowerDashboard.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/manpowerSupabase.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260912120000_manpower_production.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260912133000_manpower_security_hardening.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260912170000_manpower_leave_types_notes.sql', import.meta.url), 'utf8')
]);

for (const id of [
  'view-manpower', 'manpowerDate', 'manpowerWorkingCount', 'manpowerAbsentCount',
  'manpowerLeaveCount', 'manpowerSwappedCount', 'manpowerDepartmentList',
  'manpowerPrintContext', 'manpowerDataBadge', 'manpowerAssignmentModal', 'manpowerStaffSelect', 'manpowerStatusSelect',
  'manpowerAssignmentDepartment', 'manpowerStaffAvailabilityNote', 'manpowerAssignmentSaveButton',
  'manpowerNewLeaveTypeGroup', 'manpowerNewLeaveType', 'manpowerNewNote',
  'manpowerManagementModal', 'manpowerManageAssignmentId', 'manpowerManageCurrentStaff',
  'manpowerManageStatus', 'manpowerLeaveTypeGroup', 'manpowerLeaveType', 'manpowerNote',
  'manpowerHistoryModal', 'manpowerHistorySearch', 'manpowerHistoryDate', 'manpowerHistoryShift',
  'manpowerHistoryType', 'manpowerHistoryAction', 'manpowerHistoryCount', 'manpowerHistoryRows',
  'manpowerHistoryStorageLabel'
]) assert.match(view, new RegExp(`id=["']${id}["']`), `missing manpower control #${id}`);

assert.match(main, /manpower:\s*\{ view: 'manpower'/);
assert.match(main, /'\/manpower': 'manpower'/);
assert.match(main, /window\.isLocalManpowerPreview/);
assert.match(main, /const previewRequested = new URLSearchParams\(window\.location\.search\)\.get\('preview'\) === '1'/);
assert.match(main, /if \(v === 'manpower'\)/);
assert.match(main, /createManpowerSupabaseBackend/);
assert.match(main, /backend:\s*manpowerSupabaseBackend/);
assert.match(main, /canManage:\s*\(\) => normalizeHisRole\(currentUser\?\.role\) === 'admin'/);
assert.match(navbar, /id="nav-manpower"/);
assert.equal((navbar.match(/id="nav-manpower"/g) || []).length, 1, 'manpower navigation must have one unique id');
assert.match(navbar, /class="his-nav-link mnu-manpower" id="nav-manpower"/);
assert.match(navbar, /id="nav-manpower"[\s\S]*data-i18n="nav\.manpower">ຈັດການເວນຍາມ</);
assert.ok(navbar.indexOf('id="nav-appointments"') < navbar.indexOf('id="nav-manpower"'), 'manpower must follow appointments');
assert.ok(navbar.indexOf('id="nav-manpower"') < navbar.indexOf('<!-- Admin dropdown -->'), 'manpower must be a primary tab');
assert.match(main, /'nav\.manpower': 'ຈັດການເວນຍາມ'/);
assert.match(main, /'nav\.manpower': 'Duty Roster'/);
assert.match(staffView, /window\.loadView\('manpower'\)/);
assert.match(style, /\.manpower-people/);
assert.match(style, /\.manpower-department-title/);
assert.match(style, /\.manpower-person-role/);
assert.match(style, /\.manpower-manage/);
assert.match(style, /\.manpower-history-toolbar/);
assert.match(style, /\.manpower-history-table/);
assert.doesNotMatch(style, /url\('\/luckxay-logo\.jpg'\)/);
assert.match(style, /\.manpower-view\s*\{[^}]*background:\s*#fff/s);
assert.match(style, /\.manpower-person-info strong\s*\{[^}]*font-size:\s*14px/s);
assert.match(style, /\.manpower-department h4\s*\{[^}]*font-size:\s*13px/s);
assert.match(style, /\.manpower-view\s*>\s*\.manpower-datebar\s*\{[^}]*position:\s*absolute/s);
assert.match(style, /\.manpower-departments\s*\{[^}]*grid-template-columns:\s*1fr/s);
assert.match(style, /\.manpower-people\s*\{[^}]*grid-template-columns:\s*repeat\(6,/s);
assert.match(style, /@page\s+manpower-print\s*\{\s*size:\s*A4 landscape/);
assert.match(style, /@page\s+manpower-print\s*\{[^}]*margin:\s*4mm/s);
assert.match(style, /#view-manpower\s*\{[^}]*page:\s*manpower-print/s);
assert.match(style, /#view-manpower\s*\{[^}]*width:\s*289mm\s*!important/s);
assert.match(style, /@media print[\s\S]*\.manpower-header p\s*\{\s*display:\s*none\s*!important/);
assert.match(style, /@media print[\s\S]*\.manpower-person-info small,[\s\S]*\.manpower-person-role\s*\{\s*display:\s*none\s*!important/);
assert.match(style, /@media print[\s\S]*\.manpower-person-info strong,[\s\S]*overflow-wrap:\s*anywhere/s);
assert.match(style, /@media print[\s\S]*\.manpower-person-info strong\s*\{[^}]*font-size:\s*7\.4pt/s);
assert.match(style, /@media print[\s\S]*\.manpower-header\s*\{[^}]*min-height:\s*13mm[^}]*border-radius:\s*2mm/s);
assert.match(style, /@media print[\s\S]*\.manpower-summary article\s*\{[^}]*min-height:\s*11mm[^}]*border-radius:\s*2mm/s);
assert.match(style, /@media print[\s\S]*\.manpower-people\s*\{[^}]*min-height:\s*16mm/s);
assert.match(style, /@media print[\s\S]*\.manpower-person\s*\{[^}]*min-height:\s*14mm/s);
assert.match(style, /\.manpower-modal \.select2-container/);
assert.match(view, /window\.printManpowerDashboard\(\)/);
assert.match(view, /window\.saveManpowerManagement\(event\)/);
assert.match(view, /window\.openManpowerHistory\(\)/);
assert.doesNotMatch(dashboard, /reception:\s*\{/);
assert.doesNotMatch(dashboard, /other:\s*\{/);
assert.doesNotMatch(dashboard, /manpower-person--vacant/);
assert.doesNotMatch(dashboard, /manpower-avatar-placeholder\.png/);
for (const avatar of ['doctor', 'nurse', 'pharmacy', 'laboratory', 'imaging']) {
  assert.match(dashboard, new RegExp(`/assets/manpower/avatar-${avatar}\\.png`));
}
const departmentPositions = ['doctor:', 'nurse:', 'pharmacy:', 'lab:', 'radiology:'].map(token => dashboard.indexOf(token));
assert.ok(departmentPositions.every(position => position >= 0), 'all requested departments must be configured');
assert.deepEqual([...departmentPositions].sort((a, b) => a - b), departmentPositions, 'departments must use the requested display order');
assert.match(dashboard, /window\.openManpowerManagement/);
assert.match(dashboard, /minimumResultsForSearch:\s*0/);
assert.match(dashboard, /manpowerLandscapePrintRule/);
assert.match(dashboard, /label: 'ລາພັກ'/);
assert.match(dashboard, /label: 'ລາປ່ວຍ'/);
assert.match(dashboard, /label: 'ລາກິດ'/);
assert.doesNotMatch(view, /ຜູ້ຮັບເວນແທນ/);
assert.match(dashboard, /appendHistory\(\{ action: 'created'/);
assert.match(dashboard, /appendHistory\(\{ action: 'deleted'/);
assert.match(dashboard, /MANPOWER_HISTORY_STORAGE_KEY/);
assert.match(dashboard, /window\.addEventListener\('storage'/);
assert.match(dashboard, /LOCAL_PHARMACY_DEMO/);
assert.match(dashboard, /ຈັດເຂົ້າເວນແລ້ວ/);
assert.match(dashboard, /sharedState\?\.initialized/);
assert.match(dashboard, /await staffBackend\.load\(\)/);
assert.match(dashboard, /Supabase realtime/);
assert.match(dashboard, /backend\.loadAssignments/);
assert.match(dashboard, /backend\.loadHistory/);
assert.match(dashboard, /backend\.subscribe/);
assert.match(dashboard, /backend\.create/);
assert.match(dashboard, /backend\.update/);
assert.match(dashboard, /backend\.remove/);
assert.match(dashboard, /mayManage/);
assert.match(supabaseBackend, /\.on\('postgres_changes'/);
assert.match(supabaseBackend, /\.is\('Deleted_At', null\)/);
assert.match(supabaseBackend, /error\.code === '23505'/);
assert.doesNotMatch(supabaseBackend, /\.upsert\(/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\."HIS_One_Manpower_Assignments"/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\."HIS_One_Manpower_History"/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /public\.his_one_is_admin\(\)/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /his_one_audit_manpower_assignment/);
assert.match(migration, /REPLICA IDENTITY FULL/);
assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE/);
assert.match(migration, /REVOKE ALL ON TABLE public\."HIS_One_Manpower_Assignments" FROM anon/);
assert.match(hardeningMigration, /Deleted manpower assignments are immutable/);
assert.match(hardeningMigration, /Assignment date, shift and staff cannot be changed/);
assert.match(hardeningMigration, /NEW\."Created_By" := auth\.uid\(\)/);
assert.match(hardeningMigration, /NEW\."Deleted_By" := auth\.uid\(\)/);
assert.match(hardeningMigration, /public\.his_one_is_active_user\(\) AND "Deleted_At" IS NULL/);
assert.match(leaveMigration, /ADD COLUMN IF NOT EXISTS "Leave_Type" TEXT/);
assert.match(leaveMigration, /DROP CONSTRAINT IF EXISTS "HIS_One_Manpower_Assignments_replacement_check"/);
assert.match(leaveMigration, /"Leave_Type" IN \('vacation', 'sick', 'personal'\)/);
assert.match(leaveMigration, /"Note_Before" TEXT/);
assert.equal(MANPOWER_STORAGE_KEY, 'his_local_manpower_assignments_v1');
assert.equal(MANPOWER_HISTORY_STORAGE_KEY, 'his_local_manpower_history_v1');
assert.deepEqual(calculateManpowerSummary([
  { status: 'working' }, { status: 'working' }, { status: 'leave' },
  { status: 'absent' }, { status: 'swapped' }, { status: 'unknown' }
]), { working: 2, absent: 1, leave: 1, swapped: 1 });
assert.equal(resolveManpowerStaffType({ employeeType: 'doctor' }), 'doctor');
assert.equal(resolveManpowerStaffType({ employeeType: 'other', department: 'ພະຍາບານ' }), 'nurse');
assert.equal(resolveManpowerStaffType({ department: 'Pharmacy' }), 'pharmacy');
assert.equal(resolveManpowerStaffType({ specialty: 'Laboratory' }), 'lab');
assert.equal(resolveManpowerStaffType({ department: 'Echo / Ultrasound' }), 'radiology');
assert.deepEqual(assignmentPayload({
  id: 'local-id', date: '2026-09-12', shift: 'night', staffId: 'staff-id',
  status: 'leave', leaveType: 'sick', replacementStaffId: 'replacement-id', note: 'handover'
}), {
  ID: 'local-id', Duty_Date: '2026-09-12', Shift: 'night', Staff_ID: 'staff-id',
  Status: 'leave', Leave_Type: 'sick', Replacement_Staff_ID: null, Note: 'handover'
});
assert.deepEqual(mapAssignmentRow({
  ID: 'assignment-id', Duty_Date: '2026-09-12', Shift: 'morning', Staff_ID: 'staff-id', Status: 'working'
}), {
  id: 'assignment-id', date: '2026-09-12', shift: 'morning', staffId: 'staff-id', status: 'working',
  leaveType: '', replacementStaffId: '', note: '', createdAt: '', updatedAt: ''
});
assert.equal(mapHistoryRow({ Changed_By_Name: 'Admin', Staff_Name: 'Doctor One' }).changedBy, 'Admin');
const history = [
  { date: '2026-09-12', shift: 'morning', staffType: 'doctor', action: 'created', staffName: 'Doctor One', changedBy: 'Admin' },
  { date: '2026-09-12', shift: 'night', staffType: 'nurse', action: 'updated', staffName: 'Nurse One', changedBy: 'Tester' }
];
assert.equal(filterManpowerHistory(history, { date: '2026-09-12', shift: 'night' }).length, 1);
assert.equal(filterManpowerHistory(history, { type: 'doctor', action: 'created' }).length, 1);
assert.equal(filterManpowerHistory(history, { query: 'tester' }).length, 1);
assert.match(dashboard, /label: 'ເອໂກ້ \+ ລັງສີ'/);

const fallbackSelects = [];
const fallbackClient = {
  from() {
    return {
      select(columns) {
        fallbackSelects.push(columns);
        const response = columns.includes('Leave_Type')
          ? { data: null, error: { code: '42703', message: 'column Leave_Type does not exist' } }
          : { data: [{ ID: 'legacy-id', Duty_Date: '2026-09-12', Shift: 'morning', Staff_ID: 'staff-id', Status: 'working' }], error: null };
        const query = {
          is() { return query; },
          order() { return query; },
          eq() { return query; },
          then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); }
        };
        return query;
      }
    };
  }
};
const fallbackBackend = createManpowerSupabaseBackend({
  client: fallbackClient,
  assignmentsTableName: 'assignments',
  historyTableName: 'history'
});
const fallbackRows = await fallbackBackend.loadAssignments('2026-09-12');
assert.equal(fallbackRows.length, 1);
assert.equal(fallbackRows[0].id, 'legacy-id');
assert.equal(fallbackSelects.length, 2, 'missing Leave_Type must retry with the legacy assignment columns');
assert.ok(fallbackSelects[0].includes('Leave_Type'));
assert.ok(!fallbackSelects[1].includes('Leave_Type'));
console.log('Manpower production persistence, security, history, realtime and UI checks passed.');
