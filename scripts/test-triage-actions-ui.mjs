import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const view = fs.readFileSync(path.join(root, 'public', 'partials', 'views', 'triage.html'), 'utf8');

const checks = [
  ['OPD/IPD header is replaced by the receiving nurse', /triage-nurse-column[^>]*>ພະຍາບານຮັບເຄດ</.test(view) && !/>OPD\/IPD</.test(view)],
  ['Receiving nurse comes from the saved triage recorder', /const receivingNurse = String\(r\.recordedBy \|\| ''\)\.trim\(\)/.test(main)],
  ['Receiving nurse is rendered in its own table cell', /class="text-center triage-nurse-cell">\$\{receivingNurseBadge\}/.test(main)],
  ['Receiving nurse badge supports readable full names', /\.triage-nurse-badge\s*\{[\s\S]{0,500}white-space:\s*normal/.test(css)],
  ['Triage action header reserves an orderly action column', /triage-action-column/.test(view)],
  ['Action cell uses the dedicated action rail', /class="text-center triage-action-cell"[\s\S]{0,180}class="triage-actions"/.test(main)],
  ['Action rail is exposed as an accessible button group', /class="triage-actions" role="group" aria-label=/.test(main)],
  ['All Triage controls use the shared action-button class', (main.match(/triage-action-btn/g) || []).length >= 8],
  ['Icon-only controls use one shared size class', (main.match(/triage-action-btn--icon/g) || []).length >= 6],
  ['Action rail never wraps onto a second row', /\.triage-actions\s*\{[\s\S]{0,180}flex-wrap:\s*nowrap/.test(css)],
  ['Action buttons use a compact 34px height', /\.triage-actions \.triage-action-btn\s*\{[\s\S]{0,220}height:\s*34px/.test(css)],
  ['Icon buttons use a compact 34px width', /\.triage-actions \.triage-action-btn--icon\s*\{[\s\S]{0,100}width:\s*34px/.test(css)],
  ['Triage data rows use compact vertical padding', /#triageTable tbody > tr > td\s*\{[\s\S]{0,100}padding-top:\s*7px[\s\S]{0,80}padding-bottom:\s*7px/.test(css)],
  ['Narrow screens use horizontal table scrolling', /#view-triage \.card-body\.table-responsive[\s\S]{0,100}overflow-x:\s*auto/.test(css)]
];

let failed = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`PASS ${label}`);
  else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

if (failed) {
  console.error(`\n${failed} Triage action UI check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} Triage action UI checks passed.`);
