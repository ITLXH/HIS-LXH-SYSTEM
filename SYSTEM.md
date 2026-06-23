# Luckxay Hospital HIS — System Reference

Single-source reference for the whole codebase. Read this BEFORE diving into `src/main.js` (12k lines) to save round-trips.

---

## 1. Stack

- **Frontend**: Vite + vanilla JS (jQuery + Bootstrap 5 + SweetAlert2 + Chart.js + DataTables)
- **Backend**: Supabase (PostgREST + RLS)
- **Auth**: Custom `HIS_One_Users` table (NOT Supabase Auth)
- **Hosting**: Cloudflare Pages (built `dist/`)
- **Languages**: Lao (default) + English i18n
- **Dev**: `npm run dev` on port 5176

## 2. File Map

```
index.html                          # SPA shell, loads main.js
src/main.js                         # ~12k lines — ALL logic
src/style.css                       # All styles
public/partials/navbar.html         # Top nav with role-based show/hide
public/partials/views/*.html        # Per-view templates (loaded by name)
public/partials/modals/             # Modal templates
public/partials/print-areas.html    # Print templates
supabase/migrations/*.sql           # Schema migrations (timestamp prefix)
supabase/restore_chunks/            # One-time data restore SQL (ignore)
.claude/launch.json                 # Preview server config
```

### Views (the only `loadView()` targets)

```
dashboard, report, visit_history, patients, triage, opd,
appointments, vaccines, vaccine_master, drugs, labs,
ipd_ward_bed, ipd_inpatient_list, ipd_chart, ipd_config,
services, locations, users, orgs, settings,
activity_log, backup, public-queue
```

Removed (do not reference): `ipd_dashboard`, `ipd_discharge`.

## 3. Database Schema (Supabase)

All tables prefixed `HIS_One_`. Use `dbTable('Name')` in JS.

### Core
| Table | PK | Notes |
|---|---|---|
| `HIS_One_Users` | `ID` (auto) | Login. Roles: `admin/doctor/nurse/lab/pharmacy/reception/cashier/staff` |
| `HIS_One_Patients` | `Patient_ID` (TEXT) | Format `LXH<YYYY>-<6digits>`, e.g. `LXH2026-002256` |
| `HIS_One_Visits` | `Visit_ID` | OPD visits |
| `HIS_One_OPD_Vital_Signs` | `Vital_ID` | Linked by `Visit_ID` + `Patient_ID` |
| `HIS_One_Appointments` | `Appt_ID` | |
| `HIS_One_Patient_Vaccines` | `Record_ID` | |
| `HIS_One_Organizations` | `Org_ID` | |
| `HIS_One_Vaccines_Master` | `Vac_ID` | |
| `HIS_One_Drugs_Master` | `Drug_ID` | |
| `HIS_One_Labs_Master` | `Lab_ID` | |
| `HIS_One_Service_Lists` | `ID` | |
| `HIS_One_Locations` | `ID` | District/Province lookup |
| `HIS_One_MasterData` | `ID` | Catch-all key/value (Category + Value) |
| `HIS_One_activity_logs` | auto | Audit trail |
| `HIS_One_Settings` | `Key` | Hospital name, logo, etc. |

### IPD Tables
| Table | PK | Linked by |
|---|---|---|
| `HIS_One_Admissions` | `Admission_ID` | `Patient_ID` |
| `HIS_One_Wards` | `Ward_ID` | |
| `HIS_One_Rooms` | `Room_ID` | `Ward_ID` |
| `HIS_One_Beds` | `Bed_ID` | `Ward_ID` + `Room_ID` |
| `HIS_One_Bed_Movements` | `Movement_ID` | `IPD_Admission_ID` |
| `HIS_One_IPD_Doctor_Notes` | `Note_ID` | `Admission_ID` |
| `HIS_One_IPD_Nursing_Notes` | `Note_ID` | `Admission_ID` |
| `HIS_One_IPD_Vital_Signs` | `Vital_ID` | `Admission_ID` |
| `HIS_One_IPD_Medication_Orders` | `Order_ID` | `Admission_ID` (legacy, hidden in UI) |
| `HIS_One_IPD_Radiology_Orders` | `Radiology_ID` | `Admission_ID` (legacy, hidden in UI) |
| `HIS_One_IPD_Procedures` | `Procedure_ID` | `Admission_ID` (legacy, hidden in UI) |
| `HIS_One_IPD_Billing_Items` | `Billing_ID` | `Admission_ID` (legacy, hidden in UI) |
| `HIS_One_IPD_Discharge_Summaries` | `Summary_ID` | `Admission_ID` |
| `HIS_One_IPD_Visits` | `Visit_ID` | `Admission_ID` (rounds, hidden in UI) |

### IPD Tables — Provider Tracking (added migration `20260620140000`)
All clinical IPD tables have:
- `Visit_ID` TEXT (link to round, optional now)
- `Provider_ID` TEXT (Users.ID)
- `Provider_Role` TEXT (`doctor`/`nurse`)

### Doctor Notes — Extra Fields (migration `20260620150000`)
- `Visit_Type` (Initial / Daily Round / Follow-up / Emergency)
- `Diagnosis`
- `Chief_Complaint`
- `Subjective`, `Objective`, `Assessment`, `Plan` (SOAP)

### Nursing Notes — Extra Fields (`20260620150000`)
- `Shift` (Morning/Evening/Night)
- `Patient_Condition`, `Observation`, `Nursing_Care_Given`
- `Response_To_Treatment`, `Intake`, `Output`, `Pain_Score`
- `Fall_Risk` (Low/Moderate/High)
- `Allergy_Alert`, `Medication_Given`, `Procedure_Done`
- `Notes` (free text)

### Admissions — Extra Fields (`20260621120000`)
- `Admitting_Nurse` TEXT (assistant nurse name, captured at quick admit)

### Vital Signs — Extra Fields (`20260620150000`)
- Standard: `Temperature`, `BP_Systolic`, `BP_Diastolic`, `Pulse`, `Respiration`, `SpO2`, `Weight`, `Height`, `BMI`, `Pain_Score`
- New: `Consciousness` (Alert/Verbal/Pain/Unresponsive/Drowsy/Confused)

## 4. Auth & Permissions

- Login: custom check against `HIS_One_Users.Email + Password` (no Supabase Auth)
- After login: `currentUser` global with `id, name, role, permissions, buttonPermissions`
- Role-based UI: navbar items have `.mnu-<view>` classes hidden then shown by perm
- `canUserAccessView(view, perms)` checks visibility
- `window.can(view, action)` checks button perms (view/edit/delete/etc.)

## 5. Modules & Key Functions

All entry points are `window.*` functions in `src/main.js`.

### Patients
- `loadPatients()`, `initPatientTable()`
- `editPatient(id)`, `viewPatientDetail(id)`, `delPatient(id)`
- `generateNextPatientID()` → returns `LXH<YYYY>-<6digit>`
- `handlePatientExcelUpload(e)` — Excel import using upsert (line 8027). On conflict by `Patient_ID`, updates existing.
- `normalizePatientCode(value)` — trim + uppercase

### OPD / Visits
- `loadQueue()`, `handleVisitEdit()`, `viewVisitDetail()`
- Visits + Vitals saved together
- LIS/Labs are JSON in `Visits.Lab_Orders_JSON`, prescriptions in `Prescription_JSON`

### Appointments
- `loadAppointments()`, `saveAppointment()`, `deleteAppointment()`
- Status flow: pending → Completed / Missed / Cancelled

### Vaccines
- Master: `loadVaccineMaster()`, `saveVaccine()`, `deleteVaccine()`
- Patient: `loadPatientVaccines()`, `addPatientVaccine()`, `deletePatientVaccine()`

### Drugs / Labs / Services / Locations / Orgs
- All follow same pattern: `load<X>Master()` + Add/Edit/Delete

### Users (Settings → Users)
- `loadUsers()`, `openAddUserModal()`, `openEditUserModal()`, `deleteUserRow()`
- Per-role default permissions set in `togglePermissionsBox()`

### MasterData
- Generic key/value store, used for lab categories, dropdown options
- `Category` + `Value` columns
- Helpers: insert/update/delete in settings flow

## 6. IPD Module (post-simplification)

### Navigation (2 items only)
1. **Ward / Bed Management** (`ipd_ward_bed`) — DEFAULT landing. Bed board grid. Top toolbar has the green **Admit Patient** button → `openIpdQuickAdmitModal()` (admit no longer has its own page).
2. **Inpatient List** (`ipd_inpatient_list`) — Flat table for search/print. Tabs: Active / Discharged / All (state in `window.ipdInpatientFilter`, default `'active'`). Discharged rows show "View History" only (no transfer/discharge buttons) and open the chart in read-only mode.

`ipd_chart` is a sub-view opened from the bed board (not in nav menu).

### IPD Chart — Single Timeline View
File: `public/partials/views/ipd_chart.html` (~25 lines).
- Header: subtitle (`IPD<id> · HN<id> · <patient name>`) + 6 action buttons:
  - 🔵 **ເພີ່ມການກວດຂອງໝໍ** (`openIpdDoctorNoteModal()`)
  - 🟢 **ເພີ່ມບັນທຶກພະຍາບານ** (`openIpdNursingNoteModal()`)
  - 🔴 **ເພີ່ມສັນຍານຊີບ** (`openIpdVitalModal()`)
  - 🟡 **Edit Discharge** (`openIpdDischargeSummaryModal()`)
  - **Print Discharge** (`printIpdDischargeSummary()`)
  - **Back to Ward Board** (`loadView('ipd_ward_bed')`)
- Filter pills: All / Doctor / Nursing / Vitals / Linked OPD
- Timeline EMR-style: date headers (Sat 20 Jun 2026 · N events), each row = time + icon + type badge + provider + body + CRUD buttons

### State
```js
window.ipdClinicalState = {
  admissionId, admission,
  visits: [],            // OPD visits (read-only context)
  doctorNotes: [],
  nursingNotes: [],
  vitals: [],
  medicationOrders: [],  // legacy, no UI
  radiology: [],         // legacy, no UI
  procedures: [],        // legacy, no UI
  billing: [],           // legacy, no UI
  dischargeSummary: null,
  rounds: [],            // legacy IPD_Visits, no UI
  providers: [],         // doctor/nurse cache
  movements: [],
  timelineFilter: 'all',
  timelineLimit: 200
};
window.ipdCurrentChartAdmissionId  // current open chart
window.ipdCurrentChartReadOnly     // true when viewing a discharged admission (history)
window.ipdInpatientFilter          // 'active' | 'discharged' | 'all' (Inpatient List tabs)
window.ipdActiveVisitId            // legacy, no UI
window.ipdProvidersCache           // [{id, name, role}, ...]
```

### Key IPD Functions
- `loadIpdClinicalChart(admissionId)` — fetch all + render
- `renderIpdChartPage(id)` — just subtitle + timeline
- `renderIpdTimeline()` — EMR-style grouped by date
- `buildIpdTimelineEvents()` — collects events from doctorNotes/nursingNotes/vitals/visits(OPD)/movements/discharge
- `ipdTimelineEvent({at, type, filter, title, body, meta, icon, id, entityType, provider, providerRole, readOnly})`
- `ipdTimelineEntityActions` map — `entityType` → `{open, table, idCol}` for CRUD wiring
- `ipdLoadProviders()` — cache doctor/nurse users
- `ipdProviderOptions(selectedId, roleFilter)` — `<option>` HTML
- `ipdCurrentProviderDefault()` — returns logged-in user as provider
- `ipdUpsertClinical(table, idCol, payload, existingId)` — generic upsert + refresh
- `ipdDeleteClinical(table, idCol, id)` — confirm + delete + refresh
- `ipdSelectClinical(table, admissionId, orderCol, asc)` — fetch
- `ipdNeedsMigration(error)` — checks `column does not exist` errors → returns []

### IPD Entry Modals
All accept optional `id` (= edit existing, else create). All write `Provider_ID`/`Provider_Role` + use translated values.

| Function | Roles allowed | Modal title |
|---|---|---|
| `openIpdDoctorNoteModal(noteId?)` | doctor | ການກວດຂອງໝໍ (SOAP) |
| `openIpdNursingNoteModal(noteId?)` | nurse | ບັນທຶກພະຍາບານ (ປະຈຳກະ) |
| `openIpdVitalModal(vitalId?)` | doctor + nurse | ບັນທຶກສັນຍານຊີບ |
| `openIpdDischargeSummaryModal()` | any | ສະຫຼຸບການຈຳໜ່າຍ |

## 7. i18n

- Stored in `window.appTranslations.{en,lo}` objects (multiple `Object.assign` blocks)
- Access: `window.t('key')` — returns current-language string or key if missing
- `window.ipdTranslateValue(value)` — looks up `option.<value>` keys for dropdown values
- Language switch: dropdown in navbar, persisted to localStorage
- Lao is default. Adding a key: append to BOTH `appTranslations.en` AND `appTranslations.lo` blocks.

## 8. Naming Conventions

- All custom helpers prefixed `window.ipd*` for IPD-related, `window.*` global
- Patient IDs: `LXH<YYYY>-<6digits>` (e.g. `LXH2026-002256`)
- IPD Admission IDs: `IPD<long unique>` (timestamp-based, generated by `ipdId('IPD')`)
- Other prefixes via `ipdId(prefix)`: `DN` (doctor note), `NN` (nursing), `VS` (vital), `MO` (med order), `RAD`, `PROC`, `BILL`, `DS`, `IPDV`
- All Supabase table refs go through `dbTable('Name')` (lets us swap prefix in dev)

## 9. Recent Migrations (chronological)

| Date | File | Purpose |
|---|---|---|
| 2026-06-16 | `20260616142931_remote_schema.sql` | Initial schema snapshot |
| 2026-06-18 | `20260618093000_ipd_ward_bed_management.sql` | Wards/Rooms/Beds/Admissions/Movements |
| 2026-06-19 | `20260619090000_ipd_clinical_chart.sql` | All IPD clinical tables (Doctor Notes, Vitals, Med, etc.) |
| 2026-06-19 | `20260619110000_ipd_bed_reservation_details.sql` | Reservation fields on beds |
| 2026-06-20 | `20260620130000_add_old_patient_id.sql` | `Old_Patient_ID` column |
| 2026-06-20 | `20260620140000_ipd_visits.sql` | `IPD_Visits` table + `Visit_ID/Provider_ID/Provider_Role` columns on all IPD action tables |
| 2026-06-20 | `20260620150000_ipd_simplify_emr.sql` | Doctor SOAP-Plus + Nursing rich fields + Vitals Consciousness |
| 2026-06-21 | `20260621120000_ipd_admitting_nurse.sql` | `Admitting_Nurse` TEXT column on `HIS_One_Admissions` (assistant nurse on quick admit) |

## 10. Ad-hoc SQL (in `supabase/` root)

- `fix_patient_id_padding.sql` — DO-block to renumber short Patient_IDs (e.g. `LXH2026-009` → next available 6-digit). Updates all 6 child tables in one transaction. Run after Excel imports that mixed short/long IDs.
- `insert_recovered_patients.sql` — INSERT for 21 patients lost when Excel had duplicate Patient_IDs.

## 11. Recent Behavioural Changes (cheat sheet)

| Date | What changed | Where |
|---|---|---|
| 2026-06-20 | Patients Excel upload: `insert` → `upsert(onConflict='Patient_ID')` + dedupe in JS + report counts | `handlePatientExcelUpload` |
| 2026-06-20 | Patient table sort: by ID desc using `data-order` numeric sort key | `initPatientTable` |
| 2026-06-20 | Patient ID generator: 4-digit no-dash → 6-digit with dash (`LXH2026-002256`) | `generateNextPatientID` |
| 2026-06-20 | IPD chart simplified: 12 tabs → 1 timeline | `ipd_chart.html` + `renderIpdChartPage` |
| 2026-06-20 | Patient header & snapshot bar removed from IPD chart (kept only subtitle) | `renderIpdChartPage` |
| 2026-06-20 | IPD nav: 5 items → 3 (removed Dashboard + Discharge views) | `navbar.html` |
| 2026-06-20 | Modal titles now include role icon + clear language ("ການກວດຂອງໝໍ", "ບັນທຶກພະຍາບານ") | 3 modals |
| 2026-06-21 | Inpatient List: filter tabs Active / Discharged / All + new Discharge Date column. Default = Active. Discharged rows show only "View History" action button. State: `window.ipdInpatientFilter` | `ipd_inpatient_list.html`, `renderIpdInpatientTable`, `loadIpdInpatientListPage`, `bindIpdInpatientFilterTabs`, `applyIpdInpatientFilterTabUi` |
| 2026-06-21 | `viewIpdChart()` no longer blocks discharged admissions. Sets `window.ipdCurrentChartReadOnly = true` and `renderIpdChartPage` injects `#ipdChartReadOnlyBanner` (alert-info banner) when read-only. | `viewIpdChart`, `renderIpdChartPage` |
| 2026-06-21 | Quick Admit modal rebuilt: patient search now rebuilds `<option>` list (was `.toggle()` which doesn't work on options); patient/doctor/nurse/bed all required with red `*` and preConfirm validation; doctor + assistant-nurse changed from text input to provider dropdowns via `ipdProviderOptions(_, ['doctor'])` / `['nurse']`. Nurse name saved to new `Admitting_Nurse` column. | `openIpdQuickAdmitModal`, `createIpdQuickAdmission` |
| 2026-06-21 | New i18n keys (en+lo): `ipd.filterActive/Discharged/All`, `ipd.viewHistory`, `ipd.historyChartReadOnly`, `ipd.noDischargedData`, `ipd.assistantNurse`, `ipd.doctorRequired`, `ipd.nurseRequired`, `ipd.bedRequired`, `ipd.searchHint` | `main.js` translations |
| 2026-06-21 | Ward/Bed Management page top-right toolbar: added green "Admit Patient" button → `openIpdQuickAdmitModal()` (was only on Admit Patient page) | `ipd_ward_bed.html` |
| 2026-06-21 | Quick Admit modal: merged "Search registered patient" text input + "Patient" `<select>` into ONE Select2-powered searchable combobox. Uses `dropdownParent: $(Swal.getPopup())` so the popup renders above SweetAlert. Custom `matcher` reads `data-search` blob (Patient_ID + Old_Patient_ID + first/last name) for substring match. | `openIpdQuickAdmitModal` |
| 2026-06-21 | Removed pricing field from Room modal & Rooms table (no billing yet). Deleted: `#ipdRoomCharge` input + `Daily_Charge` from preConfirm payload + `Daily_Charge` cell from `renderIpdRoomsTable`. i18n keys `ipd.chargePerDay`/`ipd.dailyCharge` kept for later. DB column `Daily_Charge` on `Rooms` remains untouched. | `openIpdRoomModal`, `renderIpdRoomsTable` |
| 2026-06-21 | **Removed `ipd_admit` view entirely** (admit now lives on Ward/Bed board's green button). Deleted: `public/partials/views/ipd_admit.html`, navbar item `nav-ipd_admit` + class `mnu-ipd_admit`, `loadIpdAdmitPage`/`renderIpdAdmitPage` functions, view name from both `views` arrays, route handler, visibility refresh block. `createIpdQuickAdmission` now refreshes via `loadIpdWardBedManagement()` instead. IPD nav: 2 items only. | `navbar.html`, `main.js` |
| 2026-06-21 | Ward/Bed board split into TWO segments: General Wards (top, blue gradient header) and VIP Rooms (bottom, gold gradient header with crown icon). VIP detection: `Ward_Type === 'VIP'` OR `Ward_Name` matches /vip/i. New CSS: `.ipd-board-segment`, `.ipd-board-segment-header`, `.ipd-board-segment-vip` (overrides ward header + group bg to gold). New i18n keys: `ipd.generalWardsTitle/Subtitle`, `ipd.vipWardsTitle/Subtitle`, `ipd.wardsCount`. | `renderIpdBedBoard`, `style.css` |
| 2026-06-21 | Added gold **"Add VIP Room"** toolbar button (👑 `fa-crown`) on Ward/Bed page → `openIpdVipRoomModal()`. Extends `openIpdRoomModal(roomId, opts)` with `opts.vipOnly` flag: filters Ward dropdown to VIP wards only, defaults Room_Type='Private', uses VIP title, applies `customClass.popup='ipd-vip-modal'` (gold accent). Editing a VIP room auto-enters VIP mode. Edit/Delete CRUD already present per room via `renderIpdBedBoard`. If no VIP ward exists, blocks with `ipd.noVipWard` warning. New i18n: `ipd.addVipRoom`, `ipd.editVipRoom`, `ipd.noVipWard(Text)`. New CSS: `.btn.ipd-vip-btn`, `.swal2-popup.ipd-vip-modal`. | `openIpdRoomModal`, `openIpdVipRoomModal`, `ipd_ward_bed.html`, `style.css` |
| 2026-06-21 | VIP Room modal: Ward dropdown HIDDEN from user — `Ward_ID` is auto-assigned silently from the first VIP ward (or the room's existing Ward_ID when editing). Switched the visible `<select id="ipdRoomWard">` to a `<input type="hidden">` carrying `autoVipWardId`. Non-VIP modal still shows the dropdown as before. | `openIpdRoomModal` |
| 2026-06-21 | **New view `ipd_config`** — IPD config page under the Settings dropdown (between vaccine_master and locations). Three Bootstrap tabs: Wards / Rooms / Beds, each backed by an existing `renderIpdWardsTable` / `renderIpdRoomsTable` / `renderIpdBedsTable` (previously orphaned). Toolbar reuses Add Ward / Add Room / Add VIP Room / Add Bed buttons. CRUD edit/delete buttons already present in each row's render. New: `loadIpdConfigPage`, nav-item `nav-ipd_config` + class `mnu-ipd_config`, view in both `views` arrays, route handler, i18n keys `ipd.configTitle/Subtitle`, `ipd.wardsTab`, `ipd.roomsTab`, `ipd.bedsTab`. | `ipd_config.html`, `navbar.html`, `main.js` |
| 2026-06-22 | Ward/Bed board page now CLINICAL-ONLY — removed all config CRUD: 4 toolbar add buttons (Add Ward / Add Room / Add VIP Room / Add Bed), ward-header edit/delete (`.ipd-ward-crud`), and room-title edit/delete (`.ipd-room-crud`). Only "Admit Patient" remains in the toolbar. All ward/room/bed CRUD now lives under Settings → IPD Config. Handler functions `deactivateIpdWard/Room` and `deleteIpdWard/Room` still exist (called from the config tables' Edit/Disable buttons). | `ipd_ward_bed.html`, `renderIpdBedBoard` |
| 2026-06-22 | Master Data page (`ຈັດການຂໍ້ມູນ Master`): added "Nurse" (`ລາຍຊື່ພະຍາບານ`) category alongside the existing Doctor category in the `clinical` group. Stored under `Category='Nurse'` in `HIS_One_MasterData`. Also added `<option value="Nurse">` to the hidden `<select id="masterCategory">` in `settings.html` — without it, `$.val('Nurse')` silently no-ops and the category panel stays empty. Generic CRUD (`addMaster`/`editMaster`/`delMaster`) just works. | `masterCategoryGroups` clinical group, `settings.html` |
| 2026-06-22 | **Login auto-sync to Master Data** — when a user with `Role=doctor` or `Role=nurse` logs in (or restores their session), the system automatically inserts their `Name` into `HIS_One_MasterData` with `Category='Doctor'`/`'Nurse'` if not already present. Idempotent (SELECT-then-INSERT, no duplicates). Failures are warn-logged, never block login. Two paths wired: post-password login (`currentUser = buildCurrentUserFromDbRow(user)`) and `restoreLoginSession`. Master Data list thus has TWO sources: manual entries via Settings UI + auto-synced login names. New helper: `window.syncCurrentUserToMasterData(user)`. | `syncCurrentUserToMasterData`, login + session-restore paths |
| 2026-06-23 | **Delete buttons on IPD Config tables**. Each row in Wards/Rooms/Beds tabs now has THREE action buttons: Edit (blue pencil), Disable (outline-secondary ban icon → Inactive status), Delete (red trash → hard delete via `deleteIpdWard`/`deleteIpdRoom`/`deleteIpdBed`). Delete functions already existed with guards: ward with rooms blocked, room with beds blocked, occupied/reserved bed blocked. Added `title` tooltips on every action button. New i18n key: `ipd.disable` (en: "Disable", lo: "ປິດໃຊ້ງານ"). Also fixed dangling `common.edit` reference → uses existing `ipd.edit`. | `renderIpdWardsTable`, `renderIpdRoomsTable`, `renderIpdBedsTable` |
| 2026-06-22 | **Add Bed modal — VIP visual cue (no separate button)**. Beds inherit VIP-ness from their parent Ward (`Ward_Type='VIP'` OR Ward_Name matches /vip/i) — no `Bed.Is_VIP` column. Decision: do NOT add a separate "Add VIP Bed" button (would be redundant). Instead: (1) Ward dropdown options for VIP wards get crown emoji prefix + `[VIP]` suffix, (2) `data-vip="1"` on those options, (3) `didOpen` watches Ward change and toggles `.ipd-vip-modal` class on the Swal popup → gold accent kicks in via existing CSS at `.swal2-popup.ipd-vip-modal`. Also extracted the inline `isVipWard` helper that was duplicated in 3 places into `window.ipdIsVipWard` (next to `ipdWardById`/`ipdRoomById`/`ipdBedById`); refactored the bed-board renderer and `openIpdRoomModal` to use it. | `openIpdBedModal`, `openIpdRoomModal`, bed-board renderer, `window.ipdIsVipWard` |
| 2026-06-22 | **IPD Config tab visibility & CRUD reliability fix**. Two issues on the new `ipd_config` view: (1) tabs showed multiple panes simultaneously (Bootstrap/AdminLTE 3 CSS conflict suspected), (2) tab clicks not reliably hiding the previous pane. Fix: defensive CSS `#view-ipd_config .tab-content > .tab-pane:not(.active) { display: none !important; }` + custom JS handler `bindIpdConfigTabs` that bypasses Bootstrap's tab JS — manual class toggle, manual `display` set, plus DataTables `columns.adjust()` after tab show (fixes column-width bugs from tables initialized inside hidden panes). Wired into `loadIpdConfigPage` after the 3 render calls. | `loadIpdConfigPage`, `bindIpdConfigTabs`, `style.css` |
| 2026-06-22 | **Login speed fix** — login was hanging ~15s after correct credentials. Root cause: `seedMasterDefaults` (called inside `initApp` with `await`) loops 11 categories and does a SELECT-then-maybe-INSERT *sequentially*. Even when all categories exist (the steady state on every login), that's 11 sequential Supabase round-trips blocking the UI. Fix: (1) parallelize the existence checks with `Promise.all` + use `select('ID', { head: true, count: 'exact' })` instead of fetching rows; (2) batch INSERTs in one round-trip for missing categories; (3) cache `localStorage.his_master_seeded_v1 = '1'` so subsequent logins skip the check entirely; (4) drop the `await` in `initApp` so seeding runs in background and never blocks login. Net effect: login round-trips reduced from 11+ sequential to 0 (cached after first login). | `seedMasterDefaults`, `initApp` |
| 2026-06-22 | **Cloudflare Pages login-hang diagnosis**. Production (`his.luckxayhospitallaos.com`) was serving the *unbuilt* root `index.html` (which references `/src/main.js`) instead of `dist/index.html` (which references `/assets/index-<hash>.js`). Symptom: clicking "ເຂົ້າສູ່ລະບົບ" did nothing because `window.doLogin` never got defined (the ES-module `/src/main.js` worked as a raw fetch but its `import`/`export` syntax wasn't compiled, so it crashed silently in production). Confirmed via `curl -I /src/main.js` returning 200 from production (should be 404). Fix: in Cloudflare Pages dashboard → Settings → Build configurations, set Build command = `npm run build`, Build output directory = `dist`, Node version 20+. After re-deploy: `/src/main.js` should 404 and `/assets/index-*.js` should serve with `Content-Type: application/javascript`. `dist/` is already in `.gitignore` — Cloudflare must run the build itself. | Cloudflare Pages dashboard (no code change) |
| 2026-06-22 | **Button permissions for IPD modules**. Added 2 new cards to the `buttonPermModal` in `users.html`: `ipd` (view/admit/transfer/discharge/chart_edit) and `ipd_config` (view/add/edit/delete). Wired through `saveButtonPermissions` (new `ipd:` + `ipd_config:` blocks), `resetToRoleDefaults` (all 8 roles get sensible defaults — admin: all-on; doctor: ipd full + ipd_config off; nurse: ipd full minus discharge; lab/pharmacy/staff: all-off; reception: view+admit only; cashier: view only), and `applyButtonPermissions` (7 new CSS hide selectors). Tagged real buttons with classes: `.btn-ipd-admit` on Admit toolbar + Assign/Reserve/Cancel-Reservation dropdown items; `.btn-ipd-transfer`/`.btn-ipd-discharge` on Occupied-bed dropdown; `.btn-ipd-chart-edit` on the 4 chart entry buttons; `.btn-ipd-config-add` on 4 add buttons in Settings → IPD Config; `.btn-ipd-config-edit`/`.btn-ipd-config-delete` on edit/disable buttons in Wards/Rooms/Beds tables + bed action dropdown items. Note: action-menu items pass `className` through `.replace('btn-outline-', 'text-')` then onto the button so multi-class strings like `'btn-outline-success btn-ipd-admit'` survive (only first token rewritten). | `users.html`, `applyButtonPermissions`, `saveButtonPermissions`, `resetToRoleDefaults`, `ipdBedActionItems`, `ipd_ward_bed.html`, `ipd_config.html`, `ipd_chart.html`, `renderIpd{Wards,Rooms,Beds}Table` |

## 12. Conventions When Editing

- **Don't add features beyond ask** — keep diffs tight
- **i18n every UI string** — never hardcode Lao/EN text
- **Use existing helpers**: `ipdEscape`, `ipdFormatDateTime`, `ipdFormDateTimeValue`, `ipdOptions`, `ipdTranslateValue`, `ipdId`, `ipdCalculateBmiValue`
- **CRUD pattern for IPD tables**: `ipdUpsertClinical` / `ipdDeleteClinical` / `ipdSelectClinical` (handles RLS errors + migration check)
- **Sweet Alert for modals** — large forms use `width: 900, html: ..., preConfirm: ...`
- **DataTable** — destroy before init: `if ($.fn.DataTable.isDataTable('#x')) $('#x').DataTable().destroy();`
- **DON'T touch `supabase/restore_chunks/`** — one-time data restore, ignore

## 13. Known Tech Debt / Hidden but Not Deleted

- `loadIpdDashboard()`, `loadIpdDischargePage()` — functions still defined in main.js but no view loads them (orphaned, safe to remove later)
- `renderIpdMedicationOrders`, `renderIpdRadiology`, `renderIpdProcedures`, `renderIpdBilling`, `renderIpdDoctorNotes`, `renderIpdNursingNotes`, `renderIpdVitals`, `renderIpdLabResults`, `renderIpdVisits`, `renderIpdClinicalSummary`, `renderIpdPatientHeader`, `renderIpdClinicalSnapshot` — still exist but `renderIpdChartPage` no longer calls them (only `renderIpdTimeline`)
- `IPD_Visits` / `IPD_Medication_Orders` / `IPD_Radiology_Orders` / `IPD_Procedures` / `IPD_Billing_Items` tables still in DB with data, no UI

## 14. Dev Workflow

```bash
npm run dev              # vite dev server on :5176
npm run build            # → dist/
npm run preview          # preview built dist
```

Supabase: project `pzyrowzghrcfpmhkreag.supabase.co`. Apply migrations via Supabase Dashboard SQL Editor or `supabase db push`.

## 15. Common Tasks Quick Recipes

**Add a field to an IPD entry modal**:
1. Migration: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
2. Add input to modal `html:` template
3. Add to `preConfirm` payload
4. Update `renderIpdTimeline` body if it should display
5. Add i18n key (en + lo)

**Add a new module page**:
1. `public/partials/views/<name>.html`
2. Add to `views` array in main.js (line ~2206 and ~2861)
3. Add nav item in `navbar.html` with `id="nav-<name>"` and parent `mnu-<name>` class
4. Add route handler `if (v === '<name>') window.load<Name>();` (line ~2906)
5. Write `window.load<Name>()` and CRUD modals
6. Add to permission gates if non-admin should see it

**Patient ID issues** (collision, format):
- Check `generateNextPatientID()` — pattern `^LXH<year>-?<digits>$`, pads to 6
- If existing short IDs exist: run `supabase/fix_patient_id_padding.sql`
- Excel imports use upsert — duplicates within Excel get last-write-wins

## 16. Things NOT to Change Without Asking

- Auth flow (custom users table, not Supabase Auth)
- Patient_ID format (used as FK across 6 tables)
- Table prefix (`HIS_One_`)
- The `dbTable()` wrapper
