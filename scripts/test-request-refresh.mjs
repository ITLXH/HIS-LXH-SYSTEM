import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createCoalescedRefresh } from '../src/requestRefresh.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let calls = [];
let running = 0;
let maxRunning = 0;
const gate = deferred();
const refresh = createCoalescedRefresh(async value => {
  running++;
  maxRunning = Math.max(maxRunning, running);
  calls.push(value);
  if (calls.length === 1) await gate.promise;
  running--;
  return value;
}, { delayMs: 1 });
const burst = refresh('old');
assert.equal(refresh('new'), burst);
await sleep(10);
assert.deepEqual(calls, ['new'], 'burst before read starts makes one read with latest arguments');
for (let i = 0; i < 20; i++) assert.equal(refresh(`event-${i}`), burst);
gate.resolve();
assert.equal(await burst, 'event-19');
assert.deepEqual(calls, ['new', 'event-19'], 'updates during read retain one trailing read');
assert.equal(maxRunning, 1);
let fail = true;
const recover = createCoalescedRefresh(async () => { if (fail) throw new Error('failure'); return 'recovered'; }, { delayMs: 0 });
await assert.rejects(recover(), /failure/);
fail = false;
assert.equal(await recover(), 'recovered', 'failed task releases guard');
let canRun = true;
let skippedCalls = 0;
const guarded = createCoalescedRefresh(() => skippedCalls++, { delayMs: 5, shouldRun: () => canRun });
const skip = guarded();
canRun = false;
await skip;
assert.equal(skippedCalls, 0, 'leaving the view cancels a scheduled refresh');

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const quiet = { log() {}, warn() {}, error() {} };
// Execute the actual fetch wrapper with mocked HTTP/network, never production.
let networkCalls = 0;
let response = { ok: false, status: 500 };
let throws = false;
const networkWindow = { hisNetworkState: 'online', setHisNetworkStatus(state) { this.hisNetworkState = state; } };
const network = vm.createContext({ window: networkWindow, navigator: { onLine: true }, URL, TypeError, AbortSignal,
  SUPABASE_URL: 'https://supabase.invalid', SUPABASE_REQUEST_TIMEOUT_MS: 100,
  fetch: async () => { networkCalls++; if (throws) throw new TypeError('network unavailable'); return response; },
});
vm.runInContext(block('async function fetchWithNetworkStatus', 'const supabaseClient ='), network);
await network.fetchWithNetworkStatus('/api/failed');
assert.equal(networkWindow.hisNetworkState, 'online', '500 must not block healthy endpoints');
response = { ok: true, status: 200 };
await network.fetchWithNetworkStatus('/api/healthy', { method: 'POST' });
assert.equal(networkCalls, 2, 'writes must not be automatically retried');
throws = true;
await assert.rejects(network.fetchWithNetworkStatus('/api/network'));
assert.equal(networkWindow.hisNetworkState, 'offline');
await assert.rejects(network.fetchWithNetworkStatus('/api/blocked'), /HIS_OFFLINE/);
assert.equal(networkCalls, 3);

// Execute actual OPD lifecycle/poll functions against a fake Supabase client.
let now = 100000;
class TestDate extends Date { static now() { return now; } }
let readCalls = 0;
let readGate = null;
let statusCallback;
let eventCallback;
let channels = 0;
let removed = 0;
const intervals = new Map();
let nextId = 0;
const delivered = [];
const client = {
  from() {
    readCalls++;
    const query = { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, limit() { return this; },
      then(resolve, reject) { return (readGate?.promise || Promise.resolve({ data: [{ Visit_ID: 'V1', Status: 'Waiting OPD' }] })).then(resolve, reject); } };
    return query;
  },
  channel() { channels++; return { on(_event, _filter, callback) { eventCallback = callback; return this; }, subscribe(callback) { statusCallback = callback; return this; } }; },
  removeChannel() { removed++; },
};
const opdWindow = { seedOpdNotifiedVisits: async () => {}, getLocalStr: () => '2026-10-06',
  getLocalDayIsoBounds: () => ({ startIso: '', endIso: '' }), handleOpdQueueNotification: row => delivered.push(row.Visit_ID) };
const opd = vm.createContext({ window: opdWindow, supabaseClient: client, Date: TestDate, console: quiet,
  dbTable: name => name, $: () => ({ is: () => false }), document: { querySelectorAll: () => [] },
  setInterval: callback => { intervals.set(++nextId, callback); return nextId; }, clearInterval: id => intervals.delete(id),
  opdToastDismissTimers: new Map(), opdNotifiedVisitIds: new Set(), opdActiveRoomAlerts: [],
});
vm.runInContext('let opdQueueChannel = null, opdQueuePollInterval = null, opdQueueGeneration = 0, opdQueueRealtimeReady = false, opdQueuePollRunning = false, opdQueueLastPollAt = 0;\n'
  + block('window.pollOpdQueueNotifications =', '// Toast click handler'), opd);
await opdWindow.setupOpdQueueRealtime();
statusCallback('SUBSCRIBED');
await sleep(0);
assert.equal(readCalls, 1, 'subscription reconciles immediately');
await opdWindow.pollOpdQueueNotifications();
assert.equal(readCalls, 1, 'healthy realtime suppresses 15-second reads');
now += 60000;
await opdWindow.pollOpdQueueNotifications();
assert.equal(readCalls, 2, 'healthy realtime still reconciles every minute');
statusCallback('CHANNEL_ERROR');
await opdWindow.pollOpdQueueNotifications();
assert.equal(readCalls, 3, 'disconnected realtime preserves fast fallback');
readGate = deferred();
const pendingPoll = opdWindow.pollOpdQueueNotifications();
await opdWindow.pollOpdQueueNotifications();
assert.equal(readCalls, 4, 'slow polls do not overlap');
opdWindow.teardownOpdQueueRealtime();
readGate.resolve({ data: [{ Visit_ID: 'STALE' }] });
await pendingPoll;
assert.equal(delivered.includes('STALE'), false, 'logout ignores late responses');
assert.equal(intervals.size, 0);
assert.equal(removed, 1);
const seedGate = deferred();
opdWindow.seedOpdNotifiedVisits = () => seedGate.promise;
const settingUp = opdWindow.setupOpdQueueRealtime();
opdWindow.teardownOpdQueueRealtime();
seedGate.resolve();
await settingUp;
assert.equal(channels, 1, 'logout during seed cannot recreate channel');
eventCallback({ new: { Visit_ID: 'OLD_CHANNEL' } });
assert.equal(delivered.includes('OLD_CHANNEL'), false);
console.log('Request coalescing, network isolation and OPD lifecycle behavior checks passed.');

// Actual alert rendering retains the previous successful state on either read failure.
const dom = new Map();
const jq = selector => {
  if (!dom.has(selector)) dom.set(selector, { value: '', html(value) { this.value = value; return this; }, text(value) { this.value = value; return this; }, show() { return this; }, hide() { this.value = 'hidden'; return this; } });
  return dom.get(selector);
};
let appointmentResult = { data: [{ Appt_ID: 'A1', Patient_Name: 'Test appointment', Appt_Date: '2026-10-06', Status: 'Pending' }] };
let roomResult = { data: [{ Visit_ID: 'V1', Patient_Name: 'Test queue', Department: 'OPD', Date: '2026-10-06T00:00:00Z' }] };
let appointmentGate;
const alertWindow = { getLocalStr: () => '2026-10-06', getLocalDayIsoBounds: () => ({}), isOpdRoomMatch: () => true };
const alerts = vm.createContext({ window: alertWindow, currentUser: { id: 'test' }, console: quiet, Date, $: jq,
  opdActiveRoomAlerts: [], dbTable: name => name, createCoalescedRefresh: task => createCoalescedRefresh(task, { delayMs: 0 }),
  supabaseClient: { from(table) {
    return { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, limit() { return this; },
      then(resolve, reject) { return (table === 'Appointments' ? (appointmentGate?.promise || Promise.resolve(appointmentResult)) : Promise.resolve(roomResult)).then(resolve, reject); } };
  } },
});
vm.runInContext(block('let lastAppointmentAlerts =', 'window.preloadDropdownDataCallback ='), alerts);
await alertWindow.checkAlerts();
assert.equal(jq('#bell-count').value, 2);
appointmentResult = { error: { code: '503' } };
roomResult = { error: { code: '503' } };
await alertWindow.checkAlerts();
assert.equal(jq('#bell-count').value, 2, 'failed reads must not erase valid alerts');
appointmentResult = { data: [] };
roomResult = { data: [] };
await alertWindow.checkAlerts();
assert.equal(jq('#bell-count').value, 'hidden', 'successful empty reads clear alerts');
appointmentGate = deferred();
const lateAlert = alertWindow.checkAlerts();
await sleep(10);
alertWindow.resetClinicalAlertRefresh();
appointmentGate.resolve({ data: [{ Appt_ID: 'STALE', Appt_Date: '2026-10-06' }] });
await lateAlert;
assert.equal(jq('#bell-count').value, 'hidden', 'logout invalidates pending alerts');

let tvVisible = true;
let tvReads = 0;
let tvEvent;
let tvRemoved = 0;
const tvIntervals = new Map();
let tvId = 0;
const tvWindow = { getHospitalDataLoaderHtml: () => '', getLocalStr: () => '2026-10-06', getLocalDayIsoBounds: () => ({}) };
const tv = vm.createContext({ window: tvWindow, console: quiet, Date, dbTable: name => name, systemSettings: {},
  createCoalescedRefresh: task => createCoalescedRefresh(task, { delayMs: 0 }),
  $: selector => ({ is: () => tvVisible, html() { return this; }, text() { return this; }, addClass() { return this; }, removeClass() { return this; } }),
  setInterval: callback => { tvIntervals.set(++tvId, callback); return tvId; }, clearInterval: id => tvIntervals.delete(id),
  supabaseClient: { channel() { return { on(_event, _filter, callback) { tvEvent = callback; return this; }, subscribe() { return this; } }; }, removeChannel() { tvRemoved++; },
    from() { tvReads++; return { select() { return this; }, gte() { return this; }, lte() { return this; }, order() { return Promise.resolve({ data: [{ Status: null }] }); } }; } },
});
vm.runInContext(block('let publicQueueChannel =', 'window.triggerPublicCall ='), tv);
await tvWindow.initPublicQueueView();
await tvWindow.refreshPublicQueueDisplay();
await tvWindow.initPublicQueueView();
await tvWindow.refreshPublicQueueDisplay();
assert.equal(tvIntervals.size, 1, 're-enter TV keeps one clock');
assert.equal(tvRemoved, 1);
tvVisible = false;
tvWindow.teardownPublicQueueView();
const before = tvReads;
tvEvent({ new: { Status: 'Waiting OPD' } });
await tvWindow.refreshPublicQueueDisplay();
assert.equal(tvReads, before, 'hidden or removed TV channels cannot fetch');
assert.equal(tvIntervals.size, 0);
console.log('Alert failure preservation and TV lifecycle behavior checks passed.');

let queueReads = 0;
const queueWindow = { getLocalStr: () => '2026-10-06', getLocalDateRangeIsoBounds: () => ({}) };
const queue = vm.createContext({ window: queueWindow, console: quiet, Date, dbTable: name => name,
  supabaseClient: { from() { queueReads++; return { select() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, range() { return Promise.resolve({ error: { message: 'read failed', code: '42501' } }); } }; } },
});
vm.runInContext(block('window._fetchOpdQueue =', 'window.triggerTriagePublicCall ='), queue);
await assert.rejects(queueWindow._fetchOpdQueue('2026-10-06', '2026-10-06'), error => error.code === '42501');
assert.equal(queueReads, 1, 'failed primary queue read must not trigger an empty-result fallback');
console.log('OPD failed read avoids fallback traffic check passed.');

let patient = 'P1';
let externalCalls = 0;
let dirty = 0;
let externalGate;
const root = { style: { display: 'block' } };
const externalDocument = { hidden: false, getElementById: () => root };
const medication = { localOrderId: 'M1', pharmacyStatus: 'pending', status: 'pending' };
const externalWindow = { opdTestSelectedVisit: { visitId: 'V1' }, opdTestLisPatientId: () => patient,
  opdTestState: { medications: [medication], orders: [] }, opdTestMarkDirty: () => dirty++,
  opdTestRenderLegacyOrders() {}, opdTestSimpleAlert() {},
  opdTestPharmacyStatusProvider: async () => { externalCalls++; return externalGate ? await externalGate.promise : [{ localOrderId: 'M1', status: 'pending' }]; },
};
const external = vm.createContext({ window: externalWindow, document: externalDocument, console: quiet, Set, currentUser: { id: 'test' } });
vm.runInContext(block('const opdExternalReads =', 'window.opdTestCanRemoveLabOrder ='), external);
await externalWindow.opdTestSyncExternalResults('medication', { silent: true });
assert.equal(dirty, 0, 'unchanged provider response must not schedule an autosave');
externalDocument.hidden = true;
await externalWindow.opdTestSyncExternalResults('medication', { silent: true });
assert.equal(externalCalls, 1, 'background encounter skips external provider polling');
externalDocument.hidden = false;
externalGate = deferred();
const externalRead = externalWindow.opdTestSyncExternalResults('medication', { silent: true });
await externalWindow.opdTestSyncExternalResults('medication', { silent: true });
assert.equal(externalCalls, 2, 'provider reads for the same encounter do not overlap');
patient = 'P2';
externalWindow.opdTestSelectedVisit = { visitId: 'V2' };
externalGate.resolve([{ localOrderId: 'M1', status: 'dispensed' }]);
await externalRead;
assert.equal(medication.status, 'pending', 'late provider response cannot change a switched patient');
assert.equal(dirty, 0);
externalGate = null;
externalWindow.opdTestPharmacyStatusProvider = async () => [{ localOrderId: 'M1', status: 'dispensed' }];
await externalWindow.opdTestSyncExternalResults('medication', { silent: true });
assert.equal(medication.status, 'dispensed');
assert.equal(dirty, 1, 'new status still persists normally');
console.log('External result concurrency, patient scope and no-op autosave checks passed.');

let lisPatient = 'P1';
const lisGate = deferred();
const lisState = { lisResults: [], lisOrders: [] };
const lisWindow = { opdTestState: lisState, opdTestSelectedVisit: { visitId: 'V1' },
  opdTestLisPatientId: () => lisPatient, opdTestLisVisitDateKey: () => '2026-10-06',
  opdTestRenderLisResults() {}, opdTestLisRequest: () => lisGate.promise };
const lis = vm.createContext({ window: lisWindow, console: quiet, Set, currentUser: { id: 'test' },
  document: { getElementById: () => ({ style: { display: 'block' }, removeAttribute() {} }), querySelector: () => ({ classList: { remove() {} } }) },
});
vm.runInContext(block('window.opdTestFetchLisResults =', 'window.opdTestStopLisPolling ='), lis);
const lisRead = lisWindow.opdTestFetchLisResults();
lisPatient = 'P2';
lisWindow.opdTestSelectedVisit = { visitId: 'V2' };
lisState.lisFetchInFlight = false; // Selecting an encounter resets its view state.
const newLisGate = deferred();
lisWindow.opdTestLisRequest = () => newLisGate.promise;
const newLisRead = lisWindow.opdTestFetchLisResults();
lisState.lisOrders = [{ order_id: 'NEW_PATIENT_ORDER' }];
lisGate.resolve({ data: [{ order_id: 'OLD_PATIENT_ORDER' }] });
await lisRead;
assert.equal(lisState.lisOrders[0].order_id, 'NEW_PATIENT_ORDER', 'late LIS response cannot replace a new patient result scope');
assert.equal(lisState.lisFetchInFlight, true, 'older request cannot release a newer request guard');
newLisGate.resolve({ data: [] });
await newLisRead;
assert.equal(lisState.lisFetchInFlight, false);
console.log('LIS patient-switch response isolation check passed.');

const notificationSeed = deferred();
const notificationRead = deferred();
const notificationTimers = new Map();
let notificationId = 0;
let notificationsHandled = 0;
const notificationWindow = {
  isLisResultNotificationRecipient: () => true,
  seedLisResultNotifications: () => notificationSeed.promise,
  fetchRecentLisResultFiles: () => notificationRead.promise,
  enrichLisResultFiles: async files => files,
  handleLisResultNotificationFiles: () => notificationsHandled++,
  setInterval: callback => { notificationTimers.set(++notificationId, callback); return notificationId; },
  clearInterval: id => notificationTimers.delete(id), clearTimeout() {},
};
const notification = vm.createContext({ window: notificationWindow, console: quiet,
  document: { querySelectorAll: () => [] }, lisResultGeneration: 0,
  lisResultPollInterval: null, lisResultPollRunning: false, lisResultNotificationsSeeded: true,
  lisNotifiedResultFileIds: new Set(), lisResultToastDismissTimers: new Map(), lisActiveResultAlerts: [],
});
vm.runInContext(block('window.pollLisResultNotifications =', 'window.getLisResultAcknowledgmentPersistence ='), notification);
const notificationSetup = notificationWindow.setupLisResultNotifications();
notificationWindow.teardownLisResultNotifications();
notificationSeed.resolve();
await notificationSetup;
assert.equal(notificationTimers.size, 0, 'logout during LIS seed cannot resurrect a timer');
vm.runInContext('lisResultNotificationsSeeded = true', notification);
const notificationPoll = notificationWindow.pollLisResultNotifications();
notificationWindow.teardownLisResultNotifications();
vm.runInContext('lisResultPollRunning = true', notification); // A newer session owns the guard.
notificationRead.resolve([{ id: 'OLD_FILE' }]);
await notificationPoll;
assert.equal(notificationsHandled, 0, 'late LIS poll cannot notify a logged-out session');
assert.equal(vm.runInContext('lisResultPollRunning', notification), true, 'old LIS poll cannot release a newer guard');
console.log('Global LIS logout, setup and late-response lifecycle checks passed.');

const organizationSchema = fs.readFileSync(new URL('../supabase/restore_chunks/01_schema_only.sql', import.meta.url), 'utf8')
  .match(/CREATE TABLE IF NOT EXISTS public\."HIS_One_Organizations" \(([\s\S]*?)\);/)[1];
const organizationColumns = new Set([...organizationSchema.matchAll(/"([^"]+)"/g)].map(match => match[1]));
let organizationResponse = { data: [
  { Org_ID: 'ORG1', Org_Code: 'TEST', Org_Name: 'Synthetic Org', Name: 'Synthetic Contact' },
  { Org_ID: 'ORG2', Org_Code: 'TEST2', Org_Name: 'Second Org', Name: null },
] };
let organizationReads = 0;
let organizationOptions = '';
const organizationWindow = { fetchSupabaseRows: async () => [], applyLabCategoriesToList: rows => rows };
const organization = vm.createContext({ window: organizationWindow, console: quiet, dbTable: name => name,
  allPatientsList: [], activeOrgsList: [], drugsMasterList: [], labsMasterList: [], jQuery: {},
  document: { getElementById: () => null },
  $: selector => ({ html(value) { if (selector === '#a_org') organizationOptions = value; return this; }, trigger() { return this; } }),
  supabaseClient: { from(table) { return {
    select(fields) {
      if (table === 'Organizations') {
        organizationReads++;
        for (const field of fields.split(',')) assert.ok(organizationColumns.has(field), `organization projection must use schema field: ${field}`);
      }
      return this;
    }, limit() { return this; }, order() { return this; },
    then(callback) { return Promise.resolve(table === 'Organizations' ? organizationResponse : { data: [] }).then(callback); },
  }; } },
});
vm.runInContext(block('window.preloadDropdownDataCallback =', 'window.currentDashRangeType ='), organization);
await new Promise(resolve => organizationWindow.preloadDropdownDataCallback(resolve));
assert.match(organizationOptions, /value="ORG1">TEST - Synthetic Org \(Synthetic Contact\)/);
assert.match(organizationOptions, /value="ORG2">TEST2 - Second Org<\/option>/);
const lastOrganizationOptions = organizationOptions;
organizationResponse = { data: null, error: { code: '42501', message: 'Read failed' } };
await new Promise(resolve => organizationWindow.preloadDropdownDataCallback(resolve));
assert.equal(organizationOptions, lastOrganizationOptions, 'failed organization preload preserves dropdown choices');
assert.equal(organization.activeOrgsList.length, 2);
organizationResponse = { data: [] };
await new Promise(resolve => organizationWindow.preloadDropdownDataCallback(resolve));
assert.equal(organizationOptions, '<option value=""></option>', 'successful empty response clears old choices');
assert.equal(organizationReads, 3, 'one organization read per preload, without schema-error retries');
console.log('Organization schema projection, dropdown labels and failure preservation checks passed.');
