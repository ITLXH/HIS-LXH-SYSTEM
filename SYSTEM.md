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
| 2026-06-23 | `20260623090000_opd_observations.sql` | `opd_observations` + `opd_observation_notes` tables + duration trigger |
| 2026-06-23 | `20260623120000_opd_observations_beds.sql` | `ward_id/room_id/bed_id` + `opd_active_observations_by_bed` view |
| 2026-06-24 | `20260624140000_opd_observation_notes_ipd_parity.sql` | IPD-style columns on `opd_observation_notes` (SOAP, shift, BMI, Consciousness, provider tracking) |

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
| 2026-06-24 | **EMR workflow + status pipeline + page rename**. Three coordinated changes: (1) **EMR Discharge Status** dropdown in `emr-modals.html` now has 6 outcomes — ລໍຖ້າຜົນແລັບ, ຮັບຢາກັບບ້ານ, ກວດສຳເລັດ/ກັບບ້ານ, **ສົ່ງເຂົ້າຕິດຕາມ OPD (ໃໝ່)**, **ສົ່ງເຂົ້ານອນ IPD (ໃໝ່)**, ສົ່ງຕໍ່. Emojis dropped from labels (user asked for less "AI-look"). `submitEMRForm` now fires side-effects: `OPD Observation` → `handleEmrSendToObservation()` auto-inserts into `opd_observations` + first doctor note; `Admit IPD` → `handleEmrSendToIpd()` auto-inserts into `HIS_One_Admissions`, copies latest vitals, navigates to Ward/Bed board for bed assignment. `resolveVisitStatusFromDischarge` extended with new mappings `OPD Observation` and `Admit IPD`. (2) **Status pipeline** stays 5-dot visually but the final dot is now context-coloured by `Discharge_Status` via new `resolvePipelineOutcome(visit)` — outcomes: ສຳເລັດ (green check), ຮັບຢາ (green pills), ຕິດຕາມ (amber notes-medical), IPD (red bed), ສົ່ງຕໍ່ (gray ambulance). `renderPipeline(stage, visit)` now accepts the visit row; report renderer updated to pass it. `getPatientStage` extended to map new statuses to stage 5. (3) **"ລາຍງານ" renamed to "ສະຖານະຄິວ"** — page title in `report.html` and navbar label both updated; route `/report` and view ID `report` unchanged (no bookmarks break). | `emr-modals.html`, `submitEMRForm`, `handleEmrSendToObservation`, `handleEmrSendToIpd`, `resolveVisitStatusFromDischarge`, `resolvePipelineOutcome`, `renderPipeline`, `getPatientStage`, `report.html`, `navbar.html` |
| 2026-06-23 | **Reverted navbar to the original flat layout** at user request ("ເອົາ Navbar ກັບມາເປັນແບບເກົ່າ"). The workflow-grouped OPD dropdown (5 items with step badges) was rolled back. Top-level bar now matches the production layout that shipped in `dfc73ac`: Dashboard · ລາຍງານ · ປະຫວັດການກວດ · ຄົນເຈັບ · ຊັກປະຫວັດ · ຫ້ອງກວດ · ວັກຊີນ · ນັດໝາຍ · ຈັດການ IPD ▼ · ຕັ້ງຄ່າ ▼. IPD dropdown label restored to "ຈັດການ IPD" (uses existing `nav.ipdManagement`). All the route plumbing (`HIS_NAV_ROUTES`, `HIS_PATH_ROUTES`, `resolveHisRouteTarget`) and the i18n keys are kept untouched, so `/opd/observation`, `/opd/queue`, `/opd/consultation`, `/ipd/dashboard`, `/ipd/admission`, `/ipd/bed-management`, `/ipd/inpatients`, `/ipd/discharge` all continue to resolve — useful for bookmarks, dashboard cards, and future re-introduction of the workflow grouping. OPD Observation page (`/opd/observation`) is still reachable from the action button on each OPD queue row and from the dashboard's "Observation Patients" KPI card. | `navbar.html` |
| 2026-06-23 | **OPD dropdown now follows clinic workflow order**. User reported "navbar ບໍ່ມີຫຍັງປ່ຽນແປງ" because ຊັກປະຫວັດ and ປະຫວັດການກວດ were still top-level — disconnected from the OPD flow. Moved both into the OPD dropdown and re-ordered to match the real clinic flow: **1️⃣ ລາຍຊື່ຄົນເຈັບ → 2️⃣ ຊັກປະຫວັດ → 3️⃣ ຄິວ OPD → 4️⃣ ຕິດຕາມ OPD** (numbered step badges, items 1-4) followed by a divider and **ປະຫວັດການກວດ** as a historical lookup. Top-level bar is now leaner: Dashboard · ລາຍງານ · OPD ▼ · ນັດໝາຍ · ວັກຊີນ · IPD ▼ · ຕັ້ງຄ່າ. Added `data-i18n` to ນັດໝາຍ and ວັກຊີນ (previously hard-coded). Routes untouched — `/triage` and `/visit_history` still resolve to the same views, just accessed from inside the OPD dropdown. The dropdown's permission gate classes were extended (`mnu-triage mnu-visit_history`) so the OPD dropdown stays visible when a user only has triage/history perms. CSS: new `.his-step-num` 20×20 circular white-on-translucent step badge. | `navbar.html`, `docs/HIS_NAVIGATION_ROUTE_AUDIT.md`, `.his-step-num` in `style.css` |
| 2026-06-23 | **OPD Observation bed board** (Option A — reuse IPD ward/room/bed schema). Per user request, the "ຕິດຕາມ OPD" workflow now has physical beds visualized the same way as IPD. Approach: introduce `Ward_Type='OPD_Observation'` so admins create observation wards/rooms/beds via the existing Settings → IPD Config UI (no new admin screen). New migration `20260623120000_opd_observations_beds.sql` adds `ward_id/room_id/bed_id` columns + index to `opd_observations` and a convenience view `opd_active_observations_by_bed`. New helpers: `window.ipdIsObsWard(ward)` (mirrors `ipdIsVipWard`), `window.obsGetOccupiedBedIds()`, `window.obsActiveObservationByBedId()`. IPD `renderIpdBedBoard` now filters obs wards out (they only render on the OPD page), and `renderIpdSummaryCards` excludes obs beds from the IPD census so KPI numbers stay IPD-only. `openObservationFromVisit` modal now includes a bed picker populated from available obs beds (with "no bed yet (waiting area)" as the default). New `renderObsBedBoard()` draws grid cards per obs ward with status badges, duration counter, and a red ≥6-h highlight that triggers the existing Convert-to-IPD alert. `dischargeObservation` and `convertObservationToIpd` now `NULL` the bed/room/ward to release them automatically. Ward Type dropdown in `openIpdWardModal` extended with `'VIP'` and `'OPD_Observation'`. New i18n keys (en+lo): `obs.assignBed`, `obs.bedOptional`, `obs.noObsWardHint`, `obs.bedBoardTitle`, `obs.bedBoardSubtitle`, `obs.noBedAssigned`. | `ipdIsObsWard`, `obsGetOccupiedBedIds`, `obsActiveObservationByBedId`, `renderObsBedBoard`, `renderIpdBedBoard`, `renderIpdSummaryCards`, `openObservationFromVisit`, `dischargeObservation`, `convertObservationToIpd`, `openIpdWardModal`, `opd_observation.html`, migration `20260623120000` |
| 2026-06-23 | **Menu simplified — Option A (small clinic workflow)**. The OPD/IPD dropdowns had 4+5 items but several pointed to the same underlying view with only a `mode` difference, which confused users. Removed from `navbar.html`: `nav-opd_consultation` (same view as ຄິວ OPD), `nav-ipd_dashboard` (KPI strip is already on the bed board), `nav-ipd_admission` (the green "+ Admit" button on bed board handles it), `nav-ipd_discharge` (the "Discharged" tab inside ລາຍຊື່ IPD handles it). Final menu: **OPD = 3 items** (ຄິວ OPD, ຕິດຕາມ OPD, ລາຍຊື່ຄົນເຈັບ); **IPD = 2 items** (ຈັດການຕຽງ, ລາຍຊື່ IPD). Routes kept in `HIS_NAV_ROUTES`/`HIS_PATH_ROUTES` so `/opd/consultation`, `/ipd/dashboard`, `/ipd/admission`, `/ipd/discharge` still resolve for bookmarked URLs and dashboard cards. i18n keys `nav.opdConsultation`, `nav.ipdDashboardShort`, `nav.ipdAdmission`, `nav.ipdDischarge` also kept for the label-update map and any future re-introduction. Doc updated at `docs/HIS_NAVIGATION_ROUTE_AUDIT.md`. | `navbar.html`, `docs/HIS_NAVIGATION_ROUTE_AUDIT.md` |
| 2026-06-23 | **OPD doctor-room realtime notifications**. When triage submits a visit with `Status='Waiting OPD'` (plus a `Department` value), the doctor at that room now gets an in-page toast + ascending-tone audio cue. Uses Supabase Realtime (`supabaseClient.channel('opd-queue-notifications').on('postgres_changes', ...)` — same pattern as the existing public-queue channel). Subscription is set up once at login (`initApp` calls `setupOpdQueueRealtime()`) and torn down on logout, so notifications fire regardless of the current view. Seed set is filled from a SELECT of all current `Waiting OPD` visit IDs so it doesn't spam toasts for rows that already existed when the doctor logged in. New `#opdMyRoomFilter` `<select>` on the OPD page (populated from `MasterData.Department`) lets each doctor pick "my room"; the value is persisted in `localStorage.his_opd_my_room` so it survives reloads. If "my room" is empty → fire notifications for every room. If set → only fire when `Visits.Department` matches. Toast container is created lazily on `<body>` if not present (works on any page). Tone is two short sine pulses (880 Hz → 1320 Hz) via WebAudio — no audio files needed. | `setupOpdQueueRealtime`, `teardownOpdQueueRealtime`, `showOpdQueueToast`, `playOpdNotificationSound`, `populateOpdMyRoomFilter`, `getOpdMyRoom`/`saveOpdMyRoom`, `loadQueue`, `initApp`, `logout`, `opd.html`, `style.css` |
| 2026-06-23 | **OPD room-specific notification hardening**. Added exact room normalization/matching helpers so alerts only fire when `Visits.Department` equals the selected `localStorage.his_opd_my_room` value; choosing a room now re-seeds existing waiting visits, refreshes the OPD queue, refreshes bell alerts, and requests browser notification permission from the user gesture. Added `handleOpdQueueNotification()` as the single path for realtime and polling, desktop notifications, a 15s polling fallback when Supabase Realtime is unavailable, and teardown cleanup for the poller. `checkAlerts()` now combines appointment alerts with today's `Waiting OPD` rows for the selected room in the top bell dropdown. `loadQueue()` now filters the visible OPD table by the selected room too, so doctors only see and open records for their chosen room unless "all rooms" is selected. Toast CSS was tightened for mobile width and 8px radius. | `checkAlerts`, `normalizeOpdRoomName`, `isOpdRoomMatch`, `seedOpdNotifiedVisits`, `handleOpdQueueNotification`, `pollOpdQueueNotifications`, `setupOpdQueueRealtime`, `teardownOpdQueueRealtime`, `saveOpdMyRoom`, `loadQueue`, `style.css` |
| 2026-06-23 | **Patient registration slow + wrong next ID with 17k+ rows**. (1) `generateNextPatientID` was `.select('Patient_ID')` with no filter/limit — PostgREST capped at 1000 rows and returned the *oldest* 1000 IDs (none with current year prefix), so `maxNum` stayed 0 and every new patient got `LXH2026-000001` instead of continuing the sequence. Fix: filter with `.ilike('Patient_ID', 'LXH<year>%').order('Patient_ID', desc).limit(100)` — O(1) index scan. (2) `initPatientTable` used `fetchSupabaseRows` to paginate the entire table sequentially (17,814 rows = ~18 round-trips × ~500ms ≈ 9 s blocked the UI before DataTables init). Fix: head/count query first to know `numPages = ceil(total/1000)`, then fire ALL page queries in parallel via `Promise.all` + `.range()`. 18 parallel fetches confirmed at ~591 ms by curl (vs ~9 s sequential). DataTables init now also gets `deferRender: true` so only visible rows paint up front. All 17k rows still load — user explicitly asked for "show all but make it faster". | `generateNextPatientID`, `initPatientTable`, `patients.html` |
| 2026-06-23 | **Master-data save was silently failing (Drugs/Labs/Orgs)**. All three tables have NOT-NULL PK columns (`Drug_ID`/`Lab_ID`/`Org_ID`) but the modal save functions never generated an ID — insert returned `code: 23502 null value in column ... violates not-null constraint`. Drugs swallowed the error and showed "ສຳເລັດ" anyway (table stayed empty). Labs surfaced the raw constraint error to the user. Orgs failed silently with no popup. Fix: added generic helper `window.generateNextMasterIDs(table, idCol, prefix, padding, count)` (returns array — also useful for Excel bulk import) and `window.generateNextMasterID(...)` (single). Applied: `submitDrugMasterForm` → `DRUG001`, `submitLabMasterForm` → `LAB001`, `submitOrgForm` → uses user-entered `Org_Code` as `Org_ID` (with `ORG001` fallback). Each form now wraps insert in try/catch and surfaces real error messages instead of fake "ສຳເລັດ". Excel imports for Drugs/Labs/Orgs also generate sequential IDs (one query → array of N IDs). `openOrgModal` now pre-fills the next `ORG001`-style code so users get sequential IDs by default. Extracted `refreshPatientOrgDropdown()` helper and call it after every Org mutation so newly-added orgs appear in the patient registration `<select>` without requiring a relogin. | `submitDrugMasterForm`, `submitLabMasterForm`, `submitOrgForm`, `openOrgModal`, `handleDrugExcelUpload`, `handleLabExcelUpload`, `handleOrgExcelUpload`, `refreshPatientOrgDropdown`, `generateNextMasterID(s)` |
| 2026-06-23 | **Delete buttons on IPD Config tables**. Each row in Wards/Rooms/Beds tabs now has THREE action buttons: Edit (blue pencil), Disable (outline-secondary ban icon → Inactive status), Delete (red trash → hard delete via `deleteIpdWard`/`deleteIpdRoom`/`deleteIpdBed`). Delete functions already existed with guards: ward with rooms blocked, room with beds blocked, occupied/reserved bed blocked. Added `title` tooltips on every action button. New i18n key: `ipd.disable` (en: "Disable", lo: "ປິດໃຊ້ງານ"). Also fixed dangling `common.edit` reference → uses existing `ipd.edit`. | `renderIpdWardsTable`, `renderIpdRoomsTable`, `renderIpdBedsTable` |
| 2026-06-22 | **Add Bed modal — VIP visual cue (no separate button)**. Beds inherit VIP-ness from their parent Ward (`Ward_Type='VIP'` OR Ward_Name matches /vip/i) — no `Bed.Is_VIP` column. Decision: do NOT add a separate "Add VIP Bed" button (would be redundant). Instead: (1) Ward dropdown options for VIP wards get crown emoji prefix + `[VIP]` suffix, (2) `data-vip="1"` on those options, (3) `didOpen` watches Ward change and toggles `.ipd-vip-modal` class on the Swal popup → gold accent kicks in via existing CSS at `.swal2-popup.ipd-vip-modal`. Also extracted the inline `isVipWard` helper that was duplicated in 3 places into `window.ipdIsVipWard` (next to `ipdWardById`/`ipdRoomById`/`ipdBedById`); refactored the bed-board renderer and `openIpdRoomModal` to use it. | `openIpdBedModal`, `openIpdRoomModal`, bed-board renderer, `window.ipdIsVipWard` |
| 2026-06-22 | **IPD Config tab visibility & CRUD reliability fix**. Two issues on the new `ipd_config` view: (1) tabs showed multiple panes simultaneously (Bootstrap/AdminLTE 3 CSS conflict suspected), (2) tab clicks not reliably hiding the previous pane. Fix: defensive CSS `#view-ipd_config .tab-content > .tab-pane:not(.active) { display: none !important; }` + custom JS handler `bindIpdConfigTabs` that bypasses Bootstrap's tab JS — manual class toggle, manual `display` set, plus DataTables `columns.adjust()` after tab show (fixes column-width bugs from tables initialized inside hidden panes). Wired into `loadIpdConfigPage` after the 3 render calls. | `loadIpdConfigPage`, `bindIpdConfigTabs`, `style.css` |
| 2026-06-22 | **Login speed fix** — login was hanging ~15s after correct credentials. Root cause: `seedMasterDefaults` (called inside `initApp` with `await`) loops 11 categories and does a SELECT-then-maybe-INSERT *sequentially*. Even when all categories exist (the steady state on every login), that's 11 sequential Supabase round-trips blocking the UI. Fix: (1) parallelize the existence checks with `Promise.all` + use `select('ID', { head: true, count: 'exact' })` instead of fetching rows; (2) batch INSERTs in one round-trip for missing categories; (3) cache `localStorage.his_master_seeded_v1 = '1'` so subsequent logins skip the check entirely; (4) drop the `await` in `initApp` so seeding runs in background and never blocks login. Net effect: login round-trips reduced from 11+ sequential to 0 (cached after first login). | `seedMasterDefaults`, `initApp` |
| 2026-06-22 | **Cloudflare Pages login-hang diagnosis**. Production (`his.luckxayhospitallaos.com`) was serving the *unbuilt* root `index.html` (which references `/src/main.js`) instead of `dist/index.html` (which references `/assets/index-<hash>.js`). Symptom: clicking "ເຂົ້າສູ່ລະບົບ" did nothing because `window.doLogin` never got defined (the ES-module `/src/main.js` worked as a raw fetch but its `import`/`export` syntax wasn't compiled, so it crashed silently in production). Confirmed via `curl -I /src/main.js` returning 200 from production (should be 404). Fix: in Cloudflare Pages dashboard → Settings → Build configurations, set Build command = `npm run build`, Build output directory = `dist`, Node version 20+. After re-deploy: `/src/main.js` should 404 and `/assets/index-*.js` should serve with `Content-Type: application/javascript`. `dist/` is already in `.gitignore` — Cloudflare must run the build itself. | Cloudflare Pages dashboard (no code change) |
| 2026-06-22 | **Button permissions for IPD modules**. Added 2 new cards to the `buttonPermModal` in `users.html`: `ipd` (view/admit/transfer/discharge/chart_edit) and `ipd_config` (view/add/edit/delete). Wired through `saveButtonPermissions` (new `ipd:` + `ipd_config:` blocks), `resetToRoleDefaults` (all 8 roles get sensible defaults — admin: all-on; doctor: ipd full + ipd_config off; nurse: ipd full minus discharge; lab/pharmacy/staff: all-off; reception: view+admit only; cashier: view only), and `applyButtonPermissions` (7 new CSS hide selectors). Tagged real buttons with classes: `.btn-ipd-admit` on Admit toolbar + Assign/Reserve/Cancel-Reservation dropdown items; `.btn-ipd-transfer`/`.btn-ipd-discharge` on Occupied-bed dropdown; `.btn-ipd-chart-edit` on the 4 chart entry buttons; `.btn-ipd-config-add` on 4 add buttons in Settings → IPD Config; `.btn-ipd-config-edit`/`.btn-ipd-config-delete` on edit/disable buttons in Wards/Rooms/Beds tables + bed action dropdown items. Note: action-menu items pass `className` through `.replace('btn-outline-', 'text-')` then onto the button so multi-class strings like `'btn-outline-success btn-ipd-admit'` survive (only first token rewritten). | `users.html`, `applyButtonPermissions`, `saveButtonPermissions`, `resetToRoleDefaults`, `ipdBedActionItems`, `ipd_ward_bed.html`, `ipd_config.html`, `ipd_chart.html`, `renderIpd{Wards,Rooms,Beds}Table` |

| 2026-06-23 | **Separate OPD Follow-up / Observation module**. Added `opd_observations` and `opd_observation_notes` migration with observation statuses, note types, vital-sign fields, indexes, RLS grants, and duration trigger. Added Patient Management menu with OPD / OPD Follow-up / IPD, new `opd_observation` view, KPI cards, observation list, detail timeline, repeated vitals/notes, discharge, and Convert Observation to IPD. Dashboard/report cards keep Observation counts separate from Active IPD/Admissions/Discharges, and conversion is the only path that inserts into `HIS_One_Admissions`; observation rows never feed bed occupancy, ward occupancy, census, or admission stats. Added Lao/English i18n keys and `opd_observation.*` button permissions. Full implementation and test notes live in `docs/OPD_OBSERVATION_MODULE.md`. | `20260623090000_opd_observations.sql`, `opd_observation.html`, `navbar.html`, `dashboard.html`, `report.html`, `users.html`, `main.js`, `style.css`, `docs/OPD_OBSERVATION_MODULE.md` |
| 2026-06-23 | **HIS navigation workflow regrouping**. Reorganized top navigation into separate OPD (`/opd/queue`, `/opd/consultation`, `/opd/observation`, `/patients`) and IPD (`/ipd/dashboard`, `/ipd/admission`, `/ipd/bed-management`, `/ipd/inpatients`, `/ipd/discharge`) dropdowns. Added route alias/redirect layer so existing view IDs still work while old URLs redirect to canonical workflow URLs. Active-menu highlighting now follows the current route key even when multiple menu items reuse the same view. Dashboard operation cards now navigate to OPD Today, Observation Patients, Active IPD, and Bed Occupancy. Added Lao/English labels and route audit doc. | `navbar.html`, `dashboard.html`, `main.js`, `style.css`, `docs/HIS_NAVIGATION_ROUTE_AUDIT.md` |
| 2026-06-24 | **Queue flow local-date fix for Triage/OPD**. Root cause: visits saved with `toISOString()` around midnight Laos time were stored as the previous UTC date, while Triage/OPD/Dashboard/Report/Public Queue filters queried `YYYY-MM-DDT00:00:00Z` to `T23:59:59Z`, hiding records created between 00:00-06:59 local time. Added local-day helpers (`getLocalDateKey`, `getLocalDayIsoBounds`, `getLocalDateRangeIsoBounds`) and applied them to visit/date queries across Dashboard, alerts, reports, visit history, Triage queue, OPD queue, Observation counts, notification polling, Public Queue, and Activity Log. Triage save now defaults blank target department to `OPD ທົ່ວໄປ` so sent-to-OPD rows are not roomless. Full audit in `docs/HIS_QUEUE_FLOW_AUDIT.md`. | `main.js`, `docs/HIS_QUEUE_FLOW_AUDIT.md` |
| 2026-06-24 | **IPD Ward form simplification**. Removed visible Ward Code (`ລະຫັດຫວອດ`) and Department (`ພະແນກ`) from the IPD Config Add/Edit Ward modal and from the Wards table. `Ward_ID` remains hidden and auto-generated so existing DB relations still work; Department is retained internally for existing rows and defaults to `IPD` on new rows. Validation now asks only for Ward Name. Full audit in `docs/IPD_WARD_FORM_UI_AUDIT.md`. | `main.js`, `ipd_config.html`, `docs/IPD_WARD_FORM_UI_AUDIT.md` |
| 2026-06-24 | **IPD Room form simplification**. Removed visible Room Code (`ລະຫັດຫ້ອງ`) from the IPD Config Add/Edit Room modal and from the Rooms table. `Room_ID` remains hidden and auto-generated so bed relations still work. `renderIpdRoomsTable()` now rewrites the table header before DataTables initializes to avoid stale-column count errors. Validation now asks only for Room Number. Full audit in `docs/IPD_ROOM_FORM_UI_AUDIT.md`. | `main.js`, `ipd_config.html`, `docs/IPD_ROOM_FORM_UI_AUDIT.md` |
| 2026-06-24 | **IPD Bed form code hiding**. Removed visible Bed Code (`ລະຫັດຕຽງ`) from the IPD Config Add/Edit Bed modal and from the Beds table. `Bed_ID` remains hidden and auto-generated so admission, movement, and bed-status relations still work. Bed table rows no longer fall back to showing `Ward_ID` or `Room_ID`; room dropdown labels no longer show `Room_ID` as fallback. `renderIpdBedsTable()` rewrites the header before DataTables initializes to avoid stale-column count errors. Validation now asks only for Bed Number. Full audit in `docs/IPD_BED_FORM_UI_AUDIT.md`. | `main.js`, `ipd_config.html`, `docs/IPD_BED_FORM_UI_AUDIT.md` |
| 2026-06-24 | **IPD Add Bed ward-room sync fix**. The Add/Edit Bed modal no longer keeps a stale room selected after the ward changes. Replaced option hide/show behavior with a full rebuild of `#ipdBedRoom` based on the selected `#ipdBedWard`, so selecting an IPD ward cannot leave ER001 or any room from another ward selected. Added room-required validation for wards with no rooms. Details appended to `docs/IPD_BED_FORM_UI_AUDIT.md`. | `openIpdBedModal`, `docs/IPD_BED_FORM_UI_AUDIT.md` |
| 2026-06-24 | **Navbar OPD Observation dropdown update**. Report label remains `ສະຖານະຄິວຄົນເຈັບ`; the OPD doctor-room link is restored to `ຫ້ອງກວດແພດ (OPD)`; a new OPD Observation dropdown was added as `ຄົນເຈັບນອນຕິດຕາມ OPD` with item `ບອດຕຽງ OPD ຕິດຕາມ` routing to `/opd/observation`; IPD dropdown label changed to `ຄົນເຈັບນອນ IPD`; Vaccines and Appointments remain after IPD. Routes were not changed. Full audit in `docs/HIS_NAVBAR_ORDER_AUDIT.md`. | `navbar.html`, `main.js`, `docs/HIS_NAVBAR_ORDER_AUDIT.md` |

| 2026-06-24 | **OPD Observation bed board now matches IPD format**. The `/opd/observation` page was restyled to use the same visual workflow as IPD bed management: IPD-style workspace header, bed status pills, ward -> room -> bed card grouping, compact bed cards, and action dropdowns. Occupied OPD observation beds show patient/HN, observation number, live duration, and a 6h+ warning when the observation should be considered for IPD conversion. Data separation is unchanged: only `Ward_Type='OPD_Observation'` beds render here, and OPD observation patients still do not count toward IPD bed occupancy, census, admissions, or statistics. MD updated in `docs/OPD_OBSERVATION_MODULE.md`. | `opd_observation.html`, `renderObsBedBoard`, `style.css`, `docs/OPD_OBSERVATION_MODULE.md` |
| 2026-06-24 | **Separated OPD Observation board and list like IPD**. User reported the OPD observation bed board still had a duplicated/list table below it. Removed the table from `/opd/observation` so the bed-board page is board-only. Added a second dropdown item `ລາຍຊື່ຄົນເຈັບນອນ OPD` with route `/opd/observation/list`, new partial `opd_observation_list.html`, and route key `opd_observation_list`. The new list page uses the IPD inpatient-list pattern with date filters, observation table, actions, and detail timeline. Both pages reuse the same `opd_observation` permission and keep Observation patients separated from IPD counts. | `navbar.html`, `opd_observation.html`, `opd_observation_list.html`, `loadObservationPage`, `obsDetailTargets`, `docs/OPD_OBSERVATION_MODULE.md` |
| 2026-06-24 | **Expanded OPD Observation board cards + board action cleanup**. Adjusted the OPD observation board card/grid CSS so OPD beds use the same expanded board dimensions as the IPD bed board: `repeat(auto-fill, minmax(190px, 1fr))`, `8px` gap, and `150px` minimum card height. Removed date-range filters from `/opd/observation` because the board is a live bed-management screen, added the `Observation` button on the board header, and wired it to select an OPD queue patient before opening the existing Observation creation modal. Active bed rows are merged into `window.observationRows` before rendering so board detail/patient names work even when the active observation started before today's list range. | `opd_observation.html`, `openObservationFromBoard`, `openObservationFromVisit`, `renderObsBedBoard`, `style.css`, `docs/OPD_OBSERVATION_MODULE.md` |
| 2026-06-24 | **OPD Observation board switched to IPD detail-card management mode**. User reported the OPD observation cards still looked like the old compact boxes. `renderObsBedBoard()` now renders `ipd-board-mode-detail` and uses the same IPD bed-management card structure: `ipd-bed-top`, `ipd-bed-meta`, `ipd-bed-patient-name`, `ipd-bed-line`, and `ipd-bed-actions`. OPD-specific CSS was extended to mirror the IPD patient-line/action-dropdown/hover/status-badge styling. Available OPD observation beds now expose an IPD-style action dropdown; choosing `Observation` starts the existing OPD observation creation flow and preselects that bed. Occupied beds keep observation-specific actions: open timeline, convert to IPD, and discharge. | `renderObsBedBoard`, `openObservationFromBoard`, `openObservationFromVisit`, `style.css`, `docs/OPD_OBSERVATION_MODULE.md` |
| 2026-06-24 | **OPD Observation actions/tracking aligned with IPD bed management**. User requested all management and follow-up actions to work like IPD. OPD observation bed cards now expose IPD-style actions by status: Available = start Observation + maintenance; Cleaning/Maintenance/Reserved = mark available + maintenance; Occupied = open observation chart/timeline, transfer bed, add vital sign, doctor note, nursing note, medication, procedure, convert to IPD, and discharge/release bed. Added OPD-specific physical bed helpers (`updateObservationPhysicalBedStatus`, `changeObservationBedStatus`) plus `openObservationTransferModal`/`transferObservationBed`, keeping all patient workflow in `opd_observations` and using physical bed status only for room readiness. Discharge and Convert-to-IPD now set the released OPD observation bed to `Cleaning`, matching IPD's release-bed behavior. Board and list detail panels both got the same tracking buttons. | `opd_observation.html`, `opd_observation_list.html`, `renderObsBedBoard`, `openObservationTransferModal`, `transferObservationBed`, `openObservationNoteFromBoard`, `dischargeObservation`, `convertObservationToIpd`, `docs/OPD_OBSERVATION_MODULE.md` |
| 2026-06-24 | **Fixed OPD Observation action dropdown overlap/clipping**. User reported the `ຈັດການ` dropdown was being hidden by the bed-board containers. Root cause was the shared IPD board CSS setting `overflow: hidden` on `.ipd-board-segment` and `.ipd-ward-group`, plus the OPD action menu not having enough stacking priority. Added OPD-only overrides so board segment/body/ward/card/grid allow visible overflow, cards with open dropdowns lift above siblings, and `.ipd-bed-action-menu` uses a higher z-index. | `style.css`, `docs/OPD_OBSERVATION_MODULE.md` |

| 2026-06-24 | **OPD Observation medication action temporarily removed + provider multi-select notes**. User requested medication recording be removed for now, and Doctor/Nursing notes should select doctors/nurses from dropdowns with multiple selection. Removed Medication from OPD Observation bed-card action dropdowns and both observation detail panels. `openObservationNoteModal()` now loads the same provider cache used by IPD, shows a multi-select doctor dropdown for Doctor Note and a multi-select nurse dropdown for Nursing Note, validates that at least one provider is selected, and saves selected provider names to `recorded_by`. Existing medication timeline records remain readable for historical data, but new medication notes cannot be created from OPD Observation UI. MD updated in `docs/OPD_OBSERVATION_MODULE.md`. | `main.js`, `opd_observation.html`, `opd_observation_list.html`, `docs/OPD_OBSERVATION_MODULE.md` |

| 2026-06-24 | **Org Excel import duplicate-key crash fixed**. User uploaded a 29-row Excel where every row shared the same `Org_ID = LXH-AMZ-26-001` (the sheet is "29 customers under 1 organization", not 29 organizations) and that ID already existed in the DB. The old `handleOrgExcelUpload` used `Org_ID` straight from each row and called `.insert()`, so all 29 rows collided on PK and Postgres returned `duplicate key value violates unique constraint "HIS_One_Organizations_pkey"`. Fix: identity-priority chain Cus_ID_Ex > explicit Org_ID > generated `ORG<seq>` > Org_Code (so each customer row gets a unique PK); dedupe in-batch with a `Map`; switch to `.upsert(..., { onConflict: 'Org_ID' })` so re-imports update rather than crash. Saved-message reports how many duplicates were skipped. | `handleOrgExcelUpload` |

| 2026-06-24 | **Epic-style action grouping on OPD Observation bed cards + detail panels**. Per user ask ("ແນະນຳແບບລະບົບສາກົນ"), the action row for an occupied OPD observation bed and the matching toolbar on both detail panels (`opd_observation.html` + `opd_observation_list.html`) now follow Epic/Cerner convention: **(1) Vital Sign** = red standalone button (most frequent, 1-click), **(2) Document** = blue `+ ບັນທຶກ` dropdown with Doctor Note / Nursing Note / Procedure (per-shift documentation), **(3) Bed Management** = dark `ຈັດການຕຽງ` dropdown with Open Chart / Transfer Bed / Convert to IPD / Discharge & Release Bed (workflow that releases the room). New i18n keys `obs.documentNote` (lo: "ບັນທຶກ" / en: "Document") and `obs.bedManagement` (lo: "ຈັດການຕຽງ" / en: "Bed Management"). New CSS `.obs-bed-actions-grouped` flexes the three buttons evenly with ellipsis overflow so they fit on a compact bed card. | `renderObsBedBoard` (occupied branch), `opd_observation.html`, `opd_observation_list.html`, `style.css` (`.obs-bed-actions-grouped`) |

| 2026-06-24 | **Rolled back the Epic-style grouping — back to IPD's single `ຈັດການ ▾` dropdown**. User reviewed both pages side-by-side and asked "ປ່ຽນການຈັດການໃຫ້ເປັນແບບ IPD" — they want the OPD observation bed cards to look exactly like the IPD bed-board cards (one black "ຈັດການ" trigger that opens an 8-item dropdown), not the 3-button Vital/Document/Bed-Mgmt split from the previous entry. The Epic split was theoretically better international UX but did not match the staff's existing habit on this clinic's IPD board. Reverted: occupied-bed action HTML in `renderObsBedBoard` rebuilt to a single status-coloured dropdown with all 8 items (Open Observation, Transfer Bed, Vital Sign, Doctor Note, Nursing Note, Procedure, Convert to IPD, Discharge & Release Bed); both detail-panel toolbars (`opd_observation.html`, `opd_observation_list.html`) restored to the flat outline-button row that matches the IPD chart's toolbar style. Dropped the `.obs-bed-actions-grouped` CSS block. The new i18n keys `obs.documentNote` and `obs.bedManagement` are kept in translations in case the grouped layout is wanted again later. | `renderObsBedBoard`, `opd_observation.html`, `opd_observation_list.html`, `style.css` |

| 2026-06-24 | **OPD Observation modals = IPD parity** ("ທຸກຢ່າງໃຫ້ເປັນແບບດຽວກັນກັບ IPD"). User asked that managing OPD inpatients work the same way as IPD. `openObservationNoteModal()` rebuilt: Doctor Note now uses the IPD SOAP shape (Visit_Type, Diagnosis, Chief_Complaint, S/O/A/P) with multi-select doctor dropdown; Nursing Note uses the IPD shape (Shift, Patient_Condition, Observation, Nursing_Care_Given, Response_To_Treatment, Intake, Output, Pain_Score, Fall_Risk, Allergy_Alert, Medication_Given, Procedure_Done, Notes) with multi-select nurse dropdown; Vital Sign uses the IPD shape (Temp, BP_Systolic+BP_Diastolic split, Pulse, RR, SpO2, Weight, Height, BMI auto-calc, Pain, Consciousness, Notes) with provider multi-select. Modal width bumped to 900 to match IPD. Multi-select preserved (user's previous explicit choice). `renderObservationTimeline()` now renders the structured fields per type instead of a flat `note_text`. New migration `20260624140000_opd_observation_notes_ipd_parity.sql` adds the IPD-parity columns (provider_id/role, visit_type, diagnosis, chief_complaint, subjective/objective/assessment/plan, shift, patient_condition, observation_text, nursing_care_given, response_to_treatment, intake/output, fall_risk, allergy_alert, medication_given, procedure_done, bp_systolic/diastolic, weight, height, bmi, consciousness) to `opd_observation_notes`. Legacy columns (`note_text`, combined `bp`) still populated for backward compatibility. Reused IPD i18n keys (`ipd.visitType`, `ipd.chiefComplaint`, `ipd.subjective`, `ipd.objective`, `ipd.assessment`, `ipd.plan`, `ipd.shift`, `ipd.patientCondition`, `ipd.observation`, `ipd.nursingCareGiven`, `ipd.responseToTreatment`, `ipd.intake`, `ipd.output`, `ipd.fallRisk`, `ipd.allergyAlert`, `ipd.medicationGiven`, `ipd.procedureDone`, `ipd.consciousness`) — no new translations needed. MD updated in `docs/OPD_OBSERVATION_MODULE.md`. | `openObservationNoteModal`, `renderObservationTimeline`, migration `20260624140000_opd_observation_notes_ipd_parity.sql`, `docs/OPD_OBSERVATION_MODULE.md` |

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
