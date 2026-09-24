import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PRINTER_SETTINGS_VERSION,
  buildRuntimePrintCss,
  createDefaultPrinterSettings,
  normalizePrinterSettings,
} from '../src/printerSettings.js';

const defaults = createDefaultPrinterSettings();
const sticker = defaults.profiles.patient_sticker;
assert.equal(defaults.version, PRINTER_SETTINGS_VERSION);
assert.deepEqual({
  width: sticker.width,
  height: sticker.height,
  marginLeft: sticker.marginLeft,
  marginRight: sticker.marginRight,
  fontScale: sticker.fontScale,
  itemWidth: sticker.itemWidth,
  itemHeight: sticker.itemHeight,
  gap: sticker.gap,
}, {
  width: 70,
  height: 100,
  marginLeft: 2,
  marginRight: 2,
  fontScale: 35,
  itemWidth: 66,
  itemHeight: 31,
  gap: 2,
});

const migrated = normalizePrinterSettings({
  version: 1,
  device: { id: 'HIS-PC-TEST', name: 'OPD-PC' },
  profiles: {
    patient_sticker: {
      ...sticker,
      width: 70,
      height: 180,
      marginTop: 3,
      marginRight: 3,
      marginBottom: 3,
      marginLeft: 3,
      fontScale: 52,
      itemWidth: 94,
      itemHeight: 54,
      gap: 3,
    },
  },
});
assert.equal(migrated.version, PRINTER_SETTINGS_VERSION);
assert.equal(migrated.profiles.patient_sticker.width, 70);
assert.equal(migrated.profiles.patient_sticker.height, 100);
assert.equal(migrated.profiles.patient_sticker.itemWidth, 66);
assert.equal(migrated.profiles.patient_sticker.itemHeight, 31);

const compactAttempt = normalizePrinterSettings({
  version: 2,
  profiles: {
    patient_sticker: {
      ...sticker,
      width: 70,
      height: 180,
      marginTop: 3,
      marginRight: 4,
      marginBottom: 3,
      marginLeft: 4,
      fontScale: 44,
      itemWidth: 86,
      itemHeight: 100,
      gap: 7,
    },
  },
});
assert.equal(compactAttempt.version, PRINTER_SETTINGS_VERSION);
assert.equal(compactAttempt.profiles.patient_sticker.width, 70);
assert.equal(compactAttempt.profiles.patient_sticker.height, 100);
assert.equal(compactAttempt.profiles.patient_sticker.itemWidth, 66);
assert.equal(compactAttempt.profiles.patient_sticker.itemHeight, 31);

const css = buildRuntimePrintCss('patient_sticker', sticker, 'print-area');
assert.match(css, /@page \{ size: 70mm 100mm; margin: 0; \}/);
assert.match(css, /html, body, #partial-prints \{ width: 70mm !important;[^}]*height: 100mm !important;[^}]*overflow: hidden !important;/s);
assert.doesNotMatch(css, /66mm|31mm|font-size/, 'saved profile geometry must not override the fixed sticker CSS');

const opdCss = buildRuntimePrintCss('opd_card', defaults.profiles.opd_card, 'opd-print-area');
assert.match(opdCss, /@page \{ size: 210mm 297mm; margin: 10mm 12mm 10mm 12mm; \}/);

const historicalCss = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(historicalCss, /\.patient-card\s*\{[^}]*width:\s*180mm;[^}]*height:\s*89mm;/s);
assert.match(historicalCss, /\.pcard-id\s*\{[^}]*font-size:\s*52px;/s);
assert.match(historicalCss, /\.pcard-label\s*\{[^}]*font-size:\s*30px;/s);
assert.match(historicalCss, /\.pcard-value\s*\{[^}]*font-size:\s*37px;/s);
assert.match(historicalCss, /@page patient-sticker-print\s*\{[^}]*size:\s*70mm 100mm;[^}]*margin:\s*0;/s);
assert.match(historicalCss, /#print-area\.print-active\s*\{[^}]*page:\s*patient-sticker-print;/s);
assert.match(historicalCss, /#print-area\.print-active \.patient-card\s*\{[^}]*flex:\s*0 0 31mm !important;[^}]*width:\s*66mm !important;[^}]*height:\s*31mm !important;/s);
assert.match(historicalCss, /#print-area\.print-active \.pcard-id\s*\{[^}]*font-size:\s*18\.2px !important;/s);
assert.match(historicalCss, /#print-area\.print-active \.pcard-label\s*\{[^}]*font-size:\s*11\.2px !important;/s);
assert.match(historicalCss, /#print-area\.print-active \.pcard-value,[^}]*font-size:\s*13\.3px !important;/s);
assert.match(historicalCss, /#print-area\.print-active \.pcard-name\s*\{[^}]*font-size:\s*var\(--sticker-name-size, 14px\) !important;/s);
assert.ok((3 * 31) + (2 * 2) + 2 <= 100, 'three compact stickers must fit on one 70x100 mm sheet');
assert.match(main, /window\.preparePrinterPrint\?\.\(containerId\);/);

console.log('Patient sticker fits three isolated cards on one XP-420B 70x100 mm sheet.');
