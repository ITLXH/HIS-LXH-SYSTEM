# Safe repair, phase 1 — Organizations — 2026-10-14

Baseline: deployed HIS source 7f0cddcae9e880b545bb74d514f0cc07c509efa9. Original checkout has unrelated active edits; this repair uses a separate managed worktree. Objective: stop missing Contact_Name requests and retain existing dropdown state when a read fails. Keep current registration/request-form behavior intact.

Architecture: Organizations preload in src/main.js is a read-only Supabase select followed by activeOrgsList and #a_org rendering. Current catalog/log audit proves Contact_Name absent. Use the previously verified projection Org_Code,Org_Name,Org_ID,Name. Do not add a dummy database column, alter records/policies, or execute production CRUD.

Plan: remove the nonexistent column/fallback; return before clearing state on failed reads; test the actual preload expression with synthetic query and jQuery stubs. Build and existing regressions must pass before review-branch push. Production promotion remains separate from source commit/push. Rollback is reverting this scoped source commit; no database rollback.

Validation pending. Subsequent phases are release reload safety, patient read performance, vitals schema/staff UAT, LIS order/OutLab preservation and authenticated integration cutover. Each requires its own verification; do not apply schema/permission changes blindly.

Actual Organizations expression tests passed for success, missing contact, empty response and failure/partial-read preservation. Full baseline regression run exposed a pre-existing static Triage test expecting direct MasterData.delete(). Current baseline already uses deleteRecordsWithRecovery; updated only that assertion to require the current recovery path. No delete implementation changed. Full regression/build rerun pending.

The same stale Triage test also expected direct Visits.delete(); aligned its assertions with existing recovery call and retained checks for Visit_ID and Patient_ID scoping. Only regression expectations changed; no clinical deletion code was modified.

Validation complete: all 21 registered test commands passed, including the actual Organizations preload test. npm run build passed; only the existing large-bundle warning remains. No clinical write, data deletion, schema change, grant change or deployment. Commit this phase independently before the release-watcher phase.
