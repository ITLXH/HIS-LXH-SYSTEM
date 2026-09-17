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
assert.ok(view.indexOf('id="chartSpecialist"') < view.indexOf('id="chartTime"'), 'Department service should be above Time Slot');
assert.ok(view.indexOf('id="chartTime"') < view.indexOf('id="dashboardDoctorActivity"'), 'Time Slot should be beside Clinical Team Activity');

assert.match(main, /renderDashboardStaffActivity/);
assert.match(main, /renderDashboardStaffActivity\('dashboardDoctorActivity'/);
assert.match(main, /renderDashboardStaffActivity\('dashboardNurseActivity'/);
assert.match(main, /source\.classList\.add\('dashboard-pdf-capture'\)/);
assert.match(main, /source\.classList\.remove\('dashboard-pdf-capture'\)/);
assert.match(main, /const getTopN = \(map, n = 5\)/);
assert.match(main, /let topDocs = getTopN\(doctors, 5\)/);
assert.match(main, /let topNurses = getTopN\(nurses, 5\)/);
assert.doesNotMatch(main, /topDocs = getTopNWithOthers|topNurses = getTopNWithOthers/, 'staff rankings must not append an Other row');
assert.match(main, /v\.Recorded_By \|\| v\.Nurse_Name \|\| v\.Nurse/);
assert.match(main, /createChart\('chartChannel'/);
assert.match(main, /!isHiddenDoctorOption\(docName\)/);
assert.match(main, /const yTickFontSize = ctxId === 'chartOpdDepartments' \? 11/);
assert.match(main, /const isCompactCircularChart = \['chartGender', 'chartSite'\]\.includes\(ctxId\)/);
assert.match(main, /const dataLabelSize = isCompactCircularChart \? 16/);
assert.match(main, /isCompactCircularChart\s*\? \{ right: 4, top: 4, left: 4, bottom: 0 \}/);
assert.match(main, /color: isCompactCircularChart \? '#000000' : undefined/);
assert.match(main, /color: isCompactCircularChart \? '#000000' : \(\(type === 'bar'/);
assert.doesNotMatch(view, /<canvas id="chartDept"/);
assert.doesNotMatch(main, /deptType\[dept\]/);
assert.doesNotMatch(view, /chartExamRooms|Examination Room/);
assert.doesNotMatch(main, /chartExamRooms|examinationRoomCounts|topExamRooms/);
assert.equal((view.match(/dashboard-report-panel--third-width/g) || []).length, 3, 'the final compact row should contain three equal-width cards');

assert.match(style, /\.dashboard-staff-split/);
assert.match(style, /\.dashboard-staff-card--doctor/);
assert.match(style, /\.dashboard-staff-card--nurse/);
assert.match(style, /\.dashboard-staff-rank-name strong/);
assert.match(style, /overflow-wrap:\s*anywhere/);
assert.match(style, /\.dashboard-report-panel--disease-groups \.dashboard-report-chart--hero\s*\{\s*height:\s*250px/);
assert.match(view, /dashboard-report-panel--departments[\s\S]*?id="chartSpecialist"/);
assert.match(style, /\.dashboard-report-grid--spread-summary\s*\{\s*align-items:\s*stretch/);
assert.match(style, /\.dashboard-report-panel--departments \.dashboard-report-chart--medium\s*\{\s*height:\s*250px/);
assert.match(style, /\.dashboard-report-grid--spread-detail\s*\{[\s\S]*?align-items:\s*stretch/);
assert.match(style, /\.dashboard-report-grid--spread-detail > \.dashboard-report-panel\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%/);
assert.match(style, /\.dashboard-report-panel:not\(\.dashboard-report-panel--span-4\) > \.dashboard-report-panel-head\s*\{[\s\S]*?min-height:\s*68px/);
assert.match(style, /@media \(min-width:\s*1200px\)[\s\S]*?\.dashboard-report-panel--third-width\s*\{\s*grid-column:\s*span 4/);
assert.match(style, /\.dashboard-pdf-capture:not\(\.dashboard-export-mode\) \.dashboard-report-grid--spread-detail > \.dashboard-report-panel:nth-child\(-n \+ 4\)[\s\S]*?padding:\s*8px 10px 6px/);
assert.match(style, /\.dashboard-pdf-capture[\s\S]*?\.dashboard-report-chart--compact\s*\{\s*height:\s*120px/);
assert.match(style, /\.dashboard-pdf-capture:not\(\.dashboard-export-mode\) \.dashboard-kpi-grid--spread \.dashboard-kpi-tile\s*\{[\s\S]*?min-height:\s*88px/);
assert.match(style, /\.dashboard-pdf-capture[\s\S]*?\.dashboard-kpi-value\s*\{[\s\S]*?font-size:\s*2rem/);

console.log('Dashboard doctor, nurse, Top 5 and Channel layout checks passed.');
