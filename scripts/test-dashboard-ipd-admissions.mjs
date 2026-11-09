import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countDashboardIpdAdmissions, applyDashboardDischargeMovements } from '../src/dashboardIpdAdmissions.js';

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
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-01', '2026-11-30'), 3, 'month includes stays overlapping November');
assert.equal(countDashboardIpdAdmissions(admissions, '2026-01-01', '2026-12-31'), 3, 'year includes all November stays once');
assert.equal(countDashboardIpdAdmissions(admissions, '2026-10-01', '2026-10-31'), 0, 'past month excludes future admissions');
assert.equal(countDashboardIpdAdmissions([
  { Admission_ID: 'IPD5', Admission_Date: '2025-12-29', Discharge_Date: '2026-01-03', Status: 'Discharged' },
], '2026-01-01', '2026-01-31'), 1, 'past month includes carryover admission');

const historical = [{ Admission_ID: 'IPD6', Admission_Date: '2026-09-29', Status: 'Discharged' }];
applyDashboardDischargeMovements(historical, [
  { IPD_Admission_ID: 'IPD6', Movement_Datetime: '2026-10-03T09:00:00Z' },
], value => value.slice(0, 10), value => value.slice(11, 16));
assert.equal(countDashboardIpdAdmissions(historical, '2026-10-01', '2026-10-01'), 1, 'closed admission with movement remains counted before discharge');
assert.equal(countDashboardIpdAdmissions(historical, '2026-10-04', '2026-10-04'), 0, 'closed admission ends after movement');

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(main, /\.from\(dbTable\('Admissions'\)\)[\s\S]*?\.lte\('Admission_Date', eDate\)/);
assert.match(main, /\.from\(dbTable\('Bed_Movements'\)\)[\s\S]*?\.eq\('Movement_Type', 'Cleaning'\)/);
assert.match(main, /countDashboardIpdAdmissions\(admissions, sDate, eDate, activeShiftType\)/);
assert.match(main, /renderDashboardCharts\(visitsWithDetails, ipdAdmissionCount\)/);
assert.match(main, /clinicalDepartments\[ipdLabel\] = ipdAdmissionCount/);
assert.match(main, /Discharge_Date: window\.getLocalStr\(dischargedAt\)/);
console.log('Dashboard IPD admission counts passed.');
