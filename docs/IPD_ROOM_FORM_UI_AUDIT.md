# IPD Room Form UI Audit

Date: 2026-06-24

## Request

Remove the visible Room Code (`ລະຫັດຫ້ອງ`) field from the IPD Add/Edit Room screen.

## Scope

Changed only the IPD Configuration room UI:

- Add/Edit Room modal
- Rooms table columns
- Room validation text

## Implementation

- `Room_ID` is still generated automatically and submitted as a hidden value.
- Users no longer see or manually edit `Room_ID` in the Add/Edit Room modal.
- Rooms table no longer shows the Room ID column.
- `renderIpdRoomsTable()` rewrites the room table header before DataTables initializes, preventing stale column markup from causing an incorrect column count.
- Validation now asks only for Room Number.

## Files

- `src/main.js`
- `public/partials/views/ipd_config.html`

## Verification

- Add Room modal should not show Room Code.
- Edit Room modal should not show Room Code.
- Rooms table should not show Room ID column.
- Saving still works because `Room_ID` remains hidden and auto-generated.
