import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpdOrderPrintDocument, normalizeMedicationPrintItem } from '../src/opdOrderPrint.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainSource = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

const common = {
  hospital: { name: 'ໂຮງໝໍ ຫຼັກໄຊ', englishName: 'Luckxay Hospital', logoUrl: '/luckxay-logo.jpg' },
  patient: {
    id: 'LXH2026-000001', title: 'ທ້າວ', name: 'ທົດສອບ ລະບົບ', dob: '1990-01-01', age: '36 ປີ',
    gender: 'ຊາຍ', phone: '02055555555', address: 'ບ້ານ A', district: 'ເມືອງ B', province: 'ແຂວງ C'
  },
  encounter: { diagnosis: 'Knee pain', doctor: 'Dr Test', recommendation: 'Take after meals' },
  orderNo: 'ORDER-001',
  orderedAt: '2026-08-17T15:30:00+07:00'
};

const xray = buildOpdOrderPrintDocument({
  ...common,
  type: 'xray',
  items: [{ name: 'X-Ray Right Knee AP/Lateral', instructions: 'Suspected fracture', priority: 'Urgent' }]
});
assert.match(xray, /X-Ray Request/);
assert.match(xray, /ໂຮງໝໍ ຫຼັກໄຊ/);
assert.doesNotMatch(xray, /ໂຮງໝໍ ລັກໄຊ/);
assert.match(xray, /ລາຍການສັ່ງກວດ/);
assert.match(xray, /ຜົນໄດ້ຮັບ/);
assert.match(xray, /X-Ray Right Knee AP\/Lateral/);
assert.match(xray, /ລາຍເຊັນແພດ/);
assert.doesNotMatch(xray, /LXH2026-000001/);
assert.doesNotMatch(xray, /ORDER-001/);
assert.match(xray, /<span>ເລກທີ \/ No:<\/span><b>&nbsp;<\/b>/);
assert.match(xray, /patient-row-primary/);
assert.match(xray, /patient-row-address/);
assert.match(xray, /ທ້າວ ທົດສອບ ລະບົບ/);
assert.match(xray, /left: 50%/);
assert.match(xray, /translateX\(-50%\)/);
assert.doesNotMatch(xray, /\.field-value \{[^}]*overflow: hidden/);

const ultrasound = buildOpdOrderPrintDocument({
  ...common,
  type: 'ultrasound',
  items: [{ name: 'Ultrasound whole abdomen', instructions: 'Fasting 6 hours', priority: 'Routine' }]
});
assert.match(ultrasound, /Ultrasound Request/);
assert.match(ultrasound, /Ultrasound whole abdomen/);
assert.match(ultrasound, /ລາຍການສັ່ງກວດ/);

const prescription = buildOpdOrderPrintDocument({
  ...common,
  type: 'medication',
  items: [{ name: 'Paracetamol 500 mg', quantity: '10', dosage: '1 tablet PO TID for 3 days', note: 'After meal' }]
});
assert.match(prescription, /Prescription/);
assert.match(prescription, /Name of Drug/);
assert.match(prescription, /Paracetamol 500 mg/);
assert.match(prescription, /1 tablet PO TID for 3 days/);
assert.match(prescription, /Recommendation/);
assert.match(prescription, /Pharmacist/);
assert.match(prescription, /patient-urgent-row/);
assert.match(prescription, /Urgent tel/);
assert.match(prescription, /rx-signatures/);
assert.match(prescription, /\.patient-row-primary \{ grid-template-columns: minmax\(0, 1\.75fr\)/);
assert.match(prescription, /\.field-value \{[^}]*font-size: 12\.5px/);
assert.match(prescription, /\.rx-table \{ height: 142mm/);
assert.match(prescription, /\.rx-table \.rx-item-row \{ height: 7\.5mm/);
assert.match(prescription, /\.rx-table \.rx-item-row td \{[^}]*padding: \.7mm 2mm/);
assert.match(prescription, /\.signatures \{[^}]*margin-top: 2mm/);
assert.doesNotMatch(prescription, /\.signatures \{[^}]*margin-top: auto/);
assert.doesNotMatch(prescription, />Dr Test</);
assert.match(prescription, /ເວລາ \/ Time:/);
assert.doesNotMatch(xray, /ເວລາ \/ Time:/);

const structuredMedication = normalizeMedicationPrintItem({
  name: 'Paracetamol 500 mg', quantity: '15', dose: '500 mg', route: 'PO', frequency: 'TID', duration: '5 days'
});
assert.equal(structuredMedication.quantity, '15');
assert.equal(structuredMedication.dosage, '500 mg · PO · TID · 5 days');

const generatedInstructionMedication = normalizeMedicationPrintItem({
  name: 'Amoxicillin 500 mg', instructions: '500 mg · PO · TID · 5 days · Qty 15', quantity: '15'
});
assert.equal(generatedInstructionMedication.quantity, '15');
assert.equal(generatedInstructionMedication.dosage, '500 mg · PO · TID · 5 days');

const misplacedQuantityMedication = normalizeMedicationPrintItem({
  name: 'Legacy medication', instructions: '2'
});
assert.equal(misplacedQuantityMedication.quantity, '2');
assert.equal(misplacedQuantityMedication.dosage, '');

const correctedPrescription = buildOpdOrderPrintDocument({
  ...common,
  type: 'medication',
  items: [
    { name: 'Legacy medication', instructions: '2' },
    { name: 'Paracetamol 500 mg', quantity: '15', dose: '500 mg', route: 'PO', frequency: 'TID', duration: '5 days' }
  ]
});
assert.match(correctedPrescription, /<td class="rx-qty">2<\/td>\s*<td class="rx-directions"><\/td>/);
assert.match(correctedPrescription, /<td class="rx-qty">15<\/td>\s*<td class="rx-directions">500 mg · PO · TID · 5 days<\/td>/);

const escaped = buildOpdOrderPrintDocument({
  ...common,
  patient: { ...common.patient, name: '<img src=x onerror=alert(1)>' },
  type: 'medication',
  items: [{ name: '<script>alert(1)</script>' }]
});
assert.ok(!escaped.includes('<img src=x onerror=alert(1)>'));
assert.ok(!escaped.includes('<script>alert(1)</script>'));
assert.match(escaped, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

const prefixedName = buildOpdOrderPrintDocument({
  ...common,
  patient: { ...common.patient, name: 'ທ້າວ ທົດສອບ ລະບົບ' },
  type: 'xray',
  items: []
});
assert.doesNotMatch(prefixedName, /ທ້າວ ທ້າວ/);

assert.match(mainSource, /\['ultrasound', 'xray', 'medication'\]\.includes\(type\)/);
assert.match(mainSource, /opdTestPrintOrderBatch\('\$\{type\}'/);
assert.match(mainSource, /opdTestPrintOrderBatch\('medication'/);
assert.match(mainSource, /buildOpdOrderPrintDocument/);
assert.match(mainSource, /name: 'ໂຮງໝໍ ຫຼັກໄຊ'/);
assert.match(mainSource, /visit\.patientTitle/);
assert.match(mainSource, /normalizeMedicationPrintItem\(item\)/);
assert.doesNotMatch(mainSource, /\(medication\.quantity \|\| medication\.qty\) \? `Qty/);

console.log('OPD X-Ray, Ultrasound and prescription print template tests passed.');
