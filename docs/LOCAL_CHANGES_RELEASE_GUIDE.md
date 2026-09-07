# ຄູ່ມືໂຄ້ດຂອງຊຸດ Release 2026-09-07

ວັນທີກວດສອບ: 2026-09-07
Repository: `HIS-sys-main-LXH`
Base commit ທີ່ໃຊ້ທຽບ: `f58c64e` (`Fix triage OPD follow-up print fields`)
ສະຖານະ: ເອກະສານນີ້ບັນທຶກຂອບເຂດໂຄ້ດທີ່ລວມເຂົ້າຊຸດ Release 2026-09-07 ຫຼັງການທົດສອບ local.

## 1. ຂອບເຂດຂອງ Release

ໂຄ້ດທີ່ຄ້າງແບ່ງເປັນ 4 feature ຫຼັກ:

1. Registration server-side pagination ແລະ Backup UI ແບບ tab.
2. Hospital-branded loading UI ທີ່ໃຊ້ຮ່ວມກັນທົ່ວລະບົບ.
3. OPD room-arrival ແລະ LIS result notifications ທີ່ສະແດງໄດ້ທຸກໜ້າ.
4. ການຈັດແຖວປຸ່ມ Action ຂອງໜ້າ Triage.

ນອກຈາກນັ້ນມີ 2 ບົດວິເຄາະທີ່ຍັງບໍ່ແມ່ນ production implementation:

- ການກວດສອບ performance ຂອງການໂຫຼດຂໍ້ມູນທຸກໜ້າ.
- ການສຶກສາຄວາມເປັນໄປໄດ້ຂອງ LIS critical-value detection ດ້ວຍ OCR.

## 2. ໂຄງສ້າງການເຮັດວຽກ

ແຕ່ລະ feature ໃນ repository ນີ້ມັກແບ່ງເປັນ 4 ຊັ້ນ:

| ຊັ້ນ | ໄຟລ໌ຫຼັກ | ໜ້າທີ່ |
|---|---|---|
| HTML partial | `public/partials/...` | ສ້າງ element, table, modal, button, ID ແລະ class ທີ່ JavaScript/CSS ຈະໃຊ້ |
| JavaScript | `src/main.js` | ດຶງຂໍ້ມູນ, filter, render, ຈັດ event, timer, notification ແລະ API flow |
| CSS | `src/style.css` | ຈັດ layout, ຂະໜາດ, ສີ, responsive behavior ແລະ animation |
| Test/Documentation | `scripts/*.mjs`, `docs/*.md` | ກວດວ່າ behavior ສຳຄັນຍັງຢູ່ ແລະບັນທຶກເຫດຜົນຂອງການອອກແບບ |

## 3. Registration server-side pagination

### 3.1 ບັນຫາທີ່ໂຄ້ດນີ້ແກ້

ແບບເກົ່າດຶງຄົນເຈັບທັງໝົດຈາກ Supabase ແລ້ວຈຶ່ງສ້າງ DataTable. ເມື່ອຂໍ້ມູນຫຼາຍ ການເຂົ້າໜ້າ Registration ຈະຊ້າ, ໃຊ້ bandwidth ຫຼາຍ ແລະຕ້ອງດຶງ Visits ຈຳນວນຫຼາຍເພື່ອນັບ badge ປະຫວັດ.

ແບບໃໝ່ໃຫ້ DataTables ສົ່ງ page, search, filter ແລະ sort ໄປ Supabase; browser ຈະໄດ້ຮັບສະເພາະແຖວທີ່ຕ້ອງສະແດງ.

### 3.2 `src/main.js`

#### `window.setupPatientTableFilters(patientTable)`

ໜ້າທີ່:

- ເພີ່ມ input ຄົ້ນຫາ Old ID, ຊື່, ເບີໂທ, ວັນທີເລີ່ມ ແລະວັນທີສິ້ນສຸດເຂົ້າໄປໃນ DataTables toolbar.
- ຜູກ Old ID ກັບ column 3, ຊື່ກັບ column 4 ແລະເບີໂທກັບ column 7.
- ໃຊ້ debounce 320 ms ກ່ອນ `patientTable.draw()` ເພື່ອບໍ່ໃຫ້ຍິງ request ທຸກຄັ້ງທີ່ພິມ 1 ຕົວອັກສອນ.
- Date filter ຮັນທັນທີເມື່ອຄ່າວັນທີປ່ຽນ.

#### `window.__patientRegistryTotalCount`

ເປັນ cache ຂອງຈຳນວນຄົນເຈັບທັງໝົດ. ຈຸດປະສົງຄືບໍ່ໃຫ້ຖາມ `count(*)` ຊ້ຳທຸກເທື່ອທີ່ເລື່ອນໜ້າ. Cache ຈະຖືກ reset ເມື່ອ `initPatientTable()` ຖືກເອີ້ນໃໝ່.

#### `window.patientRegistrySearchTokens(value)`

ໜ້າທີ່:

- ຕັດ whitespace ແລະອັກສອນພິເສດທີ່ອາດລົບກວນ Supabase filter.
- ແຍກຄຳຄົ້ນຫາເປັນ token.
- ຈຳກັດບໍ່ເກີນ 4 token ແລະ 60 ຕົວອັກສອນຕໍ່ token ເພື່ອຄວບຄຸມຂະໜາດ query.

#### `window.applyPatientRegistryFilters(query, request)`

ຮັບ Supabase query builder ແລະ request ຈາກ DataTables ແລ້ວຕໍ່ filter ເຂົ້າໄປ:

- Global search: `Patient_ID`, `Old_Patient_ID`, `First_Name`, `Last_Name`, `Phone_Number`, `Name_Org`, `Insurance_Company`.
- Column search: Old ID, ຊື່/ນາມສະກຸນ ແລະເບີໂທ.
- Date range: `Registration_Date >= fromDate` ແລະ `Registration_Date <= toDate`.

ຟັງຊັນນີ້ບໍ່ execute query ເອງ; ມັນສົ່ງ query builder ທີ່ຕໍ່ filter ແລ້ວກັບໄປໃຫ້ `initPatientTable()`.

#### `window.patientRegistryHasFilters(request)`

ກວດວ່າ request ປັດຈຸບັນມີ global search, column search ຫຼື date filter ຫຼືບໍ່. ຜົນນີ້ໃຊ້ຕັດສິນວ່າຕ້ອງດຶງ total count ແຍກຕ່າງຫາກຫຼືສາມາດໃຊ້ cache ໄດ້.

#### `window.initPatientTable()`

ເປັນ controller ຫຼັກຂອງ Registration table:

1. ຖ້າ DataTable ມີຢູ່ແລ້ວ ຈະ reset total-count cache ແລະ `ajax.reload()` ໂດຍບໍ່ destroy table.
2. ກຳນົດ `serverSide: true`, `processing: true`, `searchDelay: 350`, page size 10 ແລະຕົວເລືອກ 10/25/50.
3. ອ່ານ `request.start`, `request.length`, `request.order`, search ແລະ filters ຈາກ DataTables.
4. ສ້າງ Supabase query ທີ່ດຶງສະເພາະ field ທີ່ table ຕ້ອງໃຊ້.
5. ຈຳກັດ page size ສູງສຸດ 50 ແຖວ ແລະໃຊ້ `.range(start, end)`.
6. ເອີ້ນ `fetchPatientVisitCountMap()` ສະເພາະ Patient ID ທີ່ຢູ່ໃນ page ປັດຈຸບັນ.
7. ສົ່ງ `recordsTotal`, `recordsFiltered` ແລະ rows ກັບໄປຫາ DataTables callback.
8. Render action buttons ໂດຍຍັງກວດ permission ສຳລັບ View, Timeline, Print, Triage, Cover, Edit ແລະ Delete.
9. Escape ຂໍ້ມູນທີ່ສະແດງ ແລະ encode ຄ່າທີ່ຈະຖືກສົ່ງເຂົ້າ inline handler.
10. ຖ້າ request ລົ້ມເຫຼວ ຈະສະແດງ error ຢູ່ `#patientLoadAllNotice`; ຖ້າສຳເລັດ ຈະຊ່ອນ status host ນີ້.

### 3.3 `src/style.css`

| Selector | ໜ້າທີ່ |
|---|---|
| `#view-patients .dataTables_processing` | ວາງ processing loader ກາງຈໍ ແລະຢູ່ເທິງ table |
| `.dataTables_processing .his-data-loader` | ບັງຄັບໃຫ້ hospital loader ສະແດງໃນ DataTables processing panel |
| `.dataTables_processing .his-data-loader__logo` | ປ້ອງກັນ style ອື່ນເຮັດໃຫ້ໂລໂກ້ຖືກເຊື່ອງ |
| `.patient-fast-load-note` | style ຂອງ performance note ເກົ່າ; JavaScript ປັດຈຸບັນລ້າງແລະຊ່ອນ success note, ເຫຼືອ host ໄວ້ສຳລັບ error |

### 3.4 Data flow

`DataTables UI` → `setupPatientTableFilters()` → `patientRegistrySearchTokens()` / `applyPatientRegistryFilters()` → `Supabase Patients query` → `fetchPatientVisitCountMap()` ສະເພາະ page → `DataTables callback()` → render rows/actions.

## 4. Backup UI ແບບໜ້າດຽວ

### 4.1 `public/partials/views/backup.html`

| Element/ID | ໜ້າທີ່ |
|---|---|
| `.backup-page-heading` | ຫົວໜ້າ Backup ແລະກຸ່ມປຸ່ມ Backup Now, Restore Guide, View Logs |
| `#latestBackupInfo` | ບ່ອນ render ສະຖານະ backup ລ່າສຸດ |
| `.backup-schedule-note` | ແຈ້ງ schedule backup ອັດຕະໂນມັດ 07:00 |
| `.backup-restore-warning` | ຄຳເຕືອນວ່າ Restore ອາດຂຽນທັບຂໍ້ມູນຕາມ Primary Key |
| `#backupTabSupabase` | ເປີດລາຍການ backup ຫຼັກໃນ Supabase Storage |
| `#backupTabGdrive` | ເປີດສຳເນົາ database/settings ໃນ Google Drive |
| `#backupTabHistory` | ເປີດປະຫວັດ GitHub Actions workflow |
| `#backupPaneSupabase` | pane ຂອງ Supabase files; tbody ແມ່ນ `#backupFileListBody` |
| `#backupPaneGdrive` | pane ຂອງ Google Drive files; tbody ແມ່ນ `#backupGdriveListBody` |
| `#backupPaneHistory` | pane ຂອງ workflow history; tbody ແມ່ນ `#backupHistoryBody` |
| `.backup-scroll-region` | ຈຳກັດຄວາມສູງຂອງຕາຕະລາງ ແລະ scroll ຢູ່ພາຍໃນ card |

Google Drive ແລະ History pane ເລີ່ມດ້ວຍຂໍ້ຄວາມ “ເປີດແຖບນີ້ເພື່ອໂຫຼດ” ເພາະບໍ່ຄວນຍິງ request ທັງ 3 source ພ້ອມກັນເມື່ອເຂົ້າໜ້າ.

### 4.2 `src/main.js`

#### `window.showBackupTab(tabName)`

- Map ຊື່ `supabase`, `gdrive`, `history` ໄປຫາ button, pane ແລະ loader function.
- ປ່ຽນ `.active`, `.show` ແລະ `aria-selected`.
- ໂຫຼດຂໍ້ມູນສະເພາະ tab ທີ່ຜູ້ໃຊ້ເປີດ.

#### `window.initBackupView()`

- ກວດວ່າ user ເປັນ admin.
- ດຶງສະຖານະ backup ລ່າສຸດ.
- ເປີດແລະໂຫຼດ Supabase tab ເປັນ default.
- ບໍ່ໂຫຼດ Google Drive ແລະ History ຈົນກວ່າຈະເປີດ tab.

#### Loader ຂອງແຕ່ລະ pane

- `window.loadBackupFileList()` render loader ໃນ `#backupFileListBody` ແລ້ວເອີ້ນ `/api/backup/list`.
- `window.loadGdriveBackupList()` render loader ໃນ `#backupGdriveListBody` ແລ້ວເອີ້ນ `/api/backup/gdrive-list`.
- `window.renderBackupHistory()` render loader ໃນ `#backupHistoryBody` ແລ້ວດຶງ workflow runs.
- `window._backupApiFetch()` ຮວບຮວມການຈັດການ network error, 404 ແລະ non-JSON response ໃຫ້ກາຍເປັນ `{ unavailable: true }` ສຳລັບ local Vite.
- `window._backupUnavailableRow(colspan)` ສ້າງແຖວອະທິບາຍວ່າ Backup API ໃຊ້ໄດ້ໃນ Cloudflare Pages ຫຼື `npm run pages:dev`.

### 4.3 `src/style.css`

| Selector | ໜ້າທີ່ |
|---|---|
| `.backup-overview-grid` | ຈັດ latest status ແລະ schedule note ເປັນ 2 column |
| `.backup-source-tabs` | ຈັດ 3 tabs ໃຫ້ compact ແລະມີ active state ຊັດເຈນ |
| `.backup-tab-pane:not(.active)` | ບັງຄັບເຊື່ອງ pane ທີ່ບໍ່ active |
| `.backup-pane-toolbar` | ຈັດຊື່ source, ຄຳອະທິບາຍ ແລະ Refresh button |
| `.backup-scroll-region` | ໃຊ້ `clamp()` ຄວບຄຸມຄວາມສູງ ແລະ internal scrolling |
| `.backup-data-table thead th` | ເຮັດ header ຂອງ table ເປັນ sticky |
| `@media (max-width: 900px)` | ປ່ຽນ overview ເປັນ 1 column ແລະປັບຄວາມສູງ scroll ສຳລັບຈໍນ້ອຍ |

## 5. Hospital-branded loading UI

### 5.1 `src/main.js`: shared helpers

#### Translation keys

- English: `loading.data`, `loading.wait` = `Loading data`.
- Lao: `loading.data`, `loading.wait` = `ກຳລັງໂຫລດຂໍ້ມູນ`.

#### `window.getHospitalDataLoaderHtml(options = {})`

ເປັນຟັງຊັນກາງສຳລັບສ້າງ loading component:

- ເລືອກໂລໂກ້ຈາກ `systemSettings.logoUrl`; ຖ້າ URL ບໍ່ຖືກຕ້ອງ ຫຼື image load ບໍ່ໄດ້ ຈະ fallback ໄປ `/luckxay-logo.jpg`.
- Escape URL/text ກ່ອນສ້າງ HTML.
- ຮອງຮັບ class `his-data-loader--compact` ແລະ `his-data-loader--inline`.
- ໃຊ້ `role="status"` ແລະ `aria-live="polite"` ສຳລັບ accessibility.
- ຕັ້ງໃຈໃຊ້ຂໍ້ຄວາມກາງພຽງອັນດຽວ; page-specific `options.message` ບໍ່ໄດ້ປ່ຽນຂໍ້ຄວາມທີ່ສະແດງ.

#### `window.getHospitalTableLoadingRow(colspan, message, options = {})`

ຫໍ່ shared loader ໃນ `<tr><td colspan="...">` ສຳລັບ table body. ມັນປ້ອງກັນ colspan ຕ່ຳກວ່າ 1 ແລະໃຊ້ `getHospitalDataLoaderHtml()` ເປັນຕົວ render ພາຍໃນ.

#### `window.getDataTableLanguage(overrides = {})`

ສ້າງ DataTables language object ຈາກ translation keys ສຳລັບ Search, pagination, empty/loading state ແລະຂໍ້ຄວາມຈຳນວນແຖວ. `overrides` ໃຫ້ແຕ່ລະ table ປ່ຽນສະເພາະຄ່າທີ່ຈຳເປັນ.

### 5.2 ຈຸດທີ່ JavaScript ນຳ loader ໄປໃຊ້

| Function/ພື້ນທີ່ | Target | ໜ້າທີ່ຂອງ loader |
|---|---|---|
| `renderEMRLabPicker()` | EMR lab picker | ລໍຖ້າລາຍການກວດ |
| `fetchDashboardData()` | Dashboard KPI cards | ລໍຖ້າຄ່າສະຫຼຸບ |
| `exportDashboardPDF()` | Dashboard PDF | ລໍຖ້າ loader ຫາຍກ່ອນ capture; ໃຊ້ cached KPI ເມື່ອຈຳເປັນ |
| `fetchReportData()` | `#reportTable` | table-loading row 9 columns |
| `fetchVisitHistoryData()` | `#visitHistoryTable` | table-loading row 10 columns |
| `initPatientTable()` | Registration DataTable | processing overlay ກາງຈໍ |
| `loadTriageQueue()` | `#triageTableBody` | table-loading row ກ່ອນດຶງ Triage |
| `loadObservationPage()` | Observation table/bed board | loader ສຳລັບ table ແລະ board |
| `loadQueue()` | OPD queue | table-loading row 11 columns |
| `printIPDCoverFromPatientId()` | SweetAlert | loader ກ່ອນກຽມ IPD cover |
| `loadAppointments()` | Appointment table | table-loading row 8 columns |
| `loadVaccineMaster()` | Vaccine master | table-loading row 6 columns |
| `loadPatientVaccines()` | Patient vaccine history | table-loading row 9 columns |
| `loadDrugsMaster()` | Drug master | table-loading row 4 columns |
| `loadLabsMaster()` | Lab master | table-loading row 6 columns |
| `loadUsers()` | User table | table-loading row 6 columns |
| `loadOrgs()` | Organization table | table-loading row 8 columns |
| `loadLocationsMasterView()` | Location table | table-loading row 4 columns |
| `loadServicesMasterView()` | Service table | table-loading row 5 columns |
| `loadActivityLog()` | Activity Log | table-loading row 5 columns |
| `initPublicQueueView()` | OPD/Triage public queue lists | compact loader ສອງຝັ່ງ |
| `showPatientTimeline()` | `#timelineContent` | loader ກ່ອນລວບລວມ timeline |
| Backup loaders | 3 backup panes | table-loading row ຕາມ source |
| `loadIpdWardBedManagement()` | IPD bed board | loader ກ່ອນ render ward/room/bed |
| `loadIpdDashboard()` | IPD summary panels | compact loader |
| `loadIpdConfigPage()` | Ward/Room/Bed tables | table-loading rows 5/6/9 columns |
| `loadIpdInpatientListPage()` | IPD inpatient list | table-loading row 14 columns |
| `loadIpdDischargePage()` | discharge panels | compact loader |
| `loadIpdClinicalChart()` | clinical chart summary | compact loader |
| `opdTestRenderLisResults()` | OPD doctor LIS result list | loader ກ່ອນດຶງ result files |
| `opdTestOpenMedicationPicker()` | medication catalog | compact loader |

### 5.3 Static HTML ທີ່ປ່ຽນ

| ໄຟລ໌ | ຈຸດທີ່ປ່ຽນ |
|---|---|
| `index.html` | `#loading` ປ່ຽນຈາກ Bootstrap spinner ເປັນ hospital logo loader |
| `public/partials/modals/emr-modals.html` | `#labCheckboxContainer` ໃຊ້ compact loader |
| `public/partials/modals/patient-timeline-modal.html` | `#timelineContent` ເລີ່ມດ້ວຍ hospital loader |
| `public/partials/views/activity_log.html` | initial tbody ໃຊ້ table-loading row |
| `public/partials/views/backup.html` | latest status ແລະ Supabase file list ໃຊ້ shared visual pattern |

### 5.4 `src/style.css`

| Selector | ໜ້າທີ່ |
|---|---|
| `.his-data-loader` | card ກາງ, alignment, border, shadow ແລະສີ |
| `.his-data-loader__logo-shell` | ສ້າງວົງກົມຮອບໂລໂກ້ |
| `.his-data-loader__logo-shell::after` | ສ້າງ animated ring ດ້ວຍ border |
| `.his-data-loader__logo` | ຄວບຄຸມຮູບໂລໂກ້ໃຫ້ຢູ່ກາງວົງ |
| `.his-data-loader__copy` | ຈັດ loading text ໃຫ້ຢູ່ກາງ |
| `.his-data-loader--compact`, `.his-data-loader--inline` | variant ສຳລັບ modal, card ແລະ table |
| `.his-data-loader-cell` | padding/background ຂອງ loader ພາຍໃນ table |
| `.his-system-loader` | ຄວບຄຸມ width ຂອງ loader ຕອນ bootstrap app |
| `@keyframes his-loader-ring` | ໝຸນວົງຮອບໂລໂກ້ |
| `prefers-reduced-motion` | ຫຼຸດຄວາມໄວ animation ສຳລັບ user ທີ່ຕັ້ງ reduced motion |

## 6. Clinical notifications

### 6.1 Global notification host

#### `index.html`

ເພີ່ມ `#opdToastContainer` ໄວ້ທີ່ app shell ນອກ `#partial-views`. ເຫດຜົນຄື partial view ຈະຖືກເຊື່ອງ/ປ່ຽນເມື່ອ navigation; notification host ຕ້ອງຢູ່ຕະຫຼອດເພື່ອໃຫ້ toast ສະແດງໄດ້ທຸກໜ້າ.

#### `public/partials/views/opd.html`

ລຶບ `#opdToastContainer` ອອກຈາກ OPD partial ເພື່ອບໍ່ໃຫ້ DOM ມີ ID ຊ້ຳ ແລະບໍ່ໃຫ້ toast ຫາຍເມື່ອ OPD view ຖືກເຊື່ອງ.

### 6.2 Shared timer state ໃນ `src/main.js`

| Constant/Map | ໜ້າທີ່ |
|---|---|
| `OPD_TOAST_AUTO_DISMISS_MS` | ອາຍຸຂອງ room-arrival toast = 10 ນາທີ |
| `LIS_RESULT_TOAST_AUTO_DISMISS_MS` | ອາຍຸຂອງ LIS result toast = 10 ນາທີ |
| `opdToastDismissTimers` | ເກັບ timer ID ຕາມ OPD toast ID |
| `lisResultToastDismissTimers` | ເກັບ timer ID ຕາມ LIS result file ID |

ການເກັບ timer ID ເຮັດໃຫ້ການປິດ toast ດ້ວຍມື ຫຼື logout/teardown ສາມາດ `clearTimeout()` ໄດ້ ແລະບໍ່ເຫຼືອ timer ເກົ່າ.

### 6.3 `window.getGlobalClinicalToastContainer()`

- ຊອກຫາ `#opdToastContainer`.
- ຖ້າບໍ່ມີ ຈະສ້າງໃໝ່ ແລະໃສ່ `aria-live="polite"`.
- ຖ້າ container ຖືກ cache ຢູ່ໃນ partial ເກົ່າ ຈະ re-parent ໄປ `document.body`.
- ທັງ OPD room toast ແລະ LIS result toast ເອີ້ນ helper ນີ້, ຈຶ່ງໃຊ້ host ດຽວກັນ.

### 6.4 OPD room-arrival notification

#### `window.showOpdQueueToast(patientName, department, visitId)`

- ສ້າງ toast ສຳລັບຄົນເຈັບໃໝ່ໃນຫ້ອງກວດ.
- ເພີ່ມ class `.opd-room-arrival-toast` ເພື່ອໃຫ້ teardown ລຶບສະເພາະ toast ປະເພດນີ້.
- De-duplicate ຕາມ visit ID.
- ຕັ້ງ timer 10 ນາທີ ແລະເກັບໄວ້ໃນ `opdToastDismissTimers`.

#### `window.dismissOpdToast(toastId)`

- ຊອກ timer ຂອງ toast.
- `clearTimeout()` ແລະລຶບ timer ອອກຈາກ Map.
- ລຶບ toast element ອອກຈາກ DOM.

#### `window.teardownOpdQueueRealtime()`

ນອກຈາກປິດ realtime/polling ແບບເກົ່າແລ້ວ ຍັງ clear timer ທັງໝົດ ແລະລຶບ `.opd-room-arrival-toast` ເມື່ອ logout ຫຼື setup ໃໝ່.

### 6.5 LIS completed-result notification

#### `window.isLisResultNotificationRecipient()`

ກຳນົດຜູ້ຮັບແຈ້ງເຕືອນ: admin, doctor, nurse ແລະຊື່ role ພາສາລາວທີ່ກົງກັນ. Local OPD preview ຖືກອະນຸຍາດເພື່ອການທົດສອບ.

#### `window.formatLisResultReadyTime(value)`

ປ່ຽນ timestamp ເປັນເວລາ 24 ຊົ່ວໂມງ `HH:mm`. ຖ້າຄ່າບໍ່ຖືກຕ້ອງຈະສົ່ງ `—`.

#### `window.normalizeLisResultNotification(file, orderOverride)`

ລວມ result-file row ແລະ LIS order row ໃຫ້ເປັນ notification object ຮູບແບບດຽວ:

- `fileId`, `orderId`, `patientId`, `patientName`.
- doctor, department, test name ແລະ file name.
- `uploadedAt`, `readyAt`, storage path ແລະ public URL.
- severity: `critical`, `abnormal` ຫຼື `normal` ຕາມ metadata ທີ່ມີຢູ່.

ສ່ວນ severity ນີ້ເປັນການ normalize metadata ທີ່ source ສົ່ງມາ; ມັນບໍ່ແມ່ນ OCR critical-value engine.

#### `window.showLisResultToast(alert)`

- ໃຊ້ global toast container.
- De-duplicate ຕາມ result file ID.
- ສະແດງ HN, ຊື່ຄົນເຈັບ ແລະເວລາທີ່ຜົນພ້ອມ.
- ກົດ toast ເພື່ອເປີດ report URL.
- ປຸ່ມ × ປິດ toast ໂດຍບໍ່ເປີດ report.
- ຕັ້ງ timer ໃຫ້ຫາຍຫຼັງ 10 ນາທີ.

#### `window.dismissLisResultNotification(fileId)`

Clear timer ແລະລຶບ toast ທີ່ມີ `data-lis-file-id` ກົງກັນ. ການ dismiss ສະເພາະ toast ບໍ່ເທົ່າກັບການບັນທຶກ acknowledgement.

#### `window.acknowledgeLisResultNotification(fileId)`

ບັນທຶກການຮັບຊາບເຂົ້າ `Result_Acknowledgments`, ລຶບ alert ອອກຈາກ active list ແລະ refresh bell alerts. ຖ້າ database write ບໍ່ສຳເລັດ ລະບົບຈະບໍ່ຊ່ອນ result ເພື່ອຄວາມປອດໄພ.

#### `window.showLisResultDesktopNotification(alert)`

ໃຊ້ Browser Notification API. ສະແດງ HN, ຊື່ ແລະເວລາພ້ອມ; ກົດ desktop notification ເພື່ອເປີດ report. Desktop notification ປິດອັດຕະໂນມັດຫຼັງ 12 ວິນາທີ.

#### `window.enrichLisResultFiles(files)`

ແກ້ບັນຫາ 1 order ມີຫຼາຍ test rows:

1. ຮວບຮວມ order IDs ຈາກ result files.
2. ແບ່ງເປັນ batch ລະ 50 IDs.
3. ດຶງ `lis_one_test_orders` ສູງສຸດ 1,000 rows ຕໍ່ batch.
4. ສ້າງ Map ຕາມ order ID.
5. ຕໍ່ patient/order metadata ເຂົ້າ result file ກ່ອນສ້າງ notification.

ຖ້າຈຳກັດ query ເທົ່າກັບຈຳນວນ order IDs, order ທີ່ມີຫຼາຍ test rows ອາດຕັດ patient metadata ຂອງ result ບາງອັນອອກ. Batch logic ນີ້ປ້ອງກັນບັນຫາດັ່ງກ່າວ.

#### Setup/poll/teardown flow

- `seedLisResultNotifications()` ດຶງ result ຫຼ້າສຸດ, load acknowledgement state ແລະສ້າງ active alerts.
- `pollLisResultNotifications()` ກວດຫາ files ໃໝ່ໂດຍບໍ່ຮັນຊ້ອນກັນ.
- `setupLisResultNotifications()` ຂໍ browser permission, seed ຂໍ້ມູນ ແລະ poll ທຸກ 30 ວິນາທີ.
- `teardownLisResultNotifications()` ປິດ interval, clear state/timers ແລະລຶບ LIS toasts.

### 6.6 Bell alert rendering

`window.checkAlerts()` ປັບ LIS item ໃນ bell dropdown ໃຫ້ສະແດງ HN, ຊື່ຄົນເຈັບ ແລະເວລາພ້ອມແບບກະຊັບ. ລາຍການໃນ bell ແລະ floating toast ໃຊ້ alert data source ດຽວກັນ.

### 6.7 `src/style.css`

| Selector | ໜ້າທີ່ |
|---|---|
| `.opd-toast.opd-lis-result-toast` | ສີຂຽວສຳລັບ LIS result ທົ່ວໄປ |
| `.opd-lis-result-toast.is-critical` | ສີແດງສຳລັບ metadata ທີ່ຖືກ normalize ເປັນ critical |
| `.opd-lis-toast-ready` | style ຂອງເວລາທີ່ຜົນພ້ອມ |
| `.opd-toast-container` mobile rule | ໃຫ້ toast ເຕັມຄວາມກວ້າງໃນຈໍນ້ອຍ |
| `opdToastSlideIn`, `opdToastPulse` | animation ເຂົ້າຈໍ ແລະເນັ້ນ icon |

## 7. Triage action-row UI

### 7.1 `public/partials/views/triage.html`

ເພີ່ມ class `.triage-action-column` ໃຫ້ header “ຈັດການ”. Class ນີ້ຈັບຄູ່ກັບ `.triage-action-cell` ໃນ tbody ເພື່ອຈອງຄວາມກວ້າງຄົງທີ່ໃຫ້ປຸ່ມ.

### 7.2 `src/main.js`: `window.loadTriageQueue()`

ປຸ່ມຂອງແຕ່ລະແຖວຖືກຈັດເປັນ action rail:

- ທຸກປຸ່ມໄດ້ class `.triage-action-btn`.
- ປຸ່ມທີ່ມີແຕ່ icon ໄດ້ class `.triage-action-btn--icon`.
- View ໃຊ້ `.triage-action-btn--view`.
- Measure/clinical action ໃຊ້ `.triage-action-btn--clinical`.
- ລຶບ Bootstrap margin `me-1` ຈາກແຕ່ລະປຸ່ມ; spacing ຄວບຄຸມຈາກ container ຈຸດດຽວ.
- Action cell ໃຊ້ `<div class="triage-actions" role="group" aria-label="...">` ເພື່ອ accessibility.
- `aria-label` ມີຊື່ຄົນເຈັບເພື່ອໃຫ້ screen reader ຮູ້ວ່າປຸ່ມກຸ່ມນັ້ນເປັນຂອງໃຜ.

ປຸ່ມທີ່ຄອບຄຸມມີ View, Measure/Edit, Call, Timeline, Delete, Print OPD ແລະ Print Sticker ຕາມ permission ຂອງ user.

### 7.3 `src/style.css`

| Selector | ໜ້າທີ່ |
|---|---|
| `.triage-action-column`, `.triage-action-cell` | ຈອງຄວາມກວ້າງຂັ້ນຕ່ຳ 352px ແລະບໍ່ wrap text |
| `#triageTable tbody > tr > td` | ຫຼຸດ vertical padding ເພື່ອໃຫ້ table ກະຊັບ |
| `.triage-actions` | `inline-flex`, `nowrap`, ຈັດກາງ ແລະ gap 4px |
| `.triage-action-btn` | ຂະໜາດສູງ 34px, minimum width 34px ແລະລຶບ margin ລາຍປຸ່ມ |
| `.triage-action-btn--icon` | ກຳນົດ icon button ເປັນ 34 × 34px |
| `.triage-action-btn--view` | minimum width 76px |
| `.triage-action-btn--clinical` | minimum width 78px |
| `.patient-history-count` ພາຍໃນ action rail | ປັບຕຳແໜ່ງ badge ຈຳນວນປະຫວັດ |
| responsive rule ຕ່ຳກວ່າ 1200px | ເປີດ horizontal scrolling ແທນການບີບປຸ່ມຫຼືໃຫ້ປຸ່ມຂຶ້ນແຖວໃໝ່ |

## 8. Test scripts ແລະ `package.json`

`package.json` ເພີ່ມ 4 commands:

| Command | Test file | ກວດຫຍັງ |
|---|---|---|
| `npm run test:registration-ui` | `scripts/test-registration-backup-ui.mjs` | server-side patient table, pagination/range, visit count ສະເພາະ visible rows, Backup tabs ແລະ internal scroll |
| `npm run test:loading-ui` | `scripts/test-hospital-loading-ui.mjs` | shared loader helpers, logo, Lao/English text, static loader markup ແລະ CSS animation/accessibility |
| `npm run test:notifications` | `scripts/test-clinical-notifications.mjs` | global container, 10-minute timers, timer cleanup, admin recipient, LIS batching ແລະ notification rendering |
| `npm run test:triage-ui` | `scripts/test-triage-actions-ui.mjs` | action column/rail, button classes, 34px sizing, nowrap, compact rows ແລະ horizontal scrolling |

Test scripts ເຫຼົ່ານີ້ເປັນ static regression checks: ມັນອ່ານ source files ແລະກວດຫາ contract ທີ່ສຳຄັນ. ມັນບໍ່ແທນ browser end-to-end test ຫຼືການທົດສອບກັບ production Supabase/Cloudflare API.

## 9. ເອກະສານປະກອບ

| ໄຟລ໌ | ປະເພດ | ເນື້ອຫາ |
|---|---|---|
| `docs/REGISTRATION_BACKUP_LOCAL_OPTIMIZATION.md` | Implementation note | ເຫດຜົນ, behavior ແລະການກວດ Registration/Backup |
| `docs/HOSPITAL_BRANDED_LOADING_UI.md` | Implementation note | ມາດຕະຖານ loader ແລະຈຸດທີ່ນຳໄປໃຊ້ |
| `docs/CLINICAL_NOTIFICATION_FIXES.md` | Implementation note | Registration status message, OPD/LIS toast behavior ແລະ recipient rules |
| `docs/TRIAGE_ACTION_ROW_UI.md` | Implementation note | ຮູບແບບ action row ແລະ responsive behavior |
| `docs/DATA_LOADING_PERFORMANCE_AUDIT.md` | Read-only audit | ວິເຄາະ bootstrap, partial loading ແລະ data-loading cost ຂອງແຕ່ລະ view; ບໍ່ແມ່ນ implementation |
| `docs/LIS_CRITICAL_VALUE_FEASIBILITY.md` | Read-only feasibility study | ວິເຄາະ OCR, LIS schema, ຄວາມສ່ຽງ ແລະແນະນຳໃຫ້ມີ laboratory confirmation ກ່ອນ critical alert |
| `SYSTEM.md` | Project history | ເພີ່ມ local-only changelog ຂອງ Registration paging ແລະ Backup UI |

## 10. `eng.traineddata`

`eng.traineddata` ແມ່ນ English language model ຂອງ Tesseract OCR ຂະໜາດປະມານ 5 MB. ມັນຖືກນຳມາໃຊ້ໃນການທົດລອງ OCR ສຳລັບບົດວິເຄາະ LIS critical-value feasibility.

ສະຖານະປັດຈຸບັນ:

- ບໍ່ມີ production JavaScript ຫຼື Cloudflare Function ອ້າງອີງໄຟລ໌ນີ້.
- ບໍ່ແມ່ນສ່ວນຂອງ LIS notification implementation ປັດຈຸບັນ.
- ຄວນປ່ອຍໄວ້ນອກ commit ຫຼືຍ້າຍໄປ test/tooling storage, ນອກຈາກຈະມີແຜນໃຊ້ Tesseract ໃນ repository ໂດຍກົງ.

## 11. File-by-file inventory

### 11.1 Tracked files ທີ່ຖືກແກ້

| ໄຟລ໌ | Feature ທີ່ກ່ຽວຂ້ອງ |
|---|---|
| `SYSTEM.md` | Registration/Backup local changelog |
| `index.html` | Hospital system loader ແລະ global clinical toast host |
| `package.json` | 4 test commands |
| `public/partials/modals/emr-modals.html` | EMR lab picker loader |
| `public/partials/modals/patient-timeline-modal.html` | Timeline loader |
| `public/partials/views/activity_log.html` | Activity Log table loader |
| `public/partials/views/backup.html` | Compact tabbed Backup workspace |
| `public/partials/views/opd.html` | ລຶບ local toast container ທີ່ຊ້ຳກັບ global host |
| `public/partials/views/triage.html` | Action-column class |
| `src/main.js` | Registration queries, loader helpers/call sites, notifications, Backup tabs ແລະ Triage action markup |
| `src/style.css` | Registration processing, Backup layout, loader component, notifications ແລະ Triage action rail |

### 11.2 Untracked files

| ໄຟລ໌ | ໜ້າທີ່ |
|---|---|
| `docs/CLINICAL_NOTIFICATION_FIXES.md` | ອະທິບາຍ notification changes |
| `docs/DATA_LOADING_PERFORMANCE_AUDIT.md` | data-loading audit |
| `docs/HOSPITAL_BRANDED_LOADING_UI.md` | ອະທິບາຍ shared loader |
| `docs/LIS_CRITICAL_VALUE_FEASIBILITY.md` | OCR/LIS feasibility study |
| `docs/REGISTRATION_BACKUP_LOCAL_OPTIMIZATION.md` | ອະທິບາຍ Registration ແລະ Backup changes |
| `docs/TRIAGE_ACTION_ROW_UI.md` | ອະທິບາຍ Triage action rail |
| `scripts/test-clinical-notifications.mjs` | notification regression checks |
| `scripts/test-hospital-loading-ui.mjs` | loader regression checks |
| `scripts/test-registration-backup-ui.mjs` | Registration/Backup regression checks |
| `scripts/test-triage-actions-ui.mjs` | Triage action regression checks |
| `eng.traineddata` | OCR test dependency; ບໍ່ຖືກອ້າງອີງໂດຍ production code |
| `docs/LOCAL_CHANGES_RELEASE_GUIDE.md` | ເອກະສານສະບັບນີ້ |

## 12. ຂໍ້ຄວນລະວັງກ່ອນ commit

1. `src/main.js`, `src/style.css` ແລະ `index.html` ມີຫຼາຍ feature ຢູ່ໃນໄຟລ໌ດຽວ. ຖ້າຕ້ອງການ commit ແຍກຕາມ feature ຕ້ອງ stage ເປັນ hunk, ບໍ່ຄວນ `git add` ທັງໄຟລ໌ແບບບໍ່ກວດ diff.
2. `eng.traineddata` ບໍ່ຄວນເຂົ້າ production commit ໂດຍອັດຕະໂນມັດ.
3. `DATA_LOADING_PERFORMANCE_AUDIT.md` ແລະ `LIS_CRITICAL_VALUE_FEASIBILITY.md` ເປັນບົດວິເຄາະ; ຢ່າອ່ານວ່າຂໍ້ສະເໜີທັງໝົດໄດ້ implement ແລ້ວ.
4. Static test scripts ຄວນຮັນຄູ່ກັບ `npm run build`; ສຳລັບ Backup API ຄວນທົດສອບໃນ Cloudflare Pages environment ຫຼື `npm run pages:dev`.
5. Notification ກ່ຽວຂ້ອງກັບ clinical workflow. ກ່ອນ deploy ຄວນທົດສອບດ້ວຍ admin, doctor ແລະ nurse account ພ້ອມກວດ acknowledgement persistence.

## 13. ຄຳສັ່ງກວດສອບ

```bash
npm run test:registration-ui
npm run test:loading-ui
npm run test:notifications
npm run test:triage-ui
npm run build
```

ສຳລັບ Backup API integration:

```bash
npm run build
npm run pages:dev
```

ຫຼັງຈາກນັ້ນໃຫ້ກວດດ້ວຍ admin account ວ່າ Supabase, Google Drive, History, Backup Now ແລະ Restore flow ສະແດງຜົນຖືກຕ້ອງ.
