import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { escapeHisHtml } from '../shared/his-html.js';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const rows = Array.from({ length: 2611 }, (_, i) => ({
  Org_ID: String(i).padStart(5, '0'), Cus_ID_Ex: `CUSTOMER-${i}`, Name: `Customer ${i}`, Status: 'Active'
}));
rows[2500] = { ...rows[2500], Cus_ID_Ex: 'CUS-LXH-PL-26-017-0055', Org_Name: 'PBLIC BANK LAO' };
rows[2501].Status = 'Inactive';
rows[2502].Name = '<Customer & Company>';
rows[2502].Status = ' active ';
let html = '', fail = false;
const ranges = [];
const client = { from(table) {
  assert.equal(table, 'Organizations');
  return {
    select() { return this; },
    order(column) { assert.equal(column, 'Org_ID'); return this; },
    async range(start, end) {
      ranges.push([start, end]);
      return fail ? { error: new Error('Synthetic read failure') } : { data: rows.slice(start, end + 1) };
    }
  };
} };
function $(selector) {
  return { length: 1, data() { return false; },
    html(value) { html = value; return this; }, select2() { return this; } };
}
const window = {};
const context = vm.createContext({ window, supabaseClient: client, dbTable: x => x, $, jQuery: $, escapeHisHtml, console: { warn() {} } });
vm.runInContext(extract('window.fetchSupabaseRows =', 'const HIS_MIN_PASSWORD_LENGTH'), context);
vm.runInContext(extract('window.refreshPatientOrgDropdown =', '// ==========================================\n// PATIENT VIEW'), context);
await window.refreshPatientOrgDropdown();
assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
assert.ok(html.includes('CUS-LXH-PL-26-017-0055'));
assert.ok(html.includes('PBLIC BANK LAO'));
assert.ok(!html.includes('CUSTOMER-2501'));
assert.ok(html.includes('&lt;Customer &amp; Company&gt;'));
const previous = html;
fail = true;
await window.refreshPatientOrgDropdown();
assert.equal(html, previous, 'failed reads retain the existing options');
console.log('Patient organization search: pagination, code/name search, active filtering, escaping and read failure passed.');
