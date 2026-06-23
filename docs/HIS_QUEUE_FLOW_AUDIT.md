# HIS Queue Flow Audit

Date: 2026-06-24

## Issue

Triage and OPD queues could appear empty after sending a patient into Triage or from Triage into OPD, especially around midnight to early morning in Laos time.

## Root Cause

Visit records are saved with ISO timestamps, for example `new Date().toISOString()`.

The queue pages were filtering the selected local date using UTC day boundaries:

- `YYYY-MM-DDT00:00:00Z`
- `YYYY-MM-DDT23:59:59Z`

For Laos time (UTC+7), a visit created on `2026-06-24 00:10` local time is stored as `2026-06-23T17:10:00Z`. The old filter for `2026-06-24` started at `2026-06-24T00:00:00Z`, so the visit was outside the range and did not show.

## Fix

Added shared local-date helpers in `src/main.js`:

- `getLocalDateKey`
- `getLocalDayIsoBounds`
- `getLocalDateRangeIsoBounds`

Updated visit/date queries to use local-day ISO boundaries:

- Dashboard visit loading
- OPD/Triage bell alerts
- Patient visit summary reports
- Visit history
- Triage queue
- OPD queue
- OPD Observation stats/report counts
- OPD notification polling
- Public queue display
- Activity log date filter

Triage save also now defaults a blank target department to `OPD ທົ່ວໄປ`, so OPD queue records do not have an empty room/department after vital-sign submission.

## Expected Workflow

1. Patient Registration creates/selects patient.
2. Send to Triage creates `HIS_One_Visits` row with status `Triage`.
3. Triage page shows the row for the selected local date.
4. Saving triage/vitals updates the visit to `Waiting OPD`.
5. OPD page shows the row for the selected local date.
6. If OPD room filtering is enabled, the row appears when its `Department` matches the selected room, or when the OPD page is set to all rooms.

## Verification Commands

```powershell
git diff --check
npm run build
```

## Manual Test Checklist

- Send a patient to Triage after midnight Laos time and confirm it appears on `/triage`.
- Save Triage/vitals and confirm the patient appears on `/opd/queue`.
- Select a target OPD room in Triage and confirm only that room sees the patient when room filter is enabled.
- Clear the OPD room filter and confirm all waiting OPD patients appear.
- Confirm Visit History and Reports include visits created between 00:00 and 06:59 Laos time.
- Confirm Public Queue shows Triage and OPD waiting patients for the local date.

## Remaining Notes

Authenticated browser click-through requires a logged-in browser session. The code-level and build checks verify the date-boundary and route logic, while full workflow testing should be done with a logged-in user.
