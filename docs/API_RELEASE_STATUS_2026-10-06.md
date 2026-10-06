# API request reduction release status — 2026-10-06

Implementation and local verification are complete for the scoped request/lifecycle fixes. All 20 HIS test scripts, 16 actual-app mocked browser workflows, 10 Archive browser checks, 10 neighboring LIS unit checks, the mocked LIS proxy error propagation test, syntax checks and production build passed. Browser evidence and reproduction instructions are in `API_FIXES_AND_LIS_CHECK_2026-10-06.md`.

Release branch: `codex/reduce-api-requests-20261006`. Push this reviewed scope as a separate branch to preserve the currently running main deployment. Do not merge before real staging integration checks and actual database-error inspection. No SQL migrations, LIS checkout edits, production writes or archive jobs are part of this release.

Existing user migration checks in `scripts/test-triage-clinical-crud.mjs` and the two activity-log migration files are excluded from this commit. Exact staged-tree testing caught an obsolete triage assertion expecting direct DELETE despite the already-committed recovery RPC. Only its MasterData/Visit deletion assertions were updated in the staged version to verify the actual recovery call and patient filters. The working-tree migration assertions remain intact and uncommitted. All 20 scripts pass on the API-only staged tree after this test correction, and its production build passes too.

Unresolved production evidence: aggregate screenshot counts cannot prove whether all 547 Postgres errors originate in LIS. Shared project and error-propagation mechanism are confirmed; actual SQLSTATE/message/timestamps and correlated Gateway/LIS Worker details are needed. Production quota/billing status also requires dashboard review; lowering request counts does not resolve an exhausted quota by itself.

Git result: implementation commit `243c680c61cf4421558a845f1347bc3f4ebbac32` pushed successfully to `origin/codex/reduce-api-requests-20261006`. Draft PR: https://github.com/ITLXH/HIS-LXH-SYSTEM/pull/1. Main was not merged or changed by this task. This release-status update is a documentation-only follow-up commit.

GitHub connector creation returned HTTP 403 (integration access); the installed GitHub CLI created the PR using the same existing Git credential already used for the successful push, without printing/persisting credentials. The PR is attached to this chat. No production integration, 547-error root-cause closure or measured production request reduction is claimed.
