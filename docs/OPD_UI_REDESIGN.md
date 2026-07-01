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

## Title prefix + Org ID width (2026-06-30) — Followup

User comments on the next-iteration PDF preview:

### Add a Title prefix before the Name

Until now the Name row started with `ຊື່/Name:` — there was no slot for
honorifics like `ທ່ານ` / `ນາງ` / `ນາງສາວ` / `ດຣ.` that the Patients form
already stores in `d.Title`.

Fix:

- Template ([public/partials/print-areas.html](../public/partials/print-areas.html)):
  prepended `ຄຳນຳໜ້າ/Title: <span id="popd_title" class="opdref-fill opdref-fill-title"></span>`
  before the Name span on the Name row.
- [`src/main.js`](../src/main.js) `printOPDCard`: added
  `safeSetText('popd_title', d.Title || '')` next to the existing
  `popd_name` / `popd_surname` binds.
- CSS ([`src/style.css`](../src/style.css)): added
  `.opdref-fill-title { width: 12mm }` to both the
  `#opd-print-area.opdref` and the `.opdref-page` blocks.

To keep the 4-cell row (Title + Name + Surname + Aged) on **one line**
inside the 186mm inner page width, also tightened existing widths:
- `opdref-fill-name` 36mm → 24mm
- `opdref-fill-age` 16mm → 10mm

Verified geometry via
[tmp/pdfs/check-row.cjs](../tmp/pdfs/check-row.cjs): the row content now
ends at 661 / 665 px (4 px slack), no overflow.

### Show the full Org ID

The org-row used a flex layout where `#popd_org_id` had
`flex: 0 0 28mm`. Sample data like `CUS-LXH-AMZ-12345` was truncating to
`CUS-LXH-AM`.

Fix in [`src/style.css`](../src/style.css): bumped the flex-basis to
**44mm** in both
- `#opd-print-area.opdref .opdref-org-row #popd_org_id`
- `.opdref-page .opdref-org-row #popd_org_id`

The Org Name fill (`opdref-fill-org-name-wide`) keeps `flex: 1 1 auto`,
so it just shrinks by the 16mm we gave to Org ID — no further changes
needed there.

Template cache-buster bumped to `2026-06-30-opd-title-orgid-v2` in both
`PARTIAL_CACHE_BUST` / `expectedVersion` (`src/main.js`) and
`data-opd-template-version` (`print-areas.html`).

Verified at [tmp/pdfs/opd-opd-title-v3-page1.png](../tmp/pdfs/opd-opd-title-v3-page1.png):
row reads "ຄຳນຳໜ້າ/Title: ທ່ານ  ຊື່/Name: ສົມຈິດ  ນາມສະກຸນ/Surname:
ສຸດສະຫງ່າ  ອາຍຸ/Aged: 42 ປີ" on one line; Org ID cell shows the full
`CUS-LXH-AMZ-12345`.

## CC multi-line + Nutrition checkboxes + Page 2 follow-up 5-col + QR sticker (2026-06-30)

User comments on the next iteration:

> ສາເຫດເຂົ້າມາໂຮງໝໍຂຶ້ນ ໃຫ້ປະຫຍັດການ … ຈະໃສ່ບໍ່ໄດ້  
> ໂດຍ Nutrition status ໃຫ້ປ່ຽນເປັນ ໂພຊະນາການ ແລະ ເພີ່ມສະຖານະ ເຊັ່ນ ປົກກະຕີ / ບໍ່ປົກກະຕີ / ອື່ນໆ
>
> ໂຕບີ້ໃຫ້ມີແຕ່ 5 ຫົວຂໍ້ ແລ້ວອັ້ງ ໂດຍຕາລາງທາງເທິງໃຫ້ກວ້າງເພີ່ມຂຶ້ນ
>
> Sticker ປີ້ນອອກມານ້ອຍເກີນໄປບໍ່ເຕັມໜ້າເຈ້ຍປີ້ນ

### 1. Chief complaint — 2-line writing space

Old layout: `ສາເຫດມາໂຮງໝໍ/Chief complaint:` + a single short `opdref-fill-wide`
underline. When the symptoms ran long the text truncated mid-word.

Fix in [public/partials/print-areas.html](../public/partials/print-areas.html):

```html
<div class="opdref-row opdref-row-full-line">
  <span>ສາເຫດມາໂຮງໝໍ/Chief complaint:</span>
  <span id="popd_cc" class="opdref-fill opdref-fill-cc"></span>
</div>
<div class="opdref-row opdref-row-full-line">
  <span class="opdref-fill opdref-fill-cc-line"></span>
</div>
```

CSS in [src/style.css](../src/style.css):
- `.opdref-fill-cc { width: 124mm }` (the label takes ~58mm, leaving 124mm
  on the same row)
- `.opdref-fill-cc-line { width: 182mm }` (a full-width blank dotted line
  for handwritten continuation)

`popd_cc` still binds to `v.symptoms` so the printed first line shows what
the front desk recorded; the nurse uses the second line for elaboration.

### 2. Nutrition status — Lao label + checkbox options

Old layout: `Nutrition status: ____` — just an empty underline, English-only label.

New layout (template):

```html
<div class="opdref-row opdref-row-nutrition opdref-section-inline">
  <span>ໂພຊະນາການ/Nutrition status:</span>
  <span><span id="popd_nutri_normal">□</span> ປົກກະຕີ/Normal</span>
  <span><span id="popd_nutri_abnormal">□</span> ບໍ່ປົກກະຕີ/Abnormal</span>
  <span><span id="popd_nutri_other">□</span> ອື່ນໆ/Other:</span>
  <span id="popd_nutri_other_text" class="opdref-fill opdref-fill-nutri-other"></span>
</div>
```

No DB column for nutrition status exists, so the checkboxes stay blank (□)
on print — the nurse hand-ticks. Reserved IDs `popd_nutri_normal/abnormal/
other/other_text` so a future migration can wire them up without touching
the template again.

### 3. Page 2 — wider treatment table + 5-column follow-up

- **Treatment body height** 168mm → **186mm** in
  [src/style.css](../src/style.css) (`#opd-print-area.opdref .opdref-treatment-body td`
  and the `.opdref-page` fallback). The Dx / Follow-up row keeps its 16mm.
- **Follow-up table** gained a fifth column `ໝາຍເຫດ` between Procedure and
  Recorder. New `<col class="opdref-col-note" />` and `<th>ໝາຍເຫດ</th>`.
  Column widths rebalanced:
  - `opdref-col-time` 11.5% → 10%
  - `opdref-col-symptom` 46.5% → 32%
  - `opdref-col-procedure` 28% → 22%
  - `opdref-col-note` (new) → 22%
  - `opdref-col-recorder` 14% (unchanged)
- **Body row count** reduced from 8 → 5 (`<tr><td></td><td></td><td></td><td></td><td></td></tr>`)
  so the follow-up table still fits below the now-larger treatment table
  on a single A4 portrait page.

Total page 2 budget: title 12mm + treatment header 7mm + treatment body
186mm + Dx row 16mm + page2-title-gap ≈ 10mm + follow-up header 7mm +
5×5.5mm = 245.5mm — fits well inside the 277mm inner page height.

### 4. Patient QR sticker — fill the print sheet

Old print-area in [public/partials/print-areas.html:2](../public/partials/print-areas.html#L2)
printed three 65×35mm cards which barely filled the top third of A4
portrait (≈105mm out of 297mm, the rest blank).

Card geometry rebuilt in [src/style.css](../src/style.css) (`.patient-card`,
`.pcard-left`, `.pcard-right`, `.pcard-row`, etc.):

| Property | Old | New |
|---|---|---|
| Card size | 65×35mm | **180×85mm** |
| Card padding | 2px 4px | **6mm 8mm** |
| Card border | 1.5px | **2px** |
| Gap between cards | 0 | **6mm** |
| Grid padding | 0 | **6mm 0** |
| `.pcard-right` width (QR side) | 24mm | **56mm** |
| Label font | 7px | **11px** |
| Value font | 9.5px | **14px** |
| Name font | 10.5px | **18px** |
| ID font | 10px | **14px** |
| QR canvas/img | 30px | **50mm** |

And the QRCode generator in [src/main.js:5982](../src/main.js#L5982):

```js
new QRCode(el, { text: d.id, width: 200, height: 200, ... });
```

(was `width: 30, height: 30` — produced a tiny 30px QR that printed at
fingernail size).

Stack of 3 cards = 3 × 85 + 2 × 6 (gaps) + 2 × 6 (grid padding) = **267mm**,
fits inside A4 portrait inner height with a small bottom margin.

### Verification

- OPD card PDF rendered via Puppeteer print emulation in
  [tmp/pdfs/render.cjs](../tmp/pdfs/render.cjs); both pages fit, follow-up
  table shows 5 columns + 5 rows in full
  ([tmp/pdfs/opd-opd-cc-nutri-v2-page1.png](../tmp/pdfs/opd-opd-cc-nutri-v2-page1.png),
  [-page2.png](../tmp/pdfs/opd-opd-cc-nutri-v2-page2.png)).
- QR sticker preview: print emulation hides the area (the legacy `@media
  print` rules in `style.css` only show `.print-active`), so a separate
  screen-mode renderer was added in
  [tmp/pdfs/render-screen.cjs](../tmp/pdfs/render-screen.cjs). Output at
  [tmp/pdfs/screen-qr-large.png](../tmp/pdfs/screen-qr-large.png) shows
  three full-size cards with big QR codes filling the page.

### Cache-buster

Template version bumped to `2026-06-30-opd-cc-nutrition-page2-v3` in both
[src/main.js](../src/main.js) (`PARTIAL_CACHE_BUST` and `expectedVersion`)
and [public/partials/print-areas.html](../public/partials/print-areas.html)
(`data-opd-template-version`).

## Page 2 — rename + pin nurse table to bottom edge (2026-06-30)

User request:

> ໃບຕິດຕາມອາການ ແລະ ຫັດຖະການ ປ່ຽນເປັນ ໃບບັນທຶກພະຍາບານ ແລະ ຍັບຕາຕະລາງລົງໃຫ້ສຸດຂອບເຈ້ຍ
> ໃຫ້ຕາຕະລາງດ້ານເທິງສາມາດຂຽນຂໍ້ມູນໄດ້ຫຼາຍຂຶ້ນ

### Rename the bottom-section title

In [public/partials/print-areas.html](../public/partials/print-areas.html):

```html
<!-- before -->
<div class="opdref-page2-title opdref-page2-title-gap">ໃບຕິດຕາມອາການ ແລະ ຫັດຖະການ</div>
<!-- after -->
<div class="opdref-page2-title opdref-page2-title-gap">ໃບບັນທຶກພະຍາບານ</div>
```

### Pin the nurse-record table to the bottom edge

Made `.opdref-sheet-page2` a flex column with a fixed minimum height equal
to the printable A4 area, then used `margin-top: auto` on the bottom
section's title-gap so it absorbs all remaining vertical space:

```css
#opd-print-area.opdref .opdref-sheet-page2 {
  display: flex !important;
  flex-direction: column !important;
  min-height: 277mm !important;
}

#opd-print-area.opdref .opdref-page2-title-gap {
  margin-top: auto !important;
  margin-bottom: 4mm !important;
}
```

Same overrides applied to the `.opdref-page` fallback block.

### Grow the upper Treatment table into the freed space

Started at 193mm but the user immediately reported "ເສັ້ນລຸ່ມມັນຫາຍໄປ
ໜ້ອຍໜື່ງ" — the bottom border of the nurse-record table was clipping
because total content slightly overflowed the 277mm sheet budget. Tuned
down to **185mm** to give the layout a small bottom safety margin while
still delivering noticeably more writing room than the previous 168mm.

```css
.opdref-treatment-body td { height: 185mm !important; }
```

### Verification

[tmp/pdfs/opd-nurse-fit-page2.png](../tmp/pdfs/opd-nurse-fit-page2.png)
+ a bottom-only crop at
[tmp/pdfs/crop-bottom.png](../tmp/pdfs/crop-bottom.png) — nurse-record
block pinned at the bottom edge, all 5 follow-up rows visible with the
bottom border fully present.

### Commit status

NOT committed per user request "ບໍ່ຟ້າວ commit". Folded into next batch.

## QR sticker — fix 4-page overflow + OPD bleed (2026-06-30)

User-supplied [Stickler.pdf](../tmp/pdfs/Stickler.pdf) (a real
`window.print()` output of the patient QR sticker) showed:

- Page 1: 2 stickers (third overflowed)
- Page 2: 1 sticker
- **Pages 3 & 4: the OPD card bleeding into the QR print job**

### Root cause #1 — @page margin leftover from OPD redesign

[src/style.css:3679](../src/style.css#L3679) had a leftover
`@page { size: A4 portrait; margin: 10mm 12mm }` block added during the
OPD card redesign. OPD doesn't need it any more — OPD's printable margins
are set by Puppeteer's `pdf({ margin: { top: '10mm', ... } })` parameter
in [tmp/pdfs/render.cjs](../tmp/pdfs/render.cjs) and the production
[src/main.js](../src/main.js) `exportOpdCardAsPdf`. The leftover @page
default was only affecting other prints: QR sticker (`#print-area`) and
vaccine card (`#vac-print-area`).

It shrank the QR sticker printable area from 289mm tall (4mm default
@page from line 2603) to 277mm. 3 × 85mm cards + gaps + padding = 279mm
overflowed by 2mm and pushed the third card to page 2.

Fix: removed the stale `@page` block. The default `@page { margin: 4mm }`
from line 2603 now applies again to QR sticker + vaccine card prints.

### Root cause #2 — OPD bleed safety net

Tracing the issue: `executePrint('print-area')` already sets inline
`display: none` on `#opd-print-area`, and the
`.print-container:not(.print-active) { display: none !important }` rule
at line 2592 reinforces it during `@media print`. In principle the OPD
area should not render alongside the sticker.

Not fully reproducible locally — but added a belt-and-suspenders rule in
the same `@media print` block as a defensive layer:

```css
@media print {
  #opd-print-area:not(.print-active),
  #vac-print-area:not(.print-active),
  #print-area:not(.print-active) {
    display: none !important;
    visibility: hidden !important;
  }
}
```

If anything in the future adds an unintended `display: block` rule to
`#opd-print-area`, this explicit ID-based rule still wins and the print
job stays scoped to the intended container.

### Card geometry — tightened for one-page fit with safety slack

| Property | Old (1-page failed) | New (1-page comfortably) |
|---|---|---|
| Card height | 85mm | **78mm** |
| Card padding | 6mm 8mm | **5mm 7mm** |
| `.pcard-right` (QR side) width | 56mm | **50mm** |
| QR canvas / img | 50mm | **45mm** |
| Grid gap between cards | 6mm | **4mm** |
| Grid padding | 6mm 0 | **2mm 0** |

New vertical budget: 3 × 78mm + 2 × 4mm + 4mm = 246mm.
277mm available − 246mm content = 31mm slack to absorb the browser's
default print header / footer (~25mm) without overflowing.

### Verification

[tmp/pdfs/qr-harness.html](../tmp/pdfs/qr-harness.html) updated to mimic
`executePrint()` precisely: add `.print-active` to `#print-area` and
remove the other `.print-container` elements before Puppeteer enters
print emulation. Output [tmp/pdfs/opd-qr-tight.pdf](../tmp/pdfs/opd-qr-tight.pdf)
is **1 page**, contains all 3 stickers, no OPD bleed. Verified via raw
PDF page count:

```
$ node pages-count.cjs opd-qr-tight.pdf
pages: 1
```

### Commit status

NOT committed per user's earlier instruction "ບໍ່ຟ້າວ commit". Will be
folded into the next batch with the page-2 layout work.

---

## 2026-06-30 — Org ID field widened to match Org Name

**Change:** In the `opdref-org-row`, both `#popd_org_id` (Org ID fill) and
`#popd_orgname` (Org Name fill) are now set to `flex: 1 1 auto` so they
share the remaining row width equally, instead of the previous fixed
`44 mm` for Org ID vs `100 mm` for Org Name.

**Files:** `src/style.css` — two selector blocks updated:
- `#opd-print-area.opdref .opdref-org-row #popd_org_id / #popd_orgname`
- `.opdref-page .opdref-org-row #popd_org_id / #popd_orgname`

---

## 2026-06-30 — Remove Drug/Food checkboxes; show specific allergy text only

**Change:** Removed the `□ ຢາ/Drugs  □ ອາຫານ/Foods` checkbox row from the
Allergy section of the OPD print card.  When the patient has allergies
(`hasPrintAllergy = true`) the `ລະບຸສິ່ງທີ່ແພ້:` line already contains the
formatted summary (e.g. "ຢາ: amoxicillin / ອາຫານ: shrimp") produced by
`parsePatientAllergyInfo()`, so the generic category checkboxes were
redundant.  When allergy = No the field is left blank.

**Files changed:**
- `public/partials/print-areas.html` — deleted `opdref-check-row` div
- `src/main.js` (line ~9092) — removed two `safeSetText` calls for
  `popd_allergy_drug_check` / `popd_allergy_food_check`; the
  `popd_allergy` set now gates on `hasPrintAllergy`

---

## 2026-06-30 — Tighten page-1 spacing so recorder block survives long Discount

**Problem:** When `ສ່ວນຫຼຸດ/Discount` contained many bullet lines the
`ຜູ້ບັນທຶກຂໍ້ມູນ` signature block at the bottom of page 1 was pushed past
the 277 mm `overflow:hidden` boundary and disappeared in the PDF.

**Fix:** Reduced vertical spacing in `src/style.css` for both
`#opd-print-area.opdref` and `.opdref-page` contexts:

| Property | Before | After |
|---|---|---|
| `opdref-sheet` padding-top | 1.5 mm | 0 |
| `opdref-sheet` padding-bottom | 2 mm | 1 mm |
| `opdref-rule-tight` top margin | 2 mm | 1.5 mm |
| `opdref-section` bottom margin | 2.2 mm | 1.5 mm |
| `opdref-section-inline` top/bottom | 1/2.2 mm | 0.5/1.5 mm |
| `opdref-row` bottom margin | 3–4 mm | 2 mm |
| `opdref-row-split` bottom margin | 3 mm | 2 mm |

Total recovered ≈ 10–15 mm, enough to absorb 7–8 extra discount lines.

---

## 2026-06-30 — Move Site + Type from Doctor EMR to Triage (ຊັກປະຫວັດ)

**Rationale:** Stage 1 workflow ends at Triage. Site and Type are booking
information that should be captured at check-in, not by the doctor.

**Changes:**

| File | Action |
|---|---|
| `public/partials/modals/triage-modal.html` | Add `#v_site` + `#v_type` selects between Department and Nurse fields |
| `public/partials/modals/emr-modals.html` | Remove `emrSite` + `emrDeptType` rows |
| `src/main.js` — `handleTriageSiteChange()` | New function mirroring `handleSiteChange()` for triage selects |
| `src/main.js` — `openTriage()` | Populate `#v_site` from `masterDataStore['Site']`, call `handleTriageSiteChange()`, restore saved type |
| `src/main.js` — `executeTriageSave()` | Add `Site` + `Visit_Type` to both update payloads |
| `src/main.js` — `openEMR()` | Remove dead `#emrSite` / `#emrDeptType` init code |
| `src/main.js` — EMR save | Remove `Visit_Type`/`Site` from update payload (set at triage, not overwritten by doctor) |

**Dashboard:** no change needed — `fetchDashboardData` already does
`select('*')` from Visits, so `Site` and `Visit_Type` are read automatically.

---

## 2026-06-30 — Fix dashboard chartDept hardcoded to 'OPD'

**Bug:** `renderDashboardCharts` always incremented `deptType['OPD']` regardless
of the visit's actual `Visit_Type` (line ~4323). IPD visits appeared as OPD.

**Fix:** `src/main.js` line ~4322 — use the actual `visitType` value as the
map key, defaulting to `'OPD'` only when the field is empty.

```js
// Before (broken)
if (dept) deptType['OPD'] = (deptType['OPD'] || 0) + 1;

// After
let dept = (visitType || 'OPD').toString().trim() || 'OPD';
deptType[dept] = (deptType[dept] || 0) + 1;
```

---

## 2026-06-30 — Fix Dashboard PDF export (garbled output)

**Problem:** `exportDashboardPDF` used `html2pdf().toCanvas()` which clones
the source element into its own off-screen container, producing garbled /
half-rendered pages in the output PDF.

**Fix:** Rewrote the function in `src/main.js` to use `html2canvas + jsPDF`
directly — the same pattern as `exportOpdCardAsPdf`.

Key changes:
- Removed all `html2pdf` usage from the dashboard export path
- Apply `dashboard-export-mode` class first (forces 297mm × 210mm per page)
- Snapshot and restore each page's inline style after capture
- Wait 300 ms + font-ready + two rAF frames before rendering
- Call `html2canvas(page, { scale:2, width: PAGE_W_PX, height: PAGE_H_PX, … })`
  per page, then `pdf.addImage(…)` into a landscape jsPDF document
- Output opened via `URL.createObjectURL` blob (same as OPD card)
- Filename now includes today's date: `HIS_Dashboard_YYYYMMDD.pdf`

---

## 2026-06-30 — Dashboard: remove duplicate top KPI row + flatten AI-looking UI

**User feedback:** the top operational KPI row duplicated the report KPI row,
and the dashboard looked "too AI" (gradients, floating shadows, multi-colour
card accents). Per [[feedback_no_ai_looking_ui]] the HIS must use a flat
clinical look: solid colours, one accent blue, 3–4 px radii, no gradients.

**Changes:**

| File | Action |
|---|---|
| `public/partials/views/dashboard.html` | Removed the `obs-kpi-grid dashboard-ops-grid` block (OPD Today / Observation / Active IPD / Bed Occupancy nav cards) — duplicated the in-report KPI tiles |
| `src/main.js` — `fetchDashboardData` | Removed the `#dashOpdToday…` spinner-init line and the now-orphaned `updateDashboardOperationalStats(...)` call (avoids wasted Supabase bed/admission/observation queries). Function definition left in place, uncalled. |
| `src/style.css` — KPI tile (on-screen spread) | Replaced `radial-gradient + linear-gradient` background with solid `#ffffff`; radius 6px → 4px |
| `src/style.css` — report panel / split-card (on-screen spread) | `box-shadow: 0 10px 22px …` → `none`; radius 6px → 4px; border `rgba(27,107,176,.14)` → `#e2e8f0` |

Nav to OPD queue / Observation / IPD / beds remains available via the sidebar.

---

## 2026-06-30 — Dashboard PDF now mirrors the on-screen layout

**Problem (from rendered PDF):** the exported PDF did NOT look like the live
dashboard — the 12-column grid (Top 8 + Time Slot side-by-side, etc.) collapsed
into a single stacked column, and the KPI tiles showed spinner icons instead of
numbers.

**Root cause:**
1. **Layout collapse** — `exportDashboardPDF` added the `dashboard-export-mode`
   class and captured at `windowWidth: 1122px`. The on-screen 12-column grid is
   defined only on `#dashboardPrintArea…:not(.dashboard-export-mode)`
   ([style.css](../src/style.css) ~6615), so the class dropped it; and 1122px is
   below the `@media (max-width: 1199px)` breakpoint (~6696 / 6736) which
   collapses the grid anyway. Result: stacked full-width panels.
2. **Spinners** — capture could happen during the 120 s auto-refresh, when the
   KPI values are momentarily `<i class="fa-spinner">`.

**Fix (`src/main.js` `exportDashboardPDF`):**
- No longer toggles `dashboard-export-mode` — captures the page exactly as
  shown on screen.
- Captures with `windowWidth: 1485` (> the 1199 breakpoint) so the desktop
  12-column grid is preserved; output canvas still cropped to 297 mm × 210 mm
  (1122 × 794 px) for true A4-landscape proportions.
- Added a pre-capture guard that waits (≤ 4 s) for `.fa-spinner` to disappear
  from `#dashboardPrintArea`, so KPI numbers are always captured, never spinners.

The `.dashboard-export-mode` / `.dashboard-export-sheet` CSS blocks are now dead
(left in place; the `:not(.dashboard-export-mode)` selectors are still required).

---

## 2026-07-01 — Dashboard PDF: KPI numbers, date header, bigger fonts, no Page-2 caption

Four follow-up fixes from the rendered PDF:

1. **KPI tiles showed spinners instead of numbers.** Cause: the 120 s
   auto-refresh (`dashRefreshInterval`) could fire during the multi-page
   capture, re-showing `<i class="fa-spinner">`. Fix in `exportDashboardPDF`
   ([src/main.js](../src/main.js)): `clearInterval(dashRefreshInterval)` before
   capture (restarted in `finally`); if a `.fa-spinner` is still present, `await
   window.fetchDashboardData()` first, then poll up to 5 s for the spinner to
   clear before rendering.
2. **Added a date header.** A temporary `.dash-pdf-header` is injected at the top
   of each page right before capture (removed in `finally`): left = "Clinic
   Snapshot Board" + per-page subtitle (`ສະຫຼຸບການໃຫ້ບໍລິການ` / `ຂໍ້ມູນປະຊາກອນ ແລະ
   ຊຸມຊົນ`), right = `ວັນທີ່ລາຍງານ: <range>` and `ພິມເມື່ອ: <dd/mm/yyyy hh:mm>`.
   Range comes from `#dashStartDate` / `#dashEndDate`. New `.dash-pdf-header*`
   CSS in [src/style.css](../src/style.css) (flat: 2px bottom rule, accent
   #0E3B5F, no shadow).
3. **Bigger KPI text** (was too small in the 297 mm capture). On-screen spread
   KPI overrides bumped: value `2rem → 3.1rem`, title `→ 13px/800`, note
   `→ 12.5px`, tile min-height `110 → 128px`.
4. **Removed the Page-2 caption** ("PAGE 2 / Demographic & Community Snapshot /
   ເພີ່ມພື້ນທີ່…") from [dashboard.html](../public/partials/views/dashboard.html).

Verified with a Puppeteer harness ([tmp/pdfs/dash-harness.html](../tmp/pdfs/dash-harness.html)
+ [tmp/pdfs/dash-shot.cjs](../tmp/pdfs/dash-shot.cjs), served from repo root,
captured at `windowWidth 1485 / 297×210 mm`): both pages keep the 12-column grid,
KPI numbers 6/5/1/1 render large, date header present, no Page-2 caption.

**Build note:** the app is Vite (`index.html` → `/src/main.js`). When serving the
built `dist/` (`wrangler pages dev dist`), run `npm run build` to pick up these
changes — otherwise the old bundle (filename `HIS_Dashboard_Landscape_Report.pdf`)
keeps serving. The new code names the file `HIS_Dashboard_YYYYMMDD.pdf`.

---

## 2026-07-01 — Dashboard PDF: bulletproof KPI numbers + drop "Clinic Snapshot Board"

**Problem:** Rendered PDF showed charts WITH data but KPI tiles still showing
spinners. Because `renderDashboardCharts` sets the KPI numbers *before* drawing
the charts in the same call, that combination can only occur when a *new*
`fetchDashboardData` reset the KPIs to spinners (line ~3937) and html2canvas
captured before that call's own chart re-render finished — a race the earlier
`.fa-spinner` wait-loop didn't fully close.

**Fix (timing-proof):**
- `renderDashboardCharts` ([src/main.js](../src/main.js)) now caches the values:
  `window.__dashKpiCache = { total, newPatients, oldPatients, insCorp }`.
- `exportDashboardPDF`, right before capture (after the spinner wait), restores
  any tile still showing a spinner from that cache:
  `if (el.querySelector('.fa-spinner') && cache[key] != null) el.textContent = cache[key]`.
  So the PDF can never capture a spinner once data has loaded at least once.

**Also:** removed the "Clinic Snapshot Board" text from the injected
`.dash-pdf-header`; the per-page Lao subtitle (`ສະຫຼຸບການໃຫ້ບໍລິການ` /
`ຂໍ້ມູນປະຊາກອນ ແລະ ຊຸມຊົນ`) is now the header title, with the date meta on the right.

Verified with the Puppeteer harness ([tmp/pdfs/dash-harness.html](../tmp/pdfs/dash-harness.html))
by injecting a spinner into the Total-Visits tile with a cached value of 6 — the
restore logic replaced it with "6" in the capture, and the header no longer shows
"Clinic Snapshot Board".

---

## 2026-07-01 — Dashboard PDF: page 2 charts empty (freeze re-renders during capture)

**Problem:** PDF page 1 charts had data but page 2 charts all showed the
on-canvas "ບໍ່ພົບຂໍ້ມູນ" empty state. Since all 10 charts come from one
`renderDashboardCharts` call, page-1-with-data + page-2-empty can only mean a
*second* render with empty/in-flight data ran **between** the two `html2canvas`
captures (a fetch from the user's range click / a late async resolve), clobbering
the charts after page 1 was already captured.

**Diagnosis:** Built a faithful Puppeteer harness with real Chart.js + the exact
two-pass capture ([tmp/pdfs/dash-capture-harness.html](../tmp/pdfs/dash-capture-harness.html)
+ [tmp/pdfs/dash-capture-shot.cjs](../tmp/pdfs/dash-capture-shot.cjs)). With stable
data, page 2 captured perfectly — so the capture mechanism is fine; the cause is a
stray re-render.

**Fix:** Freeze re-renders during the capture window.
- `renderDashboardCharts` ([src/main.js](../src/main.js)) now early-returns when
  `window.__dashExporting` is set.
- `exportDashboardPDF` sets `window.__dashExporting = true` after the data is
  loaded/KPIs restored (i.e. after its own render) and before sizing/capturing;
  the `finally` clears it, then calls `fetchDashboardData()` once so the live
  dashboard reflects any data that arrived while frozen.

**Verified:** the harness now fires a stray empty-render right after the page-1
capture; with the freeze flag set it is a no-op and page 2 still captures all
charts with data (Gender / OPD / Site / Age / Top-5 towns / Top-5 doctors).

---

## 2026-07-01 — OPD Card: patient code moved above barcode + colored red; Name/Surname merged

**User ask (annotated screenshot):** circled the `ID: LXH2025-001548` line and
asked to move it up and make it red ("ເອົາ ລະຫັດຄົນເຈັບຂື້ນໄປເທີງ ແລ້ວປ່ຽນເປັນສີແດງ"),
and to drop the separate Surname field, merging it into one
Name-and-Surname field ("ນາມສະກຸນຕັດອອກ ປ່ຽນເປັນຊື່ ແລະ ນາມສະກຸນຢູ່ລວມກັນ").

**Header-right reorder + color** ([print-areas.html](../public/partials/print-areas.html)):
swapped the child order inside `.opdref-header-right` so `.opdref-cn-row`
(`ID: <span id="popd_cn">`) now comes *before* `svg#popd_patient_barcode` —
since the container is `flex-direction: column`, the ID line renders above the
barcode instead of below it. `style.css` `.opdref-cn-row` and `.opdref-cn-value`
(both duplicate blocks: `#opd-print-area.opdref .X` and `.opdref-page .X`) now
set `color: #dc2626 !important` (the same red used elsewhere in this codebase)
instead of inheriting black / forcing `#000`.

**Name/Surname merge:** removed the separate
`ນາມສະກຸນ/Surname:` label + `#popd_surname` field from the profile row.
`ຊື່/Name:` label became `ຊື່ ແລະ ນາມສະກຸນ/Name and Surname:`, and `#popd_name`
now carries a new `opdref-fill-fullname` class (46mm, replacing the two
24mm `opdref-fill-name` fields that used to sit side by side) added to both
duplicate `style.css` blocks. In `main.js`, the OPD print binding now does
`safeSetText('popd_name', `${d.First_Name || ''} ${d.Last_Name || ''}`.trim())`
and the old `safeSetText('popd_surname', ...)` call was removed (`popd_surname`
is dead — kept out of the DOM entirely rather than left hidden).

**Verified:** standalone preview harness (real `style.css` + a snippet of the
opd-print-area markup) — computed styles confirmed `.opdref-header-right`
children order is `[DIV.opdref-cn-row, svg]`, both cn-row/cn-value compute to
`rgb(220, 38, 38)`, `#popd_name` carries `opdref-fill-fullname` at 173.8px
(= 46mm), and `#popd_surname` is absent from the DOM.

---

## 2026-07-01 — OPD Card page 2: add "ລາຍເຊັນທ່ານໝໍ" (doctor's signature) label

**User ask (annotated page-2 screenshot):** circled the empty bottom of the
"other" column in the treatment table (just above the Dx / Follow up divider
row) and asked to add a doctor's-signature label there ("ເພີ່ມໃສ່ວ່າ ລາຍເຊັນທ່ານໝໍ").

**Change** ([print-areas.html](../public/partials/print-areas.html)): the third
`<td>` of the `.opdref-treatment-body` row (the tall 185mm writing area) now
carries class `opdref-doctor-sign-cell` and holds
`<div class="opdref-doctor-sign">ລາຍເຊັນທ່ານໝໍ</div>`.

**CSS** ([style.css](../src/style.css), both duplicate blocks
`#opd-print-area.opdref` and `.opdref-page`): `.opdref-doctor-sign` = centered,
bold, `padding: 0 1mm 2mm`, nowrap. The cell is bottom-aligned so the label
sits at the very bottom of the column, right above the Dx/Follow up row.

**Specificity gotcha:** the base rule `#opd-print-area.opdref .opdref-table td`
(and `.opdref-page .opdref-table td`) sets `vertical-align: top !important`, and
its trailing `td` element selector gives it higher specificity than a plain
`.opdref-doctor-sign-cell` class selector — so `vertical-align: bottom` was
ignored and the label rendered at the *top*. Fixed by qualifying the selector as
`td.opdref-doctor-sign-cell` (matching specificity, later in the cascade → wins).

**Verified** via the page-2 preview harness: computed `vertical-align: bottom`,
label's bottom edge sits 4px (= the 2mm padding) above the cell's bottom edge,
directly above the Dx/Follow up divider — matching the circled position.
