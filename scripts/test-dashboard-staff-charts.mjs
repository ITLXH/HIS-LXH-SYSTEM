import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [view, main, style] = await Promise.all([
  readFile(new URL('../public/partials/views/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
]);

for (const id of ['chartSpecialist', 'dashboardDoctorActivity', 'dashboardNurseActivity', 'chartChannel']) {
  assert.match(view, new RegExp(`id=["']${id}["']`), `missing dashboard activity element #${id}`);
}
assert.doesNotMatch(view, /<canvas id=["']chart(?:Marketing|Nurses)["']/, 'staff names should use wrapping DOM rows instead of clipped canvas labels');

assert.doesNotMatch(view, /Top 5 Doctors/i, 'dashboard should use a clinical activity label instead of the old doctor-only label');
assert.match(view, /Clinical Team Activity/);
assert.match(view, /Doctor Activity/);
assert.match(view, /Nursing Activity/);
assert.ok(view.indexOf('id="chartChannel"') > view.indexOf('id="dashboardNurseActivity"'), 'Channel chart should appear after the staff activity panels');

assert.match(main, /renderDashboardStaffActivity/);
assert.match(main, /renderDashboardStaffActivity\('dashboardDoctorActivity'/);
assert.match(main, /renderDashboardStaffActivity\('dashboardNurseActivity'/);
assert.match(main, /const getTopN = \(map, n = 5\)/);
assert.match(main, /let topDocs = getTopN\(doctors, 5\)/);
assert.match(main, /let topNurses = getTopN\(nurses, 5\)/);
assert.doesNotMatch(main, /topDocs = getTopNWithOthers|topNurses = getTopNWithOthers/, 'staff rankings must not append an Other row');
assert.match(main, /v\.Recorded_By \|\| v\.Nurse_Name \|\| v\.Nurse/);
assert.match(main, /createChart\('chartChannel'/);
assert.match(main, /!isHiddenDoctorOption\(docName\)/);

assert.match(style, /\.dashboard-staff-split/);
assert.match(style, /\.dashboard-staff-card--doctor/);
assert.match(style, /\.dashboard-staff-card--nurse/);
assert.match(style, /\.dashboard-staff-rank-name strong/);
assert.match(style, /overflow-wrap:\s*anywhere/);

console.log('Dashboard doctor, nurse, Top 5 and Channel layout checks passed.');
