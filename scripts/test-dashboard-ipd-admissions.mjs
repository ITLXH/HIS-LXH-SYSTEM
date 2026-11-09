import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dashboardServiceDepartmentsForVisit } from '../src/dashboardServiceDepartments.js';

const labels = new Map([['ipd', 'IPD'], ['ob-gyn', 'OB-GYN'], ['internal medicine', 'Internal Medicine']]);
const today = [
  { Visit_ID: 'V1', Visit_Type: 'IPD', Mapped_Specialist: 'OB-GYN' },
  { Visit_ID: 'V2', Visit_Type: 'IPD', Mapped_Specialist: 'Internal Medicine' },
  { Visit_ID: 'V3', Visit_Type: 'OPD', Mapped_Specialist: 'Internal Medicine' },
];
assert.deepEqual(today.map(v => dashboardServiceDepartmentsForVisit(v, labels)), [['IPD'], ['IPD'], ['Internal Medicine']]);
assert.deepEqual(dashboardServiceDepartmentsForVisit({ Visit_Type: ' ipd ', Mapped_Specialist: 'OB-GYN' }, labels), ['IPD']);
assert.deepEqual(dashboardServiceDepartmentsForVisit({ Visit_Type: 'OPD', Mapped_Specialist: 'OB-GYN, Internal Medicine' }, labels), ['OB-GYN', 'Internal Medicine']);

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(main, /dashboardServiceDepartmentsForVisit\(v, clinicalDepartmentLookup\)/);
assert.doesNotMatch(main.slice(main.indexOf('window.fetchDashboardData = async'), main.indexOf('window.updateDashboardOperationalStats')), /dbTable\('Admissions'\)/);
console.log('Triage IPD dashboard classification passed.');
