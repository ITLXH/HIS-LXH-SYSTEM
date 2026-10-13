# Read-only HIS / LIS / UXI incident review — 2026-10-13

## Scope and safety

Investigate Supabase and Cloudflare warning/error causes without changing running clinical workflows. No clinical writes, live CRUD tests, schema changes, permission changes, deployment, commit or push. Existing unrelated changes remain untouched. Read-only browser inspection and synthetic unit tests only. No patient payloads, credentials, signed URLs or user identifiers saved in this report.

## Confirmed live Supabase observations

Project overview observed approximately 12:26 Asia/Bangkok: 73,273 total requests; Gateway 59,125 / 497 warnings / 120 errors; Postgres 199 errors; Realtime 181 errors; Storage 28 warnings. These moving overview figures differ from the explicitly fixed window below and must not be combined as unique incidents.

Fixed log window: **12 Oct 12:29 through 13 Oct 12:29 Asia/Bangkok**. All 212 Postgres error rows loaded and counted from rendered table: **67 SQLSTATE 42703**, **145 SQLSTATE 57014**. No other SQLSTATE appeared in this selected result set.

### HIS organization projection

Latest sampled 42703 at 13 Oct 12:05:04: `HIS_One_Organizations.Contact_Name` does not exist. Log query selects Org_Code, Org_Name, Org_ID, Name, Contact_Name. HIS historical main commit `9a3b39e` contains exactly this projection in dropdown preload. Current local `80f367d` selects Org_Code, Org_Name, Org_ID, Name only. No Contact_Name reference found in inspected LIS/UXI application sources. This establishes the obsolete HIS query shape still executing, but does not distinguish current production artifact from a stale open browser without deployment/bundle evidence.

### HIS patient search timeout

Sample SQLSTATE 57014 at 13 Oct 10:24:58 is a PostgREST SELECT from HIS_One_Patients with OR ILIKE across Patient_ID, Old_Patient_ID, First_Name, Last_Name, Phone_Number, Name_Org and Insurance_Company, plus a separate exact count over the same predicate. This identifies an affected HIS patient-search query, not proof that every one of the 145 timeouts has the same query. No production EXPLAIN ANALYZE was run. Index/RLS cost remains a hypothesis requiring isolated profiling.

### HIS OPD vitals

Current Gateway sample contains repeated GET **and POST** 404 to HIS_One_OPD_Vital_Signs, including 13 Oct 12:06:01 POST. An existing metadata audit on 7 Oct found the relation absent. Current 404 confirms continuing endpoint failure, but the earlier schema result is not a new catalog check. Treat failed saving of vitals as a clinical workflow priority; do not infer that records were stored or deleted. Existing `scripts/sql/staging-opd-vitals-repair.sql` remains unexecuted and untested in PostgreSQL.

### Gateway sample (partial)

Same fixed window: 650 warning/error rows reported. **246 loaded rows** grouped without query values:

| Status / operation | Path | Sample count |
|---|---|---:|
| 400 GET | HIS_One_Organizations | 35 |
| 500 GET | HIS_One_Patients | 47 |
| 404 GET | HIS_One_OPD_Vital_Signs | 119 |
| 404 POST | HIS_One_OPD_Vital_Signs | 17 |
| 400 POST | lis_one_outlab_orders | 3 |
| 400 GET | his-backups/blobs/sha256/[hash] | 25 |

These are sample counts, not complete-window totals. Gateway and Postgres can describe the same request.

### Realtime

Same window reports 181 errors. Sample at 13 Oct 11:21:14: Realtime server GenServer presence tracking times out after 5000 ms on private `his:staff:presence`. This maps to HIS online-staff presence; it is not proof of a clinical record write failure. Supabase official status page currently lists Realtime latency under monitoring; timing/signature is consistent with a provider issue, not proof of causation for every error. Edge Functions incident is separate; this project overview reported zero Edge Function events.

## Request amplification

Live success sample showed archive progress + HIS staff profile + Auth user GETs repeating approximately every 10 seconds. HIS `functions/api/backup/lis-archive-status.js` always calls `requireHisAdmin`, which performs two Supabase reads, then downloads archive progress. One archive status poll therefore generates at least three Supabase requests. Current local archive UI uses 10 seconds only for active jobs, 60 seconds otherwise, visibility gating and no overlap. Compare the served version and actual job state before attributing all polling to an outdated build. Preserve server permission checks when optimizing; never remove authorization to reduce request counts.

LIS visible blood-draw polling is 30 seconds with in-flight/hidden guards in current source; successful live reminders reads match roughly this cadence. Successful dashboard reads also include broad order/settings requests; do not label normal 200 responses as errors.

## LIS and UXI attribution and limits

LIS: observed three 400 POST outlab ledger requests in loaded Gateway sample. Exact rejection body/column/constraint was not available in the inspected Gateway detail; no corresponding SQLSTATE beyond the two HIS-related signatures in the full Postgres window. Current LIS source has a LAK-only missing-send_currency compatibility fallback. This is a candidate explanation, not confirmed cause. Require sanitized proxy response or Cloudflare Worker log before repair.

UXI: current local source has cached, read-only checkSchema with no intentional invalid save probe. Legitimate writes still call uxi_save_app_state with revisions. No UXI endpoint occurred in the 246-row Gateway sample and no Invalid dataset signature occurred in all 212 Postgres errors. This does not prove zero UXI failures across all Gateway rows or verify the served UXI source.

## Cloudflare access and public version observations

Cloudflare browser initially redirected to sign-in; user was asked to sign in in the displayed tab without sharing credentials. Authenticated access subsequently became available and all three deployment views were inspected below. Existing Wrangler session was unavailable in noninteractive execution; no new API token was created or permissions granted.

Public read-only version GETs: LIS returned JSON `2.0.0-2026-10-12T00:52:26.847Z`; this is a build version, not a verified Git SHA. UXI /version.json returned HTML application fallback with status 200, so it cannot attest a version. HIS hostname lookup failed in the command environment; this is not proof the site is down for users. The initial public reads alone did not verify deployment SHAs; subsequent authenticated provider evidence is recorded below.

## Synthetic validation

- Prior turn: HIS request-refresh, clinical-read-safety and patient-registry scripts passed.
- This turn: HIS LIS upstream error propagation (mocked network), archive polling and page read lifecycle scripts passed. Initial upstream script invocation without required checkout argument failed; corrected invocation passed.
- LIS: `node --test tests/unit/api_reliability.test.js tests/unit/file_list_requests.test.js tests/unit/patient_autocomplete_requests.test.js tests/unit/deployment_session.test.js`: **9 passed**; environment notice reflects intentionally unconfigured synthetic test process, not production failure.
- No build needed for this read-only audit; no application edits or live write tests.

## Safe next steps

1. Restore read-only Cloudflare dashboard access and verify active HIS/LIS/UXI deployment versions independently; distinguish production, preview and stale clients.
2. Diagnose OPD vitals missing endpoint in current schema and validate an additive repair in isolated staging with permission tests and synthetic clinical CRUD.
3. Deploy the already-tested HIS Contact_Name projection fix only after release/UAT gates; do not add a guessed column to silence an obsolete query.
4. Profile patient page and count independently under actual staging JWT/RLS; tune queries/indexes from evidence rather than increasing timeout globally.
5. Read sanitized LIS outlab rejection and Backup run outcomes. Blob existence GET 400 may be expected dedup probing; confirm upload/checksum afterward before declaring backup failure or success.
6. Review presence reconnect/backoff during provider incident and ensure delayed notifications recover without duplicate processing.

## Session record

Created this Markdown report and a synthetic read-only UXI audit runner. No clinical/schema/permission changes. No commit/push/deployment. Subsequent Cloudflare verification is recorded below. Remaining limits include the exact LIS rejected column/fallback outcome, complete query attribution of every timeout, and backup run verification; do not report 100% root-cause coverage.

## Further verified evidence during this session

Three lightweight catalog-only SELECTs, no clinical records read or written, confirm **current** schema state:

- `to_regclass('public."HIS_One_OPD_Vital_Signs"')` is NULL: missing relation is now reconfirmed on 13 Oct, not only historical evidence.
- HIS_One_Organizations contains Name and does not contain Contact_Name.
- lis_one_outlab_orders exists but lacks send_currency; observed LIS compatibility source intentionally tries a modern payload before a LAK-only fallback. Missing column is confirmed; attribution of each observed 400 and fallback success still needs its actual response.
- Patient indexes remain only btree Registration_Date, primary key Patient_ID and btree Old_Patient_ID. Broad multi-column wildcard/count cost needs staging profiling; no new indexes were created.
- **Security priority:** patient RLS is enabled, but his_legacy_anon_all remains FOR ALL TO anon USING(true) WITH CHECK(true), and anon has SELECT, INSERT, UPDATE and DELETE table privileges. This is an effective broad anonymous permission configuration. No anonymous clinical read/write or exploitation test was performed. Do not revoke blindly: UXI source explicitly relies on anonymous HIS reads, so migrate integration authentication and test role compatibility before tightening access.

Gateway Pathname facet counts for the complete selected 650-row result: HIS OPD vitals **421**, HIS Patients **130**, HIS Organizations **67**, LIS outlab **4**, Auth user **2**. Searching the endpoint facet for `uxi` returned no results. The remaining 26 rows are Storage-related in the observed set, including 25 backup blob GET 400s in the loaded sample and an avatar signed-object endpoint in the facet list. These facet counts supersede the earlier partial sample for these named paths, not the raw response diagnoses.

Backup source `backup/scripts/backup_rest.py` lines around upload_one performs a GET to blobs/sha256 before upload, treats 400/404 as a candidate absent blob, then uploads and verifies bytes/checksum. This supplies a concrete possible source of the observed burst. Actual successful backup run/verification is still required; do not equate all Storage 400s with harmless probes.

Public UXI static asset `assets/index-CfCkgK_P.js` contains the legitimate revision-aware save RPC and no literal `p_key: "invalid"` readiness probe. This corroborates deployment of the earlier noise fix. `/version.json` remains an HTML fallback, not a version manifest. A new synthetic audit runner `scripts/audit-uxi-schema-readonly.mjs` executed the actual current readiness source with mocked clients: coalescing, cache reuse, auth invalidation, read failure/recovery passed; RPC/insert/update/delete throw in the mock. No live UXI saves issued. The historical test-uxi-readiness-noise script expects the old bug and was not used as a current regression test.

Cloudflare authenticated dashboard became available later in the session. Account overview: **22,518/200,000** observability events today; October 1–13 **313.63k** requests and **634.88k ms** cumulative CPU time. These are not CPU utilization or error-rate measurements. Continue deployment/log review below.

Current Supabase Usage page: average Storage **53.78/100 GB**, egress **1.84/250 GB**, cached egress **0.25/250 GB**, realtime messages **1,211/5,000,000**, realtime peak connections **6/500**, MAU **2/100,000**; all those displayed overages are zero. Spend cap remains enabled; grace-period warning is a conditional quota risk, not evidence that current 400/404/500 errors are quota restrictions. No billing settings changed.

Files created so far: this Session MD and the read-only synthetic UXI audit runner. No application code modified.

### Cloudflare HIS production mapping and runtime

Current authenticated Pages deployment UI reconfirms production/main **9a3b39eed3db3312096ca1310e240b4c1357f1db**, deployment `8e5c6da9-1b0f-4d9f-a6e7-cf098a150bf7`. The tested API/search branch **80f367dc80c2d1b55525546a849906e833c8425b** is **Preview**, deployment `e7c71f50-8f36-4892-8ddd-8dbad40824fd`. Thus the organization projection fix and request guards were not promoted to production. This now has current provider evidence, not merely historical/local Git inference.

HIS Pages Metrics, Last 24 hours at observation: **9,072 Success / 0 Errors**, **35,931 subrequests**, all displayed runtime error categories zero (internal, script exception, CPU exceeded, memory exceeded, client disconnected). These Cloudflare runtime measurements do not imply that direct browser-to-Supabase clinical operations succeed, nor that handled upstream rejections are absent. No deployment or release settings changed.

### Cloudflare LIS: upstream error diagnosis now verified

LIS Overview shows active version **52ac3a4d-2363-4b8f-8cf4-35bbc0ce2d9c**, manually deployed through Wrangler, 100% traffic. Provider UI does not attach a commit SHA to that manual deployment; do not assert that local HEAD is the deployed SHA. Last-24-hour invocation metrics show about **19.32k invocations**, **0 runtime errors**, CPU time **1 ms** in the displayed aggregate.

Observability query `"Supabase upstream error"` for the **same fixed 12 Oct 12:29–13 Oct 12:29 GMT+7 window**, after loading older matched results, returned **four console error events**. Inspected all four:

| Local time | Operation | HTTP | Code | Table |
|---|---|---:|---|---|
| 13 Oct 10:38:39.173 | insert | 400 | PGRST204 | lis_one_outlab_orders |
| 13 Oct 10:02:17.636 | insert | 400 | PGRST204 | lis_one_outlab_orders |
| 13 Oct 07:51:28.860 | insert | 400 | PGRST204 | lis_one_outlab_orders |
| 12 Oct 13:50:10.024 | insert | 400 | PGRST204 | lis_one_outlab_orders |

All events identify the active 52ac3a4d Worker version. This confirms a missing-column/schema-cache insert rejection rather than an uncaught Worker crash. Current database lacks send_currency while the current frontend ledger payload includes it; this is the leading concrete schema mismatch. Diagnostic logs intentionally preserve code/table/action without the actual rejection message, so the exact rejected column and outcome of the compatibility retry are not logged here. Confirm fallback success or non-LAK rejection without issuing a live write before applying the existing additive currency migration in staging.

Additional source risk: `functions/api/list-files.js` logs order IDs, responseBody and file rows. Live log messages match those logging statements. Redact record/file metadata from routine logs; this audit did not copy their values into the report. Source also deletes an existing order/ledger before replacement saves during editing; validate failure preservation in staging before changing that flow. No such operation was exercised in this audit.

Public LIS application asset `assets/main-2Vf2dNHy.js` contains send_currency, PGRST204 handling and the LAK compatibility notice. This verifies that compatibility handling is in the served frontend, not only uncommitted local code. It does not prove the retry saved any particular ledger. OutLab currency synthetic tests: **3 passed** in addition to the earlier 9 LIS request/session tests.

### Cloudflare UXI verification

Active UXI version **fb22af54** is Ready with **100% traffic**, linked to source **632735dce3e2a874128c78c0253124acda83a52a**, branch `codex/read-only-schema-sync`. This confirms the cached read-only readiness fix is deployed. The overview explicitly says runtime metrics are unavailable for Workers with only static assets; **Workers Logs and Workers Traces are disabled**. Do not interpret unavailable metrics as zero errors, or enable observability/settings during this read-only audit. Browser-to-Supabase operations require Supabase-side monitoring and appropriately sanitized client diagnostics.

## Final priorities and unresolved details

1. **Security:** migrate legacy anonymous HIS integration access and then restrict the broad patient policy/privileges with role-matrix and workflow staging tests. No evidence of exploitation was collected; current permission configuration alone establishes the risk.
2. **Clinical persistence:** validate an additive OPD vitals repair in isolated staging, confirm historical storage and role permissions, then release with rollback preserving records.
3. **Release mismatch:** HIS fixes exist only in preview. Complete missing staging/UAT gates before promoting the tested branch; the read-only audit did not merge it.
4. **LIS OutLab:** inspect the precise error response/fallback outcome and stage currency schema compatibility. Keep LAK history and non-LAK units explicit; do not silently convert prices or erase ledgers.
5. **Patient search:** profile actual page and count query plans in staging under JWT/RLS; the current metadata confirms no broad-name-search index but does not isolate the measured cost contributor.
6. **Observability:** handle provider Realtime presence timeouts with bounded retries and stale status; redact LIS file metadata logs; distinguish static UXI metric unavailability and handled upstream errors from Worker runtime crashes.

No payment/spend-cap changes, schema migration, auth/RLS mutation, data deletion, backup/restore execution, clinical save tests, deployment, merge, commit or push occurred. Tests exercised mocked/synthetic behavior; production clinical UAT and backup restore are not claimed. Only the local report and audit runner were added. Cloudflare filters and SQL Editor catalog-only SELECTs were used for investigation; no patient record values were queried.
