import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildOpdQueueOrderSummary,
  buildOpdTestVisitPersistence,
  normalizeOpdTestOrderSchedule,
  normalizeOpdTestOrders,
  normalizeOpdTestDisposition,
  resolveOpdTestInvestigationType,
  resolveOpdTestDisposition
} from '../src/opdTestPersistence.js';

assert.deepEqual(resolveOpdTestDisposition('Home', false), {
  code: 'Home',
  note: '',
  mainStatus: 'Completed',
  dischargeStatus: 'ກວດສຳເລັດ / ກັບບ້ານ'
});
assert.equal(resolveOpdTestDisposition('Home', true).mainStatus, 'Pharmacy');
assert.equal(resolveOpdTestDisposition('Observe').mainStatus, 'OPD Observation');
assert.deepEqual(resolveOpdTestDisposition('ກັບມາກວດຄືນຖ້າອາການບໍ່ດີຂຶ້ນ'), {
  code: 'Other',
  note: 'ກັບມາກວດຄືນຖ້າອາການບໍ່ດີຂຶ້ນ',
  mainStatus: 'Completed',
  dischargeStatus: 'ກັບມາກວດຄືນຖ້າອາການບໍ່ດີຂຶ້ນ'
});
assert.deepEqual(normalizeOpdTestDisposition('Other', 'Doctor custom note'), {
  code: 'Other',
  note: 'Doctor custom note'
});
assert.equal(resolveOpdTestInvestigationType({ name: 'CBC' }), 'lab');
assert.equal(resolveOpdTestInvestigationType({ categoryKey: 'ultrasound', name: 'Abdomen' }), 'ultrasound');
assert.equal(resolveOpdTestInvestigationType({ category: 'X-Ray', name: 'Chest PA' }), 'xray');
assert.equal(resolveOpdTestInvestigationType({ name: 'Breast sonography' }), 'ultrasound');

const repeated = normalizeOpdTestOrders([
  {
    name: 'CBC',
    orderedAt: '2026-08-03T01:55:00.000Z',
    scheduledAt: '2026-08-03T02:00:00.000Z'
  },
  {
    name: 'CBC',
    orderedAt: '2026-08-03T07:55:00.000Z',
    scheduledAt: '2026-08-03T08:00:00.000Z'
  }
], {
  visitId: 'V001',
  patientId: 'P001',
  doctor: 'Dr Test',
  completedAt: '2026-08-03T08:00:00.000Z'
});
assert.equal(repeated.length, 2);
assert.equal(repeated[0].repeatScheduledAt.length, 0);
assert.equal(repeated[0].localOrderId, repeated[0].orderNo);
assert.equal(repeated[0].scheduledAt, '2026-08-03T02:00:00.000Z');
assert.notEqual(repeated[0].localOrderId, repeated[1].localOrderId);
assert.notEqual(repeated[0].orderedAt, repeated[1].orderedAt);
assert.notEqual(repeated[0].orderBatchId, repeated[1].orderBatchId);
assert.equal(repeated[0].occurrences.length, 1);
assert.equal(repeated[0].occurrences[0].occurrenceId, `${repeated[0].localOrderId}-OCC-001`);
assert.deepEqual(normalizeOpdTestOrderSchedule({ orderedAt: '2026-08-03T08:00:00.000Z' }), {
  orderedAt: '2026-08-03T08:00:00.000Z',
  scheduledAt: '2026-08-03T08:00:00.000Z',
  repeatScheduledAt: []
});

const separatedInvestigations = normalizeOpdTestOrders([
  { name: 'CBC', categoryKey: 'hematology' },
  { name: 'Ultrasound Abdomen', categoryKey: 'ultrasound' },
  { name: 'Chest PA', categoryKey: 'xray' }
], {
  visitId: 'V002',
  patientId: 'P002',
  completedAt: '2026-08-03T08:00:00.000Z'
});
assert.deepEqual(separatedInvestigations.map(item => item.investigationType), ['lab', 'ultrasound', 'xray']);
assert.deepEqual(separatedInvestigations.map(item => item.destinationSystem), ['LIS', 'RIS', 'RIS']);
assert.equal(separatedInvestigations[0].lisStatus, 'pending-lis');
assert.equal(separatedInvestigations[1].lisStatus, 'not-applicable');
assert.equal(separatedInvestigations[1].risStatus, 'pending-ris');
assert.equal(separatedInvestigations[1].status, 'ordered');
assert.notEqual(separatedInvestigations[0].orderBatchId, separatedInvestigations[1].orderBatchId);
assert.notEqual(separatedInvestigations[1].orderBatchId, separatedInvestigations[2].orderBatchId);

const queueOrderSummary = buildOpdQueueOrderSummary({
  labOrdersStr: JSON.stringify([
    { name: 'CBC', investigationType: 'lab', lisStatus: 'released', resultPdfUrl: '/cbc.pdf' },
    { name: 'Glucose', investigationType: 'lab', lisStatus: 'sent' },
    { name: 'Abdomen', investigationType: 'ultrasound', risStatus: 'processing' },
    { name: 'Chest PA', investigationType: 'xray', risStatus: 'ordered' }
  ]),
  prescriptionStr: JSON.stringify([
    { name: 'Paracetamol', pharmacyStatus: 'dispensed' }
  ])
});
assert.deepEqual(queueOrderSummary, {
  lab: { count: 2, state: 'progress' },
  ultrasound: { count: 1, state: 'progress' },
  xray: { count: 1, state: 'pending' },
  medication: { count: 1, state: 'ready' }
});
assert.deepEqual(buildOpdQueueOrderSummary({ labOrdersStr: '{invalid json' }), {
  lab: { count: 0, state: 'none' },
  ultrasound: { count: 0, state: 'none' },
  xray: { count: 0, state: 'none' },
  medication: { count: 0, state: 'none' }
});

const sameBatch = normalizeOpdTestOrders([
  { name: 'CBC', investigationType: 'lab', orderedAt: '2026-08-03T09:00:00.000Z' },
  { name: 'Glucose', investigationType: 'lab', orderedAt: '2026-08-03T09:00:00.000Z' }
], { visitId: 'V003', completedAt: '2026-08-03T09:00:00.000Z' });
assert.equal(sameBatch[0].orderBatchId, sameBatch[1].orderBatchId);

const payload = buildOpdTestVisitPersistence({
  visitId: 'V001',
  patientId: 'P001',
  doctor: 'Dr Test',
  chiefComplaint: 'Fever',
  hpi: 'Two days',
  diagnoses: ['Viral infection'],
  treatment: 'Supportive care',
  advice: 'Hydration',
  followUp: '2026-08-20',
  disposition: 'Home',
  orders: repeated,
  medications: [
    {
      name: 'Paracetamol', dose: '500 mg', route: 'PO', frequency: 'TID', duration: '3 days', quantity: '9',
      localMedicationId: 'HIS-RX-001', prescriptionBatchId: 'HIS-RX-BATCH-001',
      pharmacyStatus: 'sent_to_pharmacy', prescribedAt: '2026-08-03T07:55:00.000Z'
    },
    {
      name: 'Paracetamol', dose: '500 mg', route: 'PO', frequency: 'TID', duration: '3 days', quantity: '9',
      localMedicationId: 'HIS-RX-002', prescribedAt: '2026-08-03T08:00:00.000Z'
    }
  ],
  completedAt: '2026-08-03T08:00:00.000Z'
});
assert.equal(payload.coreUpdate.Status, 'Pharmacy');
assert.equal(payload.clinicalNote.hpi, 'Two days');
assert.equal(payload.clinicalNote.followUp, '2026-08-20');
assert.equal(payload.coreUpdate.Follow_Up, '2026-08-20');
assert.equal(payload.coreUpdate.Follow_Up_Date, '2026-08-20');
const persistedOrders = JSON.parse(payload.coreUpdate.Lab_Orders_JSON);
assert.equal(persistedOrders.length, 2);
assert.equal(persistedOrders[0].repeatScheduledAt.length, 0);
assert.equal(persistedOrders[0].occurrences.length, 1);
assert.notEqual(persistedOrders[0].orderNo, persistedOrders[1].orderNo);
const persistedMedications = JSON.parse(payload.coreUpdate.Prescription_JSON);
assert.equal(persistedMedications.length, 2);
assert.equal(persistedMedications[0].status, 'prescribed');
assert.equal(persistedMedications[0].prescriptionBatchId, 'HIS-RX-BATCH-001');
assert.equal(persistedMedications[0].pharmacyStatus, 'sent_to_pharmacy');
assert.notEqual(persistedMedications[0].localMedicationId, persistedMedications[1].localMedicationId);
assert.notEqual(persistedMedications[0].prescribedAt, persistedMedications[1].prescribedAt);
assert.equal(payload.enhancedUpdate.EMR_Revision, 1);
assert.equal(payload.clinicalNote.dispositionCode, 'Home');
assert.equal(payload.clinicalNote.dispositionNote, '');

const customDispositionPayload = buildOpdTestVisitPersistence({
  visitId: 'V004',
  patientId: 'P004',
  dispositionCode: 'Other',
  dispositionNote: 'Return immediately if symptoms worsen'
});
assert.equal(customDispositionPayload.disposition.code, 'Other');
assert.equal(customDispositionPayload.coreUpdate.Status, 'Completed');
assert.equal(customDispositionPayload.coreUpdate.Discharge_Status, 'Return immediately if symptoms worsen');
assert.equal(customDispositionPayload.clinicalNote.dispositionCode, 'Other');
assert.equal(customDispositionPayload.clinicalNote.dispositionNote, 'Return immediately if symptoms worsen');

const [opdViewSource, opdTestViewSource, mainSource] = await Promise.all([
  readFile(new URL('../public/partials/views/opd.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/views/opd_test.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8')
]);
assert.match(opdViewSource, /ແພດຜູ້ກວດ/);
assert.match(opdViewSource, /ປະກັນ \/ ອົງກອນ/);
assert.match(opdViewSource, /<th>ຄຳນຳໜ້າ<\/th>/);
assert.match(opdViewSource, /<th>ອາຍຸ<\/th>/);
assert.match(opdViewSource, /<th>ເພດ<\/th>/);
assert.doesNotMatch(opdViewSource, /<th>ຄຳສັ່ງ \/ Order<\/th>/);
assert.match(opdViewSource, /<th>ສະຖານະ<\/th>/);
assert.match(mainSource, /Insurance_Company, Insurance_Code/);
assert.match(mainSource, /ຍັງບໍ່ກຳນົດ/);
assert.match(mainSource, /colspan="11"/);
assert.match(mainSource, /formatOpdQueueGender/);
assert.match(mainSource, /renderOpdQueueOrderBadges/);
assert.match(mainSource, /openOpdQueueOrderWorkspace/);
assert.match(mainSource, /class="opd-queue-status-cell"/);
assert.match(mainSource, /aria-label="ສະຖານະຄຳສັ່ງ"/);
assert.match(opdTestViewSource, /opdTestAssignDoctor\(this\.value\)/);
assert.match(mainSource, /update\(\{ Doctor_Name: doctorName \}\)/);
assert.match(mainSource, /data-opd-doctor/);

console.log('OPD persistence checks passed');
