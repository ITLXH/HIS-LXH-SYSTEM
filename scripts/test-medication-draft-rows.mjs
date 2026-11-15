import assert from 'node:assert/strict';
import { createCatalogDraft, updateCatalogDraft, invalidCatalogDraftIndex, calculateQuantity } from '../src/medicationDraftRows.js';
import { prepareNativeLines } from '../src/nativePrescriptionSubmit.js';

const catalog = { name: 'Amlodipine 5 mg', id: 'drug-1', source: 'database' };
const row = createCatalogDraft(catalog, { dose: '5 mg', route: 'PO', frequency: 'OD', duration: '30 days', quantity: '30' });
assert.equal(row.name, catalog.name);
assert.equal(row.sourceDrugId, 'drug-1');
assert.equal(createCatalogDraft({ ...catalog, unitCode: 'TAB' }).unitCode, 'TAB');
const nativeDraft = ['dose', 'route', 'frequency', 'duration', 'quantity'].reduce((item, field, index) =>
  updateCatalogDraft(item, field, ['1', 'PO', 'BID', '5 days', '10'][index]),
  createCatalogDraft({ ...catalog, source: 'pmc', unitCode: 'TAB', catalogueVersion: 'a'.repeat(32) })
);
const [nativeLine] = prepareNativeLines([{ ...nativeDraft, prescriptionItemId: 'SYN-1' }]);
assert.equal(nativeLine.sourceDrugId, 'drug-1');
assert.equal(nativeLine.unitCode, 'TAB');
assert.equal(nativeLine.instructions, '1 · PO · BID · 5 days');
assert.equal(row.instructions, '5 mg · PO · OD · 30 days');
assert.equal(invalidCatalogDraftIndex([row]), -1);

const empty = createCatalogDraft({ name: 'Unknown drug', source: 'database' }, {});
assert.equal(invalidCatalogDraftIndex([empty]), 0);
const filled = ['dose', 'route', 'frequency', 'duration', 'quantity'].reduce(
  (item, field) => updateCatalogDraft(item, field, field === 'quantity' ? '10' : '1'), empty
);
assert.equal(invalidCatalogDraftIndex([filled]), -1);
assert.equal(filled.instructions, '1 · 1 · 1 · 1');
assert.equal(invalidCatalogDraftIndex([{ name: 'Free text', instructions: 'Take as directed' }]), -1);
assert.equal(invalidCatalogDraftIndex([{ ...row, quantity: '0' }]), 0);
assert.equal(calculateQuantity('1 ເມັດ', 'OD', '30 days'), '30');
assert.equal(calculateQuantity('2 tablets', 'BID', '7 ມື້'), '28');
assert.equal(calculateQuantity('1 ເມັດ', 'OD', '30'), '30');
assert.equal(calculateQuantity('5 mg', 'OD', '30 days'), '');
assert.equal(calculateQuantity('5', 'OD', '50'), '');
assert.equal(calculateQuantity('1 tablet', 'PRN', '10 days'), '');
const auto = createCatalogDraft({ name: 'Tablet' }, { dose: '1 tablet', frequency: 'OD', duration: '30 days' });
assert.equal(auto.quantity, '30');
assert.equal(updateCatalogDraft(auto, 'duration', '14 days').quantity, '14');
const manual = updateCatalogDraft(auto, 'quantity', '20');
assert.equal(updateCatalogDraft(manual, 'duration', '14 days').quantity, '20');
assert.equal(updateCatalogDraft(updateCatalogDraft(manual, 'quantity', ''), 'duration', '14 days').quantity, '14');
const templated = createCatalogDraft({ name: 'Amlodipine 5 mg' }, { dose: '5 mg', frequency: 'OD', duration: '30 days', quantity: '30' });
assert.equal(updateCatalogDraft(templated, 'duration', '14 days').quantity, '');
assert.equal(updateCatalogDraft(updateCatalogDraft(templated, 'quantity', '20'), 'duration', '14 days').quantity, '20');
console.log('Medication draft row checks passed');
