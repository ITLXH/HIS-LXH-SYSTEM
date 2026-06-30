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
