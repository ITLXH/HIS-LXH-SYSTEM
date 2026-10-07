# HIS request fixes and LIS investigation — 2026-10-06

## Objective and plan

Reduce redundant reads while preserving clinical notifications and data writes. Work locally; validate before any push. No deployment or production database changes. Preserve unrelated activity-log and triage edits. Inspect the neighboring LIS checkout read-only; its server configuration and detailed Supabase logs are not yet available, so screenshot error counts cannot establish ownership.

Implementation plan: serialize/coalesce alert and queue refresh bursts with a trailing refresh; preserve cached alerts when reads fail; tear down TV clock/channel on route exit/logout; distinguish HTTP endpoint errors from offline state; preserve OPD fallback with periodic reconciliation; test concurrency, lifecycle, failure behavior and existing clinical workflows. Document all results and remaining browser/release checks here.

Risk: coalescing must retain events arriving during a request. Realtime must retain fallback reconciliation. No automatic retries of clinical mutations. Browser and network tests must avoid production data writes.

## Implemented in HIS

- Added `src/requestRefresh.js`: debounce bursts for 150 ms, serialize reads, keep one trailing refresh for events received during a read, release guards on errors, and skip scheduled work when its view/session is no longer eligible.
- Applied it to OPD queue, bell alerts, Dashboard, Report and TV queue. Report now returns its underlying async read so the guard covers the complete operation.
- Retain prior successful appointment/room alerts when reads fail. Reset/invalidate the alert cache on logout/session expiry.
- HTTP error responses no longer mark the entire app offline. Network failures and timeouts still enter offline recovery. Mutations are never automatically retried by this change.
- OPD realtime now reconciles immediately on subscription/reconnect and every minute while healthy, while preserving 15-second polling on channel failure. Slow polls cannot overlap. Generation checks prevent logout or overlapping setup from resurrecting channels or processing late responses.
- Stop TV clock/channel on route exit, logout and expiry. Ignore obsolete TV events/responses and handle null visit status safely.
- Dashboard/Report/Visit History routine two-minute timers skip background documents. Dashboard and Report reads are coalesced. Their existing aggregation logic remains unchanged.
- Failed primary OPD queue reads throw to the UI instead of starting an empty-result fallback. Successful empty results retain the existing recovery behavior. Payer-column compatibility fallback is restricted to missing-column codes; other patient errors propagate. A failed refresh preserves the prior queue with a visible warning. Successful refresh clears that warning. Changed user/date/room scope prevents obsolete queue results from rendering.
- Stop encounter result timers on logout/expiry. External RIS/pharmacy polling skips hidden/empty encounters, prevents overlapping reads for the same provider/encounter, ignores results after patient/session changes, and marks the draft dirty only for actual field changes. Providers are currently optional; this is conditional traffic protection, not a claim of observed production provider load.
- Encounter LIS reads ignore old patient/visit/session responses. A request token prevents an old request's completion from unlocking a newer patient's in-flight read.
- Global LIS setup, acknowledgement loading, seeding and result polling now invalidate late responses on logout or replacement setup. An obsolete seed cannot restart a timer, and an obsolete poll cannot release a newer session's guard.
- Earlier Archive changes remain included locally: visible-only, single pending request, active/idle cadence and failure backoff.

No database migrations or data mutations were introduced. Pre-existing activity-log migrations and their added triage migration tests are excluded. The staged triage test only corrects stale direct-DELETE expectations to the existing recovery RPC; the original working-tree migration assertions are preserved.

## LIS relationship: confirmed vs unconfirmed

Read-only inspection of `C:/Users/asus/Desktop/Project/LIS-LXH-main`:

- Both `.env.production` and `.env.local` URL settings point to `https://pzyrowzghrcfpmhkreag.supabase.co`, matching HIS. `docs/LIS_LXH_WORKER.md` also records this shared project. Deployed Worker secrets were not independently read.
- HIS sends LIS data reads through `window.opdTestLisRequest` to the LIS Worker `/api/data`. LIS's `src/api.js` uses this proxy too; `functions/api/data.js` forwards requests to Supabase REST/RPC and returns upstream failure status plus its database error body.
- A mock-network test executing the actual LIS handler demonstrates that an upstream `42703` response produces HTTP 400 with the same code and only one upstream request. Consequently, one failing LIS-backed query can appear as both a database error and a Gateway error. This demonstrates the mechanism, not attribution of the 547 real errors.
- LIS blood-draw reminders poll every 30 seconds (about 120 reads/hour/visible logged-in tab); source already has an in-flight guard, hides its timer in background tabs and stops on a missing-table error. Inventory badge checks run every five minutes while visible. No generic automatic retry loop was found in the inspected `fetchProxy`/handler path.
- The OutLab compatibility path attempts an insert with `send_currency`, then a legacy LAK payload only for a missing-column error. This is a candidate for repeated schema-related failures if the deployed schema lacks that column, but there is no production error evidence proving it is involved.

The 547 Postgres errors cannot be assigned to LIS from aggregate counts. Even a `lis_one_*` pathname may be a HIS integration read through the LIS Worker. Required evidence: timestamps, SQLSTATE/message, Gateway pathname/status, and corresponding LIS Worker action/table/function/caller context. Avoid collecting patient query payloads or tokens. Accessible browser inventory contained no logged-in Supabase dashboard; requested sanitized error details from the user. No live Supabase queries or production archive runs were performed.

## Validation results

Passed:

- All 20 HIS `test:*` npm scripts (including the new `test:request-refresh`). These include source-level UI/permission checks and behavior tests; they are not 20 live clinical end-to-end scenarios.
- New behavior tests execute actual source blocks against controlled network/timer/DOM fakes: burst coalescing, trailing events, failure release, view eligibility, HTTP-vs-network errors, no write retry, OPD healthy/disconnected polling, slow request overlap, logout during poll/seed, old channel callbacks, alert failure preservation, successful empty alerts, stale alert responses, TV re-entry/exit, failed OPD primary read without fallback, external provider no-op/changed updates, background and patient switching, LIS patient switching and old-request guard isolation.
- `node scripts/test-lis-upstream-errors.mjs C:/Users/asus/Desktop/Project/LIS-LXH-main`: actual LIS API error propagation with mocked fetch; no production calls.
- LIS targeted unit command: `node --test .../tests/unit/dashboard_date.test.js .../tests/unit/outlab_currency.test.js .../tests/unit/requisition_order.test.js`: 10 passed, 0 failed. No LIS files modified.
- Real local browser fixture at `/scripts/fixtures/archive-dashboard.html`: 10 checks passed using the actual Archive module/partial and mocked API. Covers hidden/open/return, completion rendering, 20 concurrent refresh callers sharing one read, one manual dispatch, active progress/button state and visible error. Saved evidence: `API_BROWSER_TEST_2026-10-06.png`.
- `node --check src/main.js`, `git diff --check`, and `npm run build` passed. Build required approved local execution for parent directory metadata; existing large-bundle warning remains.
- After later LIS/optional-provider safeguards, reran `test:request-refresh`, `test:opd`, and `test:notifications`; all passed. Final build is rerun after the final code revision.
- Final revision: all 20 HIS test scripts, syntax checks, mocked LIS handler test, diff whitespace check and production build passed again. The large-bundle warning is unchanged.
- Actual full app and real Supabase SDK in the local browser, with mocked auth/backend/realtime: 16 workflow checks passed. Covers login/profile, OPD rendering and refresh bursts, failed-read preservation/recovery, date filter, realtime arrival/reconnect, LIS result notification and single acknowledgement write, TV rendering/exit, endpoint 500 isolation, archive completion, logout and obsolete events. Evidence: `API_WORKFLOW_TEST_2026-10-06.png`. Test harness timing and synthetic patient fixtures were corrected during testing; these were fixture defects, not production defects.
- Global LIS lifecycle behavior tests additionally passed for logout during setup/poll and guard ownership after session replacement.

## Remaining work / release gate

Ready for a review-branch commit/push after the final checks. No production deployment is included. The mock browser fixture does not replace authenticated multi-user clinical end-to-end tests. Before merging into the production branch, use a safe staging environment/account to verify actual OPD calls, LIS upload/acknowledgement persistence, manual Archive progression, reconnect, patient switching and room filters under real schema/RLS/realtime. There is no accessible authenticated staging or Supabase dashboard session in this chat. Final Git status is recorded in `API_RELEASE_STATUS_2026-10-06.md`.

The screenshot error attribution is pending sanitized detailed logs. Incremental LIS fetching, cross-tab leader polling, Dashboard aggregation/query-size improvements and complete partial-pagination failure handling remain separate work; they are not claimed fixed here. Existing global LIS notification polling remains intact to preserve clinical alerts. Deployment can prompt re-login because application sessions are tied to the build version.

Changed/created files: `src/main.js`, `src/requestRefresh.js`, `package.json`, `scripts/test-request-refresh.mjs`, `scripts/test-lis-upstream-errors.mjs`, `scripts/fixtures/archive-dashboard.html`, this document and the browser evidence image; earlier Archive change files are recorded in `API_REQUEST_REDUCTION_2026-10-06.md`.

## Reproduce the full local workflow test

Run `node scripts/generate-workflow-fixture.mjs`, then `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`. Open `http://127.0.0.1:5174/scripts/fixtures/his-workflow.html` and click **Run workflow checks**. The generated HTML is ignored by Git and reconstructed from the current index. It is not included by the production Vite build. The fixture rejects non-loopback hosts and mocks backend/auth/realtime before main loads. Navigate back to the fixture entry to rerun; do not reload a history-updated app route such as `/opd`, which loads the ordinary app instead.

## Expected request reduction and rollback

Archive status: hidden panel makes zero scheduled reads; idle visible panel changes from 360/hour to about 60/hour; active runs remain about 360/hour with no overlap. OPD notification reconciliation changes from 240/hour to about 60/hour while subscribed, and retains 240/hour during a channel outage. These are per-tab theoretical rates, not measured production totals. Burst coalescing reduces duplicate reads depending on events/users; no overall percentage is promised. Global LIS notification cadence remains 30 seconds to preserve alerts.

After staged verification and any eventual deployment, compare equal-time windows with similar active-user counts: gateway paths/statuses, Auth user reads, archive status reads and Postgres SQLSTATE groups. Capture no patient payloads or tokens. Roll back the API-fix commit if queue freshness/notification/patient isolation regresses; no database rollback is required because this change contains no migrations. A new build can prompt re-login under the existing release-session policy.
