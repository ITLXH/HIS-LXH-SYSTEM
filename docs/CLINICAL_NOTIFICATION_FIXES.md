# Registration and clinical notification fixes

Date: 2026-08-25
Scope: local workspace only; no commit or push

## Requested behavior

- Do not show the Registration performance text (`10 rows in ... ms / searched from ... patients`).
- Keep a new-patient room notification visible for 10 minutes, then remove it automatically if nobody dismisses it.
- Make completed LIS result notifications visible to the intended users on every screen.

## Changes

### Registration

- Removed the successful-load timing/corpus message from the patient table.
- Kept the same status host for genuine loading errors so failures remain visible to staff.

### New patient sent to an OPD room

- Added a 10-minute (`600000 ms`) auto-dismiss timer.
- Clicking the toast or its close button removes it immediately and clears its timer.
- Teardown clears all outstanding timers to avoid stale callbacks after logout or notification restart.

### LIS completed-result notifications

- Moved the clinical toast container from the hidden OPD view into the global application shell, so notifications display while Registration, Triage, IPD, Backup, and other views are active.
- Added a compatibility guard that re-parents a toast container from older cached OPD partials to `document.body`.
- Added the `admin` role to LIS recipients. The active account shown during verification uses this role; it had previously been excluded.
- Corrected LIS order enrichment. One order can have many test rows, so limiting the order response to the number of result files truncated patient identity data and silently filtered out notifications. Order IDs are now fetched in batches of 50 with a limit of 1000 rows per batch.

### LIS notification content and duration (2026-08-25)

- Simplified the visible result toast to only HN, patient name, and result-ready time (`HH:mm`).
- Removed the Order ID, test name, completion wording, and acknowledgement button from the toast. Staff can still open the result by clicking the toast or close it with the × button.
- Applied the same HN, patient name, and ready-time presentation to the notification-bell list. Its acknowledgement action remains available there so the clinical audit trail is preserved.
- Added a dedicated 10-minute (`600000 ms`) auto-dismiss timer for each LIS result toast.
- Manual close or acknowledgement clears the pending timer. Notification teardown clears all timers so no stale callbacks survive logout or notification restart.
- Auto-dismiss removes only the temporary toast. The alert remains in the notification bell until staff acknowledge it.

## Verification

- Read-only LIS API contract check succeeded.
- A 20-file sample confirmed that all requested order IDs can be enriched when the corrected row limit is used. No patient identifiers or names were printed during the check.
- Local browser verification while signed in as Admin confirmed:
  - Registration loaded 10 rows and did not display the removed performance text.
  - Exactly one toast container existed, directly under `BODY`, with fixed positioning and `z-index: 9999`.
  - Completed LIS result toasts were visible while Registration was active, proving they are no longer trapped in the hidden OPD view.
- Added `npm run test:notifications` with regression checks for the hidden Registration notice, both ten-minute timers, timer cleanup, global toast container, Admin recipient, LIS batching, and the reduced HN/name/ready-time content across web toast, bell list, and desktop notification.
- `npm run test:notifications`: passed (25/25).
- `npm run test:registration-ui`: passed.
- `npm run build`: passed. Vite reported only the existing large-chunk advisory.

## Git status

No commit or push was performed.
