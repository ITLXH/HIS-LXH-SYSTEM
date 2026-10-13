# Safe incident repair and release sessions — 2026-10-13

## Objective and baseline
Repair confirmed request/schema noise and release-login behavior without touching real clinical records. Use isolated verified release baselines; preserve unrelated local changes. Commit/push reviewed branches only after synthetic tests and build. No production deployment or database execution is part of this source release.

## Plan and architecture
- HIS: preserve existing query/lifecycle fixes; defer release reload/session invalidation until unsaved work is safe; test asynchronous callback, hidden/offline checks and cancellation. Prepare additive OPD vitals and security cutover candidates under docs/sql, not automatic migrations; validate SQL in an isolated PostgreSQL-compatible runner.
- LIS: remove record/file payloads from routine logs; replace repeated invalid currency insert probes with cached read-only column readiness and LAK compatibility; preserve non-LAK currency and existing data on schema failure. Defer deployment reload while clinical forms/dialogs are open; new builds require fresh application login.
- UXI: emit a real version manifest; invalidate only app/cloud authentication on release changes, preserve report drafts and pending operations; defer reload while editing, pause hidden/offline polling and coalesce refresh work. Keep deployed read-only readiness behavior.

## Safety and validation
No live clinical CRUD, writes, migration, role/grant change, secrets, backup restore or production deployment. All tests use synthetic/mocked data or an isolated in-memory database. Validate role compatibility before any legacy anonymous access cutover. A successful source build is not production UAT or authorization to apply review SQL. Document exact tests, limitations, rollback and commit/push results.

## Progress
Isolated implementation and automated verification completed. Production clinical UAT and schema/security gates below remain open.


## Verified implementation and tests
Source fixes are isolated from unrelated local changes. Production clinical data was never written, deleted, restored or migrated during this repair.
- HIS: all 23 npm test commands passed, including patient HN/Old ID/Lao name/phone/date paging, stale-response and failure preservation, OPD/IPD/lifecycle, auth and archive polling. Production build passed.
- LIS: 94 unit tests passed; new authenticated metadata endpoint coalesces read-only readiness requests, LAK legacy writes omit the absent column without generating a failed insert, non-LAK/schema failure stops before existing-order changes; file logs omit clinical/file payloads. Release safety test and production build passed.
- UXI: release session and asynchronous watcher tests passed; verify:cloud passed synthetic PostgreSQL roles/revisions/atomic rollback, private Storage, offline documents/orders and read-only readiness; tsc and production build passed. Added only Node build types to the lockfile.
- Review SQL passed in-memory PGlite tests: vitals access/action restrictions, anon rejection, repeated repair refusal without data loss, anonymous cutover UAT gate, currency rerun preserving existing THB and invalid currency rejection. Command in UXI: node scripts/verify-incident-review-sql.mjs <isolated-HIS-root> <isolated-LIS-root>.
- Watchers retain active editing/pending saves, coalesce checks, skip hidden/offline checks, ignore invalid manifests/late responses and await authentication invalidation before safe reload. New application release requires login, with drafts/pending records retained. Supabase local sign-out in UXI is device-local, not a global staff logout.

## Confirmed production causes and release gates
Fixed audit window 12 Oct 12:29–13 Oct 12:29 GMT+7: 67 missing Organizations.Contact_Name errors and 145 patient query timeouts; 421 OPD vitals requests failed because the table is absent. The existing HIS source query/lifecycle repairs are based on preview 80f367d, not deployed main 9a3b39e. LIS recorded four PGRST204 OutLab insert failures; missing send_currency is verified in the catalog. Do not attribute every historical PostgreSQL error to LIS.
Production still needs isolated staging and clinical staff UAT before schema candidates in docs/sql are applied. SQL files are review artifacts, not auto migrations. No live grant/policy/table/record change performed.
Legacy anonymous HIS patient access remains a serious security gate: UXI currently depends on anonymous HIS reads. Do not revoke blindly; authenticated HIS/LIS/UXI integration must be staged first. The reviewed SQL deliberately refuses cutover without a UAT flag.
Existing LIS edit flow deletes old order/ledger before replacement; preflight now protects schema rejection but does not make that workflow atomic under network failures. An authenticated transactional server operation is still required and must be staged before releasing a claim of full clinical edit safety.
LIS list-files authorization compatibility and backup restoration require a separate staging integration audit. No live restore tested. Provider Realtime presence timeouts and account incident status are distinct from missing-column application errors.
Build warnings: existing large bundles; LIS outdated Browserslist data. UXI npm reports 13 dependency vulnerabilities (1 low, 1 moderate, 11 high); do not run blanket audit fix against clinical software. Dependency remediation requires scoped regression tests.
Browser fixture tests only synthetic release behavior. Three-system real staff login/clinical workflow UAT is not claimed. Keep source branches unmerged until these gates pass.

## Cloudflare push safety / rollback
UXI Settings > Builds had non-production Version command npx wrangler deploy. Changed only that command to npx wrangler versions upload and verified saved (no Unsaved changes). Production branch remains main and production Deploy command unchanged. This prevents branch pushes from promoting a new live deployment. Reference: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/ . Existing active version fb22af54 remains the release baseline.
Push only codex/safe-release-sessions-20261013. No main merge, production deployment, clinical SQL execution or forced global logout. Roll back source via prior deployment/branch; retain any clinical tables once staff have written records. Session logout takes effect after a future verified release is deployed, when each browser finishes active work; cannot guarantee instantaneous logout of every staff browser from a source push.

### Browser verification
Synthetic fixture at localhost:5183/tests/fixtures/release-safety.html: entering SYNTHETIC DRAFT then Detect new release produced reloads 0 / invalidations 0 and visible notice. Confirm save/close produced reloads 1 / invalidations 1, draft text retained. LIS Cloudflare Builds > Previews Base: Builds for Preview branches disabled; production branch main. UXI preview command saved to versions upload. No deployed active version changed.
