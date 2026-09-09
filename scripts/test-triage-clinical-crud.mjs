import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const modal = await readFile(new URL('../public/partials/modals/triage-modal.html', import.meta.url), 'utf8');
const settings = await readFile(new URL('../public/partials/views/settings.html', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../public/partials/views/dashboard.html', import.meta.url), 'utf8');

const clinicalSelect = modal.match(/<select[^>]+id="v_clinical_department"[\s\S]*?<\/select>/)?.[0] || '';
assert.match(clinicalSelect, /class="form-select dyn-ServiceDepartment"/);
assert.match(clinicalSelect, /-- ເລືອກພະແນກບໍລິການ --/);
assert.match(clinicalSelect, /\brequired\b/);
assert.match(modal, /ພະແນກບໍລິການ \(Department service\)\s*<span class="text-danger">\*<\/span>/);
assert.match(modal, /<select[^>]+class="form-select dyn-Department"[^>]+id="v_department"/);

const defaultsSource = main.match(/ServiceDepartment:\s*\[([^\]]+)\]/)?.[1] || '';
const serviceDepartments = [...defaultsSource.matchAll(/"([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(serviceDepartments, [
  'Internal Medicine',
  'Pediatrics',
  'OB-GYN',
  'General / ER',
  'IPD',
  'Health Checkup'
]);
assert.match(settings, /<option value="ServiceDepartment">6 ພະແນກບໍລິການ\/Department service<\/option>/);
assert.match(main, /\['Department', 'ServiceDepartment'/);
assert.match(main, /key: 'ServiceDepartment', label: '6 ພະແນກບໍລິການ\/Department service'/);
assert.match(main, /masterDataStore\.ServiceDepartment\?\.length/);
assert.match(main, /\.insert\(\{ Category: c, Value: v \}\)/);
assert.match(main, /\.update\(\{ Value: newVal \}\)\.eq\('ID', id\)/);
assert.match(main, /\.delete\(\)\.eq\('ID', id\)/);
assert.match(dashboard, /6 ພະແນກບໍລິການ\/Department service/);
assert.doesNotMatch(dashboard, /Triage Clinical Departments/);

const submitSource = main.slice(
  main.indexOf('window.submitTriageForm = function'),
  main.indexOf('window.executeTriageSave = async function'),
);
assert.match(submitSource, /ກະລຸນາເລືອກພະແນກບໍລິການ/);

const saveSource = main.slice(
  main.indexOf('window.executeTriageSave = async function'),
  main.indexOf('window.openEMRLabModal = function'),
);
assert.match(saveSource, /from\(dbTable\('OPD_Vital_Signs'\)\)\.insert\(\[opdVitalPayload\]\)/);
assert.match(saveSource, /Department:\s*fd\.v_department,\s*Mapped_Specialist:\s*fd\.v_clinical_department/);
assert.match(saveSource, /from\(dbTable\('Visits'\)\)\.update\(visitUpdatePayload\)\.eq\('Visit_ID',\s*fd\.visitId\)/);
assert.match(saveSource, /query\s*=\s*query\.eq\('Patient_ID',\s*fd\.patientId\)/);
assert.match(saveSource, /ກະລຸນາເລືອກພະແນກບໍລິການ/);

const readSource = main.slice(
  main.indexOf('window._fetchTriageQueue = async function'),
  main.indexOf('window.triggerTriagePublicCall = function'),
);
assert.match(readSource, /clinicalDepartment:\s*r\.Mapped_Specialist\s*\|\|\s*''/);
assert.match(readSource, /department:\s*r\.Department\s*\|\|\s*'OPD'/);

const editSource = main.slice(
  main.indexOf('window.openTriage = async function'),
  main.indexOf('window.deleteVisitFlow = async function'),
);
assert.match(editSource, /const serviceDepartment = String\(r\.clinicalDepartment \|\| ''\)\.trim\(\)/);
assert.match(editSource, /\$serviceDepartment\.append\(new Option\(serviceDepartment, serviceDepartment\)\)/);
assert.match(editSource, /const \$room = \$\('#v_department'\)/);
assert.match(editSource, /toUpperCase\(\)\s*===\s*'OPD'/);

const deleteSource = main.slice(
  main.indexOf('window.deleteVisitFlow = async function'),
  main.indexOf('// ============================================================\n// OPD Follow-up / Observation'),
);
assert.match(deleteSource, /from\(dbTable\('Visits'\)\)\.delete\(\)\.eq\('Visit_ID',\s*visitId\)/);
assert.match(deleteSource, /query\s*=\s*query\.eq\('Patient_ID',\s*patientId\)/);

console.log('Triage Clinical Department CRUD wiring checks passed.');
