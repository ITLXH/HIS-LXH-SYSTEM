# Supabase warning/error review — 20 October 2026

## Evidence and scope

Audited the linked production project through its configured Supabase CLI and
bounded Management API log queries. Log window: 19 October 17:32 to 20 October
17:32 Asia/Bangkok. Only diagnostic metadata, role labels, resource names and
aggregates were emitted. No patient rows or result-file contents were queried.
Original unrelated working-tree changes were preserved in a separate checkout.

| Finding | Verified cause | Action |
| --- | --- | --- |
| One OPD vitals SQLSTATE 42501 / HTTP 401 | HIS browser sent `anon`; staff requests in the same window returned 200/201 | Gate both vitals readers on a Supabase session; propagate authorization failures instead of reading Visits as fallback; retain RLS/grants |
| 41 Storage NoSuchKey warnings / 52 backup-bucket GET 400 responses | New immutable backup keys were probed with GET before upload | List exact key metadata first; keep existing-object and upload SHA-256 verification and ambiguous-upload reconciliation |
| One Outlab PGRST204 | `send_currency` absent from production table, present in LIS payload | Add text column with established LAK legacy default; no price conversion or amount updates |
| Eight auth_rls_initplan warnings | Auth UID re-evaluated in policy expressions | Wrap only `auth.uid()` in SELECT, retaining exact role/action/row predicates |
| Admission ID allocator lacked action check | Authenticated callers could increment counter before admission permission was checked | Require active staff and existing admission-insert permission before the unchanged allocation algorithm |
| Ten UXI staff PGRST116 / HTTP 406 | `localhost:5173` authenticated profile lookups returned no visible staff row; `.single()` requires one | No production role expansion or account provisioning; local UXI profile/session needs verification |
| One Auth refresh_token_not_found | UXI supplied an unavailable refresh token | Do not reuse old sessions or weaken token rotation; reauthentication is required for that session |
| Seven Realtime Unauthorized events | Authentication failures | No bypass or anonymous Realtime access enabled |
| Six Realtime RPC/CDC errors, one Storage background error | Timeout categories in recorded events | No destructive retry, data deletion, global timeout/config rewrite or restart; follow-up requires recurrence/context |

## Applied database changes

Applied and recorded individually, without running unrelated pending migrations:

- `20261020180000_rls_auth_uid_initplan.sql`: eight policies; exact definition
  drift guards; equivalent access tested across five actor/topic contexts.
- `20261020181000_outlab_send_currency_compatibility.sql`: additive constant
  default; preserves historical amounts, notes and RLS; rerun tested.
- `20261020182000_admission_id_authorization.sql`: exact prior function-body
  hash guard; existing counter allocation and grants retained; inactive,
  read-only, anonymous and missing-state callers denied in synthetic tests.

Each transaction uses a 3-second lock timeout and 15-second statement timeout.
Live metadata verified all eight optimized policies, the currency column, both
allocator guards, staff vitals access and denied anonymous vitals access.
No live counter allocation, patient mutation, restore or delete was performed.

## Advisor outcome and remaining work

Official advisors: **129 warnings before, 121 after; zero advisor ERROR findings**.
The eight auth_rls_initplan warnings are gone. Remaining categories:

- 76 multiple-permissive-policy warnings. Existing admin/staff/role policies
  intentionally overlap in many tables. Consolidation must preserve OR/AND and
  restrictive-policy semantics; they were not deleted to clear a counter.
- 39 authenticated SECURITY DEFINER warnings. Reviewed metadata and guard
  prefixes, including admin-only restore/audit and permission-gated PMC/UXI
  writers. These routines need elevated execution in several workflows. The
  allocator guard was repaired; blanket revocation or SECURITY INVOKER changes
  would be unsafe. This is not an exhaustive per-function authorization proof.
- Five anonymous SECURITY DEFINER warnings overlap the above routines: four
  UXI permission/session helpers and one trigger function. Anonymous helper
  predicates depend on the caller's Auth identity; no anonymous table access
  was granted. Full RPC hardening remains separate from suppressing warnings.
- One leaked-password-protection warning. `password_hibp_enabled` is false;
  token rotation is enabled. Password-policy changes need coordinated sign-in,
  password-change and account-provisioning checks across the hospital apps.
  It was not toggled during live clinical work. See
  [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

The Billing/Quota grace-period banner is an account-usage matter. No plan,
billing or financial settings were changed. Database health was ACTIVE_HEALTHY;
diagnostic statistics showed 64 MB database size, 1.00 table/index cache ratios,
and 24 connections at inspection. These are observations, not a capacity guarantee.

## Validation and limits

89 Python backup tests; focused vitals-session, policy-equivalence, Outlab and
Admission ID tests; auth/security/backup checks; triage CRUD and 14 triage UI
checks passed. Build passed into a fresh temporary directory; existing bundle
size warning remains. Stale triage test expectations were updated to verify the
already deployed scoped recovery/audit delete path, preserving Visit/Patient filters.

Automatic approval review rejected a privileged service-key HTTP smoke test as
unnecessary credential extraction. It was not executed or retried indirectly.
Safe SQL metadata confirmed that the backup bucket is private and contains
backup blobs; HTTP writer behavior was verified with mocks. A fresh live backup
run is still required to verify the new writer against both destinations.
The Computer Use kernel could not initialize, so no authenticated browser UI
smoke test was performed. Clinical form continuity and real staff login were
not exercised through a live UI in this review.
