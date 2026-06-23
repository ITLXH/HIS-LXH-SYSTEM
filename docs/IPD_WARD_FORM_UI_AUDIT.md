# IPD Ward Form UI Audit

Date: 2026-06-24

## Request

Remove the visible Ward Code (`ລະຫັດຫວອດ`) and Department (`ພະແນກ`) fields from the IPD ward setup screen.

## Scope

Changed only the IPD Configuration ward UI:

- Add/Edit Ward modal
- Wards table columns
- Ward validation text

## Implementation

- `Ward_ID` is still generated automatically and submitted as a hidden value.
- Users no longer see or manually edit `Ward_ID` in the Add/Edit Ward modal.
- `Department` is no longer shown in the Add/Edit Ward modal.
- Existing ward rows keep their current `Department`; new rows default internally to `IPD`.
- `renderIpdWardsTable()` now rewrites the ward table header before DataTables initializes, preventing stale 7-column markup from causing an incorrect column count when the visible table has 5 columns.
- Wards table now shows only:
  - Ward Name
  - Ward Type
  - Floor
  - Status
  - Actions

## Files

- `src/main.js`
- `public/partials/views/ipd_config.html`

## Verification

- Add Ward modal should not show Ward Code.
- Add Ward modal should not show Department.
- Wards table should not show Ward Code column.
- Wards table should not show Department column.
- Saving still works because `Ward_ID` remains hidden and auto-generated.
