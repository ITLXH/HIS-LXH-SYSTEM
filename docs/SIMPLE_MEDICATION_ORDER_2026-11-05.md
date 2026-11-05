# Simple medication ordering

The new order editor asks for a catalogue medicine, original prescriber instructions and a positive quantity. Unit is read-only and populated from the selected catalogue. Existing structured prescriptions retain their original fields in a legacy editing section; new prescriptions never invent dose, route, frequency or duration.

Instruction-only batches call `pmc_submit_native_batch_v2`. The additive migration `20261105010000_simple_medication_submission.sql` preserves v1, existing submission enablement, invoker/RLS checks, visit and revision scope, catalogue identity/version checks and idempotent batch replay. It validates quantity, original instructions and matching catalogue unit server-side. It does not activate dispensing or modify stock.

Deployment order: apply the additive function in the HIS Supabase project, verify function permissions and read back its definition, then deploy HIS. Do not deploy this editor before the database endpoint exists. No patient order should be submitted as a production test. Rollback the frontend to the prior deployment if necessary; keep v1 and existing clinical data intact. The new function may remain unused.

Validation: synthetic JS checks cover instruction-only and legacy validation, unit prefill/read-only markup, empty dose, positive quantities and legacy editing. An isolated PGlite database executes the actual migration and tests atomic submission, mismatched unit rejection, missing instructions, invalid quantity, RLS scope, anonymous denial and replay without duplicates. Existing native submission, PMC source API, OPD persistence, department and security checks and production build pass.

Production migration, real PMC receipt and actual clinical dispensing are not established by these local tests. The database test reuses the installed PGlite package in the sibling PMC checkout; it performs no external requests.
