import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countDashboardIpdAdmissions } from '../src/dashboardIpdAdmissions.js';

const rows = [
  { Admission_ID: 'IPD1', Admission_Date: '2026-11-09', Admission_Time: '09:00' },
  { Admission_ID: 'IPD2', Admission_Date: '2026-11-09', Admission_Time: '22:00' },
  { Admission_ID: 'IPD3', Admission_Date: '2026-11-09', Admission_Time: null },
];
const shift = value => Number(value.slice(11, 13)) >= 8 && Number(value.slice(11, 13)) < 16 ? 'morning' : 'night';
assert.equal(countDashboardIpdAdmissions(rows, 'all', shift), 3);
assert.equal(countDashboardIpdAdmissions(rows, 'morning', shift), 1);
assert.equal(countDashboardIpdAdmissions(rows, 'night', shift), 1);
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(main, /\.from\(dbTable\('Admissions'\)\)[\s\S]*?\.gte\('Admission_Date', sDate\)[\s\S]*?\.lte\('Admission_Date', eDate\)/);
assert.match(main, /countDashboardIpdAdmissions\(admissions, activeShiftType, window\.getDashShiftBucket\)/);
assert.match(main, /clinicalDepartments\[ipdLabel\] = ipdAdmissionCount/);
console.log('Dashboard IPD admission counts passed.');
