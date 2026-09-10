import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [view, chart, main, style, careTasksMigration] = await Promise.all([
  readFile(new URL('../public/partials/views/ipd_ward_bed.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/views/ipd_chart.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260909170000_ipd_medication_and_specimen_tasks.sql', import.meta.url), 'utf8'),
]);

for (const id of [
  'ipdTotalBeds',
  'ipdOccupiedBeds',
  'ipdAvailableBeds',
  'ipdReservedBeds',
  'ipdAttentionTasks',
  'ipdFilterWard',
  'ipdFilterRoom',
  'ipdFilterStatus',
  'ipdFilterBedType',
  'ipdFilterSearch',
  'ipdFilterDoctor',
  'ipdBedBoard',
  'ipdNurseStation',
  'ipdDoctorCensus',
  'ipdFilteredResultCount',
  'ipdNurseAttentionCount',
]) {
  assert.match(view, new RegExp(`id=["']${id}["']`), `missing IPD operations control #${id}`);
}

assert.match(view, /data-bs-target="#ipdBedBoardTab"/);
assert.match(view, /data-bs-target="#ipdNurseStationTab"/);
assert.match(view, /data-bs-target="#ipdDoctorCensusTab"/);
assert.match(view, /setIpdBedViewMode\('compact'\)/);
assert.match(view, /setIpdBedViewMode\('detail'\)/);
assert.match(view, /setIpdBedViewMode\('floor'\)/);
assert.match(view, /applyIpdQuickFilter\('Attention'\)/);

assert.match(main, /\(observation\|follow\[- \]\?up\|short\[- \]\?stay\)/i);
assert.match(main, /if \(rawType\) return false/);
assert.ok(main.includes('a General/IPD ward may'), 'configured IPD ward types must override display-name heuristics');
assert.match(main, /window\.ipdInpatientWards = function/);
assert.match(main, /window\.ipdInpatientBeds = function/);
assert.match(main, /const readyBeds = window\.ipdInpatientBeds\(\)/);
assert.match(main, /const destinations = window\.ipdInpatientBeds\(\)/);
assert.match(main, /window\.ipdInpatientWards\(\)\.forEach\(ward =>/);
assert.match(main, /window\.ipdIsActiveAdmission\(admission\) \|\| !window\.ipdIsInpatientAdmission\(admission\)/);
assert.match(main, /const inpatientAdmissions = state\.admissions\.filter\(a => window\.ipdIsInpatientAdmission\(a\)\)/);
assert.match(main, /const inpatientBeds = window\.ipdInpatientBeds\(\)/);
assert.match(main, /const todayDischarges = inpatientAdmissions\.filter\(a => window\.ipdDischargeDate\(a\) === today\)\.length/);

for (const id of [
  'ipdChartSummaryPanel',
  'ipdClinicalSnapshot',
  'ipdCareTaskAlerts',
  'ipdCareTasksPane',
  'ipdMedicationAdministrationsList',
  'ipdSpecimenTasksList',
  'ipdVitalsList',
  'ipdDoctorNotesList',
  'ipdNursingNotesList',
  'ipdMedicationOrdersList',
  'ipdVisitsList',
  'ipdLabResultsList',
  'ipdDischargeSummaryView',
]) {
  assert.match(chart, new RegExp(`id=["']${id}["']`), `missing IPD chart control #${id}`);
}

assert.match(main, /window\.renderIpdMedicationAdministrations = function/);
assert.match(main, /window\.openIpdMedicationAdministrationModal = async function/);
assert.match(main, /window\.renderIpdSpecimenTasks = function/);
assert.match(main, /window\.openIpdSpecimenTaskModal = async function/);
assert.match(main, /window\.renderIpdCareTaskAlerts = function/);
assert.match(main, /window\.setupIpdCareTaskClock = function/);
assert.match(main, /window\.showIpdCareTaskDesktopNotification = function/);
assert.match(main, /window\.ipdBoardCareTaskSummary = function/);
assert.match(main, /window\.ipdAllAttentionTasks = function/);
assert.match(main, /window\.renderIpdNurseAttentionQueue = function/);
assert.match(main, /window\.openIpdAdmissionCareTasks = function/);
assert.match(main, /window\.setupIpdWardBedShortcuts = function/);
assert.match(main, /IPD_Medication_Administrations'\)\)\.select\('\*'\)/);
assert.match(main, /IPD_Specimen_Tasks'\)\)\.select\('\*'\)/);
assert.match(main, /new Notification\(overdueCount \? 'IPD care task overdue' : 'IPD care task due'/);
assert.match(main, /Reason is required for this status/);
assert.doesNotMatch(main, /ipdDeleteClinical\('IPD_(?:Medication_Administrations|Specimen_Tasks)'/);
assert.match(style, /\.ipd-attention-panel/);
assert.match(style, /\.ipd-quick-filter/);
assert.match(style, /#view-ipd_chart \.ipd-tabs/);

assert.match(careTasksMigration, /HIS_One_IPD_Medication_Administrations/);
assert.match(careTasksMigration, /HIS_One_IPD_Specimen_Tasks/);
assert.match(careTasksMigration, /CHECK \("Status" IN \('Scheduled','Given','Held','Refused','Missed','Cancelled'\)\)/);
assert.match(careTasksMigration, /CHECK \("Status" IN \('Scheduled','Collected','Sent','Received','Rejected','Cancelled'\)\)/);
assert.match(careTasksMigration, /ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(careTasksMigration, /GRANT DELETE/);

console.log('IPD operations, clinical chart, care-task safety and Observation separation checks passed.');
