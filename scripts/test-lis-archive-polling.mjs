import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let visible = false;
let calls = 0;
let resolveRequest;
let observer;
const timers = new Map();
let timerId = 0;
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    style: {}, classList: { toggle() {} }, parentElement: { setAttribute() {} },
    addEventListener() {}, getClientRects: () => visible ? [{}] : [],
  });
  return elements.get(id);
}
const document = { hidden: false, documentElement: {}, getElementById: element, addEventListener() {} };
const window = { authenticatedFetch: () => {
  calls++;
  return new Promise(resolve => { resolveRequest = resolve; });
} };
const context = vm.createContext({
  window, document, console, Date, Set, Promise,
  MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
  setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
  clearTimeout: id => timers.delete(id),
});
vm.runInContext(fs.readFileSync(new URL('../src/lisArchiveDashboard.js', import.meta.url), 'utf8')
  .replace("import './lisArchiveDashboard.css';", ''), context);
assert.equal(calls, 0, 'hidden Backup must make no requests');
visible = true;
observer();
assert.equal(calls, 1);
const pending = window.refreshLisArchiveStatus();
assert.equal(calls, 1, 'concurrent refresh shares the pending request');
resolveRequest({ ok: true, json: async () => ({ status: 'success' }) });
await pending;
assert.equal([...timers.values()][0].delay, 60000, 'idle archive polls less frequently');
visible = false;
observer();
assert.equal(timers.size, 0, 'leaving Backup clears timer');
visible = true;
observer();
const active = window.refreshLisArchiveStatus();
resolveRequest({ ok: true, json: async () => ({ status: 'in_progress' }) });
await active;
assert.equal([...timers.values()][0].delay, 10000);
document.hidden = true;
observer();
assert.equal(timers.size, 0, 'background tab clears timer');
document.hidden = false;
observer();
const failure = window.refreshLisArchiveStatus();
resolveRequest({ ok: false, status: 503, json: async () => ({ error: 'unavailable' }) });
await failure;
assert.equal([...timers.values()][0].delay, 30000, 'failed requests back off');
// Hiding while a request is in flight must prevent rescheduling on completion.
const last = window.refreshLisArchiveStatus();
visible = false;
observer();
resolveRequest({ ok: true, json: async () => ({ status: 'in_progress' }) });
await last;
assert.equal(timers.size, 0);
console.log('LIS archive polling behavior checks passed.');
