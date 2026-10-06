# HIS patient retrieval and API safety — 2026-10-06

## Authorized scope

Reduce unnecessary HIS reads while preserving patient retrieval and clinical workflows. UXI and LIS checkouts are being handled separately and will not be edited here. Test before committing/pushing; do not merge or deploy to production from this audit.

## Implementation and verification plan

- Replace appointment/vaccine full-registry startup preload with bounded, debounced search by current HN, old HN, name and phone. Keep paging and selected patient labels; retain existing registry, patient details and encounter APIs.
- Make Dashboard/Report/history pagination complete and failure-safe. Keep the last complete display, label its range and ignore responses for obsolete user/filter scopes. Test failures beyond the first page and more than 100 patients.
- Share only identical concurrent HIS-to-LIS read requests within one user session. Do not cache writes or retry mutations; retain existing notification polling and encounter guards.
- Run focused regressions, the full HIS test suite, build and local browser workflows using synthetic data and mocked backend/auth. Preserve existing unrelated migration/test changes.

## Known external limits

Actual SQL statements/caller metadata for the screenshot's six `57014` timeouts have not been supplied. Aggregate Postgres errors cannot prove ownership of all errors or identify an index fix. No live clinical database writes or schema changes are part of this work.

The last GitHub push was blocked by account email verification. Real staging integration and shared-project quota/log comparison remain separate from local/mock verification. Results and release status will be recorded below after tests.

## Implemented changes

- `src/patientLookup.js` supplies appointment/vaccine Select2 paging: 20 labels plus one lookahead row, 300 ms debounce, HN/old HN/name/actual `Phone_Number` filtering. Selected options survive shared master preload. Names containing ` - ` stay intact. Session changes/aborted searches cannot populate obsolete pickers. No full Patients read is needed for these startup dropdowns.
- `src/clinicalReads.js` bounds patient-id filters to 100 and reads every 1000-row page in stable key order. Dashboard no longer stops after the first short history batch or computes partial totals after a failed page. Report/history propagate supplementary patient and history errors instead of silently truncating counts. Full patient details are retained where existing clinical consumers use them.
- Dashboard/Report/history keep the last complete display on failure and label its original range. Filter/user/logout generation guards reject obsolete results. A visible Dashboard status line is included in its print area; it was absent despite previous code referencing it. An unknown observation count shows `—`, not a fabricated zero. Logout clears these displays and patient selections.
- Identical concurrent HIS-to-LIS reads for the two existing result/order tables share one pending request within one user session. No resolved cache, incremental cursor, background-alert suppression or mutation sharing/retry was introduced. Worker SQL errors retain their message, HTTP status and SQLSTATE for callers.
- Dropdown transport failures now complete startup's preload callback and preserve existing master choices instead of leaving login waiting forever.

## Verification results

- Focused executable regressions passed: bounded paging; HN/old HN/Lao multi-token names/phone; selection id/name; filter sanitization; shared search; aborted/logout search; failed search and recovery; 105 patients and 1107 encounters; history beyond 1000 rows; supplementary/second-page failures; range/user changes; successful empty ranges; unknown/stale observation counts; identical LIS read burst (20 callers, one fetch), fresh next poll, different patient/session, structured 42703, failure recovery and independent writes.
- All **21 configured HIS test scripts passed on the exact staged-source export** `tmp/patient-safety-staged`, followed by a successful `npm run build` there. This excludes pre-existing activity-log migration checks/edits. The working-tree suite also passed; its unrelated migration assertions are not part of this release.
- The real HIS app and real Supabase/Select2 SDK ran on a loopback fixture with synthetic backend/auth/realtime. All **27** browser checks passed, including patient-detail retrieval, appointment old-HN selection, vaccine name selection, selected-option preservation without another Patients read, complete Dashboard/Report/history, failed refresh preservation, OPD/date/realtime/reconnect, LIS notifications/one acknowledgment write, TV lifecycle, network isolation, Backup and logout. Screenshot: `API_PATIENT_SAFETY_TEST_2026-10-06.png`. An initial browser run caught the missing Dashboard status host; corrected the real partial and reran successfully.
- Read-only cross-repository LIS proxy test passed with mocked network: upstream 42703 stays HTTP 400 with one fetch. No neighboring checkout changes or live requests were needed.
- Syntax and whitespace checks passed. Build's existing large-chunk warning remains; it is not a clinical test failure.

## Other projects and release limits

Inspected the other two task results without editing/messaging those checkouts. **Fix repeated Supabase schema probe** reports UXI commit `632735d`, cloud/build/browser-mock verification and pushed draft PR https://github.com/ITLXH/UXI-lxh/pull/1; no merge/deploy. **Audit duplicate requests and polling** has local LIS commit `f6a8840`; its audit reports 79 unit and 47 browser cases plus build passing. Publication there remains blocked by GitHub email verification, being handled in that chat. Those reported results do not substitute for a live three-system integration test here.

Correct complete history pagination can make more reads than the old incorrectly truncated implementation. Bounded filters avoid oversized URLs; this is a correctness safeguard, not a claim that every individual query count decreased. Bounded patient search removes the repeated full-registry preload and concurrent sharing reduces duplicate reads. Production reduction has not been measured.

No database/schema/auth permission changes, production writes, merge or deployment were performed. Existing patient registry, details and encounter read paths remain available and were checked with synthetic data. Before release: exercise actual authenticated staging patient search/details, appointment/vaccine saves, HIS→LIS/UXI orders/results/PDFs, multi-user permissions and logout; obtain sanitized 57014 statements/callers and review plans/indexes; confirm shared-project quota. This work cannot establish zero production risk or attribute all 547 aggregate errors from screenshots alone.

## Reproduction and commit boundary

Run `npm run test:clinical-reads` for the new source-executing regressions and `npm run test:request-refresh` for existing lifecycles/preload transport failure. Enumerate all `test:*` entries in `package.json` and invoke each with `npm run <name>`, failing if any process exits nonzero. Run `npm run build`. Optional cross-repository read-only test: `node scripts/test-lis-upstream-errors.mjs C:/Users/asus/Desktop/Project/LIS-LXH-main`.

For the local browser check, run `node scripts/generate-workflow-fixture.mjs`, then `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`. Open `/scripts/fixtures/his-workflow.html` and click **Run workflow checks**. Backend traffic fails closed to mocks; never reload the fixture's history URL such as `/dashboard` as a standalone app page. Stop the server after checks.

Only the 11 source/test/fixture/MD/screenshot files listed in the reviewed staged diff are included. Preserve/exclude `scripts/test-triage-clinical-crud.mjs`, `supabase/migrations/20260924100000_activity_log_recovery.sql` and untracked `supabase/migrations/20260926100000_activity_log_recovery_schema_cache.sql`. The isolated test export will be removed after verification. Release branch remains `codex/reduce-api-requests-20261006`; existing draft PR https://github.com/ITLXH/HIS-LXH-SYSTEM/pull/1 contains earlier pushed fixes. New commit/push outcome will be recorded after the attempt.
