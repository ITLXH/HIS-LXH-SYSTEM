import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [style, template, main, manpowerStyle] = await Promise.all([
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/partials/print-areas.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/manpowerDashboard.css', import.meta.url), 'utf8')
]);

assert.match(style, /@page\s+sticker-print\s*\{[^}]*size:\s*100mm 180mm;[^}]*margin:\s*0;/s);
assert.match(style, /#print-area\.print-active\s*\{[^}]*page:\s*sticker-print;/s);
assert.match(style, /#print-area\.print-active\s+\.print-card-grid\s*\{[^}]*height:\s*180mm\s*!important;[^}]*grid-template-rows:\s*repeat\(3,\s*58mm\)/s);
assert.match(style, /#print-area\.print-active\s+\.print-card-grid\s*\{[^}]*box-sizing:\s*border-box\s*!important;/s);
assert.match(style, /#print-area\.print-active\s+\.patient-card\s*\{[^}]*width:\s*96mm\s*!important;[^}]*height:\s*58mm\s*!important;/s);
assert.equal((template.match(/class="patient-card"/g) || []).length, 3);
assert.match(main, /window\.printQRCard\s*=\s*async function/);
assert.match(main, /\[1,\s*2,\s*3\]\.forEach/);
assert.match(main, /window\.executePrint\('print-area'\)/);
assert.doesNotMatch(manpowerStyle, /@page\s*\{\s*size:\s*A4 landscape/);
assert.match(manpowerStyle, /@page\s+manpower-print\s*\{/);

console.log('Patient sticker XP-420B 100x180mm three-up print checks passed.');
