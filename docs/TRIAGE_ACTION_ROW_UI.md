# Triage action-row UI

Date: 2026-08-25
Scope: local workspace only; no commit or push

## Request

Organize the Triage table's action controls into a clean, consistent row.

## Implementation

- Replaced the generic wrapping flex container with a dedicated `triage-actions` action rail.
- Kept every action on one row with a consistent 6px gap.
- Standardized icon-only controls to 42 × 42px.
- Standardized text actions (`View` and `Measure`) with predictable minimum widths and the same 42px height.
- Removed per-button margin spacing so the container controls alignment uniformly.
- Reserved a stable action-column width and retained horizontal table scrolling on narrower screens instead of wrapping controls onto a second line.
- Added an accessible `role="group"` label for each patient's action set.
- Adjusted the visit-count badge position to sit cleanly on the history button.

## Compact-density revision

After desktop review, the first 42px version was still too large and reduced the number of visible patient rows. It was refined as follows:

- icon actions reduced from 42 × 42px to 34 × 34px;
- View action reduced from 94px to 76px wide;
- Measure action reduced to a 78px minimum width;
- gap reduced from 6px to 4px;
- action column reduced from 390px to 352px;
- data-row vertical padding standardized at 7px.

## Verification

- Added `npm run test:triage-ui` to check the row structure, shared button sizing, no-wrap behavior, accessibility group, and narrow-screen overflow.
- Local browser verification at the supplied 1920 × 1080 desktop size confirmed:
  - row height reduced from 66px to 52px (about 21% denser);
  - all 10 table rows were fully visible in the viewport;
  - seven available actions remained on one row;
  - icon actions measured 34 × 34px, View measured 76px wide, and Measure measured 78px wide;
  - computed layout remained `flex-wrap: nowrap` with a 4px gap.
- `npm run test:triage-ui`: passed (10/10).
- `npm run build`: passed. Vite reported only the existing large-chunk advisory.
- `npm run test:notifications`: passed (12/12, regression safety).
- `npm run build`: passed. Vite reported only the existing large-chunk advisory.

## Git status

No commit or push was performed.
