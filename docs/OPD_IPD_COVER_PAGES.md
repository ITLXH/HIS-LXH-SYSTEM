# OPD / IPD File Cover Pages (ໜ້າປົກ)

## 2026-07-07 — Initial version

### What it is

A one-page printable cover sheet for the paper OPD Card / IPD Chart. OPD covers are generated per patient and are reusable. IPD covers are generated per admission and carry the admission's AM code while keeping the patient's HN visible.

### Where to trigger it

- **Patient Registration** — the row action **ໜ້າປົກ** opens a chooser. OPD prints the reusable patient cover. IPD loads the patient's existing admissions and asks which AM to print. Handler: `window.printCoverChooser(patientId)` in [src/main.js](../src/main.js).
- **IPD Inpatient List** — each admission (active or discharged) has a **ໜ້າປົກ** button next to the chart/history actions. Handler: `window.printIPDCoverFromAdmission(admissionId)`.

### What appears on the page

| Position | OPD | IPD |
|---|---|---|
| Header | Luckxay logo + `ໂຮງໝໍ ຫຼັກໄຊ / LUCKXAY HOSPITAL` | Same |
| ID fields | `HN: LXH2026-XXXXXX` | `HN: LXH2026-XXXXXX` + `AM: AMYYYYMMDD-###` |
| Center title | `OPD CARD` (blue, ~84pt) | `IPD CARD` (red) |
| Center subtitle | `ໃບບັນທຶກຄົນເຈັບນອກ` | `ໃບບັນທຶກຄົນເຈັບໃນ` |
| Patient block | Title + Lao full name | Same |
| Date | None | Admission date/time + Ward/Bed |

### Files

- Template: [public/partials/print-areas.html](../public/partials/print-areas.html) — `#cover-print-area`
- Styles: [src/style.css](../src/style.css) — `#cover-print-area .cover-page` block
- Logic: [src/main.js](../src/main.js) — `printCoverChooser`, `printOPDCoverFromPatientId`, `printIPDCoverFromPatientId`, `printIPDCoverFromAdmission`, `_printCoverPage`, `exportCoverPageAsPdf`
- Logo asset: [public/luckxay-logo.jpg](../public/luckxay-logo.jpg) (already in repo — used by sidebar as well)

### Why programmatic PDF instead of `window.print()`

Same reasoning as OPD Card (`exportOpdCardAsPdf` at src/main.js:9309): the browser print dialog stamps date/URL/page-number headers that can't be turned off from within the page. html2canvas + jsPDF produces a clean A4 sheet with no injected chrome and opens it in a new tab where the user chooses save vs. print.

## 2026-07-07 — IPD title renamed CHART → CARD

The IPD cover sheet was labelled `IPD CHART`; user feedback ("IPD Card ບໍ່ແມ່ນ chart") is that the cover is a *card* (front sheet identifying the file), not the chart itself. Renamed to `IPD CARD` so it stays parallel with `OPD CARD`.

Touched:
- Title string: [src/main.js:9543](../src/main.js#L9543) — `setText('cover_title', isIPD ? 'IPD CARD' : 'OPD CARD')`
- Chooser dialog: [src/main.js:9480](../src/main.js#L9480) — `denyButtonText` now shows `IPD CARD`
- File-header comments: [src/main.js:9457](../src/main.js#L9457), [public/partials/print-areas.html:275](../public/partials/print-areas.html#L275), [src/style.css:2610](../src/style.css#L2610)

Subtitle `ໃບບັນທຶກຄົນເຈັບໃນ` and red accent (`cover-ipd` class) unchanged — only the English title differs.

## 2026-07-07 — Lao tone marks missing on exported cover PDF

**Comment from ອ້າຍໂນ່:** patient names containing ໄມ້ເອກ ( ່ ) show fine in the app but the tone mark disappears on the exported cover PDF.

**Root cause:** html2canvas's default text renderer walks text nodes and splits per character. Lao tone marks ( ່ ້ ໊ ໋ ) are Unicode combining characters that sit above their base consonant; the splitter emits the base and the mark as separate paint operations at the same x, and the second paint loses shaping context, so the mark either overpaints as an empty glyph or is dropped entirely. Same class of bug affects Thai (ั ่ ้), Arabic diacritics, Devanagari, etc.

**Fix:** [src/main.js:9655](../src/main.js#L9655) `window.exportCoverPageAsPdf` now passes `foreignObjectRendering: true` to html2canvas. This wraps the target node in an SVG `<foreignObject>` and lets the browser rasterize it natively — full text shaping preserved. Wrapped in try/catch with a fallback to the previous non-foreignObject render so export still works on browsers where SVG-foreignObject rasterization fails (rare, but has happened on some Safari versions with local images).

Also bumped `line-height` on `#cover-print-area .cover-field-value` from 1.2 → 1.5 and added `padding-top: 2mm` at [src/style.css:2773](../src/style.css#L2773). At 22pt bold, line-height 1.2 was too tight to leave headroom for a tone mark above the ascender — defense in depth in case a future export path stops using foreignObject.

**Not applied to:** the OPD Card multi-page PDF ([src/main.js:9401](../src/main.js#L9401)) and the dashboard export ([src/main.js:4529](../src/main.js#L4529)) still use the plain canvas render. If the same tone-mark drop shows up there, add `foreignObjectRendering: true` to those calls too — kept scoped for now to avoid layout regressions on pages that have been working.

## 2026-07-07 (later) — Reverted foreignObjectRendering (hung the page)

User report: `/patients` → click ໜ້າປົກ → browser threw **"This page isn't responding"**. Root cause: html2canvas 1.4.1 with `foreignObjectRendering: true` inlines every `@font-face` rule from the page into the SVG foreignObject. Our Noto Sans Lao is loaded from `https://fonts.googleapis.com` (index.html:12), and inside a data-URI SVG the WOFF2 fetch is treated as cross-origin without CORS credentials — the browser blocks it, html2canvas keeps waiting on `document.fonts.ready` inside the SVG context, and the whole thing hangs.

**Fix:** reverted [src/main.js:9655](../src/main.js#L9655) `exportCoverPageAsPdf` back to the plain canvas render (no `foreignObjectRendering`). Also removed `letterRendering: true` from the options — in html2canvas 1.4.1 it's a no-op for shaping but historically caused combining marks to render one-at-a-time; leaving it off can only help.

**Kept:** the CSS line-height bump on `#cover-print-area .cover-field-value` (1.2 → 1.5 + 2mm top padding) at [src/style.css:2773](../src/style.css#L2773). If a font ever needs vertical headroom for tone marks above the ascender, that's still there as defense in depth.

**Tone-mark issue is not yet resolved.** Next things to try, in order of least → most invasive:
1. Self-host the Noto Sans Lao WOFF2 (drop it in `/public/fonts/`, replace the Google Fonts `<link>` in index.html with a local `@font-face`). Then try `foreignObjectRendering: true` again — same-origin fonts don't hit the CORS wall.
2. Pre-render the patient-name string to a `<canvas>` using canvas 2D `fillText` (which uses the browser's native shaper and does preserve combining marks), export the canvas as a data-URI `<img>`, and swap the name span for the img just before html2canvas runs.
3. Bypass html2canvas entirely for this one export: load a Noto Sans Lao TTF into jsPDF via `pdf.addFont`, and lay out the cover in jsPDF calls directly. Highest effort, most reliable.

Do NOT re-enable `foreignObjectRendering: true` before doing step 1.

## 2026-07-07 (later still) — Hardened `exportCoverPageAsPdf` so a hang can't wedge the UI

Follow-up bug from the hang: after the browser threw "This page isn't responding", the tab stayed on `/patients` but only the OPD CARD cover was visible — `.wrapper` was hidden and there was no button anywhere. Cause: DOM state was mutated **before** the try/catch, so a hang skipped the `finally` restore.

**Change in [src/main.js:9598](../src/main.js#L9598) `window.exportCoverPageAsPdf`:**
- Moved every state mutation (`wrapper.style.display = 'none'`, `.print-container` display flips, `.print-active` class, `await document.fonts.ready`, inline page styles) **inside the try block**. The `finally` block reliably restores everything even on a throw or a hang that gets killed by the browser.
- Wrapped `document.fonts.ready` in a `Promise.race` against a 3-second timeout so a stalled webfont fetch can never hold the export forever.

If the user hits another hang, they still lose the current export attempt, but the wrapper and containers come back — no forced reload required.

## 2026-07-13 — OPD reusable cover/sticker and IPD AM codes

Feedback from OPD/IPD review:
- OPD cover must not show a date because one patient keeps using the same OPD cover/card identity.
- Sticker must not show visit date/time so unused printed stickers can be reused on another day.
- OPD Card itself must still show the visit date automatically on both printed pages.
- IPD must not reuse HN as its admission code. Each admission gets its own AM code, and one patient can have many AM codes.
- Patient history must show every AM code for that patient.

Implemented locally:
- OPD cover hides the date row. HN and patient name stay visible.
- IPD cover shows HN plus `AM` and keeps admission date/ward/bed visible.
- Patient QR sticker template and print flow no longer ask for or print date/time.
- OPD Card page 1 and page 2 now print `ວັນທີ: <visit date/time>` automatically in the header.
- New IPD admissions use `AMYYYYMMDD-###`. In the real workflow the code comes from the database function `his_one_generate_am_id(p_admission_date)` and the `HIS_One_AM_Counters` table, then is saved into `Admissions.Admission_ID`. The browser has a local fallback only for unapplied local migrations.
- AM generation is used by EMR → IPD, OPD Observation → IPD, and Quick Admit.
- Patient Timeline now merges OPD visits and IPD admission events, showing every AM with a button to open that admission chart.
- IPD Inpatient List now includes a `ໜ້າປົກ` button per admission.

Pending business decision: IPD/OPD cover paper color is not encoded yet because the final paper color has not been chosen.

## 2026-07-13 — AM source of truth review

AM source in production-like flow:
1. Patient has one HN in `Patients.Patient_ID`.
2. When the patient is actually admitted to IPD, the admission flow asks the database to reserve the next AM for the admission date.
3. The reserved AM is written to `HIS_One_Admissions.Admission_ID`.
4. Beds, movements, clinical chart, IPD cover, and patient timeline all reference that saved AM. They do not generate a new AM.

Why DB-backed: if two staff admit patients at the same time, browser-side counting can duplicate numbers. `his_one_generate_am_id()` uses an upserted daily counter so concurrent admissions get different AM values.

Format: `AMYYYYMMDD-###`, for example `AM20260713-001`, `AM20260713-002`.
