# HIS page audit — 2026-10-07

## Authorized scope

Audit HIS page loads and request lifecycles, preserve patient retrieval, test changes before committing/pushing. Use synthetic data on a loopback origin; do not mutate production patient data, migrations, RLS, or the separate LIS/UXI checkouts. Existing unrelated migration and triage-test edits are excluded.

## New findings

- Manpower subscribed on entry but did not unsubscribe on route exit/logout. Realtime updates could trigger invisible-page reads. Pending responses lacked session/date/lifecycle guards. The shared staff cache also lacked session ownership.
- IPD linked-visit read errors became successful empty history. A slower admission response could replace another admission's chart. Old chart sections could remain when switching patients and the new read failed.
- Browser audit exposed a patient profile modal still visible after logout. Patient-detail responses had no session/latest-selection guard and logged the complete patient payload to the console. Logout now closes modal overlays/clears profile identity; obsolete profile reads cannot render or reopen the modal, and payload logging is removed.

Changes stop only manpower read subscriptions/timers on leaving, retain overview save timers, reject obsolete reads, fetch staff through its authorized backend, share concurrent IPD reads, fail incomplete linked-history reads, preserve the last successful same-admission sections with a warning, and clear old sections when switching admission/logout.

## Validation plan

Run actual-source lifecycle/error tests, every configured page through the real app with mock Auth/API/Realtime, existing patient workflow checks, all package test scripts and production build against the staged snapshot. Record detailed results below before release.

## Page-by-page request review

Entry/manual loads are not background polling. Counts and exact observed endpoints are stored in `API_PAGE_AUDIT_2026-10-07.json`; counts cover the route's test window, including shared notification reads, rather than proving production caller ownership. Empty master tables are synthetic empty-state tests; clinical routes additionally contain a synthetic patient/admission.

| View | Request source / assessment | Verification |
| --- | --- | --- |
| dashboard | Visible two-minute refresh; bursts share reads; full paged clinical data | Load, totals, failed refresh preserves last success |
| report | Visible two-minute refresh; patient/history reads paged | Load, rows, failed supplemental read preserves rows |
| visit_history | Visible two-minute refresh; shared concurrent refresh | Load, encounters, failure preserves rows |
| patients | Server-side table pagination/filter and manual profile lookup | Load, HN/old HN/name/phone lookup, stale profile and logout guards |
| offline_sticker | Local form/printing; no API on entry in fixture | Render/entry only; physical printer not tested |
| settings | Shared startup master/settings reads; no entry poll | Render/entry only; settings mutations not exercised |
| staff | Authorized staff backend on entry; no interval | Load/empty-state; existing backend tests cover persistence |
| manpower | Realtime refresh formerly survived route exit; now scoped and shared | Load, exit/reentry, hidden/visible, stale date/session, pending save preservation |
| printer_settings | Local settings; no API on entry | Render/entry plus existing settings tests; hardware not tested |
| orgs | Organization entry/manual reads; invalid Contact_Name projection already removed | Load plus dropdown/schema/failure regressions |
| triage | Entry/manual queue reloads | Patient queue load plus existing action/CRUD tests |
| opd | Queue Realtime with visible reconciliation, healthy 60s/disconnected 15s | Patient queue, burst, error/recovery, date and channel lifecycle |
| opd_test | Consultation LIS/external polling pauses off-page/hidden; shares pending reads | Selected patient consultation loads; concurrency/patient switch/no-op autosave tests |
| opd_observation | Entry loads observation/ward/admission data | Load/empty-state plus existing operation tests |
| opd_observation_list | Entry loads observation/ward/admission data | Load/empty-state plus existing operation tests |
| users | Profile/presence reads on entry; presence timer uses Realtime | Load plus auth/security tests; live multi-user permissions still needed |
| services | Master-data entry/manual CRUD reads | Load/empty-state; no automatic interval found |
| locations | Master-data entry/manual CRUD reads | Load/empty-state; no automatic interval found |
| appointments | Entry/manual list reads; bounded patient picker | Load and actual old-HN picker; production appointment save still needed |
| ipd_ward_bed | Nine parallel board reads per entry; no background API clock | Bed board, dashboard and admission route modes loaded |
| ipd_inpatient_list | Shared board reads on entry | Inpatient and discharged route modes loaded |
| ipd_chart | Admission-scoped clinical reads; concurrent identical reads shared | Patient HN, read failure, old/new admission and logout isolation |
| ipd_config | Shared ward/room/bed/admission initialization | Load/empty-state; production configuration writes not exercised |
| vaccines | Entry/manual vaccination list reads; bounded patient picker | Load and actual patient-name picker; production vaccination save still needed |
| vaccine_master | Master entry/manual reads | Load/empty-state; no automatic interval found |
| drugs | Master entry/manual reads | Load/empty-state; no automatic interval found |
| labs | Master entry/manual reads | Load/empty-state; no automatic interval found |
| activity_log | Paged/filtered entry/manual audit reads | Load/empty-state; unrelated recovery migrations excluded |
| backup | Visible archive status only: active 10s, idle 60s, failure backoff | Status completion, polling/lifecycle tests; no real restore/archive run |
| public-queue | Realtime queue refresh, local display clock | Patient queue and route/channel teardown |

Global LIS result alerts and OPD queue notifications legitimately operate across authorized pages. Backup server calls legitimately perform auth/profile checks before storage access. Removing those checks would change security and is outside this fix. Version checks target same-origin `/version.json`, not Supabase; IPD care-task clocks redraw local data rather than issuing API reads.

Existing IPD board/default Supabase result limits and linked-IPD-history `limit(1000)` are unchanged. The audit does not certify full-history completeness for admissions beyond those limits. Addressing them requires a separate scoped pagination/query plan and representative large-dataset integration tests; do not claim that an empty-state page pass establishes it.

## Production limitations

Dashboard screenshots alone do not attribute every Postgres/Gateway error. The supplied log confirms `42703` on `HIS_One_Organizations.Contact_Name`; `57014` timeouts still require SQL/caller details. LIS reminder cadence and UXI RPC probes belong to their respective release paths. A mock page-load pass does not certify all production CRUD, clinical workflows, database integration, or deployment. GitHub previously rejected pushes with HTTP 403 requiring email verification; no production release is claimed.

## Browser and source-executing results

- Final all-page browser run: **34 route loads, all 30 configured views, 81 assertions passed**, zero uncaught errors/rejections. Expected errors were deliberately injected for linked-visit failure and a missing admission. Normal-route console had no unexpected errors; incomplete synthetic MasterData generated expected fallback warnings.
- Patient detail remained correct after navigation through every route. Logout during a modal's backdrop/show animation now closes the delayed overlay, clears patient HN, and allows the profile to open normally after re-login. The final screenshot shows the login screen with no patient overlay.
- Existing workflow regression was rerun separately (sequentially because fixtures share loopback localStorage): **all 27 checks passed**. Evidence: `API_WORKFLOW_RETEST_2026-10-07.txt`.
- Actual installed manpower module tests cover burst sharing, reads shared while pending, hidden-tab pauses/visible reconciliation, stale date/session responses, retired callbacks after reentry, initialization after route exit, authorized staff read rather than an unowned cache, and preserving an already scheduled overview save on route exit.
- Actual main.js functions are executed in VM tests for IPD linked-read failure preservation, admission switching, twenty concurrent reads becoming one backend read, logout response isolation, latest-patient-profile selection, stale profile completion after logout, and modal-animation session boundaries.

Evidence: `API_PAGE_AUDIT_2026-10-07.json`, `API_PAGE_AUDIT_TEST_2026-10-07.png`. A page-load pass is narrower than complete production CRUD certification; the table above records that distinction for each page.

## Staged release verification

Exported the reviewed Git index into `tmp/page-audit-stage-20261007` after stopping the dev server. All **22 `test:*` package scripts passed**, including the new `test:page-lifecycle`, then **`npm run build` passed** (140 modules). The existing >500 kB bundle warning remains; built JS is approximately 1.21 MB / 299 kB gzip. No functional test failure remained. Browser-tested source and staged-export source are compared with normalized Windows line endings before commit.

Excluded/preserved the three pre-existing user changes: `scripts/test-triage-clinical-crud.mjs`, `supabase/migrations/20260924100000_activity_log_recovery.sql`, untracked `supabase/migrations/20260926100000_activity_log_recovery_schema_cache.sql`. The isolated export tests the committed baseline for those files. No unrelated migration is staged.

Reproduce: run all `test:*` scripts in package.json and `npm run build`; generate loopback browser fixtures with `node scripts/generate-workflow-fixture.mjs --pages` and without `--pages`; run the local Vite server on 127.0.0.1:5174, then click the test button at `/scripts/fixtures/his-page-audit.html` and `/scripts/fixtures/his-workflow.html` sequentially. Do not reload the fixture's history URL (`/dashboard`, etc.) as a standalone app page; return to the explicit fixture URL. Close fixture tabs/stop the server before editing sources or exporting the staged checkout.

Release branch: `codex/reduce-api-requests-20261006`; existing draft HIS PR: https://github.com/ITLXH/HIS-LXH-SYSTEM/pull/1. Commit/push outcome is recorded after the authorized attempt. No merge/deploy or production patient mutation is part of these tests.
