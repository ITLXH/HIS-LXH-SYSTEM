# Patient table organization and visit-count badges

Date: 2026-08-24

## Scope

- Added an `ອົງກອນ/ປະກັນໄພ` column to the Registration patient table.
- Added an `ອົງກອນ/ປະກັນໄພ` column to the Triage queue table.
- Added a red numeric visit-count badge to patient-history buttons on Registration, Triage, OPD queue, and Visit History.

## Behavior

- The organization/insurance value uses the existing patient payer fields in this priority order: `Insurance_Company`, `Organization_Name`, then `Name_Org`.
- A missing payer is displayed as an em dash instead of an empty cell.
- The number in the red badge is the patient's distinct visit count from `HIS_One_Visits`, keyed by `Visit_ID` so duplicate rows do not inflate the count.
- Registration loads a compact paginated visit-key list once for the full registry. Smaller queue pages use patient-focused queries in batches.
- Paginated visit queries use stable patient and visit ordering.
- If visit counts cannot be loaded, the table remains usable and shows `0` rather than blocking the page.
- Triage keeps compatibility with deployments where `Insurance_Company` is unavailable by retrying with the legacy patient fields.

## Files changed

- `public/partials/views/patients.html`
- `public/partials/views/triage.html`
- `src/main.js`
- `src/style.css`
- `docs/PATIENT_TABLE_ORG_VISIT_BADGES.md`

## Verification

- `node --check src/main.js`
- `npm run build`
- `git diff --check`
- Browser-checked Registration, Triage, OPD queue, and Visit History on local development.
- Confirmed Registration and Triage show payer values and em-dash fallbacks.
- Confirmed history badges render on all visible rows and match the Visit History count, including patients with 2 and 3 visits.
- Confirmed the tested desktop pages do not introduce document-level horizontal overflow.

## Delivery status

- Local workspace only.
- No commit created.
- No push performed.
