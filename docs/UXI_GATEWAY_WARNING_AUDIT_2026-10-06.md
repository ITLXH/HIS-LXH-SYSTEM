# UXI Gateway warning attribution — 2026-10-06

## Objective and evidence

The new user screenshot filters Gateway warnings/errors for 09:00–10:00 and shows repeated HTTP 400 POSTs to `/rest/v1/rpc/uxi_save_app_state`. Every visible list row is a yellow 4xx warning; no individual red 5xx row is visible in this list. Red chart segments do not identify the failing endpoint without opening those rows. This is separate from the previous HIS Organizations 42703 and unassigned 57014 timeout findings.

Read-only source search found no `uxi_save_app_state` calls in inspected HIS or LIS application code. The neighboring `C:/Users/asus/Desktop/Project/UXI-LXH-main` checkout defines and calls it. Its `.env` URL and Wrangler URL point to the same `pzyrowzghrcfpmhkreag` project. Deployed application versions/callers are not independently proven by this screenshot.

## Identified mechanism

- `src/lib/supabase.ts:81`: `checkSchema()` calls the save RPC with `{ p_key: "invalid", p_data: {}, p_expected_revision: 0 }` as a readiness probe. It treats `22023` from that probe as expected success.
- `supabase/cloud-migration.sql:141`: the RPC authorizes the user first, then rejects unknown dataset keys with `22023 / Invalid dataset` before any write. Admins reach this validation; other users can receive permission errors instead. Invalid shape and other validation failures can also return the same SQLSTATE on genuine save requests.
- `src/App.tsx`: `retryPendingSync` runs every 30 seconds and, for a signed-in cloud profile, calls `refreshCloudData()`, which calls `checkSchema()`. Additional startup, focus, reconnect, manual refresh and order checks call it too. Thus schema checks can intentionally generate roughly 120 failed RPC probes/hour per continuously active, eligible tab, plus all their other schema reads. Browser throttling and additional events affect actual counts. This is not a measured production total or exact proof of the visible rows' caller.
- `src/lib/cloud.ts:57`: real master/exams/settings/inventory saves also use this RPC. Their HTTP 400 responses must not be dismissed as probes. Distinguish using sanitized response code/message and `p_key`; do not collect `p_data` or tokens.

## Plan and scope

Reproduce the existing `checkSchema()` behavior with synthetic in-memory Supabase responses. No live calls, no UXI edits and no production writes. Document attribution and a concrete change plan. The UXI checkout has many pre-existing modified/untracked application, migration and deployment files; avoid mixing this HIS audit into that independent work.

Recommended UXI fix: remove the deliberately invalid save probe from routine sync checks. Cache schema readiness per session with explicit invalidation/manual recheck; use a read-only, successfully returning diagnostic if RPC existence/access must be verified. Preserve real save validation, permission checks, revision conflict checks and the local pending queue. Only repeat writes when real pending changes exist; back off/requires correction on persistent validation failures. Never clear pending local documents to hide errors. No production migration should be run merely to remove warning noise.

## Validation / limits

Passed `node scripts/test-uxi-readiness-noise.mjs C:/Users/asus/Desktop/Project/UXI-LXH-main`: actual `checkSchema()` function executed in memory with only TypeScript annotations removed. Three readiness calls produced three invalid-key probes, each reporting ready/writable when receiving expected 22023; an unexpected XX000 correctly failed readiness. Source checks confirmed the 30-second periodic refresh-to-schema path and SQL validation before app-state writes. No live RPCs or database execution occurred. Initial harness lacked table constants; added synthetic constants and the final run passed.

`node --check scripts/test-uxi-readiness-noise.mjs` and whitespace checks passed. No production application source was changed, so an additional application build was not needed for this read-only audit/test addition. The optional audit script requires the neighboring UXI source checkout and is not part of the ordinary HIS test suite. Audit/test recorded in the existing HIS review branch; unrelated user edits excluded.

No assertion that all shown 400s are probes, that all 547 earlier Postgres errors originate in UXI, or that actual saves succeeded. Requested response code/message and key-only evidence from the failed requests. UXI implementation and deployment are unchanged by this audit. The screenshot's grace-period/quota notice is a separate billing/quota condition; eliminating probe noise does not establish that quota is available.
