import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('window._patientDropdownAdditions = {');
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
  Occupation: [{ id: 2, value: 'ຄ້າຂາຍ' }, { id: 4, value: 'ເດັກ' }],
});

const channelOptions = rendered.get('.dyn-Channel');
const occupationOptions = rendered.get('.dyn-Occupation');
for (const value of ['ສື່ໂຄສະນາ / Facebook', 'ຕິດຕາມ', 'ຍາດພີ່ນ້ອງແນະນຳ', 'ຜ່ານໂຮງໝໍອື່ນ', 'Walk in']) {
  assert.ok(channelOptions.includes(`<option value="${value}">${value}</option>`), `missing channel ${value}`);
}
for (const value of ['ເດັກ', 'ນັກຮຽນ/ນັກສຶກສາ', 'ພະນັກງານ', 'ປະຊາຊົນ/ອື່ນໆ', 'ຄ້າຂາຍ', 'ນັກທຸລະກິດ']) {
  assert.ok(occupationOptions.includes(`<option value="${value}">${value}</option>`), `missing occupation ${value}`);
}
assert.equal((channelOptions.match(/value="Facebook"/g) || []).length, 1);
assert.equal((channelOptions.match(/value="Walk in"/g) || []).length, 1);
assert.equal((occupationOptions.match(/value="ຄ້າຂາຍ"/g) || []).length, 1);
assert.equal((occupationOptions.match(/value="ເດັກ"/g) || []).length, 1);

console.log('Patient channel and occupation dropdown options passed.');
