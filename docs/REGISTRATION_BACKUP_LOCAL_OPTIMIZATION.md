# Registration Performance and Compact Backup UI

Updated: 2026-08-24 (Asia/Bangkok)

Status: approved for the 2026-09-07 release after local verification.

## Registration problem

The Registration page previously fetched every patient in parallel 1,000-row pages. After that completed, it fetched the complete Visits key list again to calculate the red visit-count badge for every patient. With a large registry this created a high request burst, transferred thousands of rows that were not visible, delayed first render and made one failed page request fail the entire table.

## Registration change

- DataTables now uses server-side pagination.
- Initial load fetches only the 10 visible patient rows; page size can be changed to 25 or 50.
- Visit counts are fetched only for the patients on the visible page.
- Global search, Old ID, name, phone and date filters execute against the full Supabase patient table.
- Search inputs use a 320 ms debounce to avoid one network request per keystroke.
- The table displays a small load-time/total-patient indicator for local verification.
- Reopening Registration reloads the current page instead of destroying and rebuilding the full table.

Expected effect: first meaningful table render no longer depends on downloading the entire patient registry and entire visit index.

## Backup UI change

- Replaced the vertically stacked Supabase, Google Drive and Workflow History tables with three tabs in one workspace card.
- Each tab has its own fixed-height internal scroll region and sticky table header.
- The page header, latest status, automatic schedule, restore warning and actions were made compact.
- Only the visible Supabase list and latest status load initially. Google Drive and Workflow History load when their tabs are opened.
- Restore confirmation and all existing element IDs/actions remain unchanged.

## Verification

- Dedicated static regression suite: `npm run test:registration-ui`.
- `node --check src/main.js`, production build, security, auth and backup regression suites passed.
- Local browser initial Registration result: 10 rows from 19,174 patients in 801 ms, including visit-count badges.
- Local browser name search result: one matching patient from the full 19,174-patient registry in 470 ms.
- Registration rendered real patient rows, organization badges, pagination and action controls without a load error.
- Backup Supabase, Google Drive and Workflow History tabs switched correctly after an explicit-pane fix found during browser testing.
- At a 1280 × 720 test viewport, the Backup header, status, warning, tabs and active table workspace fit on one screen; only the table region scrolls when rows exceed its height.
- A loopback-only temporary Admin preview used for browser verification was removed after testing and is not part of the delivered source.
