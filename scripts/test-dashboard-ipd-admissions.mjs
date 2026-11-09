import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countDashboardIpdAdmissions } from '../src/dashboardIpdAdmissions.js';

const admissions = [
  ...Array.from({ length: 37 }, (_, i) => ({ Admission_ID: `OLD${i}`, Admission_Date: '2026-10-15', Status: 'Admitted' })),
  { Admission_ID: 'TODAY1', Admission_Date: '2026-11-09', Admission_Time: '09:00', Status: 'Admitted' },
  { Admission_ID: 'TODAY2', Admission_Date: '2026-11-09', Admission_Time: '22:00', Status: 'Admitted' },
  { Admission_ID: 'CANCELLED', Admission_Date: '2026-11-09', Status: 'Cancelled' },
];
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-09', '2026-11-09'), 2, 'today excludes older active rows');
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-01', '2026-11-30'), 2, 'month counts November admissions');
assert.equal(countDashboardIpdAdmissions(admissions, '2026-01-01', '2026-12-31'), 39, 'year counts admissions once');
assert.equal(countDashboardIpdAdmissions(admissions, '2026-10-01', '2026-10-31'), 37, 'past month counts its admissions');
const shift = value => value.slice(11, 13) === '09' ? 'morning' : 'night';
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-09', '2026-11-09', 'morning', shift), 1);
assert.equal(countDashboardIpdAdmissions(admissions, '2026-11-09', '2026-11-09', 'night', shift), 1);

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(main, /\.gte\('Admission_Date', sDate\)[\s\S]*?\.lte\('Admission_Date', eDate\)/);
assert.match(main, /renderDashboardCharts\(visitsWithDetails, ipdAdmissionCount\)/);
assert.doesNotMatch(main.slice(main.indexOf('window.fetchDashboardData = async'), main.indexOf('window.updateDashboardOperationalStats')), /Bed_Movements/);
console.log('Dashboard IPD date range counts passed.');
