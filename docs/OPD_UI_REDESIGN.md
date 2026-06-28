# OPD UI Redesign Notes

## Scope

- Rewrite the OPD print card into a clean 2-page A4 portrait hospital form
  that visually matches the user-supplied Word reference (`Form 1. ໃບ OPD Card`).
- Switch the OPD print path from `window.print()` to a programmatic PDF
  generator so Chrome's browser-injected headers/footers never appear.
- Redesign the OPD registration / triage modal allergy + underlying disease
  panels for a clearer clinical workflow.
- Keep existing IDs, JS bindings, database schema, and API calls intact.

## Files Modified

- [`public/partials/modals/triage-modal.html`](../public/partials/modals/triage-modal.html)
- [`public/partials/modals/patient-modal.html`](../public/partials/modals/patient-modal.html)
- [`public/partials/print-areas.html`](../public/partials/print-areas.html)
- [`src/style.css`](../src/style.css)
- [`src/main.js`](../src/main.js)
- [`index.html`](../index.html) — added `html2canvas` + `jspdf` CDN scripts

## Print pipeline — programmatic PDF (no browser dialog)

`window.printOPDCard` no longer calls `window.executePrint`. The new path
([`src/main.js`](../src/main.js) → `window.exportOpdCardAsPdf`) uses
**html2canvas + jsPDF directly** (NOT `html2pdf.js`, which clones the
source into its own off-screen container and was clipping each 186 mm page
to the right half).

Process:

1. Force each `.opd-page` to 186 × 277 mm with `overflow: hidden`.
2. `html2canvas` captures the page at `scale: 2`, `windowWidth: 703`,
   `windowHeight: 1047`.
3. `pdf.addImage` places the JPEG at `x=12 mm / y=10 mm`, size `186 × 277 mm`.
4. Result is a blob URL opened in a new tab; falls back to download if the
   popup is blocked.

Output guarantees:

- Exactly 2 A4 portrait pages.
- No browser-injected date / URL / page-number headers.
- No `localhost` or `Page X of Y` strings in the PDF.
- Logo, barcode and customer ID render as part of the page-1 header.

## Page 1 layout

- 3-column header: hospital logo (40 mm) · centered title `ຂໍ້ມູນການລົງທະບຽນ` /
  `(OPD Card)` · barcode + customer ID (60 mm).
- `Client's Profile` section: name, age/gender, DOB, nationality, occupation,
  address, tel, relationship; followed by `Org ID + Org Name` row and a
  separate `ສ່ວນຫຼຸດ / Discount` row.
- Vital signs as a 7-column **table** (BT °C | BP mmHg | PR bpm | RR bpm |
  SpO₂ % | Weight Kg | High Cm) — clearer than the previous inline dotted
  line layout.
- Allergy / Underlying disease / Regular-medicine sections with dotted-line
  fills.
- Right-aligned signature block (`ຜູ້ບັນທຶກຂໍ້ມູນ` / `ຊື່ແຈ້ງ:` on two lines).

## Page 2 layout

- Title `ໃບບັນທຶກອາການ ແລະ ການປິ່ນປົວ`.
- Treatment table (~75 % of page): 3 columns (History | Treatment | other)
  with one tall content cell + `Dx:` / `Follow up:` footer row.
- Title `ໃບຕິດຕາມອາການ ແລະ ຫັດຖະການ`.
- Follow-up table (~22 % of page): 4 columns (Time | ອາການ | ຫັດຖະການ |
  ຜູ້ບັນທຶກ), 8 empty rows; bottom border closes properly.

## OPD Card data binding

- All `popd_*` IDs preserved verbatim (`popd_name`, `popd_age`, `popd_temp`,
  `popd_bp`, …). Added `popd_org_id` binding (`d.Organization_ID`); existing
  `popd_orgname`, `popd_discount`, `popd_cn` were unhidden and moved into
  the visible header / Client Profile rows.
- Drug allergy, food allergy and allergy symptoms are still saved into the
  existing `Drug_Allergy` patient field.
- Underlying disease + regular medicine are still saved into the existing
  `Underlying_Disease` patient field.
- `JsBarcode` writes into `#popd_patient_barcode` (CODE128) inside the
  page-1 header.
- No database schema, API, or print workflow changes required.

## Patient-modal allergy + underlying disease redesign

- Allergy panel: separate `ແພ້ຢາ` / `ແພ້ອາຫານ` checkboxes, each revealing a
  detail input (`p_allergy`, `p_food_allergy`). Allergy symptoms input
  (`p_allergy_symptoms`) reveals when any allergy is selected.
- Underlying disease panel: `ມີພະຍາດປະຈຳຕົວ` checkbox reveals the disease +
  regular-medicine inputs (`p_disease`, `p_regular_medicine`).
- Saved values still serialize into the existing `Drug_Allergy` and
  `Underlying_Disease` columns so no migration is needed.

## Verification

- `npm run build` passes (no template-side changes that would affect the
  Vite bundle).
- Standalone Chromium harness: [`tmp/pdfs/html2pdf-harness.html`](../tmp/pdfs/html2pdf-harness.html)
  + [`tmp/pdfs/render-html2pdf.cjs`](../tmp/pdfs/render-html2pdf.cjs) reproduce
  the production export path without needing a Supabase login. Verified at
  blank and sample-data states — both pages render full width with no
  clipping and the follow-up table's bottom border closes.
- `grep` on the final PDF returns zero matches for `localhost`,
  `127.0.0.1`, or `Page \d+ of \d+`.
