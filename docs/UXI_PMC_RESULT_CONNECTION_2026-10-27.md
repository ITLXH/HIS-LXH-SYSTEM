# UXI / PMC result connection — 2026-10-27

## Plan and scope

1. Add staff-authenticated, patient-RLS-scoped HIS reads of released UXI reports and protected attachments. Existing UXI reports without an exact HIS Visit_ID are explicitly patient history; never attach them to the current investigation by HN/date/name guesses.
2. Add an exact patient/visit authorization endpoint in HIS and a bounded read-only PMC result export. PMC verifies the original HIS user through that endpoint before using a service-only RPC for its separate database. Filter by configured issuer and exact patient/visit; retain prescription/revision/line identity and actual issued/returned quantities.
3. Display UXI history (report text, PDF/images) and PMC feedback as separate source records in existing OPD result panels, with dates, empty/error states, refresh and logout/patient-switch guards. Reading feedback never rewrites the doctor's prescription/draft or marks a partial issue complete.
4. Test anonymous/inactive/wrong-patient denial, draft/file protection, malformed results, exact quantities and stale responses with synthetic fixtures; run affected suites/builds. Prepare scoped release and additive PMC SQL separately from the dirty working checkouts.

Clinical dispensing, stock activation, prescription submission and retrospective identity guessing are outside this result-viewing change. No clinical data migration is needed for UXI. PMC needs one additive service-only read RPC; existing clinical flags remain authoritative.

## Release acceptance

Implemented the authenticated UXI report/file reads, exact HIS patient/visit authorization, same-origin PMC proxy, result renderer and existing OPD refresh/polling hooks. UXI reads released `Reported`/`Approved` records from the existing shared Supabase project; file access verifies report metadata and patient scope before private Storage/verified Drive reads. No UXI deployment or schema change is required. Patient history is never merged into an encounter draft. Result presentation is cleared on logout/encounter polling teardown; late responses after patient/visit/session changes are ignored. File viewing reuses the existing private blob/popup lifecycle.

Actual checks:

- New server and client synthetic checks passed after failing tests first. Covers anonymous/inactive/incorrect patient denial, unreleased files, invalid file ID, private Storage and hash/bucket-verified Drive fallback, exact PMC scope, escaped report text, request deduplication and stale response suppression.
- All 22 named HIS `test:*` scripts were run. Twenty passed initially; the two failures were stale expectations from prior releases (one-minute notification duration and anonymous public PDF redirect). Updated those test expectations/fixtures to the already-released five-second countdown and authenticated private-file behavior; both reruns passed. No production notification timing or LIS server code changed.
- Existing private-file client regression passed; fresh Vite build passed into `tmp/uxi-pmc-final-build-20261027`. Existing large-chunk warning remains.
- Synthetic browser check passed at 1280x800 and 390x844: correct original report date, actual partial PMC quantities, authenticated file fetch and tracked popup, no page overflow or page errors. Corrected the synthetic demo's outer grid minimum width during verification; production result table scrolling is scoped to the new cards.
- Paired PMC package passed 510 tests / 95 files, build/typecheck/lint/secret checks. Its additive read RPC/configuration rollout is documented in `PMC_HIS_RESULT_READ_2026-10-27.md` in that repository.

Hosted authenticated viewing of real results remains a separate acceptance check. PMC staging currently has zero canonical prescription revisions and clinical dispensing is disabled; connecting read APIs does not create results or submit browser-only physician drafts. The new PMC read flag/issuer and one additive migration require the scoped PMC hosted approval. No clinical data or stock activation is part of this release.
