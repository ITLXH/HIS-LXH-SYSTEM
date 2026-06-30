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

## 8-Point Fix Round (2026-06-30) — Commit `43ae2e0`

Triggered by an annotated screenshot of the rendered OPD Card PDF where
the user listed eight discrete problems. Each fix below corresponds to
one numbered comment.

### 1. ຄຳບາງຄຳບໍ່ສະແດງ (some words don't display)

Symptom was a side-effect of the fill widths being miscalibrated for the
new 3-field-per-row layout (see #4 + #5 below). After tightening widths
in [`src/style.css`](../src/style.css) (search for `.opdref-fill-village`,
`.opdref-fill-district`, `.opdref-fill-prov`, `.opdref-fill-emer-*`) the
truncated text now fits.

### 2. ນາມສະກຸນບໍ່ຂຶ້ນ (surname doesn't render)

`popd_surname` had been left inside the `.opdref-hidden` block from an
older layout, so `d.Last_Name` was being written into a hidden span.

Fix in [`public/partials/print-areas.html`](../public/partials/print-areas.html):
moved the surname `<span>` into a visible cell on the Name row so the
"ຊື່/Name ___ ນາມສະກຸນ/Surname ___ ອາຍຸ/Aged ___ ປີ" layout matches the
Word reference.

### 3. ເພດ ລະບົບບໍ່ໄດ້ຕິກ (gender checkboxes never tick)

The Gender cell was static text: `□ ຊາຍ/Male  □ ຍິງ/Female` with no JS
hook, so no matter what the patient's gender was, both boxes stayed
empty.

Fix:
- Template: replaced the static squares with two ID'd spans —
  `<span id="popd_gender_male">□</span>` and
  `<span id="popd_gender_female">□</span>`.
- [`src/main.js`](../src/main.js) (`printOPDCard`, around line 9046):
  added a binder that matches `d.Gender` against `/^(M|Male|ຊາຍ)$/i` and
  `/^(F|Female|ຍິງ)$/i`, writing `☑` to the matched ID and `□` to the
  other.

### 4. ບ້ານ/ເມືອງ/ແຂວງ ບໍ່ມາ (Village/District/Province don't show)

The previous template had only `popd_village` visible; `popd_district`
and `popd_prov` were inside `.opdref-hidden`. That hid the District and
Province values entirely.

Fix:
- Template: replaced the single Address row with a 3-field row
  `ບ້ານ/Village ___ ເມືອງ/District ___ ແຂວງ/Province ___` bound to
  `popd_village`, `popd_district`, `popd_prov`.
- CSS widths balanced: village 34mm / district 32mm / province 40mm
  (province names like ນະຄອນຫຼວງວຽງຈັນ run longer than typical district
  names).

### 5. ຫົວກ່ອງເພີ່ມຜູ້ຕິດຕໍ່ສຸກເສີນ (add Emergency contact)

There was no Emergency Contact information on the card at all, even
though the database has `Emergency_Name`, `Emergency_Contact` (phone),
and `Emergency_Relation` columns (see [`src/main.js:5911`](../src/main.js#L5911)
where the Patients form already writes those).

Fix:
- Template: added a new row right after the Phone row —
  `ຜູ້ຕິດຕໍ່ສຸກເສີນ/Emergency ___ ເບີໂທ/Phone ___ ສາຍສຳພັນ/Rel ___` bound
  to `popd_emer_name`, `popd_emer_phone`, `popd_emer_rel`.
- `printOPDCard`: three new `safeSetText` calls for the new IDs.
- CSS widths: emer-name 38mm / emer-phone 30mm / emer-rel 22mm.

### 6. ສ່ວນຫຼຸດຍັງບໍ່ສະແດງ (discount still doesn't render)

The previous fix had bound `popd_discount` to `d.Discount`, but
`Discount` is **not a column on the `Patients` table** — it lives on
the `Organizations` table (see the patient registration handler at
[`src/main.js:10413`](../src/main.js#L10413) which already does the
org-discount lookup).

Fix in `printOPDCard`: when `d.Organization_ID` is set, query
`Organizations` for `Discount` using
`Org_ID.eq."<id>",Org_Code.eq."<id>"`. Fall back to `d.Discount` if
present, else render `-`.

```js
const orgKey = String(d.Organization_ID || '').trim();
if (orgKey) {
  const { data: orgRow } = await supabaseClient
    .from(dbTable('Organizations'))
    .select('Discount, Org_Name')
    .or(`Org_ID.eq."${orgKey}",Org_Code.eq."${orgKey}"`)
    .limit(1);
  if (orgRow && orgRow[0] && orgRow[0].Discount) discountText = String(orgRow[0].Discount);
}
```

### 7. ເພີ່ມ BMI ໃນ Vital sign (add BMI column)

`popd_bmi` was being **calculated** but written into the hidden block,
so the user never saw it on the card.

Fix:
- Template: vital signs `<table>` extended from 7 to 8 columns; the
  8th `<th>` is `BMI` and the 8th `<td>` is `<span id="popd_bmi">`.
- BMI text in `printOPDCard` simplified from
  `"22.0 (ປົກກະຕິ)"` → `"22.0"` so it fits the now-narrower cell.
- CSS: vital-table font dropped from 11.5pt to 10pt and side padding
  from 0.5mm to 0.3mm so 8 columns fit the 186mm inner page width.

### 8. BP 120/60 ແຈ້ງເຕືອນຄວາມດັນຕ່ຳ (false low-BP warning)

[`src/main.js:6106`](../src/main.js#L6106) had:

```js
} else if (s <= 90 || d <= 60) {
```

For a diastolic of exactly 60 (a normal value), this fired the
"ຄວາມດັນຕ່ຳ" SweetAlert. International hypotension thresholds are
strictly **less than** 90 systolic or 60 diastolic.

Fix: changed to strict inequality:

```js
} else if (s < 90 || d < 60) {
```

So 120/60, 110/60, 100/60 etc. are now classified as normal.

### Template cache-buster

Bumped to `2026-06-30-opd-emer-bmi-gender-v1` in
- `PARTIAL_CACHE_BUST` and `expectedVersion` in [`src/main.js`](../src/main.js)
- `data-opd-template-version="..."` in [`public/partials/print-areas.html`](../public/partials/print-areas.html)

so any cached old template gets force-refreshed on the next
`ensureFreshOpdPrintTemplate()` call.

### Verification

Standalone Chromium harness:
[`tmp/pdfs/opd-harness.html?fill=1`](../tmp/pdfs/opd-harness.html) +
[`tmp/pdfs/render.cjs`](../tmp/pdfs/render.cjs) (Puppeteer headless
Chrome, A4 portrait, `displayHeaderFooter:false`, margin 10mm/12mm).

Sample data exercised every new field:
- Name: ສົມຈິດ, Surname: ສຸດສະຫງ່າ, Aged: 42
- D.O.B: 15/03/1983, Gender: ☑ ຊາຍ
- Village: ບ້ານໂພນສະຫວັນ / District: ສີໂຄດຕະບອງ / Province: ນະຄອນຫຼວງວຽງຈັນ
- Tel: 020 5555 1234
- Emergency: ນາງ ຄຳສຸກ / 020 9999 8888 / ພັນລະຍາ
- Org ID: ORG-001 / Org Name: ໂຮງງານຕັດຫຍິບລາວ / Discount: 10%
- Vital: 36.8 / 120/60 / 78 / 18 / 98 / 62 / 168 / BMI 22.0

Output: [`tmp/pdfs/opd-opd-fix8b-page1.png`](../tmp/pdfs/opd-opd-fix8b-page1.png)
+ [`tmp/pdfs/opd-opd-fix8b-page2.png`](../tmp/pdfs/opd-opd-fix8b-page2.png).
All 8 user comments resolved; both Village/District/Province and
Emergency rows fit one line.
