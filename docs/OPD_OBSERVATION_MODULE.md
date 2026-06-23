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

The OPD Observation page now uses the same operating bed-board format as IPD bed management:

- IPD-style workspace header with bed status pills.
- Ward group -> room section -> bed card layout.
- Occupied OPD observation beds show patient, HN/observation number, current duration, and a `6h+` warning badge.
- Bed cards use the same compact action-dropdown pattern as IPD.
- Available observation beds stay visible as available beds.
- The observation list/table remains below the bed board for searching, timeline opening, conversion, and discharge.

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
4. Add doctor note, nursing note, medication, and procedure notes.
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
- 2026-06-24: `git diff --check` passed with line-ending warnings only.
- 2026-06-24: `npm run build` passed. Vite emitted the existing large chunk warning for the main bundle.

Database note:

- The Supabase migration must be applied before using the new module against a live database. Until then, the Observation page will show a table-not-found/load error for `opd_observations`.
