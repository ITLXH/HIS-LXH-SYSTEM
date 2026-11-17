# HIS medication draft confirmation — 2026-11-17

## Observed failure

On the hosted HIS consultation for synthetic visit `V261029-101104131`, a new medication row displayed route, dose, frequency, duration, and quantity. Confirm repeatedly returned “medication data incomplete.” The browser controls held values while the draft rendered from saved state still held empty input attributes. No new prescription was submitted or sent to PMC.

## Source change

Immediately before the existing draft validation, read the five visible controls in each editable medication row and synchronize them through the existing `updateCatalogDraft` rules. Validation, permission checks, HIS persistence, and PMC delivery logic are unchanged. The change is isolated from the unrelated pending work in the primary checkout.

## Checks

- `node scripts/test-medication-draft-rows.mjs` — passed.
- `node scripts/test-pmc-prescriptions.mjs` — passed.
- `node scripts/test-pmc-orders.mjs` — passed.
- `node scripts/test-order-save-readiness.mjs` — passed.
- `npm run build -- --outDir tmp/his-med-draft-sync-check-20261117` — passed.
- Hosted visual verification and a fresh HIS → PMC test order — pending deployment. No real patient record was changed.
