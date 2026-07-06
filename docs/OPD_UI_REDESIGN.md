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

---

## 2026-07-01 — OPD Card: show date + time under the barcode

**User ask:** "OPD Card ເພີ່ມວັນທີ ກັບ ເວລາໃສ່ກ້ອງ barcode" — show the visit
date and time below the header-right barcode.

**Change** ([print-areas.html](../public/partials/print-areas.html)): the
`#popd_datetime` span already existed but was buried inside the page-1
`.opdref-hidden` block (write-only metadata). Moved it out to become a visible
`<div class="opdref-datetime-row" id="popd_datetime">` appended after
`svg#popd_patient_barcode` inside `.opdref-header-right`. Since the container is
`flex-direction: column`, it renders directly under the barcode. No JS change —
`main.js` still does the single `safeSetText('popd_datetime', "<date> <time>")`
([main.js:9117](../src/main.js#L9117)); the id/text binding is unchanged, only
the element's location and visibility. Confirmed `popd_datetime` is write-only
(no `getElementById`/read of it anywhere), so relocating it is safe.

**CSS** ([style.css](../src/style.css), both duplicate blocks
`#opd-print-area.opdref` and `.opdref-page`): new `.opdref-datetime-row` mirrors
`.opdref-cn-row` (Times/Phetsarath serif, centered, `width: 62mm` to match the
barcode, nowrap) but smaller and black — `font-size: 11pt`, `font-weight: 600`,
`color: #000` — so it reads as a subordinate caption under the red ID + barcode.

---

## 2026-07-01 — OPD Card: widen Title field + move Aged onto the D.O.B row

**User ask (annotated screenshot):** the `ຄຳນຳໜ້າ/Title` field was too narrow
(honorifics like `ທ່ານນາງ` were cramped), and `ອາຍຸ/Aged` sat at the far right of
the Name row — asked to widen Title and drop Aged down onto the `ເກີດ/D.O.B` row
("ຂະຫຍາຍຊ່ອງຄຳນຳໜ້າ, ເອົາອາຍຸລົງມາຕໍ່ແຖວວັນເກີດ").

**Change** ([print-areas.html](../public/partials/print-areas.html)): moved the
`ອາຍຸ/Aged:` label + `#popd_age` fill + `ປີ` group out of the first profile row
(now just `Title` + `Name and Surname`) and into the second row, before
`ເພດ/Gender`. Row 2 order is now `ເກີດ/D.O.B ___  ອາຍຸ/Aged ___ ປີ  ເພດ/Gender ☐/☑`.

**CSS** ([style.css](../src/style.css), both duplicate blocks): `.opdref-fill-title`
width `12mm → 24mm`. No other field widths changed — removing Aged from row 1
freed the space for the wider Title, and row 2 still had ample room for the
Aged group next to D.O.B + Gender.

**Verified** via the OPD harness (fill=1): both rows fit with no overflow — row 1
content ends ~162mm and row 2 ~172mm inside the sheet, Title fill computes to
24mm holding the honorific, Aged (`42 ປີ`) renders between D.O.B and Gender.

---

## 2026-07-02 — Dashboard INS/CORP KPI stuck at 0

**Symptom** (user): the `INS / CORP` tile on the Clinic Snapshot Board
("ລູກຄ້າອົງກອນປະກັນໄພ ຈະບໍ່ສະແດງໂຕເລກຂື້ນ") always displayed `0`, even with
insurance/corporate patients in range.

**Root cause** ([src/main.js](../src/main.js), `renderDashboardCharts`): the
count filtered on **visit-level** fields `v.Revenue_Group` / `v.Visit_Type`.
`HIS_One_Visits` has no such column, so the filter matched nothing → always 0.
Insurance/corporate status actually lives on the **patient** record
(`Insurance_Company`, `Organization_ID`, `Name_Org`), which the dashboard already
attaches to every visit as `v.Patients` (`pMap[v.Patient_ID]`).

**Fix**: added `insCorpHas(val)` + an `insCorpNone` set that treats
`'' / - / ບໍ່ມີ / none / n/a / self pay / self-pay / ຈ່າຍເອງ` as non-insurance
(case-insensitive), and rewrote the filter to count a visit when the patient has
a real `Insurance_Company` OR `Organization_ID` OR `Name_Org`. The old
Revenue_Group/Visit_Type test is retained only as a legacy fallback.

**Verified**: Vite dev server (port 5176) reloads the edited `main.js` with no
console or build error; a standalone node unit test of the filter logic counted
4/4 sample cases correctly — insurance-company, corporate (Organization_ID),
org-name-only, and legacy "Package" visits are counted; self-pay (`ບໍ່ມີ`),
dash, and empty patients are excluded.

**NOT committed** — per user "ກວດສອບໃນ local ກ່ອນບໍ່ຟ້າວ commit"; awaiting the
user's check against live data before it is folded into the next commit.

---

## 2026-07-03 — OPD Card Page 2 rebuilt as "ໃບຕິດຕາມອາການປິ່ນປົວ"

**Request** (head of department): change Page 2 of the OPD Card to match the
supplied paper reference form.

**Old Page 2** (removed): title `ໃບບັນທຶກອາການ ແລະ ການປິ່ນປົວ`, a 3-column
`History / Treatment / other` table + a `Dx: / Follow up:` row, then a separate
`ໃບບັນທຶກພະຍາບານ` section with a 5-column `Time/ອາການ/ຫັດຖະການ/ໝາຍເຫດ/ຜູ້ບັນທຶກ`
table pinned to the page bottom.

**New Page 2** ([print-areas.html](../public/partials/print-areas.html)):
- Title **ໃບຕິດຕາມອາການປິ່ນປົວ**
- Patient header, 3 lines:
  - `ຊື່ ນາມສະກຸນ/Name` · `ວ/ດ/ປ/D.O.B` · `ອາຍຸ/Age … ປີ`
  - `ທີ່ຢູ່/Address` · `ເມືອງ/Dist` · `ແຂວງ/Prov` · `ໂທ/Tel`
  - `Diagnosis/ມະຕິແພດ` (full-width line)
- One open **4-column log table**: `ວັນເດືອນປີ | ອາການ | ປິ່ນປົວ | ໝາຍເຫດ`
  (single tall body cell, 214mm, fills the page).
- Signature row: `ລາຍເຊັນພະຍາບານຮັບຜິດຊອບ` (left) / `ລາຍເຊັນທ່ານໝໍ` (right).

**Data binding** ([main.js](../src/main.js), `printOPDCard`): new IDs
`popd2_name / popd2_dob / popd2_age / popd2_village / popd2_district /
popd2_prov / popd2_phone / popd2_dx` written right after `popd_doctor`, so the
follow-up sheet carries the patient header stand-alone.

**CSS** ([style.css](../src/style.css), both `#opd-print-area.opdref` and the
`.opdref-page` fallback): old page-2 selectors replaced with
`opdref-p2-header / p2-line / fill-p2-* / col-fl-* / followlog-body /
p2-sign-row`.

**Fit tuning**: the four bilingual header labels first overflowed the 180mm row
(row 1 by 30.2mm, row 2 by 28.8mm — measured with the new
[tmp/pdfs/measure-p2.cjs](../tmp/pdfs/measure-p2.cjs)). Fixed by abbreviating the
labels (`Name Surname→Name`, `ວັນ/ເດືອນ/ປີ→ວ/ດ/ປ`, `District→Dist`,
`Province→Prov`, `ເບີໂທ→ໂທ`) and sizing fills — name 46 / dob 28 / age 10 (row 1)
and addr 26 / dist 22 / prov 26 / tel 28 (row 2). Final measured overflow = 0 on
all three lines.

**Cache-buster** bumped `2026-06-30-opd-cc-nutrition-page2-v3` →
`2026-07-03-opd-page2-followup-log-v4` in three spots: the
`data-opd-template-version` attribute, `PARTIAL_CACHE_BUST`, and
`expectedVersion` (`ensureFreshOpdPrintTemplate`).

**Verified** via the Puppeteer harness (`opd-harness.html?fill=1` → render.cjs →
pdf2pages.cjs, [tmp/pdfs/p2v5-page2.png](../tmp/pdfs/p2v5-page2.png)): output is
exactly 2 pages, every header field renders without clipping, the log table fills
the sheet, and the two signature labels sit near the bottom edge.

**NOT committed** — per user "ກວດສອບໃນ local ກ່ອນບໍ່ຟ້າວ commit"; awaiting the
user's local check before the next commit.

### 2026-07-03 (follow-up) — Page 2 widened + pulled up

Head's mark-up on the live export: "ຍັບອອກເທີງ ແລະ ຊ້າຍ ຂວາ ຂະຫຍາຍຕື່ມ" (move up,
expand left/right). The Page-2 sheet was 180mm centered inside the 186mm
printable area (3mm gap each side) with 4mm top padding.

**Change** ([style.css](../src/style.css), both `.opdref` and fallback blocks):
`.opdref-sheet-page2` width `180mm → 186mm`, `margin: 0`, top padding
`4mm → 0.5mm`. Freed 6mm of row width reallocated to the tightest fills — name
46→50, dob 28→30, prov 26→29, tel 28→31mm. Header rows re-measured at 0 overflow;
render still exactly 2 pages ([tmp/pdfs/p2v6-page2.png](../tmp/pdfs/p2v6-page2.png)).

This fills the full printable width at the standard 12mm side / 10mm top export
margins (`exportOpdCardAsPdf`). Going wider/higher than this would mean reducing
those export margins, which also affects Page 1 — left as a separate decision.

### 2026-07-03 (follow-up 2) — Page 2 tighter print margins (Page 1 untouched)

Head wanted Page 2 wider/higher than the standard print margins allowed, without
changing the approved Page 1. `exportOpdCardAsPdf` ([main.js](../src/main.js)) now
uses **per-page** margins instead of one shared 12mm/10mm value:

- `PAGE_MARGINS = [ {x:12,y:10}, {x:6,y:6} ]` — Page 1 registration form keeps
  12mm side / 10mm top; Page 2 follow-up log drops to 6mm all round.
- A `pageGeom(i)` helper derives inner width/height (px + mm) per page; the
  capture (`html2canvas` width/height/windowWidth) and placement
  (`pdf.addImage` x/y/w/h) both read it, so Page 2 is captured at 198×285mm and
  placed at (6,6) while Page 1 stays 186×277 at (12,10).
- Page 2's sheet is locked to 186mm by `!important` CSS, so the export sets an
  **important inline** width (`p2sheet.style.setProperty('width','198mm','important')`)
  during capture and restores it in `finally` (saved `prevSheetCss`). The
  `.opd-page` element sizing likewise switched from `Object.assign` (non-important,
  which the `.opdref-page { width:186mm !important }` rule was silently
  overriding for Page 2) to `setProperty(..., 'important')`.

**Verified** by running the actual export path headlessly (new
[tmp/pdfs/export-verify.cjs](../tmp/pdfs/export-verify.cjs): loads the harness,
injects the real html2canvas 1.4.1 + jsPDF 2.5.1 from CDN, runs the same per-page
geometry, writes [tmp/pdfs/opd-export-verify.pdf](../tmp/pdfs/opd-export-verify.pdf)).
Output = exactly 2 pages; [exp-page2.png](../tmp/pdfs/exp-page2.png) shows the log
table reaching ~6mm from every edge, all header fields intact;
[exp-page1.png](../tmp/pdfs/exp-page1.png) confirms Page 1 is unchanged.

### 2026-07-03 (follow-up 3) — Page 2 header fields reworked

Head's comments on the live Page 2: merge Title into the Name field, add Gender,
keep Address/District/Province on one row, and move Tel down onto the Diagnosis
row. New header layout ([print-areas.html](../public/partials/print-areas.html)):

- Row 1: `ຊື່/Name` (now `Title + First + Last`) · `ວ/ດ/ປ/D.O.B` · `ອາຍຸ/Age ປີ`
  · `ເພດ/Gender ☑ຊາຍ ☐ຍິງ`
- Row 2: `ທີ່ຢູ່/Address` · `ເມືອງ/Dist` · `ແຂວງ/Prov`
- Row 3: `ໂທ/Tel` · `Diagnosis/ມະຕິແພດ` (full-line; Tel fixed 34mm, Diagnosis fills the rest)

Bindings ([main.js](../src/main.js), `printOPDCard`): `popd2_name` now prefixes
`d.Title`; new `popd2_gender_male/female` tick spans reuse the Page-1 M/F regex.
CSS: name label shortened to `ຊື່/Name:` to make room for Gender (row 1 was 16.4mm
over); fills re-tuned (name 42 / dob 24 / age 7; addr 40 / dist 34 / prov 42);
`#popd2_phone` pinned to `flex: 0 0 34mm` inside the full-line row so Diagnosis
takes the remainder. Cache-buster → `2026-07-03-opd-page2-followup-log-v5`.

Verified via the real export path ([tmp/pdfs/export-verify.cjs](../tmp/pdfs/export-verify.cjs)
→ [exp2-page2.png](../tmp/pdfs/exp2-page2.png)): all three header rows fit with 0
overflow, Title shows in the name, Gender ticks render, Tel+Diagnosis share row 3,
still exactly 2 pages, Page 1 unchanged.

### 2026-07-03 (follow-up 4) — Widen Page 2 name field + shift left

Head: the name kept clipping ("ຂະຫຍາຍ ຊື່ແລະນາມສະກຸນອອກກວ້າງໆ ຍັບອອກເບຶ້ອງຊາຍອີກ").
Measured row 1 — labels alone ate ~78mm, leaving the name fill at only 42mm.
Shortened the row-1 labels to Lao-primary short forms so the value gets room and
starts further left: `ຊື່/Name:` → `ຊື່:` (label 15.6mm → 3.8mm, so the name field
shifts ~12mm left), `ວ/ດ/ປ/D.O.B:` → `ວ.ດ.ປ:`, `ອາຍຸ/Age:` → `ອາຍຸ:`,
`ເພດ/Gender:` → `ເພດ:`. Name fill `42mm → 78mm` (nearly doubled). Rows 2/3 keep
their bilingual labels. Re-measured: all 3 header rows 0 overflow; export path
render [exp3-page2.png](../tmp/pdfs/exp3-page2.png) shows the full `ທ່ານ ສົມຈິດ
ສຸດສະຫງ່າ` on a long line with slack, 2 pages, Page 1 unchanged.

### 2026-07-03 (follow-up 5) — Page 2: replace Diagnosis with full vital signs

Head: "ມະຕິແພດ ປ່ຽນເປັນເອົາ ອາການຊີວິດທັງໝົດມາໃສ່" — drop the Diagnosis field on
row 3 and show all vital signs instead. Row 3 is now `ໂທ:` + phone + a
`ອາການຊີວິດ/Vital:` inline summary of all 8 vitals (BT / BP / PR / RR / SpO₂ /
W / H / BMI) as compact `.opdref-p2-vital` chips ([print-areas.html](../public/partials/print-areas.html)).
New IDs `popd2_temp/bp/pr/rr/spo2/w/h/bmi` bound in `printOPDCard`
([main.js](../src/main.js)) — bare numeric values (labels carry the units), BMI
reuses the page-1 `bmiText`. `popd2_dx` removed. CSS: `.opdref-p2-vital-line`
font 11pt, chips `margin-right: 1.5mm`, Tel fill trimmed to 28mm so all 8 vitals
+ Tel fit one line (row was 11mm over before tuning). Cache-buster → v6.
Verified via export-verify.cjs ([exp5-page2.png](../tmp/pdfs/exp5-page2.png)):
row 3 shows Tel + all 8 vitals, 0 overflow, 2 pages, Page 1 unchanged.

### 2026-07-03 (follow-up 6) — Page 2: one-line address+Tel, vitals as Page-1 table

Head: put ບ້ານ/ເມືອງ/ແຂວງ/ໂທ on one row, and use the same vital-sign TABLE as
Page 1 (not the inline chips). Changes ([print-areas.html](../public/partials/print-areas.html)):

- Header row 2 now holds all four: `ບ້ານ` · `ເມືອງ` · `ແຂວງ` · `ໂທ` (Lao-only
  labels, fills addr 40 / dist 34 / prov 42 / tel 28mm — measured 0 overflow).
  The separate row-3 line was removed.
- Vital signs: replaced the inline `.opdref-p2-vital` chips with a copy of the
  Page-1 8-column `.opdref-vital-table` (BT/BP/PR/RR/SpO₂/Weight/High/BMI) plus
  the `ອາການຊີວິດ/Vital sign:` section label, reusing `popd2_temp/bp/pr/rr/spo2/
  w/h/bmi`. Bindings updated to match Page-1 formatting (units in cells:
  `37.8 °C`, `49.8 kg`, `156 cm`).
- Log-table body height reduced `214mm → 196mm` (both CSS blocks) to make room
  for the vital table while staying 2 pages. Dead `.opdref-p2-vital*` CSS removed;
  new `.opdref-p2-vital-title { margin:0 0 1.5mm }`. Cache-buster → v7.

Verified via export-verify.cjs ([exp6-page2.png](../tmp/pdfs/exp6-page2.png)):
address+Tel on one row, 8-column vital table identical to Page 1, log table fills
the page, 2 pages, Page 1 unchanged.

### 2026-07-03 (follow-up 7) — Tighten Page 2 header, enlarge log table

Head: pull the vital table up (tighten the header gaps) so the lower log table
gets more writing room. Reduced Page-2 vertical spacing ([style.css](../src/style.css),
both blocks): title margin-bottom `4mm → 2mm`, `.opdref-p2-header` `3mm → 1mm`,
`.opdref-p2-line` `2.5mm → 1.2mm`, `.opdref-p2-vital-title` `1.5mm → 1mm`; and
raised the follow-up log body `196mm → 210mm`. Verified via export-verify.cjs
([exp7-page2.png](../tmp/pdfs/exp7-page2.png)): header block is compact, vital
table sits directly under the address row, log table is noticeably taller, still
exactly 2 pages, Page 1 unchanged.

### 2026-07-03 (follow-up 8) — Add logo + ID/barcode + date header to Page 2

Head: put the logo, code (ID+barcode) and date on Page 2 too. Replaced the plain
`.opdref-page2-title` with a Page-1-style `opdref-header-row`
([print-areas.html](../public/partials/print-areas.html)): logo left
(`#print-opd-p2-logo`), title center, and red `ID` (`#popd2_cn`) + barcode
(`#popd2_barcode`) + date (`#popd2_datetime`) right. `renderOpdPatientBarcode`
generalised to take an optional element id (`window.renderOpdPatientBarcode(id,
'popd2_barcode')`); new bindings in `printOPDCard` set the logo (same
`page1HeaderSrc`), ID, date and render the barcode ([main.js](../src/main.js)).
Compact `.opdref-p2-header-row` CSS (logo 36×16mm, barcode 54×10mm, ID 12pt, date
9pt, title 16pt) keeps the header small; log body trimmed `210mm → 194mm` so the
sheet content measures 277.3mm (fits the 285mm Page-2 export area with ~8mm
slack). Verified via export-verify.cjs — barcodes rendered with real JsBarcode
3.11.6 — [exp9-page2.png](../tmp/pdfs/exp9-page2.png): full header present,
signatures fully visible, 2 pages, Page 1 unchanged. (Page-1 barcode call
unchanged — the new 2nd arg defaults to `popd_patient_barcode`.)

### 2026-07-03 (follow-up 9) — Page 2 logo top-aligned + enlarged

Head: "ປັບໂລໂກ້ໃຫ້ຢູ່ສູງຂື້ນແລະງາມ". The Page-2 header logo was vertically
centered (sat lower than the right-column ID). CSS ([style.css](../src/style.css),
both blocks): `.opdref-p2-header-row` set `align-items: start`; the logo cell
`.opdref-header-left` → `align-items: flex-start` (top) with `padding-top: 0.5mm`;
title cell kept `align-self: center`; logo enlarged `36×16mm → 42×20mm` and the
first grid column `40mm → 44mm`. CSS-only, no template/version change. Verified
via export-verify.cjs with the real [luckxay-logo.jpg](../public/luckxay-logo.jpg)
— [expB-page2.png](../tmp/pdfs/expB-page2.png): logo top edge level with the ID,
larger and clean, 2 pages, signatures visible, Page 1 unchanged.

### 2026-07-03 (follow-up 10) — Page 2 logo enlarged to Page-1 size

Head: "Logo ຍັງບໍ່ງາມ" → chose "bigger (same as Page 1)". Root cause: the logo
is nearly square (luckxay-logo.jpg 444×416, aspect 1.07) but the Page-2 header
capped it at `max-height: 20mm`, squashing it into a small square with side
whitespace. Fix ([style.css](../src/style.css), both blocks): logo
`max-height 20mm → 32mm`, width `42mm → 44mm`, first grid column `44mm → 46mm`
(matches Page-1's 44mm/34mm feel). Offset by trimming the log body `194mm →
184mm` — sheet content measures 278.6mm, within the 285mm Page-2 export area.
Verified [expC-page2.png](../tmp/pdfs/expC-page2.png): full Luckxay logo (icon +
bilingual name) at Page-1 size, top-aligned with the ID, 2 pages, signatures
visible, Page 1 unchanged.

### 2026-07-03 (follow-up 11) — Page 2 header fills bleed to paper edge + date column removed

Head annotated the paper form: "ຂະຫຍາຍດ້ານຂ້າງ ຊ້າຍຂວາອອກໃຫ້ສຸດໜ້າ ບ້ານ ເມືອງ
ແຂວງ ເບີ ໃຫ້ພໍ ດີ ຕິດຂອບເຈ້ຍ / ລົບຕາຕະລາງວັນເດືອນປີອອກ ຂະຫຍາຍອອກຊ້າຍຂວາໃຫ້ຊີດ
ຂອບເຈ້ຍ ຂະໜາດ A4". Two asks: (1) the two patient-header lines should stretch
left→right to the sheet edge (they left whitespace at the right margin because the
dotted fills were fixed mm widths); (2) drop the leftmost ວັນເດືອນປີ (date) column
from the follow-up log and let the remaining columns fill the width.

**[print-areas.html](../public/partials/print-areas.html)** — `.opdref-followlog-table`
is now a 3-column table: removed `<col class="opdref-col-fl-date">`, the
`<th>ວັນເດືອນປີ</th>`, and the first `<td>` of `.opdref-followlog-body`. Headers
are now ອາການ / ປິ່ນປົວ / ໝາຍເຫດ.

**[style.css](../src/style.css)** (both `#opd-print-area.opdref` and `.opdref-page`
blocks):
- `.opdref-p2-line` switched from `display:block` (with `white-space:nowrap` +
  fixed-mm inline-block fills) to `display:flex; align-items:baseline; gap:1.5mm`.
  This is the key change — flex items grow, so the dotted fill lines now consume
  all remaining row width and the last field's right edge lands on the sheet edge.
- Per-field widths replaced with flex: `.opdref-fill-p2-name` `flex:1 1 auto`
  (grows to fill the name line), `.opdref-fill-p2-dob` `flex:0 0 27mm` and
  `.opdref-fill-p2-age` `flex:0 0 9mm` (fixed — dates/ages are fixed length), and
  the four address fills `.opdref-fill-p2-addr` / `-district` / `-prov` / `-tel`
  all `flex:1 1 0` (equal quarters across the full width; phone reaches the edge).
  Each also gets `width:auto` (+`min-width:0` on the growing ones) so the old
  fixed `width` no longer constrains them.
- Follow-up column widths retargeted 14/38/36/12% → 43/43/14%
  (`.opdref-col-fl-symptom` / `-treat` / `-note`); the `.opdref-col-fl-date` rules
  were deleted.

The Page-2 sheet already renders at the full 198mm printable width (6mm export
margins in `exportOpdCardAsPdf`), so the flex fills bleed edge-to-edge with no
geometry change needed.

Verified in a standalone page-2 harness loading the real `src/style.css` with the
sheet forced to the 198mm export width and sample data (ສົມນຶ ສີວົງອິຈິດ /
Naxaithong District / Vientiane Capital / 2078999656): the four address fills
measured equal (145px each), the phone field's right edge equalled the sheet's
right edge (0px gap), the name line grew to fill, and the follow-up table reported
exactly 3 header cells and 3 body cells. Page 1 untouched.

### QR sticker — surname clipped on long Lao names (2026-07-04)

User photo of a printed sticker showed the last word of the ນາມສະກຸນ line
(`ເດັກຍິງ ນາງ ວັນນິດາ ປະພັດສະດາ`) running past the right edge of the label
and getting sliced off. Root cause: [src/style.css:5316](../src/style.css#L5316)
`.pcard-row` forces `white-space: nowrap; overflow: hidden; text-overflow:
ellipsis` on every row for compact single-line layout, but the ຊື່ ແລະ ນາມສະກຸນ
row combines `Title + First + Last`, which can exceed the 180mm card width for
Lao name compounds (child prefix + given + family).

Fix — targeted, keeps other rows single-line:

1. [public/partials/print-areas.html](../public/partials/print-areas.html):
   added a modifier class `pcard-row-name` to the ຊື່ຊື່ row for all three
   card templates (`pcard1/2/3`).
2. [src/style.css:5336](../src/style.css#L5336) `.pcard-name`:
   font-size `38px → 32px` + `word-break: break-word; overflow-wrap: anywhere`
   so long compounds break at any glyph instead of running past the edge.
3. New `.pcard-row-name` rule immediately below: `white-space: normal
   !important; overflow: visible !important; line-height: 1.15` — lets ONLY
   the name row wrap onto a 2nd line (Vital Sign / DOB / phone rows stay
   nowrap-truncated).

The card height (89mm) already has slack — even the 2-line worst case fits
above the address rows without spilling past the 3-cards-per-A4 vertical
budget (see original QR-sticker section above).


### Dashboard — Revenue Groups → 10 Services, Ins/Corp split, Occupation added, sidebar label (2026-07-04)

Head-of-department requested four dashboard tweaks in one round:

1. **Rename `Revenue Groups` → `10 Services`.** Panel header only —
   the underlying chart is still fed from `v.Revenue_Group` (top-8 with
   "Other" bucket). The old label was misleading because clinicians
   read revenue groups as service categories anyway. Location:
   [public/partials/views/dashboard.html:79](../public/partials/views/dashboard.html#L79),
   subtitle updated to `ບໍລິການທັງໝົດ 10 ອັນດັບ`.
2. **Split "ກຸ່ມປະກັນໄພ ແລະ ອົງກອນ" into two separate charts.** The
   combined `Ins / Corp` KPI tile on page 1 stays, but page 2 now
   carries two independent breakdowns:
   - `<h6>Insurance</h6>` → `chartInsurance` — top 5 `p.Insurance_Company`
   - `<h6>Organization</h6>` → `chartOrganization` — top 5 `p.Name_Org`
3. **Add Occupation chart.** New span-2 compact panel on page 2:
   `<h6>Occupation</h6>` → `chartOccupation` — top 8 `p.Occupation`.
4. **Sidebar label rename.** `nav.dashboard` translation
   `ແຜງຄວບຄຸມ → Dashboard` in [src/main.js:147](../src/main.js#L147).
   `nav.ipdDashboard` (`ແຜງຄວບຄຸມ IPD`) left alone — the user only
   asked about the main entry.

**Data plumbing.** `renderDashboardCharts` in
[src/main.js:4219](../src/main.js#L4219) grows three new
accumulators — `insurance / organization / occupation` — plus an
`insOrgOccSeen` Set that dedups by `Patient_ID`. Rationale: returning
patients would otherwise be counted N times per breakdown (one per
visit), so a single insured patient with 12 visits would beat 11
one-shot self-pay patients. Visit-scoped tallies (services /
specialist / timeSlot / district / doctors) keep the per-visit tally
they've always had — only patient-attribute breakdowns switch to
patient-level counting. Blank / self-pay entries are filtered via the
existing `insCorpHas()` helper (rejects ``, `-`, `ບໍ່ມີ`, `none`,
`n/a`, `self pay`, `ຈ່າຍເອງ`) so they don't pollute the top-N.

The three new chart IDs are added to both `window.dashboardChartIds`
(so the resize/relayout loop sizes them on grid changes) and the
`compactDashboardCharts` Set (so their legend / tick / data-label
fonts match the neighbouring page-2 compact charts).

**Layout.** Page 2 grid unchanged at 4 columns. New row inserted
between Age Group and Community Snapshot:

- Insurance (span-1) · Organization (span-1) · Occupation (span-2)

The A4-landscape height budget still holds — the added row is one
compact-panel tall (~182px on screen) and Community Snapshot pushes
down accordingly without breaking the second page.

**Verification.** `node --check src/main.js` passes. Vite dev server
(port 5173) starts with no console errors. HTML structure verified
headlessly via [tmp/pdfs/dash-changes-check.cjs](../tmp/pdfs/dash-changes-check.cjs)
(new title, no old title, three new canvases, three new h6 headings,
Community Snapshot preserved). Live-data verification pending user
acceptance test with real Supabase data (dashboard needs auth).


## 2026-07-06 — Dashboard: Province + District fixed-bucket breakdown tables

### Requested by the user
Screenshots supplied of a paper reference sheet: a two-column table with a blue
header `Province` and rows `ວຽງຈັນ / ບໍລິຄຳໄຊ / ອື່ນໆ`, and a matching one for
`District` with rows `Xaythany / Xaysettha / Chanthabuly / Naxaithong /
Sikhottabong / others`. User wants both breakdowns on the Dashboard styled to
match the reference.

### Implementation
- **[public/partials/views/dashboard.html](../public/partials/views/dashboard.html)** — added two new panels after the `Occupation` panel, one per breakdown. Each panel wraps a `<table class="dashboard-breakdown-table">` inside a `.dashboard-breakdown-wrap` scroll container. Table body IDs: `#tblProvinceBody`, `#tblDistrictBody`.
- **[src/style.css](../src/style.css)** — new `.dashboard-breakdown-wrap` / `.dashboard-breakdown-table` block. Flat clinical look per `[feedback_no_ai_looking_ui]`: solid `#1B6BB0` header, white text, 4px radius, alternating `#f7fafc` odd rows, no gradients or shadows. Right-aligned tabular-nums count column via `.dashboard-breakdown-count`.
- **[src/main.js](../src/main.js)** — new `window.renderProvinceDistrictTables(visits)`. Called at the tail of `renderDashboardCharts` right before `refreshDashboardChartLayout()`.

### Aggregation logic
Patient-level dedup (uses `v.Patients.Patient_ID` in a `Set` — returning
patients don't inflate their home province/district). Each patient's
`Province` / `District` value is normalized (`trim`+`toLowerCase`) and matched
against a per-bucket alias list; unmatched values fall into `ອື່ນໆ` (province)
or `others` (district).

- Province buckets:
  - **ວຽງຈັນ** — aliases: `ວຽງຈັນ`, `vientiane`, `ນະຄອນຫຼວງ`, `nakhon luang`, `nakhonluang`
  - **ບໍລິຄຳໄຊ** — aliases: `ບໍລິຄຳໄຊ`, `bolikhamxay`, `borikhamxay`, `bolikhamsai`, `borikhamsai`
- District buckets (5 named): **Xaythany**, **Xaysettha**, **Chanthabuly**, **Naxaithong**, **Sikhottabong** — each with Lao and common English-spelling aliases.

Alias match uses `includes()`, so e.g. `"Vientiane Capital"` still buckets to
`ວຽງຈັນ`.

### i18n note
The `Province` / `District` panel titles and `<th>` headers are auto-translated
by the app's existing i18n system: in Lao mode the reader sees `ແຂວງ` / `ເມືອງ`,
in English mode `Province` / `District`. The row labels themselves are not
translated — Lao names stay Lao, English names stay English (matches the paper
reference).

### Verification
- Fed 9 synthetic patients (Lao and English spellings, a duplicate Patient_ID,
  and off-list provinces/districts) through `window.renderProvinceDistrictTables`
  in the live dev preview. Province: `ວຽງຈັນ 5 / ບໍລິຄຳໄຊ 2 / ອື່ນໆ 2`;
  District: `Xaythany 2 / Xaysettha 1 / Chanthabuly 2 / Naxaithong 1 /
  Sikhottabong 1 / others 2` — dedup + alias matching both correct.
- `preview_inspect` confirmed header cells render with `background-color:
  rgb(27, 107, 176)` (`#1B6BB0`), white text, `font-weight: 700`, left-aligned;
  count cells right-aligned with `color: rgb(14, 59, 95)` and `font-weight: 700`.
  Matches the flat clinical brief.

## 2026-07-06 (b) — Province + District into a single side-by-side band

Followup to the same-day Province+District tables. User wanted:
1. Remove the "Top 5 ເມືອງທີ່ມາໃຊ້ບໍລິການ" bar chart from Community Snapshot.
2. Show Province + District in a single 2-column band styled like Community Snapshot (not as two separate panels).

### Layout change ([public/partials/views/dashboard.html](../public/partials/views/dashboard.html))

Replaced the two separate `--soft`/`--accent` breakdown panels **and** the old Community Snapshot panel with **one** `dashboard-report-panel--span-4 dashboard-report-panel--community` panel titled "Province & District". Inside it a `dashboard-report-split` grid holds two `dashboard-report-split-card` slots (`--map` for Province with `fa-map-marker-alt`, `--doctor` for District with `fa-city`), each wrapping the `.dashboard-breakdown-wrap`/`.dashboard-breakdown-table` structure from the earlier commit.

Top 5 Doctors kept as its own `dashboard-report-panel--span-2 --accent` panel (canvas `#chartMarketing`).

### JS cleanup ([src/main.js](../src/main.js))

- Removed `chartProvince` from `window.dashboardChartIds` and the `compactDashboardCharts` Set.
- Deleted the `topDist = getTopNWithOthers(district, 5, 0.001)` line and the `createChart('chartProvince', …)` call.
- The `district` map is still populated by the visits loop but no longer read — left in place because removing the assignment risks breaking other code that walks the same loop.

### Verification (live vite preview @ 1440×900)

- `#chartProvince` canvas gone; `#chartMarketing` still present.
- The Province/District panel's split cards render **side-by-side** at equal width (615×N each, 14px gap, same top Y-coordinate).
- Row contents unchanged: `ວຽງຈັນ / ບໍລິຄຳໄຊ / ອື່ນໆ` and `Xaythany / Xaysettha / Chanthabuly / Naxaithong / Sikhottabong / others`.

## 2026-07-06 (c) — Polish pass on the Province/District band

User photo showed the District card with a visible right-side scrollbar hiding the top row (`Xaythany`) and asked for a nicer "frame" (`ກາບແບບສວຍງາມ`) look.

### CSS changes ([src/style.css](../src/style.css))

- **Removed** the `max-height:170px` cap on `.dashboard-breakdown-wrap` — it was clipping the 6-row District table. The wrap now sizes to content; `overflow:hidden` keeps the rounded corners clean.
- Table font 12.5 → 13px; row padding 5px 10px → 9px 14px; header padding 6px 10px → 9px 14px with 0.2px letter-spacing.
- Border colour `#e2e8f0 → #d6e0ea`; zebra `#f7fafc → #f5f9fc`.
- New `tr:hover td { background:#eaf2fa }`.
- New **totals footer** — `tfoot td` background `#f0f6fb`, 2px top border in `#1B6BB0`, weight 700, dark-blue text; second cell right-aligns via `tfoot td:last-child`.
- New `.dashboard-breakdown-empty` — italic muted centered placeholder for the zero-data case.

Design still follows [feedback_no_ai_looking_ui]: single accent blue, no gradients, 4px radius.

### HTML changes ([public/partials/views/dashboard.html](../public/partials/views/dashboard.html))

Added `<tfoot><tr><td>ລວມ / Total</td><td id="tblProvinceTotal|tblDistrictTotal">0</td></tr></tfoot>` to both tables.

### JS changes ([src/main.js](../src/main.js))

`paint()` inside `renderProvinceDistrictTables` now:
1. Sums the bucket values → writes to `tblProvinceTotal` / `tblDistrictTotal`.
2. When the sum is 0, replaces the body with a single `<tr class="dashboard-breakdown-empty"><td colspan="2">ບໍ່ພົບຂໍ້ມູນ</td></tr>` row instead of six zero-count rows.

### Verification (live vite @ 1440×900, 9 synthetic patients)

- Province total = 9, 3 rows.
- District total = 9, all 6 rows visible; `wrap.scrollHeight === wrap.clientHeight` (no scrollbar).
- `preview_inspect` on `tfoot td`: `background: rgb(240, 246, 251)`, `color: rgb(14, 59, 95)`, `font-weight: 700`.
- Screenshots kept timing out on this session, but header/row/footer computed styles were inspected directly and match the spec.

## 2026-07-06 (d) — Province & District tables → bar charts

User asked "ບໍ່ເຫັນສິເປັນ chart ໂຊ" ("wouldn't it be better as a chart?"). Kept the same aggregation + fixed-bucket logic, just changed the rendering.

### HTML ([public/partials/views/dashboard.html](../public/partials/views/dashboard.html))

Both split-cards now contain `<div class="dashboard-report-chart dashboard-report-chart--split"><canvas id="chartProvinceBreakdown|chartDistrictBreakdown"></canvas></div>`. The split-title gets a small `Total` pill: `<span class="dashboard-breakdown-total" id="tblProvinceTotal|tblDistrictTotal">0</span>`.

### CSS ([src/style.css](../src/style.css))

- New `.dashboard-breakdown-total` — 999px pill, `#eaf2fa` bg, `#0E3B5F` text, weight 800, tabular-nums, `margin-left:auto` so it hugs the right end of the title bar.
- **Removed** the previous ~55-line `.dashboard-breakdown-wrap` / `.dashboard-breakdown-table*` / `.dashboard-breakdown-count` / `.dashboard-breakdown-empty` block since HTML no longer uses it.

### JS ([src/main.js](../src/main.js))

`renderProvinceDistrictTables` swapped its `paint()` inner helper for `draw()`, which:
1. Sums the bucket values → writes to `tblProvinceTotal` / `tblDistrictTotal`.
2. Calls `window.createChart(canvasId, 'bar', labels, values, palette, true)` — the same compact-bar renderer used by Insurance / Organization / Occupation.

Both canvases registered in `window.dashboardChartIds` and `compactDashboardCharts`, so the resize loop and compact-font sizing pick them up automatically.

### Fixed-bucket note

Buckets are fixed (`ວຽງຈັນ / ບໍລິຄຳໄຊ / ອື່ນໆ` and `Xaythany / Xaysettha / Chanthabuly / Naxaithong / Sikhottabong / others`) so zero-count bars are drawn too. Categories stay stable across date ranges, which is important for comparing periods.

### Verification (live vite @ 1440×900, 11 synthetic patients)

- Province: `ວຽງຈັນ 7 / ບໍລິຄຳໄຊ 2 / ອື່ນໆ 2`, Total = 11.
- District: `Xaythany 4 / Xaysettha 0 / Chanthabuly 2 / Naxaithong 0 / Sikhottabong 0 / others 5`, Total = 11.
- Both totals rendered in the pill; canvas dimensions 589×156.

## 2026-07-06 (e) — Fit exactly 2 A4 pages in the exported dashboard PDF

Reference: user's `Dashboard.pdf` — page 2 clipped the Province & District band mid-chart and pushed Top 5 Doctors onto a nonexistent page 3.

### Root cause
`dashboard-report-grid--spread-detail` is a **12-column** grid inside `#dashboardPrintArea` ([src/style.css:6751](../src/style.css#L6751)). Default detail-panel = `grid-column: span 3` ([src/style.css:6772](../src/style.css#L6772)), `--span-4` = span-12. Because Top 5 Doctors was declared *after* the `--span-4` Province & District panel in the HTML source, auto-placement floated it onto Row 4:

- Row 1: Gender/OPD/Site/Age — 12 cols
- Row 2: Insurance/Organization/Occupation — 9 cols; slot 10–12 empty
- Row 3: **P&D (span-12)** — full row (couldn't fit in the 3-col leftover)
- Row 4: Top 5 Doctors — off-page

### Fix
1. **Reorder in HTML** ([public/partials/views/dashboard.html](../public/partials/views/dashboard.html)) — Top 5 Doctors moved *before* Province & District. Row 2 now fills 12 cols with Insurance/Organization/Occupation/Doctors; P&D sits alone on Row 3 = 3 rows total on page 2.
2. **Trim heights in export layout** ([src/style.css](../src/style.css)):
   - Page 2 (spread-detail): `--compact 172→148px`, `--split 156→130px`, split-card padding `12→10px 12px 8px`, grid gap `14→10px`, panel-head margin/padding `10→6px`.
   - Page 1 (spread-summary): `--hero 214→206px`, `--medium 174→168px`.

### Verification
Ran an export-simulation loop in the live preview: injected the same `.dash-pdf-header`, forced each `.dashboard-report-page--spread` to `297×210mm` with `overflow:hidden`, then read `scrollHeight` vs `clientHeight`. Both pages returned `scrollHeight === clientHeight === 792px` — **0 overflow, exactly 2 pages**.

## 2026-07-06 — OPD Card printed a stale patient age

Reviewer flagged an OPD Card where DOB 2023-07-20 rendered Age = 1 on the printout despite today being 2026-07-06 (real age 2y 11m). Root cause was not the age math but the *source*: [src/main.js:9211](../src/main.js#L9211) and [src/main.js:9290](../src/main.js#L9290) both wrote `d.Age` straight to `popd_age` / `popd2_age`. `Patients.Age` is a snapshot column populated by `calculateAgeForm()` at registration ([src/main.js:2985](../src/main.js#L2985)) and never refreshed. A patient registered in mid-2024 at age 1 keeps `Age = 1` in the DB forever.

Fix: added a local `ageFromDob(dob)` helper inside `printOPDCard` that computes years from `Date_of_Birth` using calendar arithmetic (guards against months/days not yet reached this year), falling back to the stored `d.Age` only when DOB is missing or unparseable. Both page 1 (`popd_age`) and page 2 (`popd2_age`) now go through the same `printAge` value, so the two pages can never disagree either.

Not touched: `calculateAgeForm()` — that path stores an age at registration by design (searches, filters and reports elsewhere depend on it). Only the *printed* age is now derived live.

Edge cases handled:
- Future DOB (data entry error) → returns `` (falls back to stored `d.Age`).
- Same month, day-of-month not yet reached → decrements year (turns 3 → 2 for DOB 2023-07-20 on 2026-07-06).
- DOB stored as either ISO (`2023-07-20`) or a raw `Date` — `new Date()` parses both.

### 2026-07-06 (same-day follow-up) — same bug in Triage / OPD queues

After the OPD Card printout was fixed, the reviewer spotted the Triage list still showed `3 ປີ` for the same DOB 2023-07-20 patient. Same root cause on a different surface: `_fetchTriageQueue` ([src/main.js](../src/main.js) `age: r.Age || p?.Age || 0`) and `_fetchOpdQueue` (identical line) built each row from the stored age snapshot. The reports/patients list had the same pattern for `p.Age`.

Refactored age handling into a shared `window.ageFromDob(dob)` helper (returns `null` when DOB is missing/invalid/future so callers can fall back cleanly). The OPD Card local helper was replaced with a call to it. Both queue joins now select `Date_of_Birth` in addition to `Age`, and the row mappings compute `window.ageFromDob(p?.Date_of_Birth || r.Date_of_Birth) ?? (r.Age || p?.Age || 0)`. `calculateAgeForm()` was also rewritten on top of the shared helper — the old `Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970)` epoch-diff trick worked for common ages but was fragile around leap-second and TZ boundaries.

Left alone: `Age_Group` band on Patients — reports elsewhere key off it and re-binding pediatric rows into a new band mid-report would break historical accuracy.


## 2026-07-06 — Doctor dropdown moved from EMR to Triage

User observation: the "Top 5 Doctors" chart on the dashboard was always empty. Two causes stacked:
1. **Timing**: `Doctor_Name` was only assigned inside the EMR modal (`#emrDoctor`), after the visit had passed OPD. Any run that never reached EMR (or where the doctor was implicit) left the field blank.
2. **Counter gate**: [src/main.js:4337](../src/main.js#L4337) required `Mapped_Specialist` to be non-empty before counting a doctor — a heuristic added earlier to filter out cases where `Doctor_Name` was a nurse or free-text string. With no specialist mapping this dropped otherwise valid doctors.

Fix — move assignment upstream:
- New `#v_doctor` select in [public/partials/modals/triage-modal.html](../public/partials/modals/triage-modal.html) using the `dyn-Doctor` auto-populate hook (options come from `MasterData["Doctor"]`).
- `openTriage` hydrates it from the row (`r.doctor`), with the same safety `append(new Option(...))` pattern used for `#v_recorded_by` in case the row carries a doctor name not currently in MasterData.
- `executeTriageSave` writes `Doctor_Name: fd.v_doctor` to `Visits`; local `currentTriageData[i].doctor` is patched so the list card stays in sync until the next fetch.
- Dashboard counter gate on `Mapped_Specialist` removed — the dropdown is backed by curated MasterData so the nurse-leakage concern is moot.

Relationship to EMR: the `#emrDoctor` dropdown in the EMR modal was intentionally left in place. It still edits the same `Visits.Doctor_Name` column, so a doctor can override the triage assignment mid-visit. EMR save runs later than Triage save, so any change there wins. The Triage assignment is the "first-touch" default.

### 2026-07-06 (second follow-up) — Triage dropdown was showing non-doctors

After the initial move, the dropdown pulled from `MasterData["Doctor"]` (via the `.dyn-Doctor` class). That MasterData category had been used loosely for all staff, so nurses appeared alongside physicians. The correct source is `HIS_One_Users.Role`.

Added a small cache layer:
- `window.doctorUsersCache` — plain array of Name strings.
- `window.refreshDoctorUserList()` — Supabase select on `Users` filtered by `Role="doctor"`, then repopulates every `.doctor-users-select` in the DOM.
- `window.applyDoctorUserSelects()` — DOM writer, called by the refresh and again inside `openTriage` to cover late-loading modals.
- `loadUsers()` now triggers the refresh so admin edits stay in sync automatically.

The Triage form now marks its select with class `doctor-users-select` (replacing `dyn-Doctor`). The "unknown value" append pattern still runs in `openTriage`, so an old visit whose `Doctor_Name` is a person no longer in the active-users list will still render and remain editable.

EMR intentionally not touched. Its `.dyn-Doctor` source may still include people not in HIS_One_Users, and silently dropping them would be a regression we cannot verify from here. Revisit only if the user reports the same complaint on EMR.

**2026-07-06 (third pass) — Fallback to MasterData when Users has no doctors.** The users-only source was too strict; a system that has not yet registered doctors as Users saw an empty dropdown. `applyDoctorUserSelects` now falls back to `masterDataStore["Doctor"]` when the users cache is empty, and is also called from the tail of `loadMasterDataGlobalCallback` so the fallback fires the moment MasterData finishes loading. Each rendered select gets a `data-doctor-source` attribute (`users` or `masterdata`) for debugging. Once the operator registers actual doctors in `HIS_One_Users` with role=doctor, the dropdown auto-flips to the curated list.


## 2026-07-06 — Removed obsolete OPD Header/Footer URL inputs from Settings

The System Settings card historically stored the OPD print header and footer as free-text URLs (`OpdHeaderUrl` / `OpdFooterUrl` in the Settings table, wired to `#setOpdHeaderUrl` / `#setOpdFooterUrl`). Since the image-upload cards in "ຕັ້ງຄ່າໃບ OPD / OPD Print Settings" landed, those URL inputs became redundant — the print path at `printOPDCard` prefers `opdPrintPage1HeaderImage` etc. and only falls back to the URLs when the image slot is empty. User asked to cut the two duplicated URL inputs.

Removed:
- The two `<div class="col-md-6">` blocks for `#setOpdHeaderUrl` and `#setOpdFooterUrl` in [public/partials/views/settings.html](../public/partials/views/settings.html).
- Every DOM read/write against those inputs in `submitSettingsForm`, the post-login settings hydrate, and `loadSettings()` in [src/main.js](../src/main.js).
- `OpdHeaderUrl` / `OpdFooterUrl` from the Settings upsert payload and the `systemSettings` merge inside `submitSettingsForm`.

Kept for backward compatibility:
- The Supabase read paths that populate `systemSettings.opdHeaderUrl` / `.opdFooterUrl` if those rows still exist in the Settings table.
- The print-time fallback chain: `opdPrintPage1HeaderImage || opdHeaderUrl || logoUrl`. Tenants with legacy values still get them honored on print — the values just can no longer be edited from this page.


## 2026-07-06 — OPD print header/footer images did not persist

Users uploaded a header/footer image, saw the preview appear, then found the slot empty again on the next visit to Settings. Root cause was not the load path but a UX-side gap in the save flow: `handleOpdPrintImageUpload` only wrote the returned public URL into the hidden input, and persistence was gated on a separate "Save OPD Print Settings" click at the bottom of the card. Anyone who uploaded and navigated away lost the value.

Added `window.persistOpdPrintImageSetting(settingKey, value)`:
- Upserts a single row `{ Key: settingKey, Value: value }` into the `Settings` table with `onConflict: "Key"`.
- Mirrors the value into the corresponding `systemSettings.opdPrintPage*Image` field so subsequent OPD prints in the same session pick it up without a full page reload.
- Any Supabase error surfaces via Swal instead of a silent `console.error`, so a misconfigured unique-key constraint on the tenant `Settings` table becomes immediately visible.

`handleOpdPrintImageUpload` awaits the persist call right after `uploadOpdPrintImage` returns. `clearOpdPrintImage` also persists an empty string so a Remove click is instantly durable. The bulk save button on the form is left in place; hitting it after individual auto-saves is a harmless no-op double-write.


## 2026-07-06 — Both Settings-view configuration cards removed

User confirmed (via AskUserQuestion) that they wanted both cards removed entirely, not just the URL fields inside them. Cut from settings.html:
1. `ຕັ້ງຄ່າລະບົບ` (Hospital Name, Logo URL, remember-module toggle, Save button).
2. `ຕັ້ງຄ່າໃບ OPD / OPD Print Settings` (four image dropzones + Save button).

Only the Master Data section remains under `#view-settings`.

JS cleanup in [src/main.js](../src/main.js): deleted `submitSettingsForm`, `submitOpdPrintSettingsForm`, `loadSettingsData` (an older duplicate load path that also targeted the removed inputs), plus the entire image-upload helper family (`getOpdPrintImageFieldIds`, `renderOpdPrintImagePreview`, `clearOpdPrintImage`, `uploadOpdPrintImage`, `handleOpdPrintImageUpload`, `persistOpdPrintImageSetting`). Simplified the on-navigate-to-settings handler to just render the Master Data UI.

CSS cleanup: removed unused `.opd-print-image-card`, `.opd-print-image-dropzone`, `.opd-print-image-placeholder` blocks from [src/style.css](../src/style.css).

Backward compatibility: the post-login Settings fetch still reads `HospitalName`, `LogoUrl`, `OpdHeaderUrl`, `OpdFooterUrl`, and the four `opd_print_page*_image` keys into `systemSettings`. `printOPDCard` still consults them via its fallback chain. Any tenant with existing rows keeps their printed header/footer/logo working; those values can no longer be edited from the UI and must be changed directly in the Supabase Settings table if needed.


## 2026-07-06 — Triage Type / Recorded By / Doctor set to required

User: make three fields required (`ຜູ້ລົງທະບຽນ / ຜູ້ບັນທຶກ`, `ແພດຜູ້ກວດ (Doctor)`, `ປະເພດ (Type)`). Added the `required` attribute + red `*` on each label in [triage-modal.html](../public/partials/modals/triage-modal.html), and put an explicit `-- ເລືອກປະເພດ --` placeholder in front of the Type list so the field is not auto-satisfied by the sole `OPD` option.

Backed with JS validation in `submitTriageForm` that fires a Swal warning per missing field, mirroring the pre-existing `Department` check. Native HTML5 required handles most cases; the JS layer catches Save clicks that somehow bypass the browser check.
