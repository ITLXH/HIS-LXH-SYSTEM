# OPD Test Legacy EMR Layout

## Objective

The `/opd/test` page reuses the established EMR encounter design and workflow already present in the HIS project. It is a full-page version of the old EMR modal, with unique OPD Test element IDs so both implementations can coexist.

## Reused Structure

- Blue Encounter title bar with OPEN/COMPLETED status
- Compact patient identity and allergy banner
- Patient vital-sign strip
- Paper-record field order: CC, H/O, PHE, PE, Dx, Service Department, Treatment, Advice, Doctor, Follow-up, and Discharge Status
- Three workflow tabs:
  - Encounter information
  - Lab
  - Rx
- Diagnosis selector that accepts either `Services_List` selections or new typed diagnoses
- Service Department selector based on the specialties listed in the paper reference
- Fixed EMR footer with Cancel and Save Encounter actions

## Reused Workflows

- The Lab tab opens the existing EMR Lab picker.
- The Rx tab opens the existing EMR drug picker.
- Selected Lab and Rx items are copied back to the OPD Test state and rendered with the existing EMR order-list style.
- Discharge Status is required.
- CC / Chief Complaint is required.
- Diagnosis is required when closing an encounter, except when the status is Waiting Lab.
- Saving locks the local demo encounter and changes the status from OPEN to COMPLETED.

## Files

- `public/partials/views/opd_test.html`
- `src/main.js`
- `src/style.css`

## Verification

```bash
npm run build
```

The page was verified at desktop, tablet, and mobile widths. No API, database schema, authentication, or deployment behavior was changed.
