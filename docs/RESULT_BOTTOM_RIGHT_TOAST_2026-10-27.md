# Bottom-right result notifications — 2026-10-27

User requested LIS/UXI/PMC results use compact bottom-right toasts like the supplied UXI connection notice, and asked whether old UXI results were moved into HIS.

## Behavior

- LIS result toasts now use a separate bottom-right result container with compact white cards. Existing room-arrival notifications retain their container. Existing LIS recipient/auth checks, result opening, unread history and acknowledgement behavior remain intact.
- UXI/PMC notify when the authenticated open OPD patient's result snapshot changes after the first successful load. Initial history is displayed silently and unchanged polls do not replay notices. UXI reports and PMC review/issue/return changes trigger their own source-labelled toast. Clicking opens the corresponding OPD result tab only while the original patient/visit/session is still current.
- Five-second shrinking progress bar, timed/manual dismissal, keyboard activation, at most three connected-result toasts, mobile fit. Logout and encounter teardown clear connected toast timers/state; signed-out recipients cannot display/open them.
- Old UXI reports are queried from the existing source and shown as dated patient history; this change does not copy/migrate clinical data. PMC feedback exists only for actual saved source records; this UI change does not activate clinical dispensing or submit drafts.

## Verification

- Failing-first lifecycle and connected-result change detection tests, then passing real implementations. Includes first-load silence, unchanged polling, changed UXI report, changed PMC quantity, correct result-tab opening, stale/patient-switch suppression and signed-out cleanup.
- All 23 named HIS test scripts passed, including auth/security, existing LIS notifications/private files and actual-workerd transport.
- Fresh Vite build into `tmp/bottom-toast-build` passed; existing large-chunk warning remains.
- Actual renderer/browser with synthetic data passed: LIS/UXI/PMC bottom-right placement, shrinking pseudo-element at halfway, all removed after five seconds, 390px fit, and signed-out suppression. Desktop/mobile screenshots visually reviewed after waiting for the existing slide-in animation to finish. No real patient content used for visual tests.

No DB, UXI, PMC backend, stock, permission, or patient-content changes. UXI/PMC notices currently follow the open OPD case polling, not a hospital-wide feed. Real new clinical events were not manufactured for notification acceptance.
