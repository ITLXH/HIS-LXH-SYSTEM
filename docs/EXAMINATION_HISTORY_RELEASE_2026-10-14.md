# HIS examination history release — 2026-10-14

Scope: save examination names, timestamp, ordering staff and batch identity in the patient's existing HIS Visit history. No order submission to LIS/RIS. Existing LIS result reads remain unchanged.

Persistence updates only Visits.Lab_Orders_JSON, scoped to patient/visit and conditional on the previously read value. Concurrent history additions are reread and merged; retry uses stable order identities. Existing encounter completion merges current history and checks its snapshot before writing. Saved history batches cannot be removed through draft-delete controls.

Local verification: real release UI with mocked Auth/PostgREST saved two CBC batches, reopened the encounter and retained both. Utility tests cover permission denial, stale patient, timeout, duplicate retry, concurrent staff and revision conflicts. Auth, OPD, PDF generation and production build checks pass. Actual production clinical writes and physical printer output were not exercised.

Release built from production main 9a3b39e, retaining the previously deployed customer selector pagination fix. Unrelated checkout changes and SQL migrations are excluded. No database migration is required.

Rollback baseline: Cloudflare Pages production deployment 522f5eb9-06f9-456b-8b31-277ea697f73d. Roll back frontend assets only, preserving newer Visit history.

Request form settings persist per browser; shared server-side template administration is not part of this history-only release.