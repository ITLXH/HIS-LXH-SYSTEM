import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PATIENT_STICKER_PAPER, PATIENT_STICKER_PRINT_CSS, preparePatientStickerPrint, finishPatientStickerPrint } from '../src/patientStickerPrint.js';

assert.deepEqual(PATIENT_STICKER_PAPER, { width: 70, height: 100 });
assert.match(PATIENT_STICKER_PRINT_CSS, /size: 70mm 100mm; margin: 0/);
const rules = [];
globalThis.document = {
  createElement: () => ({ remove() { rules.splice(rules.indexOf(this), 1); } }),
  getElementById: id => rules.find(rule => rule.id === id),
  head: { appendChild: rule => rules.push(rule) },
};
preparePatientStickerPrint('opd-print-area');
assert.equal(rules.length, 0, 'other documents receive no sticker page rule');
preparePatientStickerPrint('print-area');
assert.equal(rules.length, 1);
assert.equal(rules[0].textContent, PATIENT_STICKER_PRINT_CSS);
preparePatientStickerPrint('print-area');
assert.equal(rules.length, 1, 'no duplicate rules');
finishPatientStickerPrint();
assert.equal(rules.length, 0, 'rule removed after printing');
delete globalThis.document;
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
assert.match(css, /@page patient-sticker-print\s*\{\s*size: 70mm 100mm/);
assert.match(css, /#print-area\.print-active \.patient-card\s*\{[^}]*width: 66mm[^}]*height: 31mm/s);
assert.match(css, /#print-area\.print-active \.pcard-name\s*\{[^}]*white-space: nowrap/s);
assert.match(css, /#print-area\.print-active \.pcard-row\s*\{[^}]*font-size: 13\.3px/s);
assert.ok(3 * 31 + 2 * 2 + 2 <= 100);
console.log('Verified sticker geometry and temporary page-rule isolation pass.');
