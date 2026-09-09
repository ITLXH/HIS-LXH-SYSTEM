import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const opdView = fs.readFileSync(path.join(root, 'public', 'partials', 'views', 'opd.html'), 'utf8');

const checks = [
  ['Registration does not render the fast-load timing notice', !main.includes('ໂຫຼດແບບໄວ:')],
  ['Registration retains a hidden error/status host', /#patientLoadAllNotice'[\s\S]{0,180}\.hide\(\)/.test(main)],
  ['Room-arrival toast duration is exactly one minute', /OPD_TOAST_AUTO_DISMISS_MS\s*=\s*60\s*\*\s*1000/.test(main)],
  ['Room-arrival toast schedules automatic dismissal', /setTimeout\(\(\)\s*=>\s*window\.dismissOpdToast\(toastId\),\s*OPD_TOAST_AUTO_DISMISS_MS\)/.test(main)],
  ['Manual dismissal clears the pending timeout', /opdToastDismissTimers\.get\(toastId\)[\s\S]{0,180}clearTimeout\(timerId\)/.test(main)],
  ['LIS result toast duration is exactly one minute', /LIS_RESULT_TOAST_AUTO_DISMISS_MS\s*=\s*60\s*\*\s*1000/.test(main)],
  ['LIS result toast schedules automatic dismissal', /setTimeout\([\s\S]{0,100}dismissLisResultNotification\(safeAttr\)[\s\S]{0,100}LIS_RESULT_TOAST_AUTO_DISMISS_MS/.test(main)],
  ['LIS result manual dismissal clears its timeout', /lisResultToastDismissTimers\.get\(safeAttr\)[\s\S]{0,180}clearTimeout\(timerId\)/.test(main)],
  ['LIS notification teardown clears all toast timers', /lisResultToastDismissTimers\.forEach\(timerId => window\.clearTimeout\(timerId\)\)[\s\S]{0,100}lisResultToastDismissTimers\.clear\(\)/.test(main)],
  ['Clinical toast container is global in the app shell', /id="opdToastContainer"[^>]*aria-live="polite"/.test(index)],
  ['Hidden OPD view no longer owns the toast container', !opdView.includes('id="opdToastContainer"')],
  ['Cached hidden containers are re-parented to body', /container\.parentElement\s*!==\s*document\.body[\s\S]{0,80}document\.body\.appendChild\(container\)/.test(main)],
  ['Room and LIS toasts use the shared global container', (main.match(/window\.getGlobalClinicalToastContainer\(\)/g) || []).length >= 2],
  ['Administrators receive LIS result notifications', /role\s*===\s*'admin'/.test(main)],
  ['LIS order enrichment uses bounded batches', /index\s*\+=\s*50/.test(main) && /limit:\s*1000/.test(main)],
  ['LIS enrichment fetches all batches concurrently', /Promise\.all\(orderBatches\.map/.test(main)]
];

const lisToastSource = main.slice(
  main.indexOf('window.showLisResultToast = function'),
  main.indexOf('window.showLisResultDesktopNotification = function')
);
checks.push(
  ['LIS result toast shows HN', /HN \$\{esc\(alert\.patientId\)\}/.test(lisToastSource)],
  ['LIS result toast shows patient name', /esc\(alert\.patientName\)/.test(lisToastSource)],
  ['LIS result toast shows ready time', /ເວລາພ້ອມ \$\{esc\(readyTime\)\}/.test(lisToastSource)],
  ['LIS result toast hides order and test details', !/alert\.(?:orderId|testName)/.test(lisToastSource)],
  ['LIS result toast has no acknowledgement button', !/acknowledgeLisResultNotification/.test(lisToastSource)]
);

const lisBellSource = main.slice(
  main.indexOf('lisResultAlerts.forEach(alert =>'),
  main.indexOf('roomAlerts.forEach(a =>')
);
checks.push(
  ['Notification bell shows LIS ready time', /ເວລາພ້ອມ \$\{esc\(readyTime\)\}/.test(lisBellSource)],
  ['Notification bell hides LIS order and test details', !/alert\.(?:orderId|testName)/.test(lisBellSource)]
);

const lisDesktopSource = main.slice(
  main.indexOf('window.showLisResultDesktopNotification = function'),
  main.indexOf('window.handleLisResultNotificationFiles = function')
);
checks.push(
  ['Desktop LIS notification shows ready time', /ເວລາພ້ອມ \$\{readyTime\}/.test(lisDesktopSource)],
  ['Desktop LIS notification hides order and test details', !/alert\.(?:orderId|testName)/.test(lisDesktopSource)]
);

let failed = 0;
for (const [label, passed] of checks) {
  if (passed) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

if (failed) {
  console.error(`\n${failed} clinical notification check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} clinical notification checks passed.`);
