import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { installManpowerDashboard } from '../src/manpowerDashboard.js';
import { createConcurrentRead } from '../src/clinicalReads.js';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const storage = new Map(), timers = new Map(); let nextTimer = 0;
const w = globalThis.window = {
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  addEventListener() {}, isLocalManpowerPreview: () => false,
  staffManagementState: { initialized: true, mode: 'supabase', records: [{ id: 'STALE', fullName: 'Previous session', status: 'active' }] },
  setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); }
};
const listeners = new Map();
globalThis.document = { hidden: false, getElementById: () => null, addEventListener: (name, callback) => listeners.set(name, callback) };
let user = {}, onChange, subscriptions = 0, reads = 0, gate = null, saves = 0;
const backend = {
  async loadAssignments(date) { reads++; if (gate) await gate.promise; return [{ date, shift: 'morning', id: date }]; },
  async loadOverviews() { return []; },
  subscribe(callback) { subscriptions++; onChange = callback; return () => { subscriptions--; }; },
  async saveOverview() { saves++; }
};
installManpowerDashboard({ backend, staffBackend: { load: async () => [{ id: 'S1', fullName: 'Synthetic', status: 'active' }] }, getCurrentUser: () => user, canManage: () => true });
w.renderManpowerDashboard = () => {};
await w.initManpowerDashboard();
assert.equal(subscriptions, 1);
assert.equal(w.manpowerDashboardState.staff[0].id, 'S1', 'current authorized backend overrides unowned previous-session staff cache');
const refresh = async () => { const tasks = [...timers.values()]; timers.clear(); await Promise.all(tasks.map(fn => fn())); };
let before = reads;
for (let i = 0; i < 20; i++) onChange('assignments');
await refresh(); assert.equal(reads - before, 1, 'realtime burst shares one read');
document.hidden = true; onChange('assignments'); assert.equal(timers.size, 0, 'hidden page ignores events'); document.hidden = false;
before = reads; listeners.get('visibilitychange')(); await refresh(); assert.equal(reads - before, 1, 'visibility return reconciles assignments');
gate = deferred(); const burstGate = gate; before = reads;
onChange('assignments'); const pendingBurst = refresh(); await tick(); onChange('assignments'); const nextBurst = refresh(); await tick();
assert.equal(reads - before, 1, 'events during a pending read share that read'); burstGate.resolve(); await Promise.all([pendingBurst, nextBurst]); gate = null;
const day = w.manpowerDashboardState.date;
gate = deferred(); const oldGate = gate;
const oldDate = w.setManpowerDate('2026-01-01'); await tick(); gate = null;
await w.setManpowerDate('2026-02-01'); oldGate.resolve(); await oldDate;
assert.equal(w.manpowerDashboardState.assignments[0].date, '2026-02-01', 'old date cannot replace new date');
gate = deferred(); const oldSession = gate;
onChange('assignments'); const pending = refresh(); await tick();
const retained = w.manpowerDashboardState.assignments;
user = {}; oldSession.resolve(); await pending; gate = null;
assert.equal(w.manpowerDashboardState.assignments, retained, 'old session cannot publish');
w.updateManpowerOverview('pending save');
onChange('assignments'); w.teardownManpowerReads();
assert.equal(subscriptions, 0);
before = reads; const retiredChange = onChange; onChange('assignments'); await refresh();
assert.equal(reads, before, 'retired callback performs no reads'); assert.equal(saves, 1, 'route teardown preserves pending overview save');
gate = deferred(); const initializationGate = gate;
const initialization = w.initManpowerDashboard(); await tick(); w.teardownManpowerReads(); initializationGate.resolve(); await initialization; gate = null;
assert.equal(subscriptions, 0, 'late initialization cannot resubscribe after leaving');
await w.initManpowerDashboard(); assert.equal(subscriptions, 1, 'returning to page resubscribes');
before = reads; retiredChange('assignments'); await refresh(); assert.equal(reads, before, 'old lifecycle callback stays retired after reentry');
w.teardownManpowerReads();

// Execute actual IPD read/reset/load functions, with controlled admission responses.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const from = source.indexOf('window.fetchIpdClinicalData = async function');
const to = source.indexOf('window.renderIpdChartPage = function', from);
const dom = new Map(); const setHtml = (selector, value) => dom.set(selector, value);
let visitGate = null, visitError = null, visitReads = 0;
const iw = { clinicalReadGeneration: 0, ipdClinicalState: {}, ipdWardBedState: { admissions: [{ Admission_ID: 'A1', Patient_ID: 'P1' }, { Admission_ID: 'A2', Patient_ID: 'P2' }], movements: [] },
  clearInterval() {},
  ipdSelectClinical: async () => [], ipdLoadProviders: async () => [], t: key => key, ipdEscape: String,
  getHospitalDataLoaderHtml: () => 'loading', renderIpdChartPage: id => setHtml('rendered', id) };
const client = { from() { const query = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
  async then(resolve) { visitReads++; const response = visitError ? { error: visitError } : { data: [{ Visit_ID: 'V1' }] }; if (visitGate) await visitGate.promise; return resolve(response); } }; return query; } };
const context = vm.createContext({ window: iw, currentUser: {}, supabaseClient: client, dbTable: x => x, createConcurrentRead, console: { error() {} },
  chartInstances: {},
  $: selector => ({ html: value => setHtml(selector, value), empty: () => setHtml(selector, ''), remove: () => setHtml(selector, ''), text: value => setHtml(selector, value) }) });
vm.runInContext(source.slice(from, to), context);
await iw.loadIpdClinicalChart('A1');
assert.equal(iw.ipdClinicalState.admission.Patient_ID, 'P1');
const complete = iw.ipdClinicalState;
visitError = new Error('linked visits failed'); await iw.loadIpdClinicalChart('A1');
assert.equal(iw.ipdClinicalState, complete, 'failed linked read retains complete state');
assert.match(dom.get('#ipdChartSummaryPanel'), /ຄັ້ງກ່ອນ/, 'cached sections identified'); visitError = null;
visitGate = deferred(); const ipdGate = visitGate;
const stale = iw.loadIpdClinicalChart('A1'); await tick(); visitGate = null;
await iw.loadIpdClinicalChart('A2'); ipdGate.resolve(); await stale;
assert.equal(iw.ipdClinicalState.admission.Patient_ID, 'P2', 'late A1 cannot replace A2');
visitGate = deferred(); const concurrentGate = visitGate;
before = visitReads; const concurrent = Array.from({ length: 20 }, () => iw.loadIpdClinicalChart('A2')); await tick();
assert.equal(visitReads - before, 1, 'concurrent admission loads share backend read'); concurrentGate.resolve(); await Promise.all(concurrent); visitGate = null;
visitGate = deferred(); const logoutGate = visitGate;
const duringLogout = iw.loadIpdClinicalChart('A2'); await tick(); iw.clinicalReadGeneration++; iw.resetIpdClinicalReadDisplay(); logoutGate.resolve(); await duringLogout; visitGate = null;
assert.equal(iw.ipdClinicalState.admissionId, null, 'logout discards obsolete chart response');
visitError = new Error('no access'); await iw.loadIpdClinicalChart('A1');
assert.equal(iw.ipdClinicalState.admissionId, null, 'failed different admission never restores previous patient');
assert.equal(dom.get('rendered'), 'A2');
const views = source.match(/let views = (\[[^;]+\]);/)[1].match(/'([^']+)'/g).map(value => value.slice(1, -1));
assert.equal(views.length, 30);
for (const view of views) assert.ok(fs.existsSync(new URL(`../public/partials/views/${view}.html`, import.meta.url)), `missing ${view}`);

// Patient detail: execute the actual loader and supersede a pending response.
const profileWrites = [], profileGates = new Map();
const profileWindow = { clinicalReadGeneration: 0, formatAgeFromDob: () => '36', parsePatientAllergyInfo: () => ({}), parsePatientDiseaseInfo: () => ({}) };
const profileContext = vm.createContext({ window: profileWindow, currentUser: {}, dbTable: name => name, console: { error() {} },
  Swal: { fire() {}, close() {} },
  $: selector => { const q = { length: 1, text(value) { profileWrites.push([selector, value]); return q; }, attr() { return q; }, show() { return q; }, hide() { return q; }, off() { return q; }, on() { return q; }, modal(value) { profileWrites.push(['modal', value]); return q; } }; return q; },
  supabaseClient: { from() { let id; const q = { select() { return q; }, eq(_field, value) { id = value; return q; }, async single() { if (profileGates.has(id)) await profileGates.get(id).promise; return { data: { Patient_ID: id, First_Name: 'Synthetic', Phone_Number: '02012345678' } }; } }; return q; } } });
vm.runInContext(source.slice(source.indexOf('window.viewPatientDetail = async'), source.indexOf('window.setupPatientTableFilters =')), profileContext);
profileGates.set('P1', deferred());
const firstProfile = profileWindow.viewPatientDetail('P1'); await tick(); await profileWindow.viewPatientDetail('P2');
profileGates.get('P1').resolve(); await firstProfile;
assert.deepEqual(profileWrites.filter(([selector]) => selector === '#view_p_id'), [['#view_p_id', 'P2']], 'late P1 profile cannot overwrite P2');
profileWrites.length = 0; profileGates.set('P3', deferred());
const logoutProfile = profileWindow.viewPatientDetail('P3'); await tick(); profileWindow.clinicalReadGeneration++; profileContext.currentUser = null; profileGates.get('P3').resolve(); await logoutProfile;
assert.equal(profileWrites.length, 0, 'late profile response after logout cannot render or reopen modal');
let modalHides = 0, afterShown;
const fakeModal = { addEventListener(name, callback) { assert.equal(name, 'shown.bs.modal'); afterShown = callback; } };
const resetWindow = { clinicalReadGeneration: 0, ipdWardBedState: { admissions: [{ Patient_ID: 'OLD' }] } };
const resetContext = vm.createContext({ window: resetWindow, currentUser: {}, Swal: { close() {} }, Option: function () {},
  bootstrap: { Modal: { getInstance: () => ({ hide() { modalHides++; } }) } }, console: { warn() {} },
  $: selector => { const q = { each(fn) { if (selector === '.modal') fn.call(fakeModal); return q; } }; for (const method of ['removeClass', 'css', 'attr', 'removeAttr', 'remove', 'not', 'text', 'hide', 'off', 'empty', 'append', 'val', 'trigger']) q[method] = () => q; return q; } });
vm.runInContext(source.slice(source.indexOf('window.resetClinicalReadDisplays = function'), source.indexOf('window.clinicalReadFailureLabel = function')), resetContext);
resetWindow.resetClinicalReadDisplays(); assert.equal(modalHides, 1);
afterShown(); assert.equal(modalHides, 2, 'late show animation closes under retired session');
resetContext.currentUser = {}; afterShown(); assert.equal(modalHides, 2, 'new login can show a modal');
assert.equal(resetWindow.ipdWardBedState.admissions.length, 0, 'logout clears previous-session admission metadata');
delete globalThis.window; delete globalThis.document;
console.log('Manpower lifecycle, pending-save preservation, IPD complete-read failures/concurrency/patient/session isolation and all 30 partials passed.');
