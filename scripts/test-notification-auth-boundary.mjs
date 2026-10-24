import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function assignment(name) {
  const start = source.indexOf(`window.${name} = `);
  assert.ok(start >= 0, `Missing ${name}`);
  return source.slice(start, source.indexOf('\n};', start) + 3);
}
let loginVisible = true, appVisible = false, rendered = 0, desktops = 0, requests = 0;
let closed = 0, removed = 0;
const container = { querySelector: () => null, insertAdjacentHTML() { rendered++; } };
const context = vm.createContext({
  currentUser: null, lisResultGeneration: 1, lisResultNotificationsSeeded: false,
  lisNotifiedResultFileIds: new Set(), lisReadResultFileIds: new Set(), lisActiveResultAlerts: [],
  lisResultToastDismissTimers: new Map(), LIS_RESULT_TOAST_AUTO_DISMISS_MS: 60000,
  clinicalDesktopNotifications: new Set([{ close() { closed++; } }]),
  document: { getElementById: () => ({ replaceChildren() { removed++; } }) },
  validateHisAuthSessionRecord: record => ({ valid: record?.valid === true }),
  $: selector => ({ is: () => selector === '#login-section' ? loginVisible : appVisible }),
  Notification: Object.assign(function () { desktops++; }, { permission: 'granted' }),
  window: {
    Notification: true, isLocalOpdTestPreview: () => false,
    readAuthSession: () => ({ valid: true }),
    getGlobalClinicalToastContainer: () => container,
    formatLisResultReadyTime: () => '00:00',
    setTimeout: () => 1,
    opdTestLisRequest: async () => { requests++; return { data: [] }; },
  },
});
for (const name of ['canShowClinicalNotifications', 'isLisResultNotificationRecipient',
  'showLisResultToast', 'showLisResultDesktopNotification', 'fetchRecentLisResultFiles',
  'clearClinicalNotificationPresentation', 'showOpdQueueToast', 'showOpdDesktopNotification',
  'showIpdCareTaskDesktopNotification']) {
  if (name === 'canShowClinicalNotifications' && !source.includes(`window.${name} = `)) continue;
  vm.runInContext(assignment(name), context);
}
const alert = { fileId: 'SYNTHETIC-FILE', patientId: 'SYNTHETIC-HN', patientName: 'Synthetic Patient' };
context.alert = alert;
vm.runInContext('window.showLisResultToast(alert); window.showLisResultDesktopNotification(alert)', context);
vm.runInContext('window.showOpdQueueToast("Synthetic", "OPD"); window.showOpdDesktopNotification("Synthetic", "OPD"); window.showIpdCareTaskDesktopNotification([], 0)', context);
assert.equal(rendered, 0, 'Login page must never render patient result toasts');
assert.equal(desktops, 0, 'Logged-out state must not create desktop notifications');
await vm.runInContext('window.fetchRecentLisResultFiles()', context);
assert.equal(requests, 0, 'Logged-out state must not fetch result notifications');
context.currentUser = { id: 'synthetic-staff', role: 'doctor' };
assert.equal(vm.runInContext('window.isLisResultNotificationRecipient()', context), false,
  'A stale cached role must not authorize notifications on the login page');
loginVisible = false; appVisible = true;
assert.equal(vm.runInContext('window.isLisResultNotificationRecipient()', context), true);
vm.runInContext('window.showLisResultToast(alert)', context);
assert.equal(rendered, 1, 'Authenticated staff in the app retain notifications');
context.window.readAuthSession = () => ({ valid: false });
assert.equal(vm.runInContext('window.isLisResultNotificationRecipient()', context), false);
assert.match(source, /onAuthStateChange\([\s\S]{0,200}SIGNED_OUT/,
  'SDK sign-out must clear private presentation');
vm.runInContext('window.clearClinicalNotificationPresentation()', context);
assert.equal(closed, 1);
assert.equal(removed, 1);
assert.equal(context.clinicalDesktopNotifications.size, 0);
let signOutHandler;
context.supabaseClient = { auth: { onAuthStateChange(handler) { signOutHandler = handler; } } };
context.onlinePresence = { stop() {} };
const begin = source.indexOf('supabaseClient.auth.onAuthStateChange(');
vm.runInContext(source.slice(begin, source.indexOf('\n});', begin) + 4), context);
context.$ = () => ({ hide() {}, show() {}, removeClass() {} });
context.currentUser = { role: 'doctor' };
signOutHandler('TOKEN_REFRESHED');
assert.ok(context.currentUser);
signOutHandler('SIGNED_OUT');
assert.equal(context.currentUser, null, 'SDK sign-out immediately invalidates cached role');
console.log('Notification auth boundary: anonymous, login-page stale role, expired session and authenticated staff passed.');
