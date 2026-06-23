# IPD Bed Form UI Audit

Date: 2026-06-24

## Request

Do not show system codes in the IPD Add/Edit Bed screen.

## Scope

Changed only the IPD Configuration bed UI:

- Add/Edit Bed modal
- Beds table columns
- Bed validation text
- Room labels used inside the bed modal

## Implementation

- `Bed_ID` is still generated automatically and submitted as a hidden value.
- Users no longer see or manually edit `Bed_ID` in the Add/Edit Bed modal.
- Beds table no longer shows the Bed ID column.
- Bed table rows no longer fall back to showing `Ward_ID` or `Room_ID`; missing display names show `-`.
- Room dropdown labels in the Bed modal show `Room_Number` only, with `-` if a room number is missing.
- The Bed modal now rebuilds the Room dropdown whenever Ward changes, instead of hiding/showing stale room options. This prevents a room from another ward, such as ER001, from staying selected after switching to an IPD ward.
- `renderIpdBedsTable()` rewrites the bed table header before DataTables initializes, preventing stale column markup from causing an incorrect column count.
- Validation now asks only for Bed Number via a dedicated `ipd.bedNumberRequired` translation key, so quick-admit room/bed validation can keep its own message.

## Files

- `src/main.js`
- `public/partials/views/ipd_config.html`

## Verification

- Add Bed modal should not show Bed Code.
- Edit Bed modal should not show Bed Code.
- Beds table should not show Bed ID column.
- Room dropdown should not display Room ID as a fallback label.
- Saving still works because `Bed_ID` remains hidden and auto-generated.
