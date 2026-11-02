import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('window._patientDropdownOptions = {');
const end = source.indexOf('window.seedMasterDefaults =', start);
assert.ok(start >= 0 && end > start);

const rendered = new Map();
const context = {
  window: { emrLabCategoryConfig: [], escapeEmrPickerHtml: value => value },
  document: { getElementById: () => null },
  console,
  masterDataStore: {},
  $: selector => ({
    html: value => rendered.set(selector, value),
    filter: () => ({ remove: () => {} }),
    text: () => {},
  }),
};
vm.runInNewContext(source.slice(start, end), context);

context.window.loadMasterDataGlobalCallback({
  Channel: [{ id: 1, value: 'Facebook' }, { id: 3, value: 'Walk in' }, { id: 5, value: 'ຍາດພີ່ນ້ອງແນະນຳ' }],
  Occupation: [
    { id: 2, value: 'ຄ້າຂາຍ' },
    { id: 4, value: 'ເດັກ' },
    { id: 6, value: 'ນັກສຶກສາ/ນັກຮຽນ' },
    { id: 7, value: 'ນັກຮຽນ/ນັກສຶກສາ' },
  ],
});

const expectedChannel = ['ສື່ໂຄສະນາ / facebook', 'ຕິດຕາມ', 'ຍາດພີ່ນ້ອງແນະນຳ', 'ຜ່ານໂຮງໝໍອື່ນ', 'walk in'];
const expectedOccupation = ['ເດັກ', 'ນັກຮຽນ/ນັກສຶກສາ', 'ພະນັກງານ', 'ປະຊາຊົນ/ອື່ນໆ', 'ຄ້າຂາຍ', 'ນັກທຸລະກິດ'];
const values = key => [...rendered.get(`.dyn-${key}`).matchAll(/<option value="([^"]+)">/g)].map(match => match[1]);
assert.deepEqual(values('Channel'), expectedChannel);
assert.deepEqual(values('Occupation'), expectedOccupation);
context.window.loadMasterDataGlobalCallback({});
assert.deepEqual(values('Channel'), expectedChannel);
assert.deepEqual(values('Occupation'), expectedOccupation);

const selects = {
  p_job: { options: expectedOccupation.map(value => ({ value })), dataset: {}, value: '', required: false },
  p_channel: { options: expectedChannel.map(value => ({ value })), dataset: {}, value: '', required: true },
};
const notes = { p_job_legacy: { textContent: '', hidden: true }, p_channel_legacy: { textContent: '', hidden: true } };
context.document.querySelector = selector => selects[selector.match(/name="([^"]+)"/)?.[1]];
context.document.getElementById = id => notes[id] || null;
context.window.applyPatientLegacyChoice('p_job', 'Old occupation');
context.window.applyPatientLegacyChoice('p_channel', 'Old channel');
assert.equal(selects.p_job.value, '');
assert.equal(selects.p_channel.value, '');
assert.equal(selects.p_channel.required, false);
assert.equal(notes.p_job_legacy.hidden, false);
assert.equal(notes.p_channel_legacy.hidden, false);
assert.equal(context.window.patientFormChoiceValue('', selects.p_job), 'Old occupation');
assert.equal(context.window.patientFormChoiceValue('', selects.p_channel), 'Old channel');
assert.equal(context.window.patientFormChoiceValue('ຄ້າຂາຍ', selects.p_job), 'ຄ້າຂາຍ');
context.window.applyPatientLegacyChoice('p_channel', '');
assert.equal(selects.p_channel.required, true);
assert.equal(notes.p_channel_legacy.hidden, true);

console.log('Patient channel and occupation dropdown options passed.');
