# HIS prescription queue source filter — 2026-11-17

## Finding

The PMC queue showed an empty page with Next enabled even when its date range covered prior synthetic orders. HIS `/api/pmc/v1/orders` paginated all visits first, then discarded visits whose `Prescription_JSON` was null or `[]`. In a busy range, the first source pages can therefore contain no prescriptions.

## Change

The date-range query now excludes null and empty-array prescription text before applying offset and limit. The exact patient/visit lookup stays unchanged so a previously selected order can still be checked by identity. API response shape, staff authorization, RLS token, clinical status logic, and order workflows are unchanged.

## Verification

`scripts/test-pmc-orders.mjs` asserts that the queue query includes both source filters and the identity query does not. It passed with synthetic fixtures. `npm run test:auth`, `npm run test:security`, and `npm run build -- --outDir tmp/his-pmc-queue-filter-check` passed. The orientation document mentions `test:clinical-reads`, but this current checkout has no such npm script.

## Remaining limit

Malformed or nonempty prescription text and visits without a confirmed EMR revision can still be skipped after pagination. This change addresses the common null/`[]` case without altering clinical confirmation rules. It does not make an unsent HIS prescription appear in PMC.
