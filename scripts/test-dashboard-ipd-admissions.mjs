import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countDashboardIpdAdmissions } from '../src/dashboardIpdAdmissions.js';

const admissions = [
  { Admission_ID: 'IPD1', Admission_Date: '2026-11-08', Admission_Time: '09:00' },
  { Admission_ID: 'IPD2', Admission_Date: '2026-11-09', Admission_Time: '22:00' },
  { Admission_ID: 'IPD3', Admission_Date: '2026-11-07', Discharge_Date: '2026-11-08' },
  { Admission_ID: 'IPD4', Admission_Date: '2026-11-09', Status: 'Cancelled' },
];
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-09', '2026-11-09'), 2);
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-09', '2026-11-09', 'morning'), 1);
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-09', '2026-11-09', 'night'), 2);
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-08', '2026-11-08'), 2);

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(main, /\.from\(dbTable\('Admissions'\)\)[\s\S]*?\.lte\('Admission_Date', eDate\)/);
assert.match(main, /countDashboardIpdAdmissions\(admissions, sDate, eDate, activeShiftType\)/);
assert.match(main, /renderDashboardCharts\(visitsWithDetails, ipdAdmissionCount\)/);
assert.match(main, /clinicalDepartments\[ipdLabel\] = ipdAdmissionCount/);
console.log('Dashboard IPD admission counts passed.');
