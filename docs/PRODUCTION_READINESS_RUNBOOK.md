# HIS Production Readiness Runbook

Updated: 2026-08-24 (Asia/Bangkok)

## Current release scope

- Supabase Auth is the login authority; `HIS_One_Users` is the staff profile and permission source.
- Doctor and Nurse use separate named accounts and role profiles.
- Pharmacy is intentionally deferred to the next release. Doctor/Nurse defaults do not grant Pharmacy access.
- LIS remains active. RIS must stay in its safe "not connected" state until the real RIS endpoint, authentication method, and payload contract are supplied.

## 1. Authentication and staff roles

- Admin, OPD Doctor, and OPD Nurse are linked to `auth.users` through `Auth_User_ID`.
- Temporary passwords must be changed at first login (minimum 6 characters).
- Disabled staff are marked `Status = inactive`; do not delete staff records because clinical/audit history must remain attributable.
- Doctor: OPD diagnosis/treatment, Lab/RIS orders, clinical notes, appointments and IPD clinical chart; no destructive delete; no Pharmacy module.
- Nurse: patient view, triage/vitals, OPD observation nursing notes, appointments and IPD nursing chart; no OPD diagnosis/order editing; no Pharmacy module.
- Per-user page and action permissions may be reduced by Admin, but never raised above the selected role ceiling.
- Doctor cannot manage users/settings/master data, delete clinical records, edit Lab results, or use Pharmacy administration.
- Nurse cannot open OPD diagnosis/order entry, write doctor notes, discharge a visit/IPD case, delete clinical records, or manage system configuration.
- Direct URL access is checked in the router; action buttons are checked in the UI; the final RLS cutover also checks each user action permission for database writes.
- Admin-only Cloudflare endpoints validate the Supabase access token and the linked active admin profile.
- Supabase Security Advisor currently has no ERROR findings. Its remaining Auth warning requires enabling leaked-password protection in the Supabase Dashboard before go-live.

Required Cloudflare Pages environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only)
- `BACKUP_GH_TOKEN`
- Existing backup destination variables documented by the backup workflows

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `BACKUP_GH_TOKEN` in browser code.

## 2. Database migration and RLS deployment order

Already applied:

- All previously pending additive OPD/IPD migrations
- OPD persistence/revision and result-acknowledgment tables
- Auth profile foundation and staff profile sequence repair
- Transitional authenticated profile access

Intentionally pending:

- `20260809110000_auth_rls_cutover.sql`

Apply the cutover only in this order:

1. Deploy the frontend and Cloudflare Functions from this workspace.
2. Configure the required Cloudflare secrets.
3. Login as Admin, Doctor and Nurse and complete the UAT below.
4. In Supabase Dashboard → Authentication → Security, enable leaked-password protection.
5. Confirm no production client still uses the legacy client-side password flow.
6. Run `supabase db push --linked --dry-run` and confirm only the RLS cutover is pending.
7. Apply with `supabase db push --linked --yes`.
8. Repeat the Admin/Doctor/Nurse smoke tests immediately.

Do not apply the RLS cutover before step 1: the currently deployed legacy frontend still depends on anonymous table access.

### Final anonymous-access shutdown

The compatibility bridge in `20260810162000_restore_legacy_anon_bridge.sql`
re-opens anonymous access after the base RLS cutover. Do not remove it while the
legacy production bundle is active.

After authenticated Admin/Doctor/Nurse UAT passes, review and run
`docs/sql/finalize_auth_rls_and_audit.review.sql` manually during a maintenance
window. It is intentionally outside `supabase/migrations` so it cannot be
applied by an ordinary `supabase db push`.

The release is blocked until read-only post-cutover probes confirm that an
anonymous request cannot read `HIS_One_Users`, cannot select `Password_Hash`,
and cannot write clinical tables. Also verify that OPD encounter revisions
allow INSERT but reject UPDATE and DELETE.

## 3. Backup and restore

- Supabase physical backups are present; the latest observed completed backup was 2026-08-08 19:35:05 UTC (2026-08-09 02:35 Bangkok time).
- Backup/restore/list/status/signed-download endpoints now require a verified active Admin session.
- Restore continues to require the literal `RESTORE` confirmation and the workflow creates a pre-restore backup before a real restore.
- Automated backup/restore unit suite: 23 tests.

Before go-live:

1. Trigger one manual backup as Admin.
2. Confirm the ZIP appears in Supabase Storage and its workflow reports success.
3. Run restore with `dry_run=true` using that ZIP.
4. Verify manifest, required tables and object hashes.
5. Schedule a supervised restore drill to a non-production project. Do not test a real restore against production.

## 4. UAT checklist

### Admin

- Login and change the temporary password.
- Open Users and verify Doctor/Nurse role and active status.
- Create a disposable test staff account, login once, then deactivate it.
- Verify Backup status/list is visible and manual backup can be triggered.
- Verify a non-admin receives HTTP 403 from `/api/backup/*` and `/api/admin/users`.

### Doctor

- Login and change the temporary password.
- Open OPD, select a patient from the queue, and verify the clinical workspace opens at `/opd/consultation`; create/edit diagnosis, treatment and advice.
- Create two separate Lab order groups and confirm newest-first ordering.
- View Lab result, acknowledge it, reload and confirm acknowledgment persists.
- Verify destructive delete and Pharmacy management controls are unavailable.

### Nurse

- Login and change the temporary password.
- Verify Triage, vital signs, OPD Observation, appointments and IPD nursing chart are available.
- Verify OPD diagnosis/order editing, user administration, backup/restore and Pharmacy are unavailable.
- Verify LIS result notifications can be seen and acknowledged where nursing workflow allows.

### Data and recovery

- Save the same encounter from two browser sessions and confirm the stale revision is rejected.
- Verify visit history/timeline includes Lab, Ultrasound, X-Ray, medication history and attached result files.
- Verify all timestamps display in Asia/Bangkok local time and store consistently.
- Export one patient timeline and compare it with source records.

## Go-live decision

Go live only after every required UAT item is signed by the clinical owner and technical owner, the RLS cutover is applied, and post-cutover smoke tests pass. Pharmacy and live RIS integration are separate release gates, not hidden prerequisites for this OPD/LIS release.
