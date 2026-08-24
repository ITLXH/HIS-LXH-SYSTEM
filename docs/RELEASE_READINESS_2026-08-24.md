# Release Readiness Report — 2026-08-24

Time zone: Asia/Bangkok

Target branch: `main`

Scope: accumulated local HIS changes, OPD production cutover, authentication/security hardening, and backup reliability.

## Release outcome

- The tested clinical EMR is now the production OPD workflow.
- `/opd` is the patient queue; opening a patient goes to `/opd/consultation`.
- `/opd/test` is retained as a compatibility route but no longer has a separate navigation item.
- The legacy OPD modal is no longer opened from the production queue.
- Patient timeline, organization/insurance fields and visit-count badges remain included in the release.

## Automated verification

Passed on Windows in the release workspace:

- `npm run test:opd`
- `npm run test:opd-print`
- `npm run test:auth`
- `npm run test:security`
- `npm run test:backup`
- `python -m unittest backup.tests.test_gdrive_common`
- `python -m compileall -q backup functions`
- `npm run build`
- `npm audit --audit-level=high` — 0 vulnerabilities

The production build completed successfully. The remaining Vite large-chunk notice is a performance advisory, not a build failure.

## Browser smoke verification

Verified through the local application with an authenticated Admin session:

- OPD queue displays one OPD navigation item and no OPD Test item.
- Queue actions and secure public-call buttons render for all visible rows.
- Opening the first queue patient loads the real clinical EMR at `/opd/consultation` with the OPD navigation item active.
- Closing the encounter returns to `/opd`.
- No document-level horizontal overflow was detected in the queue or consultation workspace.
- Main modules rendered without visible alert failures: Dashboard, reports, visit history, registration, triage, OPD, vaccines and appointments.
- Dropdown modules rendered without visible alert failures: OPD observation/list, IPD ward/list, settings, organizations, users, services, locations, drugs, labs, vaccine master, activity log and backup.
- Direct Pages-development requests returned HTTP 200 for `/`, `/opd`, `/opd/consultation`, `/patients` and `/backup`.

## Backup verification

The latest observed scheduled run before this release was GitHub Actions run `32678204859`:

- Primary Supabase backup: successful.
- Data captured: 62,402 rows across 57 tables, 0 table failures.
- Previous manifest referenced 886 Storage objects.
- ZIP location step: successful.
- Secondary Google Drive upload: failed with `invalid_grant`, indicating revoked or expired OAuth authorization.

The release changes make Google Drive an optional secondary destination, refresh OAuth credentials eagerly, and use the service account as fallback when configured. Supabase Storage remains the required primary backup. A new manual workflow run must be dispatched after push; its run ID and outcome will be added below.

## Database and security review

- Authentication, authorization and RLS transition checks are covered by the auth/security suites.
- Backup and admin Cloudflare Functions verify the Supabase access token and active Admin profile.
- The final anonymous-access shutdown remains a supervised production operation as documented in `PRODUCTION_READINESS_RUNBOOK.md`; this release does not silently perform that destructive cutover.
- No real restore was triggered. Restore testing remains dry-run/non-production only.

## Post-push verification

- Manual backup workflow run: pending.
- Primary Supabase backup result: pending.
- Secondary Google Drive result: pending.
- Final release commit(s): pending.
