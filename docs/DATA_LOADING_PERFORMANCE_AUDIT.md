# Data-loading performance audit (local)

Date: 2026-08-24

Scope: review the remaining HIS pages after the Registration server-side pagination change. This document is a recommendation only; no implementation, commit, or push is included in this audit.

## Measured all-page audit — 2026-08-25

This follow-up audit covers every routed view in the current application. It separates the shared hard-refresh/bootstrap cost from the data cost of navigating to a view after the application is already open.

### Main finding

The long full-screen hospital-logo loader is primarily a shared bootstrap problem, not an animation problem and not a Triage-only problem.

Every hard refresh or direct URL currently waits for all of the following before the requested page is opened:

1. Download and parse the monolithic application bundle.
2. Fetch and inject 36 HTML partial files (27 views, 8 modal groups, navbar, and print areas). The loader waits for every partial, including pages the user did not open.
3. Restore the authentication session.
4. Run `initApp()` and wait for all global lookup data.
5. Download every row and every column from `Patients` to build appointment/vaccine dropdowns.
6. Only after the shared work completes, hide the full-screen loader and start the requested page query.

The blocking patient-dropdown preload is the dominant cause. It is in `preloadDropdownDataCallback()` and is awaited by `initApp()`.

### Read-only measurements

Measurements were made against the configured local application and current Supabase data on 2026-08-25. They contain no patient values; only row counts, byte sizes, request counts, and durations were recorded. Network timings vary between runs, but the data-volume difference is decisive.

| Operation | Requests | Rows | Transfer | Measured time |
|---|---:|---:|---:|---:|
| Shared startup: all `Patients` with `select('*')` | 20 sequential | 19,183 | 15.35 MB | 23,027 ms |
| Registration page: 10 displayed patients, selected columns | 1 | 10 | 4.3 KB | 185 ms |
| Shared `Service_Lists` preload | 1 | 936 | 243.7 KB | 661 ms |
| Shared `MasterData` preload | 1 | 406 | 39.0 KB | 285 ms |
| Shared `Drugs_Master` preload | 1 | 516 | 46.4 KB | 248 ms |
| Shared `Labs_Master` preload | 1 | 233 | 18.3 KB | 682 ms |
| Triage/OPD current-day Visits | 1 | 18 | 23.7 KB | 536 ms |
| Queue follow-up stages after Visits | 4 sequential | 18 patients / 30 history rows | 8.6 KB | 648 ms |
| Report/Visit History current-day pipeline | 3 sequential | 11 patients / 18 visits | 17.7 KB | 660 ms |
| Organizations current management load | 3 sequential | 2,611 | 3.19 MB | 1,103 ms |
| IPD shared loader: first 1,000 Patients alone | 1 of 6 parallel calls | 1,000 | 790.6 KB | 861 ms |
| Activity log, current day | 1 | 166 | 33.9 KB | 845 ms |

The current production build also reports a large-chunk warning:

- JavaScript: 1,029.30 KB minified, 248.44 KB gzip.
- CSS: 414.08 KB minified, 64.39 KB gzip.
- `index.html` eagerly loads jQuery, Bootstrap, Select2, SweetAlert2, DataTables, Chart.js, PDF/canvas tools, XLSX, QR tools, and Supabase before the application becomes interactive.

### All-page classification

`Hard refresh` is critical for every protected route until the shared Patients preload is removed. The table below describes the additional cost after the application shell is already open.

| View / route | In-app navigation risk | Current behavior and finding |
|---|---|---|
| Dashboard | High | Downloads every Visit in the selected range with `*`, then Patients, then historical Visits in sequential stages; browser performs aggregation and chart rendering. |
| Patient queue / Report | High | Uses `buildPatientVisitSummaryData`; browser joins registered Patients, range Visits, missing Patients, and all-history counts before DataTables pagination. |
| Visit History | High | Reuses the same full Report pipeline, then filters rows only after all processing completes. |
| Registration | Low after bootstrap | Server-side pagination is implemented. Only 10–50 displayed rows are fetched, followed by visit counts for those rows. This is the correct pattern to reuse elsewhere. |
| Triage | High | Fetches range Visits with `*`, vitals, Patients, visit-count keys, and then a second historical Visits dataset. Several stages are sequential and two stages overlap in purpose. |
| OPD queue | High | Fetches range Visits with `*`, vitals, Patients, and full history for visible patient IDs before rendering. |
| OPD consultation / OPD Test | Medium–High | A selected chart loads multiple clinical datasets and LIS bundles. This is appropriate for a single patient, but large libraries and unrelated global dropdown data are already paid at startup. |
| OPD Observation board/list | High | Loads the complete shared IPD ward/bed state first, then up to 500 observation rows, then patient details, then statistics; date filtering is partly done in JavaScript. |
| IPD ward/bed | High | Every live load fetches all wards, rooms, beds, all admissions, first 1,000 full Patient rows, and 300 movements. |
| IPD inpatient/discharge list | High first load | Reuses the same full IPD loader even though the screen needs a filtered subset. A 60-second view cache helps only when returning quickly. |
| IPD chart | High | Direct route can load the full IPD state before loading one admission chart; the chart itself then loads several admission-specific datasets. |
| IPD configuration | Medium–High | Reuses the full IPD loader, including admissions, Patients, and movements, although configuration primarily needs wards, rooms, and beds. |
| Appointments | Low now, unbounded growth risk | One full-table `select('*')` with browser-side pagination. Current table is small, but startup also downloads all 19,183 Patients solely to populate its selector. |
| Patient Vaccines | Low now, unbounded growth risk | Downloads the complete `Patient_Vaccines` table. It also depends on the shared all-patient selector preload. |
| Vaccine Master | Low | Small full master table. Cache and explicit columns are sufficient at current size. |
| Drugs Master | Medium | 516 rows are downloaded and rendered at once; acceptable today, but the same data is also loaded globally before this page opens. |
| Labs Master | Low–Medium | 233 rows at once; duplicated with the global preload. |
| Services | Medium | 936 full rows are downloaded and rendered; the same list is also loaded during shared startup. |
| Locations | Low | 150 rows; small enough for a cached lookup. It is also duplicated by shared startup. |
| Organizations | High | Pages through and renders all 2,611 rows: 3 requests and 3.19 MB in the measured run, before client-side DataTables pagination. |
| Users | Low | Four narrow user rows in the measured data. `refreshDoctorUserList()` is additionally triggered without being awaited. |
| Settings | Low–Medium | Master data is already loaded during bootstrap but some settings/master loaders query it again; avoid duplicate refreshes. |
| Activity Log | Medium | Correctly defaults to today and caps 500, but still fetches full rows and performs user filtering and summary counting in the browser. |
| Backup | Medium / external latency | The shell opens immediately, then status and Supabase file-list APIs load independently. Delay depends on Cloudflare/GitHub/Storage APIs; this page is not the cause of the full-screen startup delay. |
| Public Queue | Low–Medium | Current-day rows only, but uses `select('*')`; every Realtime event refreshes the entire day instead of applying one changed row. |

### Recommended implementation order based on the measurements

#### P0 — remove the delay seen on every page

1. Remove the all-Patients request from blocking `initApp()`.
2. Change appointment and vaccine patient selectors to debounced server-side search (HN, old HN, name, or phone), returning approximately 20 matches only after 2–3 characters.
3. Load only the navbar, requested view, and required modal(s) on first paint. Lazy-load other views, print areas, and modal groups when opened.
4. Split `main.js` by route and dynamically import large optional libraries (Chart/PDF/XLSX/QR) only on pages that use them.
5. Display the application shell first; use an inline loader inside the requested content area while its own query runs. A failed unrelated lookup must not keep the whole screen blocked.

Expected effect: the hard-refresh critical path stops transferring 15.35 MB of Patients data and no longer performs 20 sequential patient requests. The Registration query already demonstrates a reduction from 19,183 rows to 10 rows.

#### P1 — clinical screens used most often

1. Create one queue RPC/view for Triage and OPD returning the displayed columns, latest vital signs, `visit_count`, and `has_previous_visit`.
2. Remove the duplicate Triage history/count downloads and select only visible fields from Visits.
3. Convert Report and Visit History to a server-side database view/RPC with search, date filters, aggregate visit count, and pagination.
4. Add request cancellation/stale-response guards when users change date filters quickly.

#### P2 — IPD, Observation, and Organizations

1. Cache Wards, Rooms, and Beds for 10–15 minutes.
2. Fetch only active Admissions and only the Patients referenced by them for ward boards.
3. Give IPD configuration a master-data-only loader; do not load Patients, admissions, or movements.
4. Apply Observation date/status filters in Supabase and run independent queries in parallel.
5. Add server-side pagination and database search to Organizations.

#### P3 — remaining growing tables

Use server-side date/status/search pagination for Appointments, Patient Vaccines, Activity Log, and the Public Queue payload. Keep small master tables cached and invalidate only the mutated table.

### Verification completed in this audit

- Production build passed.
- Hospital loading UI checks passed.
- Registration server-side pagination and compact Backup UI checks passed.
- All 10 compact Triage action-row checks passed.
- No application code was changed by this audit.
- No commit or push was performed.

## Executive recommendation

Do not apply one loading strategy to every page. Use three patterns:

1. Transaction tables that grow continuously (Visits, Appointments, Patient_Vaccines, activity_logs, Admissions) should use database filters and server-side pagination.
2. Live queue screens should fetch only today's relevant statuses and the columns displayed on screen, then update incrementally through Realtime.
3. Small master tables (MasterData, Locations, Service_Lists, Wards, Rooms, Beds) should be cached for 5–15 minutes and invalidated after add/edit/delete.

## Recommended implementation order

### Priority 1 — OPD/Triage queues and Report/Visit History

#### OPD and Triage queues

Current behavior:

- `_fetchTriageQueue` and `_fetchOpdQueue` initially restrict Visits by date, but use `select('*')`.
- They then fetch patient details, latest vital signs, and total visit history in separate stages.
- The total-visit/history check reads all Visits for the visible patients in batches. This becomes slower as each patient's history grows.

Recommended change:

- Query only queue statuses needed by each page at the database level.
- Select only queue columns, not `*`.
- Add a database view/RPC that returns the latest visit row together with `visit_count` and `has_previous_visit`.
- Fetch the patient map, latest vitals, and counts in parallel when an RPC is not yet available.
- Cache visit counts for 1–5 minutes and invalidate the affected patient after a new visit is created.
- Keep client-side pagination for a same-day queue; use server-side pagination only when users select a long date range.

Expected effect: large improvement for patients with long visit histories and fewer network round trips.

#### Report and Visit History

Current behavior:

- Both pages share `buildPatientVisitSummaryData`.
- It loads patients registered in the date range, visits in the date range, missing patient rows, and then all historical Visits for every included patient to calculate visit counts.
- The full processed result is rendered before DataTables paginates it in the browser.

Recommended change:

- Replace the multi-stage browser join with a database view/RPC that returns one row per patient/encounter, latest visit details, and an aggregate visit count.
- Add DataTables server-side pagination, database search, date filter, and exact count.
- Load timeline/detail data only after the user opens a patient's history.
- Limit custom date ranges by default (for example 31 or 90 days), with an explicit confirmation for large exports.

Expected effect: the page remains fast even when Visits grows to hundreds of thousands of rows.

### Priority 2 — Observation, IPD, Dashboard, and Appointments

#### OPD Observation

Current behavior:

- `fetchObservationRows` fetches up to 500 rows first and applies the selected date range in JavaScript.
- `loadObservationPage` also loads the complete IPD ward/bed state before rendering.

Recommended change:

- Apply status and date filters in Supabase before downloading rows.
- Load ward/room/bed master data from cache.
- Load full IPD data only when the bed board or an IPD action is opened.
- Run observation rows, patient details, and summary counts in parallel where dependencies allow it.

#### IPD pages

Current behavior:

- `fetchIpdWardBedData` requests all wards, rooms, beds, all admissions, the first 1,000 patients, and 300 movements every time an IPD page loads.
- Several IPD pages call the same full loader even though they need different subsets.

Recommended change:

- Cache wards, rooms, and beds for 10–15 minutes; invalidate after configuration changes.
- For the ward board, fetch only active admissions and only the patients referenced by those admissions.
- For the IPD dashboard, fetch six-month aggregate counts through an RPC instead of all admissions.
- For the inpatient/discharge lists, use server-side status filters and pagination.
- Fetch movements only for the selected admission/bed, except for a small recent-activity widget.

#### Dashboard

Current behavior:

- `fetchDashboardData` downloads every Visit in the chosen range and performs grouping in JavaScript.
- It also queries historical Visits to distinguish new and returning patients.
- Operational stats load up to 1,000 full Admission rows although only active counts are required.

Recommended change:

- Use an aggregate RPC/view grouped by day, department, shift, payer, organization, gender, province, and service.
- Use `count: 'exact', head: true` or small aggregate endpoints for count cards.
- Load chart datasets independently so the summary cards appear first.
- Cache identical dashboard ranges for 1–5 minutes.

#### Appointments

Current behavior:

- `loadAppointments` uses `select('*')` without a date/status limit and paginates only after all rows reach the browser.

Recommended change:

- Default to upcoming appointments plus a short recent-history window.
- Add server-side date/status/search filters and pagination.
- Load archived Completed/Cancelled/Missed appointments only when that filter is selected.

### Priority 3 — Vaccine, organization, activity log, public queue, and master data

#### Patient vaccine records

- `loadPatientVaccines` currently downloads the full table. Use server-side date/patient/status filters and pagination.
- `Vaccines_Master` is normally small; cache it and refresh only after mutation.

#### Organizations

- `loadOrgs` deliberately pages through every organization and then renders all rows before DataTables pagination.
- Change the management table to server-side pagination and database search.
- Cache a compact Active organization list separately for Registration/Triage selectors.

#### Activity log

- The page already defaults to today and limits results to 500, which prevents an unlimited load.
- Move the user-name filter to Supabase and use server-side pagination so matches beyond the first 500 are not missed.
- Fetch summary counts with aggregate/count queries instead of counting only downloaded rows.

#### Public queue display

- The page already filters to today and subscribes to Realtime.
- Replace `select('*')` with the displayed fields and filter statuses in the query.
- Apply Realtime insert/update/delete events to the local queue instead of reloading the entire day after every change.

#### Small master tables

- `MasterData`, `Locations`, `Service_Lists`, `Drugs_Master`, `Labs_Master`, and `Vaccines_Master` currently load full rows.
- Full loading is acceptable while a table is small, but use explicit columns and a shared 5–15 minute cache.
- Invalidate only the changed table after add/edit/delete.
- If Drugs or Labs exceeds roughly 1,000 rows, change the picker to debounced server-side search rather than downloading the whole catalog.

## Database indexes to verify before implementation

Use `EXPLAIN ANALYZE` in a safe database environment before adding or changing indexes. High-value candidates are:

- `Visits (Date)`
- `Visits (Status, Date)`
- `Visits (Patient_ID, Date DESC)`
- `Appointments (Appt_Date, Status)`
- `Patient_Vaccines (Patient_ID, Date_Given DESC)`
- `Admissions (Status, Created_At DESC)`
- `activity_logs (timestamp DESC)`
- `Organizations (Status, Org_Code)`

## Cross-page safeguards

- Debounce text search by 300–500 ms.
- Cancel or ignore stale requests when filters change quickly.
- Disable repeated refresh while a request is still running.
- Render skeleton/summary first and secondary details later.
- Keep export separate from table browsing: export may fetch the full filtered dataset, while the screen should fetch one page only.
- Add request timing logs in development so a page can be considered complete only when first rows and total load time are measured.

## Suggested next local implementation batch

Implement in this order:

1. OPD/Triage queue visit-count aggregation and narrow Visits selects.
2. Report/Visit History server-side query and pagination.
3. Observation database filtering and IPD master-data cache.
4. Appointments and Patient Vaccines server-side pagination.
5. IPD page-specific loaders and Dashboard aggregate RPC.

This order addresses the highest-frequency clinical screens first while keeping each local change small enough to test and roll back safely.
