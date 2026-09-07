import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const backupView = await readFile(new URL('../public/partials/views/backup.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

const patientTableSource = mainSource.slice(
  mainSource.indexOf('window.__patientRegistryTotalCount'),
  mainSource.indexOf('// PATIENT PHOTO HANDLERS')
);

assert.match(patientTableSource, /serverSide:\s*true/);
assert.match(patientTableSource, /pageLength:\s*10/);
assert.match(patientTableSource, /range\(rangeStart, rangeStart \+ pageSize - 1\)/);
assert.match(patientTableSource, /fetchPatientVisitCountMap\(rows\.map\(row => row\.Patient_ID\)\)/);
assert.match(patientTableSource, /searchDelay:\s*350/);
assert.doesNotMatch(patientTableSource, /Promise\.all\(pageQueries\)/);
assert.doesNotMatch(patientTableSource, /results\.flatMap/);

for (const id of ['backupPaneSupabase', 'backupPaneGdrive', 'backupPaneHistory']) {
  assert.match(backupView, new RegExp(`id="${id}"`));
}
assert.equal((backupView.match(/class="backup-scroll-region"/g) || []).length, 3);
assert.match(backupView, /window\.showBackupTab\('supabase'\)/);
assert.match(backupView, /window\.showBackupTab\('gdrive'\)/);
assert.match(backupView, /window\.showBackupTab\('history'\)/);

const backupInitSource = mainSource.slice(
  mainSource.indexOf('window.initBackupView = function'),
  mainSource.indexOf('// Run manual backup')
);
assert.match(backupInitSource, /window\.loadLatestBackupStatus\(\)/);
assert.match(backupInitSource, /window\.showBackupTab\('supabase'\)/);
assert.doesNotMatch(backupInitSource, /window\.renderBackupHistory\(\)/);
assert.doesNotMatch(backupInitSource, /window\.loadGdriveBackupList\(\)/);

assert.match(styles, /\.backup-scroll-region\s*\{[^}]*height:\s*clamp\(/s);
assert.match(styles, /\.backup-scroll-region\s*\{[^}]*overflow:\s*auto/s);
assert.match(styles, /\.backup-data-table thead th\s*\{[^}]*position:\s*sticky/s);
assert.match(styles, /#backupSourceTabContent > \.backup-tab-pane:not\(\.active\)\s*\{[^}]*display:\s*none !important/s);

console.log('Registration paging and compact Backup UI checks passed.');
