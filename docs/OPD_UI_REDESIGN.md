# OPD UI Redesign Notes

## Scope

- Redesign the OPD registration / triage modal.
- Rewrite the OPD print card into a clean 2-page A4 portrait hospital form.
- Keep existing IDs, JS bindings, database schema, and API calls intact.

## Files Modified

- [`public/partials/modals/triage-modal.html`](/C:/Users/asus/Desktop/Project/HIS-sys-main-LXH/public/partials/modals/triage-modal.html)
- [`public/partials/print-areas.html`](/C:/Users/asus/Desktop/Project/HIS-sys-main-LXH/public/partials/print-areas.html)
- [`src/style.css`](/C:/Users/asus/Desktop/Project/HIS-sys-main-LXH/src/style.css)
- [`src/main.js`](/C:/Users/asus/Desktop/Project/HIS-sys-main-LXH/src/main.js)

## UX / Layout Changes

- Simplified the OPD registration modal into clear clinical sections.
- Kept RR and O2Sat as optional workflow values without requiring user entry.
- Patient registration allergy now supports separate drug allergy, food allergy, and allergy symptom inputs.
- Underlying disease now uses the same checkbox-driven pattern and only shows disease / regular medicine inputs when selected.
- Reworked the OPD print card into a formal hospital sheet with:
  - Page 1: patient profile, vitals, complaint, allergy, symptoms, history, coverage, discount, informant, doctor signature.
  - Page 2: treatment form and nursing record.
- Removed internal IDs and unused patient fields from the printed OPD card.
- Preserved print IDs and existing JS bindings for all visible data fields.

## OPD Card Data Binding

- Drug allergy, food allergy, and allergy symptoms are saved in the existing `Drug_Allergy` patient field and rendered on the OPD Card.
- Underlying disease and regular medicine are saved in the existing `Underlying_Disease` patient field and rendered on the OPD Card.
- The OPD Card dynamically checks the relevant Yes/No, Drugs/Foods, Underlying Disease, and Regular Medicine boxes based on saved patient data.
- No database schema, API, or print workflow changes are required for these fields.

## Verification

- `npm run build` passed.
- Local browser PDF render produced exactly 2 A4 portrait pages.
- No blank extra page was generated in the verified print output.
- Print preview was visually checked with sample data in a headless Chromium render.
