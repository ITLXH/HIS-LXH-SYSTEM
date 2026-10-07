# Morning API log review — 2026-10-07 (Asia/Bangkok)

## Screenshot evidence

The user supplied Supabase API Gateway logs with the selected window **07 Oct, 06:00–07:00**. The sidebar displays approximately 2.0k gateway log entries, 7 warnings and 14 errors. These rounded log counts are not a count of unique user actions. Visible rows are HTTP **200**; they do not reveal the cause or endpoints of the 14 errors.

Four consecutive `GET /rest/v1/lis_one_blood_draw_reminders` entries occur at 06:59:22, :32, :42 and :52: approximately 10-second spacing. Other visible reads include LIS result files, HIS Visits, Auth user, HIS staff profile and the archive progress storage object. Several reads cluster at 06:59:20–21. Multiple tabs/devices and related server requests can create such clusters; request metadata is required to prove a duplicate loop from a single client.

## Source and remote verification

Read-only source inspection found no `lis_one_blood_draw_reminders` reference in inspected HIS `src`, `public` or `functions`. The reminder watcher exists in the neighboring LIS checkout's `src/blood_draw_reminders.js`.

- Remote LIS main is **`e9ec5bd97ba007604ac19a979289cea78781132a`**. That revision declares `POLL_INTERVAL_MS = 10_000`, matching the screenshot's observed cadence. Its source was read with `git show` in the LIS checkout; the deployed Cloudflare build itself was not inspected.
- Local LIS **`f6a8840`** contains the tested audit changes and declares `POLL_INTERVAL_MS = 30_000`. It pauses hidden tabs, prevents overlapping polls and guards watcher generation/session changes. The review branch `codex/api-reliability-audit-2026-10-06` was absent from `git ls-remote` output. No LIS edit or push was performed here.
- Remote HIS main remains **`9a3b39eed3db3312096ca1310e240b4c1357f1db`**; its review branch remains **`bd47671122600ba0c6ea6d1e8b2fa1c72445c0bc`**. Local safety implementation **`78f0b54`** and documentation **`5ce1966`** are still unpublished. A branch push alone would not merge/deploy main.

For one continuously visible LIS tab, a steady 10-second cadence corresponds to about **360 reminder reads/hour**; 30 seconds corresponds to **120/hour** before initial/manual refreshes and other activity. This is an expected per-tab reduction, not a measured project-wide production result. Several 30-second clients can also produce aggregate 10-second spacing. The main-source match strengthens the old-version explanation but does not establish the number or identity of clients.

## HIS archive/Auth cluster

`functions/api/backup/lis-archive-status.js` calls `requireHisAdmin`, then reads archive run/progress information. `functions/_utils/his-auth.js` verifies `/auth/v1/user` and reads `HIS_One_Users`. Thus an archive status call can legitimately produce related Auth, profile and Storage reads; they should not all be classified as independent application bugs. Permission validation must remain intact.

The tested local `src/lisArchiveDashboard.js` shares an in-flight refresh, polls only when its panel and document are visible, uses 10 seconds while an archive is active, 60 seconds when idle, and 30 seconds–5 minutes on failures. These lifecycle changes were already tested in earlier commits. Repeated clusters in production still require deployed-version and client metadata checks; no new auth caching, timeout increase, RLS relaxation or clinical alarm cadence change was introduced in this review.

## Push retry and limitations

After confirming that the local source had not changed since the 21-script staged verification and 27 mocked browser checks, retried:

`git push origin codex/reduce-api-requests-20261006`

GitHub again rejected HTTP **403**: **`You must verify your email address`**, directing the account owner to https://github.com/settings/emails. This is a GitHub account prerequisite, not an automatic approval rejection. No bypass attempted. Remote publication and production release remain incomplete. Earlier local/mock test results are historical validation, not a claim of fresh live testing today.

Requested HTTP status, pathname, message/code and timestamp for 2–3 entries filtered to Level = Error. These details have not been provided at the time of writing. Do not attribute all 14 gateway errors to LIS reminders (visible reminder reads succeed), to the earlier `57014` timeouts, or to quota from this screenshot alone. The quota/grace-period banner remains visible; available quota and the actual cause of failed requests require dashboard/log details.

## Safe next steps

1. Complete normal GitHub email verification and publish the already-tested scoped HIS/LIS branches; inspect their draft changes and staging integration before a release.
2. Verify the actual Cloudflare deployment commit and browser bundle/build version. After an eventual release, reload clients so old timers are no longer running; compare equal-duration windows with comparable active-user/tab counts.
3. Keep clinical reminders functional. Verify visible/hidden-tab behavior, alarm delivery, reconnect and logout with the LIS owner. Do not further slow or disable clinical alarms just to reduce counters.
4. Inspect the 14 failed gateway entries and correlate their endpoints/status/timestamps with Worker/Postgres SQLSTATE and sanitized query details. Review shared-project quota separately.

This session changes documentation only. Application source, database, live patient data, deployment and neighboring checkouts were not changed. Existing unrelated triage test and activity-log migration changes remain excluded. Whitespace validation is appropriate for this documentation-only update; no extra full app test run is claimed.
