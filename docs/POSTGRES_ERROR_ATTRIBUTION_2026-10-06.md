# Postgres error attribution — 2026-10-06

## Evidence and objective

The supplied Supabase screenshot covers 19:00–20:00. Visible errors include four `42703` messages, `column HIS_One_Organizations.Contact_Name does not exist`, at 19:06:48, 19:08:21, 19:22:21 and 19:22:52, and six `57014` statement timeouts at 19:08:02–19:08:04. Normal `00000` checkpoint/logical-decoding messages are also visible. This screenshot is evidence for these messages only, not the earlier total of 547 errors.

HIS `src/main.js` contained an exact matching projection in `preloadDropdownDataCallback`: `Org_Code,Org_Name,Org_ID,Name,Contact_Name`. `initApp` invokes this preload during login; patient edits, organization changes/imports and other CRUD completion handlers invoke it again. The checked-in Organizations schema defines `Name`, without `Contact_Name`; organization writes also use `Name`. No matching Organizations/Contact_Name references were found in the neighboring LIS `src`, `functions`, `tests` or `docs`. This strongly identifies the HIS preload as the source of this missing-column failure. The screenshot does not show the original HTTP caller or SQL statement; deployed-code identity was not independently inspected.

The same read failure can be represented in Postgres and API Gateway/PostgREST logs. This is not proof that all Gateway errors or all 547 earlier Postgres errors share this cause. `57014` indicates the displayed statement timeout; caller/table/function attribution still needs the detail row's query and metadata. Requested sanitized query structure and application/user names; no production credentials or patient data requested.

## Safe implementation plan

Change only the HIS organization preload to select existing schema fields and use `Name` for the contact label. Preserve organization ids/codes/names and the dropdown format. On another organization-read failure, preserve previous choices and log the error. Add behavior coverage that rejects unknown schema fields, checks labels and empty results, and confirms existing choices survive a failed read. Strengthen the local mock fixture to reject the missing column so this cannot silently pass again.

No SQL migration or production write is needed. Retain the user’s unrelated activity-log edits and extend the existing review PR after tests/build. Risks: checked-in schema is not a live schema export; the screenshot independently confirms only the absence of Contact_Name. Existing fields are used elsewhere in HIS and are already present in the preload projection.

## Validation and release result

- Implemented: removed the nonexistent column from the HIS projection; label contact uses `Name`. Read errors preserve previously loaded choices. No retry/fallback query, SQL changes or LIS edits introduced.
- Passed `npm run test:request-refresh`: executes the actual preload with schema-validated projection, contact/no-contact labels, error preservation, successful empty response and one Organizations read per preload.
- Local actual-app browser fixture passed all 17 workflows, including organization dropdown after login. The mock now reproduces 42703 if Contact_Name is selected, preventing a permissive fake backend from hiding the defect. Evidence: `POSTGRES_ORG_TEST_2026-10-06.png`.
- Final exact-staged-tree validation: all 20 HIS npm test scripts passed; `npm run build` passed with the existing large-bundle warning. Syntax and staged whitespace checks passed. The baseline staged triage test was used, excluding the user's additional uncommitted migration checks.
- Release target: existing `codex/reduce-api-requests-20261006` review branch and draft PR #1. Commit/push confirmation will be recorded after remote verification.

Actual timeout queries remain unavailable; no claim that this change resolves 57014 or all 547 errors. The existing production main still contains this query until the review branch is merged/deployed. Production error disappearance must be verified afterward with an equivalent log window; this task does not deploy.
