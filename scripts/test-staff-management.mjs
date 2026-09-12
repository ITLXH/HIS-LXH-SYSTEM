import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STAFF_STORAGE_KEY,
  calculateStaffStats,
  createStaffEmployeeCode,
  filterStaffRecords,
  normalizeStaffRecord,
  validateStaffPhotoFile
} from '../src/staffManagement.js';
import { STAFF_AVATAR_BUCKET, mapStaffRow, staffRecordPayload } from '../src/staffSupabase.js';

const [view, main, navbar, style, migration] = await Promise.all([
  readFile(new URL('../public/partials/views/staff.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/navbar.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/staffManagement.css', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260910223000_staff_profiles.sql', import.meta.url), 'utf8')
]);

for (const id of [
  'view-staff', 'staffTotalCount', 'staffDoctorCount', 'staffNurseCount', 'staffActiveCount',
  'staffSearchInput', 'staffTypeFilter', 'staffStatusFilter', 'staffDirectoryGrid',
  'staffEditorModal', 'staffEditorForm', 'staffPhotoInput', 'staffPhotoPreview',
  'staffPersistenceBadge', 'staffPhotoPath',
  'staffFullName', 'staffDepartmentType', 'staffStatus'
]) {
  assert.match(view, new RegExp(`id=["']${id}["']`), `missing staff UI control #${id}`);
}

for (const removedId of ['staffEmployeeCode', 'staffEmployeeType', 'staffDepartment', 'staffPosition', 'staffLinkedUserId']) {
  assert.doesNotMatch(view, new RegExp(`id=["']${removedId}["']`), `obsolete staff field #${removedId} should not be shown`);
}
assert.doesNotMatch(view, /User ID ທີ່ເຊື່ອມ/);
assert.match(view, /ເອໂກ້ \+ ລັງສີ/);

assert.match(navbar, /id="nav-staff"/);
assert.match(main, /staff:\s*\{ view: 'staff'/);
assert.match(main, /'\/staff': 'staff'/);
assert.match(main, /window\.isLocalStaffPreview/);
assert.match(main, /window\.initLocalStaffPreview/);
assert.match(main, /if \(v === 'staff'\)/);
assert.match(style, /\.staff-directory-table/);
assert.match(style, /\.staff-table-row/);
assert.match(style, /\.staff-table-actions/);
assert.match(main, /installStaffManagement/);
assert.doesNotMatch(await readFile(new URL('../src/staffManagement.js', import.meta.url), 'utf8'), /staff-profile-card/);
assert.match(style, /\.staff-photo-preview/);
assert.equal(STAFF_STORAGE_KEY, 'his_local_staff_profiles_v1');
assert.equal(STAFF_AVATAR_BUCKET, 'his-staff-avatars');

const records = [
  { id: '1', employeeCode: ' doc-01 ', fullName: 'Dr Alpha', employeeType: 'doctor', department: 'OPD', status: 'active' },
  { id: '2', employeeCode: 'nur-01', fullName: 'Nurse Beta', employeeType: 'nurse', department: 'IPD', status: 'on_leave' },
  { id: '3', employeeCode: 'lab-01', fullName: 'Tech Gamma', employeeType: 'lab', department: 'Lab', status: 'active' }
];
assert.equal(normalizeStaffRecord(records[0]).employeeCode, 'DOC-01');
assert.equal(createStaffEmployeeCode('doctor', 'abc-def-123'), 'DOC-ABCDEF12');
assert.equal(createStaffEmployeeCode('nurse', '12345678-abcd'), 'NUR-12345678');
assert.deepEqual(calculateStaffStats(records), { total: 3, doctors: 1, nurses: 1, active: 2 });
assert.deepEqual(filterStaffRecords(records, { query: 'opd', type: 'all', status: 'all' }).map(item => item.id), ['1']);
assert.deepEqual(filterStaffRecords(records, { query: '', type: 'nurse', status: 'on_leave' }).map(item => item.id), ['2']);
assert.equal(validateStaffPhotoFile({ type: 'image/jpeg', size: 1000 }).ok, true);
assert.equal(validateStaffPhotoFile({ type: 'image/gif', size: 1000 }).ok, false);
assert.equal(validateStaffPhotoFile({ type: 'image/png', size: 6 * 1024 * 1024 }).ok, false);

assert.deepEqual(mapStaffRow({
  ID: 'abc', Employee_Code: 'DOC-1', Full_Name: 'Dr A', Employee_Type: 'doctor',
  Department: 'OPD', Status: 'active', Photo_Path: 'abc/avatar.jpg'
}, 'signed-url').photoData, 'signed-url');
assert.equal(staffRecordPayload({
  id: 'abc', employeeCode: 'doc-1', fullName: 'Dr A', employeeType: 'doctor',
  department: 'OPD', status: 'active', linkedUserId: '12'
}, '').User_ID, 12);
assert.throws(() => staffRecordPayload({ linkedUserId: 'not-a-number' }, ''), /User ID/);

assert.match(migration, /HIS_One_Staff_Profiles/);
assert.match(migration, /his-staff-avatars/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /his_one_is_admin\(\)/);
assert.match(migration, /HIS_One_MasterData/);
assert.match(migration, /IN \('doctor', 'nurse'\)/);
assert.doesNotMatch(migration, /GRANT .* TO anon/);

console.log('Staff directory UI, local persistence, photo validation and production schema checks passed.');
