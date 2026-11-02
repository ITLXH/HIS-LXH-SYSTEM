import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the real table/filter functions with synthetic rows and no network.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const extract = (start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'real registry source block found');
  return source.slice(from, to);
};
const values = new Map();
let table, failure = false, gate = null;
const queries = [];
const patients = Array.from({ length: 16 }, (_, i) => ({
  Patient_ID: `LXH2099-${String(i + 1).padStart(6, '0')}`,
  Old_Patient_ID: String(9000 + i), First_Name: 'ທົດສອບ', Last_Name: 'ຄົນເຈັບ',
  Phone_Number: '02099990000', Registration_Date: '2099-01-01'
}));
patients.push({ Patient_ID: 'SYNTHETIC-OLD', Old_Patient_ID: 'LXH2098-000001', First_Name: 'Legacy' });
patients.push({ Patient_ID: 'LXH2097000001', Old_Patient_ID: '7777', First_Name: 'Legacy formatting' });
const matches = (row, expression) => expression.split(',').some(part => {
  const [column, operator, ...rest] = part.split('.');
  const term = rest.join('.');
  if (operator === 'eq') return String(row[column] ?? '') === term;
  const regex = new RegExp('^' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('%', '.*') + '$', 'i');
  return regex.test(String(row[column] ?? ''));
});
const client = { from() {
  const spec = { filters: [], orders: [] };
  return {
    select(fields, options = {}) { spec.fields = fields; spec.options = options; return this; },
    or(expression) { spec.filters.push(expression); return this; },
    gte(column, value) { spec.min = [column, value]; return this; },
    lte(column, value) { spec.max = [column, value]; return this; },
    order(column, options) { spec.orders.push([column, options.ascending]); return this; },
    range(start, end) { spec.range = [start, end]; return this; },
    abortSignal(signal) { spec.signal = signal; return this; },
    then(resolve, reject) {
      const pending = gate;
      const fail = failure;
      queries.push(spec);
      return (async () => {
        if (pending) await pending.promise;
        if (fail) return { error: { code: '57014', message: 'Synthetic statement timeout' } };
        let rows = patients.filter(row => spec.filters.every(expression => matches(row, expression)));
        if (spec.min) rows = rows.filter(row => row[spec.min[0]] >= spec.min[1]);
        if (spec.max) rows = rows.filter(row => row[spec.max[0]] <= spec.max[1]);
        const count = spec.options.count === 'exact' ? rows.length : null;
        rows.sort((a, b) => String(a.Patient_ID).localeCompare(String(b.Patient_ID)) * (spec.orders[0]?.[1] ? 1 : -1));
        if (spec.range) rows = rows.slice(spec.range[0], spec.range[1] + 1);
        return { data: spec.options.head ? null : rows.map(row => ({ ...row })), count };
      })().then(resolve, reject);
    }
  };
} };
function $(selector) {
  const chain = {
    val: () => values.get(selector) || '', empty() { return this; }, hide() { return this; },
    show() { return this; }, html() { return this; }, removeClass() { return this; }, addClass() { return this; },
    DataTable(options) { table = options; return {}; }
  };
  return chain;
}
$.fn = { DataTable: { isDataTable: () => false } };
const window = {
  clinicalReadGeneration: 0,
  normalizePatientCode: value => String(value ?? '').trim().replace(/\s+/g, '').toUpperCase(),
  t: key => key, getDataTableLanguage: () => ({}), getHospitalDataLoaderHtml: () => '',
  fetchPatientVisitCountMap: async ids => Object.fromEntries(ids.map(id => [id, 3]))
};
const context = vm.createContext({ window, $, currentUser: { id: 'SYNTHETIC-ADMIN' },
  supabaseClient: client, dbTable: name => name, AbortController, escapeHisHtml: String,
  console: { warn() {}, error() {} } });
vm.runInContext(extract('window.__patientRegistryTotalCount = null;', '// ==========================================\n// PATIENT PHOTO HANDLERS'), context);
window.initPatientTable();
const request = (term = '', draw = 1, start = 0) => ({
  draw, start, length: 10, order: [{ column: 2, dir: 'desc' }], search: { value: term },
  columns: Array.from({ length: 12 }, () => ({ search: { value: '' } }))
});
const read = async req => { let response; await table.ajax(req, value => { response = value; }); return response; };
let response = await read(request(' lxh2099 - 000001 '));
assert.equal(response.data[0].Patient_ID, 'LXH2099-000001');
assert.equal(response.recordsFiltered, 1);
assert.ok(queries[0].filters.every(expression => !expression.includes('.ilike.')), 'full HN uses equality instead of seven-column contains');
response = await read(request('LXH2099'));
assert.equal(response.recordsFiltered, 11, 'one lookahead row keeps Next available without an exact total');
assert.equal(response.data.length, 10);
assert.ok(queries.at(-1).filters[0].split(',').every(part => /^(Patient_ID|Old_Patient_ID)\./.test(part)), 'HN prefix searches only identifier fields');
response = await read(request('LXH2099', 2, 10));
assert.equal(response.data.length, 6, 'all prefix matches remain reachable by pagination');
response = await read(request('LXH2098-000001'));
assert.equal(response.data[0].Patient_ID, 'SYNTHETIC-OLD', 'old HN remains searchable globally');
response = await read(request('LXH2097-000001'));
assert.equal(response.data[0].Patient_ID, 'LXH2097000001', 'legacy identifier without hyphen remains searchable');
response = await read(request('ທົດສອບ ຄົນເຈັບ'));
assert.equal(response.data.length, 10, 'multiword Lao names remain searchable');
const old = request(); old.columns[3].search.value = '9000';
assert.equal((await read(old)).data[0].Old_Patient_ID, '9000', 'dedicated numeric Old ID search works');
const phone = request(); phone.columns[7].search.value = '0209999';
assert.equal((await read(phone)).data.length, 10, 'phone filter works');
values.set('#patientDateFrom', '2099-02-01');
assert.equal((await read(request('LXH2099'))).recordsFiltered, 0, 'date filters still combine with HN');
values.clear();
await read(request());
response = await read(request('', 2, 10));
assert.equal(response.recordsFiltered, 18);
assert.equal(queries.at(-1).options.count, undefined, 'unfiltered pagination reuses authorized-session total');
assert.equal(response.data[0].__visitCount, 3, 'visit counts retained');
failure = true;
response = await read(request('', 3, 10));
assert.equal(response.data.length, 8, 'same-page refresh failure preserves loaded rows');
response = await read(request('DIFFERENT-SEARCH', 4));
assert.equal(response.data.length, 0, 'failed different search never substitutes unrelated patients');
failure = false;
let release; gate = { promise: new Promise(resolve => { release = resolve; }) };
const before = queries.length;
let staleCalls = 0;
const stale = table.ajax(request('LXH2099', 5), () => { staleCalls++; });
await Promise.resolve(); await Promise.resolve();
gate = null;
response = await read(request('LXH2098-000001', 6));
assert.ok(queries[before].signal.aborted, 'superseded search is cancelled');
release(); await stale;
assert.equal(staleCalls, 0, 'late search cannot overwrite the latest filter');
assert.equal(response.data[0].Patient_ID, 'SYNTHETIC-OLD');
let finish; gate = { promise: new Promise(resolve => { finish = resolve; }) };
const oldSession = table.ajax(request('LXH2099', 7), () => { staleCalls++; });
await Promise.resolve(); await Promise.resolve();
context.currentUser = { id: 'SYNTHETIC-NEXT-USER' };
window.clinicalReadGeneration++;
gate = null; finish(); await oldSession;
assert.equal(staleCalls, 0, 'retired session results cannot update the registry');
await read(request());
assert.equal(queries.at(-1).options.count, undefined, 'new session must not trigger an expensive exact count');
assert.ok(queries.every(query => !query.options.count && !query.options.head), 'no registry request scans all matches for a total');
assert.equal(table.pagingType, 'simple');
assert.ok(table.language.info && !table.language.info.includes('_TOTAL_'), 'lookahead must not be presented as an exact total');
console.log('PASS patient registry HN, Old ID, Lao name, phone, dates, pagination, cancellation, failure preservation and session isolation');

const handlers = new Map(), timers = new Map(); let timerId = 0, draws = 0, term = '';
const input = { value: '' };
const filterChain = { length: 1, closest() { return this; }, addClass() { return this; },
  find() { return this; }, off() { return this; }, on(events, handler) { handlers.set(events, handler); return this; } };
const filterWindow = { t: value => value, clearTimeout: id => timers.delete(id),
  setTimeout: fn => { timers.set(++timerId, fn); return timerId; } };
vm.runInNewContext(extract('window.setupPatientTableFilters = function', 'window.__patientRegistryTotalCount'),
  { window: filterWindow, $: () => filterChain });
filterWindow.setupPatientTableFilters({ search(value) { term = value; return this; }, draw() { draws++; } });
const globalSearch = [...handlers].find(([events]) => events.includes('compositionend'))?.[1];
assert.ok(globalSearch, 'the real global registry search must debounce typing and IME completion');
for (const value of ['S', 'SY', 'SYN']) { input.value = value; globalSearch.call(input, {}); }
assert.equal(draws, 0); assert.equal(timers.size, 1);
for (const fn of timers.values()) fn(); timers.clear();
assert.equal(draws, 1); assert.equal(term, 'SYN');
globalSearch.call(input, { originalEvent: { isComposing: true } }); assert.equal(timers.size, 0);
console.log('PASS rapid typing sends one completed search; IME composition sends none');
