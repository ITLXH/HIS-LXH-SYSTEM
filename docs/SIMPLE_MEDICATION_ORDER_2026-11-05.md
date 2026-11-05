# Simple medication ordering

The new order editor asks for a catalogue medicine, original prescriber instructions and a positive quantity. Unit is read-only and populated from the selected catalogue. Existing structured prescriptions retain their original fields in a legacy editing section; new prescriptions never invent dose, route, frequency or duration.

Instructions use an editable native dropdown, filtered as the user types. Choices come from the existing MasterData `DrugUsage` entries (managed in Settings → MasterData → pharmacy). No choice is selected automatically. Custom instructions and existing order text remain editable; refreshing the choices does not replace the typed prescription. Master choices can be fragments, so the prescriber must complete and review the full instructions before sending. An empty master list leaves manual entry available. No dosing presets or new dependencies are introduced.

Instruction-only batches call `pmc_submit_native_batch_v2`. The additive migration `20261105010000_simple_medication_submission.sql` preserves v1, existing submission enablement, invoker/RLS checks, visit and revision scope, catalogue identity/version checks and idempotent batch replay. It validates quantity, original instructions and matching catalogue unit server-side. It does not activate dispensing or modify stock.

Deployment order: apply the additive function in the HIS Supabase project, verify function permissions and read back its definition, then deploy HIS. Do not deploy this editor before the database endpoint exists. No patient order should be submitted as a production test. Rollback the frontend to the prior deployment if necessary; keep v1 and existing clinical data intact. The new function may remain unused.

The HIS source snapshot now exports optional sourceDrugId, unitCode and catalogueVersion while retaining all review/dispensing holds. Deploy the compatible PMC sourceSnapshot parser first. Historical blank metadata is omitted, preserving the older read flow. Native PMC reception supports instruction-only lines; the separately gated clinical ingestion v1.1 contract is not used by this native source/receipt workflow and remains strict.

Validation: synthetic JS checks cover instruction-only and legacy validation, unit prefill/read-only markup, empty dose, positive quantities and legacy editing. An isolated PGlite database executes the actual migration and tests atomic submission, mismatched unit rejection, missing instructions, invalid quantity, RLS scope, anonymous denial and replay without duplicates. Existing native submission, PMC source API, OPD persistence, department and security checks and production build pass.

Production migration, real PMC receipt and actual clinical dispensing are not established by these local tests. The database test reuses the installed PGlite package in the sibling PMC checkout; it performs no external requests.

## Applied database prerequisite — 2026-11-05

After fresh read-only preflight and an encrypted function/ACL metadata backup with verified decrypt/hash roundtrip, the exact additive v2 migration was applied in one guarded transaction to HIS project `pzyrowzghrcfpmhkreag`. Migration history increased 49 → 50; v2 has one history entry. In-transaction checks verified invoker security, authenticated execute grant, anonymous denial, unchanged v1 definition hash and unchanged existing submission enablement. No patient/stock rows were written. The complete guarded transaction also passed isolated PGlite rehearsal before application. The frontend/source metadata still require PMC-first publication and hosted read verification; this is not clinical dispensing acceptance.
