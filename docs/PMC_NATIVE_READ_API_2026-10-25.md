# PMC native read API release — 2026-10-25

Scope: three additive Pages Functions files only; the existing HIS frontend, shared authentication, OPD, database, LIS and UXI remain unchanged. Approved by the user for read-only HIS–PMC activation on 2026-10-25.

Base: a7010dd237acd897754658d25081fea29555ab3a. New production files: functions/_utils/pmc-read-auth.js, functions/api/pmc/v1/orders.js, functions/api/pmc/v1/prescriptions.js. Two standalone synthetic scripts accompany the package.

Verification against this exact base: Auth guards, auth-session policy, security hardening, OPD persistence, both export fixture scripts, Vite build into temporary output, and Wrangler Pages Functions compilation passed. PMC counterpart passed 432 tests, 26 browser tests and an actual-handler five-bill synthetic roundtrip. No hospital test records were created.

Activation: initially deploy with PMC_PRESCRIPTION_API_ENABLED=false. Native HIS user authentication and existing RLS remain mandatory; only linked active admin/pharmacy users can read. Service-role use is limited to existing staff-profile verification, never clinical table reads. Keep write/results/ingress flags off. Roll back by disabling export and PMC source flags; preserve all data/history.

Live authenticated schema/RLS acceptance is pending at preparation. Existing locked dependencies report six high-severity npm audit findings; this narrowly additive release does not upgrade dependencies or replace existing operational workflows.

## RLS-visible empty page diagnostics

Add only aggregate page counters (scanned visits, visits with medication, medication visits missing a reliable positive revision, returned rows and hasMore). No identity, date, token or prescription body is logged. Queue response and filtering/permissions stay unchanged. The synthetic queue test verifies zero-revision records remain excluded and telemetry contains no identities or credentials. This supports native read-only activation acceptance without bypassing existing revision safety.
