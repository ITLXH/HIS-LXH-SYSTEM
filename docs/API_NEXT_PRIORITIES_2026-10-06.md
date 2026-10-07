# Next API reduction priorities — 2026-10-06

The user reports that UXI and LIS fixes have been requested elsewhere. Their implementation/test/deployment status has not been verified here. This is a read-only follow-up of HIS, not another production change.

## Release state checked

Remote main remains `9a3b39eed3db3312096ca1310e240b4c1357f1db`; review branch remains `bd47671122600ba0c6ea6d1e8b2fa1c72445c0bc` before this documentation commit. Thus the tested HIS API/Organizations fixes are still separate from main. A branch push alone does not put them into the main deployment. Draft PR: https://github.com/ITLXH/HIS-LXH-SYSTEM/pull/1. Real staging integration checks remain required before any eventual release. No production deployment configuration was queried.

## Priority order for further HIS implementation

1. **Reduce shared Patients preload.** Current `preloadDropdownDataCallback` still requests all Patients using `select('*')`, and `initApp` waits for it. It builds only Patient_ID/Old_Patient_ID/First_Name/Last_Name labels. Start by narrowing selected columns, then move appointment/vaccine selectors to debounced, bounded server search and remove the full-table preload from the startup critical path. Keep selected/edit-existing patient labels resolvable, old-HN lookup and authorization intact. Validate appointment/vaccine create/edit and shared patient pickers. Narrowing fields reduces bytes, while bounded search reduces request/row count; do not conflate them.

2. **Make Dashboard/Report failure and range behavior safe, then reduce query volume.** Dashboard still uses full Visits/Patients reads, sends the full patient-id set in an IN filter, and logs/breaks on page errors before computing totals from partial data. Report renders an empty page on a failure. Use explicit failure states, preserve the last complete result with its original range clearly labeled, reject stale responses after range/user changes, batch ids and select only needed fields. Consider reviewed server aggregates/pagination after checking staging query plans. Test page-two failure, patient/history-stage failure, rapid date/shift changes and known complete-result totals. Coalescing added earlier does not resolve these payload/partial-data issues.

3. **Coordinate HIS-side LIS reads.** Global LIS notifications still fetch the newest 100 files every 30 seconds through the LIS Worker. Encounter reads are separate. Short-lived sharing/caching or an incremental cursor could reduce duplicate work. Preserve notifications across background tabs, reconnect gaps, equal upload timestamps, acknowledgement state and patient switching; do not simply stop background clinical alerts. A cursor needs explicit tie-breaking and gap recovery. Coordinate the API contract with the separate LIS work before implementing.

4. **Attribute the six 57014 timeouts before changing database behavior.** Required evidence is sanitized statement/table/function, timestamp, caller metadata and related Gateway status. None has been supplied yet. Validate indexes/query plans in staging after identifying the query. No recommendation to increase global timeouts, weaken RLS or deploy migrations from aggregate counts.

5. **Measure Auth and shared-project limits.** Server `functions/_utils/his-auth.js` validates `/auth/v1/user` and reads HIS_One_Users for API requests. This is required authorization, not a demonstrated retry bug. Profile request frequency by endpoint/user-session without collecting tokens; prefer reducing redundant caller requests or grouping related reads. Any auth caching must preserve revocation, active-status and permission semantics. The screenshot's quota/grace-period condition also needs dashboard review; request reductions do not establish available quota.

## Verification and coordination

Current source locations were inspected; no live data measurements were made. Historical counts/timings in `DATA_LOADING_PERFORMANCE_AUDIT.md` are dated August 2026 and should not be presented as current production measurements. No application code, database, UXI or LIS checkout was changed. Only this Markdown file is new; whitespace check is sufficient for this documentation-only change, and previous application tests are not claimed as validation of the proposed future fixes.

After the three projects' staging checks, verify together: HIS patient lookup into LIS/UXI, orders/results/PDFs and HIS alerts/acknowledgements, patient switching, offline/reconnect, multiple users and logout. Compare equal-duration Gateway/Auth/Storage/Postgres log windows under similar active-user load after an eventual deployment, grouping by endpoint and SQLSTATE. Roll back a release if clinical correctness regresses. Preserve all existing unrelated user edits.

## Push outcome

This documentation was committed locally. The push was rejected by GitHub HTTP 403: `You must verify your email address` (https://github.com/settings/emails). This is a GitHub account prerequisite, not a test failure or sandbox approval rejection. No bypass attempted. Earlier API fixes/audits remain pushed through remote `bd47671`; this documentation is local until email verification and a successful retry. No merge/deployment occurred.
