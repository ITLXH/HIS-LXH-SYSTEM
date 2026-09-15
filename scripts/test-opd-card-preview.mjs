import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mainSource, printAreas] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/print-areas.html', import.meta.url), 'utf8'),
]);

const printCardStart = mainSource.indexOf('window.printOPDCard = async function');
const legacyExporterStart = mainSource.indexOf('window.exportOpdCardAsPdf = async function', printCardStart);
const printCardSource = printCardStart >= 0 && legacyExporterStart > printCardStart
  ? mainSource.slice(printCardStart, legacyExporterStart)
  : '';

assert.ok(printCardSource, 'printOPDCard implementation must be present');
assert.match(printCardSource, /window\.executePrint\('opd-print-area'\)/);
assert.doesNotMatch(printCardSource, /exportOpdCardAsPdf|\.download\s*=|pdf\.output/);
assert.match(mainSource, /window\.executePrint\s*=\s*function[\s\S]*?window\.print\(\)/);
assert.match(printAreas, /rendered in the browser print preview/);

console.log('OPD Card opens browser print preview without automatic PDF download.');
