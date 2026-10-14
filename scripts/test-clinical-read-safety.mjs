import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPatientLookupAjax, patientLookupTokens } from '../src/patientLookup.js';
import { readPatientScopedRows, createConcurrentRead } from '../src/clinicalReads.js';
import { createCoalescedRefresh } from '../src/requestRefresh.js';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const block = (start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `source block ${start}`);
  return source.slice(from, to);
};
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let requests = [], fail = '', gate = null;
let tables = {};
const client = { from(table) {
  const spec = { table, filters: [], orders: [] };
  const query = {
    select(fields) { spec.select = fields; return this; },
    in(column, ids) { spec.ids = ids; return this; },
    or(expression) { spec.filters.push(expression); return this; },
    order(column, options) { spec.orders.push([column, options.ascending]); return this; },
    gte(column, value) { spec.min = [column, value]; return this; },
    lte(column, value) { spec.max = [column, value]; return this; },
    not() { return this; }, range(start, end) { spec.range = [start, end]; return this; },
    then(resolve, reject) {
      requests.push(spec);
      const execute = async () => {
        if (gate) await gate.promise;
        if (fail === table || fail === `${table}:${spec.ids ? 'scoped' : 'range'}`
            || fail === `${table}:page:${spec.range[0]}`) return { error: new Error('Mock read failed') };
        let rows = [...(tables[table] || [])];
        if (spec.ids) rows = rows.filter(row => spec.ids.includes(row.Patient_ID));
        if (spec.min) rows = rows.filter(row => row[spec.min[0]] >= spec.min[1]);
        if (spec.max) rows = rows.filter(row => row[spec.max[0]] <= spec.max[1]);
        for (const expression of spec.filters) rows = rows.filter(row => expression.split(',').some(part => {
          const [field, , term] = part.split('.');
          return String(row[field] || '').toLowerCase().includes(term.replaceAll('%', '').toLowerCase());
        }));
        rows.sort((a, b) => {
          for (const [column, ascending] of spec.orders) {
            if (a[column] !== b[column]) return (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1);
          }
          return 0;
        });
        return { data: rows.slice(spec.range[0], spec.range[1] + 1) };
      };
      return execute().then(resolve, reject);
    },
  };
  return query;
} };
tables.Patients = Array.from({ length: 45 }, (_, i) => ({ Patient_ID: `P${String(i).padStart(3, '0')}`,
  Old_Patient_ID: `OLD-${i}`, First_Name: i === 0 ? 'ຄົນເຈັບ' : 'Synthetic', Last_Name: 'Test - Family', Phone_Number: `020${i}` }));
let session = {};
const ajax = createPatientLookupAjax({ client, table: () => 'Patients', getSession: () => session });
const lookup = (term, page = 1) => new Promise((resolve, reject) => ajax.transport({ data: ajax.data({ term, page }) }, resolve, reject));
let result = await lookup('');
assert.equal(result.results.length, 20);
assert.equal(result.pagination.more, true);
assert.equal((await lookup('', 3)).results.length, 5);
assert.equal((await lookup('', 3)).pagination.more, false);
assert.equal((await lookup('OLD-0')).results[0].id, 'P000', 'old HN lookup');
assert.equal((await lookup('ຄົນເຈັບ Family')).results[0].id, 'P000', 'Lao name and family name tokens');
assert.equal((await lookup('0200')).results[0].id, 'P000', 'actual phone column');
assert.equal((await lookup('P000')).results[0].patientName, 'ຄົນເຈັບ Test - Family');
assert.equal((await lookup('missing-patient')).results.length, 0);
assert.ok(patientLookupTokens('x),Patient_ID.eq.secret,"\\%_*:(').every(token => !/[,%().:*_"\\]/.test(token)), 'filter punctuation cannot inject OR clauses');
const schema = fs.readFileSync(new URL('../supabase/restore_chunks/01_schema_only.sql', import.meta.url), 'utf8')
  + fs.readFileSync(new URL('../supabase/migrations/20260620130000_add_old_patient_id.sql', import.meta.url), 'utf8');
for (const column of [...requests[0].select.split(','), 'Phone_Number']) assert.ok(schema.includes(`"${column}"`));
assert.ok(requests.every(r => r.range[1] - r.range[0] === 20), 'at most 21 labels per picker request');
gate = deferred();
const beforeSharing = requests.length;
const a = lookup('P000'), b = lookup('P000');
await tick();
assert.equal(requests.length - beforeSharing, 1, 'two pickers share identical pending search');
gate.resolve(); gate = null;
await Promise.all([a, b]);
let callbacks = 0;
gate = deferred();
const oldGate = gate;
const transport = ajax.transport({ data: ajax.data({ term: 'P000' }) }, () => callbacks++, () => callbacks++);
await tick(); transport.abort(); oldGate.resolve(); gate = null;
await tick(); assert.equal(callbacks, 0, 'obsolete search callback is suppressed');
gate = deferred();
const logoutGate = gate;
ajax.transport({ data: ajax.data({ term: 'P000' }) }, () => callbacks++, () => callbacks++);
await tick(); session = null; logoutGate.resolve(); gate = null;
await tick(); assert.equal(callbacks, 0, 'logout suppresses picker results');
session = {}; fail = 'Patients';
await assert.rejects(lookup('P000'), /Mock read failed/);
fail = ''; assert.equal((await lookup('P000')).results[0].id, 'P000', 'failure allows retry');
assert.doesNotMatch(block('window.preloadDropdownDataCallback =', 'window.currentDashRangeType ='), /fetchSupabaseRows\('Patients'/, 'startup no longer reads the registry for pickers');

// Use the actual patient-selection handlers, including names containing " - ".
const values = new Map(), handlers = new Map();
const jquery = selector => ({
  select2(options) { if (options === 'data') return [{ id: 'P000', patientName: 'Test - Family', text: 'P000 - Test - Family' }]; return this; },
  on(_event, fn) { handlers.set(selector, fn); return this; }, val(value) { values.set(selector, value); return this; },
});
const pickerContext = vm.createContext({ $: jquery, patientLookupOptions: {} });
vm.runInContext(block("$('#a_patient').select2", "$('#a_org').select2"), pickerContext);
vm.runInContext(block("$('#pv_patient').select2", "$('#emrAddDrugSelect').select2"), pickerContext);
handlers.get('#a_patient').call({}); handlers.get('#pv_patient').call({});
assert.equal(values.get('#a_target_id'), 'P000'); assert.equal(values.get('#pv_patient_id'), 'P000');
assert.equal(values.get('#a_target_name'), 'Test - Family'); assert.equal(values.get('#pv_patient_name'), 'Test - Family');

// More than 100 patients and 1000 historic encounters must be complete.
const day = '2026-10-06';
tables.Patients = Array.from({ length: 105 }, (_, i) => ({ Patient_ID: `P${String(i).padStart(3, '0')}`, First_Name: `Patient ${i}`, Registration_Date: '2025-01-01' }));
tables.Visits = tables.Patients.map((p, i) => ({ Visit_ID: `NEW${i}`, Patient_ID: p.Patient_ID, Date: `${day}T10:00:00Z`, Status: 'Waiting OPD' }));
tables.Visits.push(...Array.from({ length: 1001 }, (_, i) => ({ Patient_ID: 'P000', Visit_ID: `OLD${i}`, Date: '2025-01-01T10:00:00Z' })));
tables.Visits.push({ Patient_ID: 'P104', Visit_ID: 'LASTOLD', Date: '2025-01-01T10:00:00Z' });
requests = [];
let scoped = await readPatientScopedRows({ client, table: 'Visits', ids: tables.Patients.map(p => p.Patient_ID), select: 'Patient_ID,Visit_ID', orderBy: 'Visit_ID' });
assert.equal(scoped.length, 1107);
assert.ok(requests.every(r => r.ids.length <= 100));
fail = 'Visits:page:1000';
await assert.rejects(readPatientScopedRows({ client, table: 'Visits', ids: ['P000'], select: 'Patient_ID,Visit_ID', orderBy: 'Visit_ID' }));
fail = '';
let renderedDash, renderedReport, renderedHistory;
const elements = new Map();
const $ = selector => ({ val: () => elements.get(selector),
  text(value) { elements.set(selector, value); return this; }, is: () => true,
  removeClass() { return this; }, addClass() { return this; },
});
for (const prefix of ['dash', 'rep', 'visit']) for (const end of ['StartDate', 'EndDate']) elements.set(`#${prefix}${end}`, day);
const w = { clinicalReadGeneration: 0, clinicalLoadedRanges: {}, currentDashShiftType: 'all',
  getLocalDateRangeIsoBounds: (s, e) => ({ startIso: `${s}T00:00:00Z`, endIso: `${e}T23:59:59Z` }),
  isSuspiciousDuplicateVisit: () => false, formatAgeFromDob: () => '30',
  renderDashboardCharts: rows => { renderedDash = rows; }, renderReportPage: rows => { renderedReport = rows; },
  renderVisitHistoryPage: rows => { renderedHistory = rows; }, updateReportObservationStats() {},
};
const context = vm.createContext({ window: w, supabaseClient: client, dbTable: name => name, currentUser: {},
  $, readPatientScopedRows, createCoalescedRefresh, console: { log() {}, warn() {}, error() {} } });
vm.runInContext(block('window.clinicalReadFailureLabel =', 'window.fetchDashboardData ='), context);
vm.runInContext(block('window.fetchDashboardData = async', 'window.fetchDashboardData = createCoalescedRefresh'), context);
vm.runInContext(block('window.buildPatientVisitSummaryData =', 'window.renderReportPage ='), context);
vm.runInContext(block('window._fetchVisitHistoryData =', '// Insurance/organization pill:'), context);
await w.fetchDashboardData();
assert.equal(renderedDash.length, 105);
assert.equal(renderedDash.find(v => v.Patient_ID === 'P104').isNew, false, 'second patient-id batch is included in returning count');
assert.equal(renderedDash.find(v => v.Patient_ID === 'P001').isNew, true);
await w._fetchReportData(day, day);
assert.equal(renderedReport.length, 105, 'returning patients registered outside range are retrieved');
assert.equal(renderedReport.find(p => p.Patient_ID === 'P000').visitCount, 1002, 'all history pages count');
await w._fetchVisitHistoryData(day, day);
assert.equal(renderedHistory.length, 105);
const previousDash = renderedDash, previousReport = renderedReport, previousHistory = renderedHistory;
for (const stage of ['Patients:scoped', 'Visits:scoped', 'Visits:page:1000']) {
  fail = stage;
  await w.fetchDashboardData(); await w._fetchReportData(day, day); await w._fetchVisitHistoryData(day, day);
  assert.equal(renderedDash, previousDash, `${stage} does not replace dashboard with partial totals`);
  assert.equal(renderedReport, previousReport, `${stage} preserves report`);
  assert.equal(renderedHistory, previousHistory, `${stage} preserves visit history`);
  for (const id of ['dashRefreshTime', 'repRefreshTime', 'visitRefreshTime']) assert.match(elements.get(`#${id}`), /ບໍ່ສຳເລັດ.*2026-10-06/, 'failed refresh labels last complete range');
}
fail = '';
const laterDay = '2026-10-07';
tables.Visits.push(...Array.from({ length: 1000 }, (_, i) => ({ Visit_ID: `MORE${i}`, Patient_ID: 'P000', Date: `${day}T11:00:00Z` })));
fail = 'Visits:page:1000';
await w.fetchDashboardData(); await w._fetchReportData(day, day); await w._fetchVisitHistoryData(day, day);
assert.equal(renderedDash, previousDash, 'failed second page of current visits never renders partial totals');
assert.equal(renderedReport, previousReport); assert.equal(renderedHistory, previousHistory);
tables.Visits.splice(-1000); fail = '';
gate = deferred(); const dateGate = gate;
const obsolete = Promise.all([w.fetchDashboardData(), w._fetchReportData(day, day), w._fetchVisitHistoryData(day, day)]);
await tick();
for (const prefix of ['dash', 'rep', 'visit']) elements.set(`#${prefix}EndDate`, laterDay);
dateGate.resolve(); gate = null; await obsolete;
assert.equal(renderedDash, previousDash); assert.equal(renderedReport, previousReport); assert.equal(renderedHistory, previousHistory);
for (const prefix of ['dash', 'rep', 'visit']) elements.set(`#${prefix}EndDate`, day);
gate = deferred(); const sessionGate = gate;
const oldSession = Promise.all([w.fetchDashboardData(), w._fetchReportData(day, day), w._fetchVisitHistoryData(day, day)]);
await tick(); context.currentUser = {}; w.clinicalReadGeneration++;
sessionGate.resolve(); gate = null; await oldSession;
assert.equal(renderedDash, previousDash); assert.equal(renderedReport, previousReport); assert.equal(renderedHistory, previousHistory);
await w._fetchReportData(laterDay, laterDay); // dates differ: ignored
assert.equal(renderedReport, previousReport);
for (const prefix of ['dash', 'rep', 'visit']) for (const end of ['StartDate', 'EndDate']) elements.set(`#${prefix}${end}`, laterDay);
await w.fetchDashboardData(); await w._fetchReportData(laterDay, laterDay); await w._fetchVisitHistoryData(laterDay, laterDay);
assert.equal(renderedDash.length, 0); assert.equal(renderedReport.length, 0); assert.equal(renderedHistory.length, 0, 'successful empty range replaces old rows');

// Optional observation counts must not fabricate zero or overwrite a new range.
let observation = { count: 7 }, observationGate = null;
context.OPD_OBSERVATION_TABLE = 'Observations';
const originalDollar = context.$;
context.$ = selector => ({ ...originalDollar(selector), length: 1 });
w.obsFrom = () => ({ select() { return this; }, gte() { return this; }, lte() { return this; },
  then(resolve, reject) { return (observationGate?.promise || Promise.resolve(observation)).then(resolve, reject); } });
vm.runInContext(block('window.updateReportObservationStats =', '// ============================================================'), context);
await w.updateReportObservationStats(laterDay, laterDay);
assert.equal(elements.get('#repObservation'), 7);
observation = { error: new Error('Mock count failed') };
await w.updateReportObservationStats(laterDay, laterDay);
assert.equal(elements.get('#repObservation'), '—', 'failed count is unknown, not zero');
observationGate = deferred();
const oldCount = w.updateReportObservationStats(laterDay, laterDay);
elements.set('#repEndDate', '2026-10-08');
observationGate.resolve({ count: 99 }); await oldCount;
assert.equal(elements.get('#repObservation'), '—', 'obsolete count ignored');
context.$ = originalDollar;

// Execute the actual LIS wrapper. Identical in-flight reads share one POST,
// while fresh reads, patient scopes, sessions and writes remain independent.
let lisCalls = 0, lisGate = deferred(), lisFailure = false;
const lisWindow = { opdTestLisApiBase: () => 'https://lis.invalid', setTimeout, clearTimeout };
const lis = vm.createContext({ window: lisWindow, currentUser: {}, AbortController, createConcurrentRead,
  fetch: async () => { lisCalls++; if (lisGate) await lisGate.promise; return { ok: !lisFailure, status: lisFailure ? 400 : 200, json: async () => ({ data: [], error: lisFailure ? { message: 'Mock LIS failure', code: '42703' } : undefined }) }; },
});
vm.runInContext(block('window.opdTestLisRequest = async', 'window.opdTestLisFileKey ='), lis);
const payload = { table: 'lis_one_test_orders', filter: 'patient_id=eq.P000', limit: 80 };
const pendingReads = Array.from({ length: 20 }, () => lisWindow.opdTestLisRequest('/api/data', payload));
await tick(); assert.equal(lisCalls, 1);
lis.currentUser = {};
const otherSession = lisWindow.opdTestLisRequest('/api/data', payload);
await tick(); assert.equal(lisCalls, 2, 'new session never shares old read');
lisGate.resolve(); lisGate = null; await Promise.all([...pendingReads, otherSession]);
await lisWindow.opdTestLisRequest('/api/data', payload); assert.equal(lisCalls, 3, 'next poll is fresh');
await lisWindow.opdTestLisRequest('/api/data', { ...payload, filter: 'patient_id=eq.P001' }); assert.equal(lisCalls, 4);
lisFailure = true;
await assert.rejects(lisWindow.opdTestLisRequest('/api/data', payload), error => error.message === 'Mock LIS failure' && error.code === '42703' && error.status === 400);
lisFailure = false;
await lisWindow.opdTestLisRequest('/api/data', payload); assert.equal(lisCalls, 6, 'error releases sharing guard');
await Promise.all([lisWindow.opdTestLisRequest('/api/write', payload), lisWindow.opdTestLisRequest('/api/write', payload)]);
assert.equal(lisCalls, 8, 'writes never coalesce');
await Promise.all([lisWindow.opdTestLisRequest('/api/data', { ...payload, action: 'update' }), lisWindow.opdTestLisRequest('/api/data', { ...payload, action: 'update' })]);
assert.equal(lisCalls, 10, 'unknown payload operations are not shared');
console.log('Patient paging/search/selection, complete clinical pagination, failure/stale guards and LIS concurrent-read checks passed.');
