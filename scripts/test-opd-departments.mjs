import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OPD_DEPARTMENTS,
  getOpdDepartmentFromVisit,
  resolveOpdDepartmentKey,
} from '../src/opdDepartments.js';

const expected = [
  ['integumentary', 'Integumentary ລະບົບຜີວໜັງ'],
  ['muscular_skeletal', 'Muscular&Skeletal ລະບົບກ້າມເນື້ອແລະກະດູກ'],
  ['nervous', 'Nervous ລະບົບປະສາດ'],
  ['cardiovescular', 'Cardiovescular ລະບົບຫົວໃຂຫລອດເລືອດ'],
  ['respiratory', 'Respiratory ລະບົບຫາຍໃຈ'],
  ['gastro_intentinal', 'Gastro&Intentinal ກະເພາະລຳໄສ'],
  ['urology', 'Urology ລະບົບຸາຍເທ່'],
  ['reproductive_obgyn', 'Reproductive&OB-GYN ລະບົບສືບພັນແລະປະສູດພະຍາດຍິງ'],
  ['ncds', 'NCDs(DM/HN/DLP/Ob/CV/CA) ກູມພະຍາດຊຳເຮື້ອ'],
  ['immune_lymphatic', 'Immune-Lymphatic ພູມຕູ້ມກັນ-ຕ່ອມນຳ້ເຫຼືອງ'],
  ['ent', 'ENT ຫູດັງຄໍ'],
  ['hematology', 'Hematology ກຸ່ມພະຍາດເລືອດ'],
  ['ophthalmology', 'Ophthalmology ຕາ'],
];
assert.deepEqual(OPD_DEPARTMENTS.map(item => [item.key, item.label]), expected);
assert.equal(resolveOpdDepartmentKey('Cardiology'), 'cardiovescular');
assert.equal(resolveOpdDepartmentKey('Orthopedic'), 'muscular_skeletal');
assert.equal(resolveOpdDepartmentKey('Hematology (OPD)'), 'hematology');
assert.equal(resolveOpdDepartmentKey('ກຸ່ມພະຍາດເລືອດ'), 'hematology');
assert.equal(resolveOpdDepartmentKey('Ophthalmology'), 'ophthalmology');
assert.equal(resolveOpdDepartmentKey('ພະຍາດຕາ'), 'ophthalmology');
assert.equal(resolveOpdDepartmentKey(''), '');
assert.deepEqual(getOpdDepartmentFromVisit({
  Clinical_Note_JSON: JSON.stringify({ departmentKey: 'respiratory', department: expected[4][1] }),
}), { key: 'respiratory', label: expected[4][1] });
assert.equal(getOpdDepartmentFromVisit({ Department: 'ຫ້ອງກວດທົ່ວໄປ' }), null);

const [opdView, dashboard, main] = await Promise.all([
  readFile(new URL('../public/partials/views/opd_test.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/views/dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
]);
const picker = opdView.match(/<select[^>]+id="opdTestDeptPicker"[\s\S]*?<\/select>/)?.[0] || '';
const optionKeys = [...picker.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]).filter(Boolean);
assert.deepEqual(optionKeys, expected.map(([key]) => key));
assert.match(picker, /\brequired\b/);
assert.match(picker, /aria-required="true"/);
assert.match(picker, /onchange="window\.opdTestApplyDept\(this\.value\)"/);
assert.match(opdView, /<b>ກຸ່ມ<\/b>\s*<span>ພະຍາດທີ່ມາຮັບບໍລິການ\/group of disease service<\/span>\s*<em>\*<\/em>/);
assert.match(opdView, /ເລືອກກຸ່ມພະຍາດ \/ Select Disease Group/);

assert.match(dashboard, /ກຸ່ມພະຍາດທີ່ມາຮັບບໍລິການ\/group of disease service/);
assert.match(dashboard, /ຈຳນວນ Visit ຕາມກຸ່ມພະຍາດ/);
assert.match(dashboard, /id="chartOpdDepartments"/);
assert.doesNotMatch(dashboard, /Top 8 ບໍລິການຍອດຮິດ|Most Used Services|chartTopServices/);
assert.match(main, /getOpdDepartmentFromVisit\(v\)/);
assert.match(main, /OPD_DEPARTMENTS\.map\(item => opdDepartmentCounts\[item\.key\]\)/);
assert.match(main, /focus: 'opdTestDeptPicker', text: 'ກຸ່ມພະຍາດທີ່ມາຮັບບໍລິການ\/group of disease service'/);
assert.match(main, /clinicalNote\.departmentKey \|\| clinicalNote\.department/);

console.log('OPD Department dropdown, validation, persistence source and dashboard checks passed.');
