# OPD Follow-up / Observation Module

Date: 2026-06-23

## Purpose

OPD Follow-up / Observation is a separate workflow for patients who need treatment and monitoring without formal IPD admission.

Business rule:

- Observation duration less than 6 hours remains OPD Follow-up.
- Observation duration 6 hours or more shows an alert to consider IPD admission.
- Observation patients are not counted in IPD dashboards, bed occupancy, admission count, or inpatient census.
- Only the explicit Convert Observation to IPD action creates an IPD admission record.

## Database Migration

Migration file:

- `supabase/migrations/20260623090000_opd_observations.sql`

Tables:

- `opd_observations`
- `opd_observation_notes`

Observation statuses:

- `WAITING`
- `UNDER_OBSERVATION`
- `COMPLETED`
- `TRANSFER_TO_IPD`
- `DISCHARGED`

Observation note types:

- `VITAL_SIGN`
- `DOCTOR_NOTE`
- `NURSING_NOTE`
- `MEDICATION`
- `PROCEDURE`

The migration includes indexes, row-level security policies for the current app access pattern, and a trigger that calculates `duration_hours` on insert/update.

## Backend/API Layer

The app uses Supabase client calls in `src/main.js` as the backend API layer.

Implemented functions:

- `loadObservationPage`
- `fetchObservationRows`
- `fetchObservationPatients`
- `updateObservationStats`
- `renderObservationTable`
- `openObservationFromVisit`
- `openObservationDetail`
- `renderObservationTimeline`
- `openObservationNoteModal`
- `dischargeObservation`
- `convertObservationToIpd`
- `updateDashboardOperationalStats`
- `updateReportObservationStats`

## UI Changes

Current menu path:

- Top navbar
- ຫ້ອງກວດແພດ (OPD)
- ຄົນເຈັບນອນຕິດຕາມ OPD
- ຄົນເຈັບນອນ IPD

New view:

- `public/partials/views/opd_observation.html`
- `public/partials/views/opd_observation_list.html`

The OPD Observation page now uses the same operating bed-board format as IPD bed management:

- IPD-style workspace header with bed status pills.
- Ward group -> room section -> bed card layout.
- Occupied OPD observation beds show patient, HN/observation number, current duration, and a `6h+` warning badge.
- Bed cards now use the same detail-card pattern as IPD bed management, including `ipd-bed-top`, `ipd-bed-meta`, `ipd-bed-line`, and the same action dropdown row.
- OPD bed cards use the same expanded board grid as the IPD bed board (`repeat(auto-fill, minmax(190px, 1fr))` and `150px` minimum card height).
- Available observation beds stay visible as available beds.
- The board header no longer shows date-range filters. It has an `Observation` action button that opens the existing Observation creation flow for a selected OPD queue patient.
- Empty OPD observation beds also have an IPD-style action dropdown; choosing `Observation` preselects that physical bed in the creation modal.
- OPD bed actions now mirror IPD bed-management behavior where appropriate:
  - Available beds: start Observation, mark maintenance.
  - Cleaning/Maintenance/Reserved beds: mark available and maintenance actions.
  - Occupied observation beds: open timeline/chart, transfer bed, add vital sign, add doctor/nursing note, add procedure note, convert to IPD, discharge/release bed.
- Medication recording is temporarily removed from the OPD Observation UI. Existing medication timeline records can still be displayed for historical data, but users cannot create new medication notes from the board or detail panels.
- Doctor Note and Nursing Note now use provider dropdowns sourced from the same doctor/nurse user cache as IPD. The dropdown supports selecting multiple doctors or multiple nurses for one note, and the selected names are saved into the note `recorded_by` field.
- Discharge and Convert-to-IPD release the OPD observation bed into `Cleaning`, matching IPD's discharge/release workflow.
- Observation bed transfer moves the active `opd_observations.bed_id` to the destination OPD observation bed and records a nursing-note timeline event.
- OPD observation bed-board dropdown menus are allowed to overflow the segment/ward/card containers with a higher stacking layer, preventing the action menu from being clipped or hidden behind neighboring bed cards.
- The observation list/table is separated into `/opd/observation/list`, matching the IPD dropdown pattern.
- The bed-board route `/opd/observation` shows only the OPD observation bed board and inline detail timeline, not the list table.

This is visual and workflow alignment only. OPD Observation beds still come only from wards marked `Ward_Type='OPD_Observation'`, and they are excluded from IPD bed management, IPD census, IPD admissions, and IPD statistics.

Observation list columns:

- Observation No
- HN
- Patient Name
- Doctor
- Diagnosis
- Start Time
- Current Duration
- Status
- Actions

Actions:

- Open Observation
- Convert to IPD
- Discharge

## Timeline

Observation detail displays a timeline for:

- Arrival / Start Observation
- Doctor Assessment
- Vital Signs
- Medication
- Procedure
- Nursing Notes
- Discharge or Transfer to IPD

Vital sign fields:

- DateTime
- Temp
- BP
- Pulse
- RR
- SpO2
- Pain Score
- Recorded By

## Convert Observation to IPD

Conversion creates a new `HIS_One_Admissions` record only after the user confirms the conversion.

The created IPD admission:

- Uses a new IPD admission number.
- Preserves patient, doctor, diagnosis, and source visit where available.
- Does not assign a bed automatically.
- Sends the user to Ward / Bed Management for formal bed assignment.

The source observation is updated to:

- `status = TRANSFER_TO_IPD`
- `end_datetime = now`
- `ipd_admission_id = created admission ID`
- `converted_at = now`

## IPD Separation

Observation data is stored only in:

- `opd_observations`
- `opd_observation_notes`

IPD bed boards, ward occupancy, active IPD census, and admission statistics continue to read from existing IPD admission and bed tables.

Observation patients are not inserted into IPD admission tables unless the user clicks Convert to IPD.

Dashboard cards were added with separated sources:

- OPD Today: OPD visits
- Observation Patients: active `opd_observations`
- Active IPD: active `HIS_One_Admissions`
- Admissions Today: `HIS_One_Admissions`
- Discharges Today: `HIS_One_Admissions`

## Permissions

Added button-permission module:

- `opd_observation.view`
- `opd_observation.add`
- `opd_observation.note`
- `opd_observation.convert`
- `opd_observation.discharge`

Default role behavior:

- Admin: all actions
- Doctor: view, add, note, convert, discharge
- Nurse: view, add, note
- Other roles: no observation actions by default

## Lao Translations

Added i18n keys for:

- Patient Management menu
- OPD Follow-up / Observation menu
- Observation dashboard cards
- Observation list headers
- Observation action labels
- 6-hour IPD consideration alert
- Saved, converted, and discharged messages

## Testing Report

Commands to run after implementation:

```powershell
git diff --check
npm run build
```

Manual workflow checks after applying the Supabase migration:

1. Start an observation from an OPD queue row.
2. Confirm the row appears in OPD Follow-up / Observation.
3. Add vital signs and confirm timeline ordering.
4. Add doctor note and nursing note with multiple selected providers, then add a procedure note.
5. Set or wait for a duration of 6 hours or more and confirm the alert appears.
6. Convert to IPD and confirm an IPD admission is created without automatic bed assignment.
7. Confirm the original observation changes to `TRANSFER_TO_IPD`.
8. Confirm active Observation count does not increase Active IPD count.
9. Confirm non-converted observation patients do not appear in bed management, ward occupancy, active IPD census, or admission statistics.
10. Discharge an observation under 6 hours and confirm it remains outside IPD.

Automated verification result:

- 2026-06-23: `git diff --check` passed with line-ending warnings only.
- 2026-06-23: `npm run build` passed. Vite emitted the existing large chunk warning for the main bundle.
- 2026-06-24: OPD Observation bed board restyled to match IPD bed-management format.
- 2026-06-24: OPD Observation board card size expanded to match IPD board cards, board date filters removed, and an Observation button added for starting Observation from the board.
- 2026-06-24: OPD Observation board switched from compact cards to the same IPD detail-card layout and action-dropdown behavior, including bed-level Observation creation.
- 2026-06-24: OPD Observation management/tracking actions aligned with IPD bed management: bed status changes, transfer bed, bed-level notes/vitals/medication/procedure, discharge-to-cleaning, and Convert-to-IPD bed release.
- 2026-06-24: Fixed OPD Observation bed action dropdown clipping/overlap by overriding board overflow and z-index stacking for the OPD board.
- 2026-06-24: Temporarily removed OPD Observation medication recording actions. Doctor and nursing note modals now use multi-select provider dropdowns for selecting one or more doctors/nurses.
- 2026-06-24: `git diff --check` passed with line-ending warnings only.
- 2026-06-24: `npm run build` passed. Vite emitted the existing large chunk warning for the main bundle.

Database note:

- The Supabase migration must be applied before using the new module against a live database. Until then, the Observation page will show a table-not-found/load error for `opd_observations`.
