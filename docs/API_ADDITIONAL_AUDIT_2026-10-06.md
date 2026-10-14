# Additional API and error-handling audit — 2026-10-06

## Scope and evidence

Read-only source audit plus this Markdown record. No additional application changes, database operations, commit, push, or deployment. Earlier local Archive changes remain pending browser verification. Existing user edits remain untouched.

New screenshots show a rolling 24-hour overview: 84,214 total, 98.3% success; API Gateway 70,666 with 722 warnings/142 errors; Auth 8,002 with 1 warning/0 errors; Storage 4,458 with 27 warnings/0 errors; Postgres 931 with 547 errors; Realtime 157 with 2 warnings/3 errors. These categories can describe the same underlying operation. Counts alone do not identify failing SQL, HTTP endpoints, or unique failed clinical actions. The local Archive patch is not deployed and cannot explain changes in production counts.

## Confirmed code findings and proposed order

### 1. Alert refresh fan-out and overlapping queue refreshes — high priority

`src/main.js:4698` (`checkAlerts`) queries pending Appointments and today's waiting Visits every invocation. New OPD arrivals invoke it individually (`:9943`); global LIS notifications, seed, and acknowledgement flows also trigger it. The OPD realtime callback (`:9985`) immediately calls `loadQueue` for every Visits event while OPD is visible. `loadQueue` (`:10538`) performs a full queue fetch and re-renders its DataTable without an in-flight guard. A burst of writes can therefore trigger multiple alert reads and full queue loads, potentially rendering older responses after newer ones.

Proposed fix: share pending requests, debounce bursts, preserve a trailing refresh for changes arriving during an in-flight request, and separate rendering LIS bell state from refetching unrelated Appointments/Visits. Do not permanently cache a live queue or discard later updates. Test burst updates, changed date/room filters, failed reads, and correct final queue/bell content.

### 2. Public TV queue subscription survives leaving the view — high priority

`src/main.js:15165–15210`: entering TV creates a new clock interval without retaining its handle. The channel is only removed when entering TV again. Route navigation, logout, and session expiry do not tear down `publicQueueChannel`. Its callback refreshes the daily Visits list on every Visits event without checking whether TV is visible. This adds hidden-view reads after TV has been opened; repeated entries also accumulate clock callbacks. The clock itself does not send requests.

Proposed fix: one lifecycle-managed clock/channel; stop on leaving TV and logout; deduplicate/debounce display reads. Preserve voice call event processing when TV is active. Verify enter/leave/re-enter and logout.

### 3. OPD fallback polling is always enabled — high priority

`src/main.js:9971–9994`: a 15-second poll runs alongside the realtime subscription, regardless of its connection status. The poll has no in-flight guard. Baseline is about 240 Visits reads/hour/tab, excluding seeds and event-triggered reads. Setup awaits seed before assigning a channel/timer, so overlapping setup or teardown during seed also needs lifecycle protection.

Proposed fix: track realtime status and use slower reconciliation while healthy, faster fallback when disconnected, plus an immediate reconciliation after reconnect. Protect setup with a generation token and polling with an in-flight guard. Do not remove fallback based solely on a successful initial subscription; test missed events and network reconnects.

### 4. Dashboard/report repeatedly fetch large datasets — medium priority

`src/main.js:4597–4607`: refresh every 120 seconds. Dashboard (`:4913`) paginates full Visits, then Patients, then historical visit batches and additional statistics. Patient `.in()` uses the entire ID set (`:4994`), which can produce oversized URLs for large ranges. Report (`:5847`) also paginates Patients and Visits and fetches additional patient/history data. Dashboard/report lack visibility-of-document and in-flight guards. Requests and bytes scale with selected range and patient count.

Proposed fix: guard/coalesce by selected range, ignore stale responses, suspend routine refresh while document is hidden and reconcile on return, batch patient IDs, select needed columns, and consider a reviewed aggregate query later. Validate totals for new/returning patients, shifts and date boundaries; do not introduce a migration solely to reduce polling without checking query plans.

### 5. HTTP 5xx marks the whole application offline — high priority for usability

`src/main.js:49–70`: any 5xx returned through `fetchWithNetworkStatus` sets global state to offline. Subsequent non-health requests are blocked while offline/restoring. Recovery probes Auth health every 10 seconds (`:82–115`). An individual API/server error can therefore temporarily block otherwise healthy clinical endpoints; Auth health success does not establish that the failed endpoint recovered.

Proposed fix: distinguish actual network failure/timeouts from endpoint HTTP errors. Preserve endpoint status/body for diagnosis and use endpoint-specific retry/backoff where safe. Do not automatically retry clinical writes without idempotency. Test one failing endpoint while normal read/save endpoints remain available.

### 6. LIS polling and external provider lifecycle — medium priority

Global LIS polls the newest 100 files every 30 seconds (`src/main.js:10429`), with an existing in-flight guard. Visible encounter polling separately fetches orders/files (`:21170`, `:21275`). These can duplicate work. External ultrasound/xray/pharmacy timers invoke providers without visibility or per-type in-flight guards (`:24574`). Current built-in source contains no provider implementation; external-provider network load is conditional on a provider being supplied. Normal encounter exit stops timers (`:22969`), but general route/logout handling should also enforce cleanup. Unlike the external provider, the encounter LIS fetch already checks view visibility and in-flight state.

Proposed fix: share/cache concurrent reads with short freshness limits, use an incremental strategy with explicit handling of equal timestamps, updates and reconnect gaps, and guard external provider responses by patient/visit identity. Keep background clinical notifications working. Test patient switching while a response is pending. Do not count unconfigured external timers as confirmed production API traffic.

### 7. Error paths can masquerade as an empty/partial successful dataset — high priority

Dashboard pagination logs a read error then breaks and continues computing metrics from partial rows (`src/main.js:4960`). OPD does the same (`:8143`), then its empty-result fallback queries active Visits even after a failed initial read (`:8151`). Alert refresh ignores the Appointments error and clears room alerts on a Visits failure (`:4698`). This can show incomplete totals/queues or make notifications disappear during failures, and adds fallback traffic when the main endpoint is failing.

Proposed fix: distinguish a successful empty result from failure. Retain the last successful dataset with a visible stale/error state; suppress unrelated fallback reads after network/permission/schema failures. Retain valid clinical recovery behavior for a genuinely empty successful query. Test errors on page two and on each alert query, not just happy paths.

## Error diagnosis still requires detailed logs

Postgres 547 errors and Realtime 3 errors need exact timestamps, error message/SQLSTATE, relevant endpoint/query/channel and HTTP status. Correlate database and API entries without exporting patient payloads or tokens. Missing-schema/RPC/permission fallback paths in code are diagnostic candidates, not established causes of these screenshot counts. Do not apply activity-log or other migrations based on this overview alone.

## Validation and release plan

This audit used source inspection and cross-referenced callers/cleanup paths, not production traffic measurement. No additional fixes are claimed tested. Keep the earlier Archive behavior/API/Auth/notification/backup/build results in `API_REQUEST_REDUCTION_2026-10-06.md`. Implement each next change in a small batch with behavioral tests for concurrency, trailing refresh, lifecycle and failure preservation, then verify in a safe browser preview before commit/push. Release/session invalidation remains a separate consideration.
