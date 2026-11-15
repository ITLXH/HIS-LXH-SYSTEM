import assert from 'node:assert/strict';
import { medicationOptions, durationOptions, validMedicationMasterValue } from '../src/medicationOrderOptions.js';

assert.deepEqual(medicationOptions(undefined, 'route')[0], ['PO', 'ກິນ (PO)']);
assert.deepEqual(medicationOptions([{ value: 'IM|ສີດເຂົ້າກ້າມ' }], 'route'), [['IM', 'ສີດເຂົ້າກ້າມ']]);
assert.deepEqual(medicationOptions([{ value: 'BID|ວັນລະ 2 ເທື່ອ' }, { value: 'BID|duplicate' }, { value: 'bad code|invalid' }], 'frequency'), [['BID', 'ວັນລະ 2 ເທື່ອ']]);
assert.deepEqual(durationOptions([{ value: '5' }, { value: '14' }, { value: '0' }, { value: 'abc' }]), ['5', '14']);
assert.equal(validMedicationMasterValue('MedicationRoute', 'PO|ກິນ (PO)'), true);
assert.equal(validMedicationMasterValue('MedicationRoute', 'PO'), false);
assert.equal(validMedicationMasterValue('MedicationDuration', '14'), true);
assert.equal(validMedicationMasterValue('MedicationDuration', '14 days'), false);
console.log('Medication order options: OK');
