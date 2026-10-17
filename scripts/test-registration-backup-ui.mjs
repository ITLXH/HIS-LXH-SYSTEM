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

for (const id of ['backupSupabasePanel', 'backupGdrivePanel', 'backupHistoryPanel']) {
  assert.match(backupView, new RegExp(`id="${id}"`));
}
assert.equal((backupView.match(/class="backup-scroll-region/g) || []).length, 3);
assert.match(backupView, /id="backupFileListBody"/);
assert.match(backupView, /id="backupGdriveListBody"/);
assert.match(backupView, /id="backupHistoryBody"/);
assert.match(backupView, /Google Drive ເກັບ database\/settings \+ Storage ແບບ incremental/);
assert.match(backupView, /LIS\/UXI ໄຟລ໌ເກົ່າ 14 ມື້ຂຶ້ນໄປ/);
assert.doesNotMatch(backupView, /backupSourceTabs|backupPaneSupabase|backupPaneGdrive|backupPaneHistory/);

const backupInitSource = mainSource.slice(
  mainSource.indexOf('window.initBackupView = function'),
  mainSource.indexOf('// Run manual backup')
);
assert.match(backupInitSource, /window\.loadLatestBackupStatus\(\)/);
assert.match(backupInitSource, /window\.loadBackupFileList\(\)/);
assert.match(backupInitSource, /window\.loadGdriveBackupList\(\)/);
assert.match(backupInitSource, /window\.renderBackupHistory\(\)/);
const backupStatusSource = mainSource.slice(
  mainSource.indexOf('window.loadLatestBackupStatus = async function'),
  mainSource.indexOf('// Backup history')
);
assert.match(backupStatusSource, /data\.html_url/);
assert.match(backupStatusSource, /Backup run #/);
const restoreGuideSource = mainSource.slice(
  mainSource.indexOf('window.showRestoreGuide = function'),
  mainSource.indexOf('// IPD Ward / Bed Management')
);
assert.match(restoreGuideSource, /Supabase Storage/);
assert.match(restoreGuideSource, /Google Drive/);
assert.match(restoreGuideSource, /pre-restore backup/);
assert.doesNotMatch(restoreGuideSource, /Extract|import CSV/);

assert.match(styles, /\.backup-destinations-grid\s*\{[^}]*display:\s*grid/s);
assert.match(styles, /\.backup-destination-panel:first-child[\s\S]*?var\(--primary\)/);
assert.match(styles, /\.backup-scroll-region\s*\{[^}]*height:\s*clamp\(/s);
assert.match(styles, /\.backup-scroll-region\s*\{[^}]*overflow:\s*auto/s);
assert.match(styles, /\.backup-data-table thead th\s*\{[^}]*position:\s*sticky/s);

console.log('Registration paging and single-page Backup UI checks passed.');
