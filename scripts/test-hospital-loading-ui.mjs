import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const backupView = await readFile(new URL('../public/partials/views/backup.html', import.meta.url), 'utf8');
const activityLogView = await readFile(new URL('../public/partials/views/activity_log.html', import.meta.url), 'utf8');
const timelineModal = await readFile(new URL('../public/partials/modals/patient-timeline-modal.html', import.meta.url), 'utf8');
const emrModals = await readFile(new URL('../public/partials/modals/emr-modals.html', import.meta.url), 'utf8');

assert.match(mainSource, /window\.getHospitalDataLoaderHtml = function/);
assert.match(mainSource, /window\.getHospitalTableLoadingRow = function/);
assert.match(mainSource, /\/luckxay-logo\.jpg/);
assert.match(mainSource, /role=\"status\" aria-live=\"polite\"/);
assert.match(mainSource, /'loading\.data': 'ກຳລັງໂຫລດຂໍ້ມູນ'/);

const sharedLoaderSource = mainSource.slice(
  mainSource.indexOf('window.getHospitalDataLoaderHtml = function'),
  mainSource.indexOf('window.getHospitalTableLoadingRow = function')
);
assert.match(sharedLoaderSource, /const message = escapeText\(window\.t\('loading\.data'\)\)/);
assert.doesNotMatch(sharedLoaderSource, /options\.message/);
assert.doesNotMatch(sharedLoaderSource, /<small>/);

for (const selector of [
  '#reportTable tbody', '#visitHistoryTable tbody', '#patientTable tbody',
  '#triageTableBody', '#observationTable tbody', '#queueTableBody',
  '#apptTable tbody', '#vacMasterTable tbody', '#patientVacTable tbody',
  '#drugTable tbody', '#labTable tbody', '#userTable tbody', '#orgTable tbody',
  '#locationTable tbody', '#serviceTable tbody', '#activityLogTableBody',
  '#backupHistoryBody', '#ipdBedBoard', '#ipdStandaloneInpatientTable tbody'
]) {
  assert.ok(mainSource.includes(selector), `Missing loading target ${selector}`);
}

const registrationLoaderSource = mainSource.slice(
  mainSource.indexOf('window.initPatientTable = function'),
  mainSource.indexOf('// PATIENT PHOTO HANDLERS')
);
assert.doesNotMatch(registrationLoaderSource, /getHospitalTableLoadingRow\(12/);
assert.match(registrationLoaderSource, /\$\('#patientTable tbody'\)\.empty\(\)/);
assert.match(registrationLoaderSource, /loadingRecords:\s*''/);
assert.equal((registrationLoaderSource.match(/getHospitalDataLoaderHtml\(/g) || []).length, 1);

assert.match(styles, /\.his-data-loader\s*\{/);
assert.match(styles, /\.his-data-loader__logo-shell::after\s*\{/);
assert.match(styles, /\.his-data-loader__logo\s*\{[^}]*object-fit:\s*contain/s);
assert.doesNotMatch(styles, /\.his-data-loader__logo\s*\{[^}]*clip-path:/s);
assert.match(styles, /@keyframes his-loader-ring/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /#view-patients \.dataTables_processing \.his-data-loader__logo\s*\{/);
assert.match(styles, /\.his-data-loader\s*\{[^}]*width:\s*min\(220px,\s*100%\)[^}]*margin:\s*0 auto[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*border:\s*1px solid #cbd8e3[^}]*box-shadow:/s);
assert.match(styles, /\.his-data-loader__logo-shell\s*\{[^}]*width:\s*44px[^}]*height:\s*44px[^}]*flex:\s*0 0 44px/s);
assert.match(styles, /\.his-data-loader--compact,[\s\S]*?flex-direction:\s*column[\s\S]*?align-items:\s*center[\s\S]*?text-align:\s*center/);
assert.doesNotMatch(styles, /\.his-data-loader--compact \.his-data-loader__logo-shell/);
assert.doesNotMatch(styles, /\.his-system-loader \.his-data-loader__logo-shell/);
assert.match(styles, /#view-patients \.dataTables_processing\s*\{[^}]*width:\s*220px !important[^}]*padding:\s*0 !important[^}]*background:\s*transparent/s);

for (const source of [indexHtml, backupView, activityLogView, timelineModal, emrModals]) {
  assert.match(source, /his-data-loader/);
  assert.match(source, /\/luckxay-logo\.jpg/);
  assert.match(source, /<strong>ກຳລັງໂຫລດຂໍ້ມູນ<\/strong>/);
  assert.doesNotMatch(source, /his-data-loader__copy[^<]*>[\s\S]{0,160}<small>/);
}

assert.doesNotMatch(mainSource, /spinner-border[^\n]*ກຳລັງໂຫຼດ/);
assert.doesNotMatch(mainSource, /fa-spinner[^\n]*ກຳລັງໂຫຼດ(?:ຂໍ້ມູນ|ປະຫວັດ|ລາຍການ)/);

console.log('Hospital-branded data loading UI checks passed.');
