import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const modal = await readFile(new URL('../public/partials/modals/triage-modal.html', import.meta.url), 'utf8');

const clinicalSelect = modal.match(/<select[^>]+id="v_clinical_department"[\s\S]*?<\/select>/)?.[0] || '';
const clinicalDepartments = [...clinicalSelect.matchAll(/<option value="([^"]+)">/g)].map(match => match[1]);
assert.deepEqual(clinicalDepartments, [
  'Internal Medicine',
  'Pediatrics',
  'OB-GYN',
  'General / ER',
  'IPD',
  'Health Checkup',
]);
assert.match(clinicalSelect, /\brequired\b/);
assert.match(modal, /Clinical Department\)\s*<span class="text-danger">\*<\/span>/);
assert.match(modal, /<select[^>]+class="form-select dyn-Department"[^>]+id="v_department"/);

const submitSource = main.slice(
  main.indexOf('window.submitTriageForm = function'),
  main.indexOf('window.executeTriageSave = async function'),
);
assert.match(submitSource, /ກະລຸນາເລືອກພະແນກກວດ/);

const saveSource = main.slice(
  main.indexOf('window.executeTriageSave = async function'),
  main.indexOf('window.openEMRLabModal = function'),
);
assert.match(saveSource, /from\(dbTable\('OPD_Vital_Signs'\)\)\.insert\(\[opdVitalPayload\]\)/);
assert.match(saveSource, /Department:\s*fd\.v_department,\s*Mapped_Specialist:\s*fd\.v_clinical_department/);
assert.match(saveSource, /from\(dbTable\('Visits'\)\)\.update\(visitUpdatePayload\)\.eq\('Visit_ID',\s*fd\.visitId\)/);
assert.match(saveSource, /query\s*=\s*query\.eq\('Patient_ID',\s*fd\.patientId\)/);
assert.match(saveSource, /ກະລຸນາເລືອກພະແນກກວດ/);

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
assert.match(editSource, /#v_clinical_department'\)\.val\(r\.clinicalDepartment\s*\|\|\s*''\)/);
assert.match(editSource, /const \$room = \$\('#v_department'\)/);
assert.match(editSource, /toUpperCase\(\)\s*===\s*'OPD'/);

const deleteSource = main.slice(
  main.indexOf('window.deleteVisitFlow = async function'),
  main.indexOf('// ============================================================\n// OPD Follow-up / Observation'),
);
assert.match(deleteSource, /from\(dbTable\('Visits'\)\)\.delete\(\)\.eq\('Visit_ID',\s*visitId\)/);
assert.match(deleteSource, /query\s*=\s*query\.eq\('Patient_ID',\s*patientId\)/);

console.log('Triage Clinical Department CRUD wiring checks passed.');
