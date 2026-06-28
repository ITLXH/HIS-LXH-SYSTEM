# EMR Modal Redesign Notes

**ໜ້າສັ່ງກວດແພດ** / Encounter / EMR modal — flat clinical HIS look.

## Scope

- Restructure `#emrModal` ([`public/partials/modals/emr-modals.html`](../public/partials/modals/emr-modals.html))
  into a layout that mirrors a real hospital information system: title strip,
  patient banner, sticky vitals strip, clinical body, action footer.
- Remove the OPD Card tab because all of its data is already shown in the
  banner + vitals strip — duplicate display was confusing for users.
- Keep all existing DOM IDs so the JS writers (`populateEMRFromTriage`,
  `submitEMRForm`, `handleSiteChange`, `openEMRLabModal`,
  `openEMRDrugModal`, tab counters) keep working without changes.

## Layout structure (top → bottom)

1. **Title strip** — solid `#1f5f97` blue, small `ENCOUNTER /
   ບັນທຶກການກວດ` label above the `ຫ້ອງກວດແພດ (EMR)` title; outlined
   `OPEN` status pill on the right; close button.
2. **Patient banner** — 44 × 44 photo placeholder, patient name (single
   line), inline chips for HN and gender, compact ALLERGY pill on the
   right.
3. **Vitals strip** — single-row CSS grid: `Chief Complaint` (2.2 fr) +
   8 vital tiles (1 fr each) for BP, Temp, PR, RR, SpO₂, Wt, Ht, BMI.
   Flat white background, single accent-blue icons, no per-vital colour
   palette.
4. **Clinical body** (`.emr-his-body`) — scrollable region containing the
   Bootstrap tab strip:
   - `ຂໍ້ມູນການກວດ` — Site / Type / Services / Specialist / Revenue /
     Physical Exam / Diagnosis / Advice / Follow-up / Doctor /
     Discharge Status.
   - `Lab` (with count badge) — Lab order panel.
   - `Rx` (with count badge) — Rx order panel.
5. **Action footer** — help-info line on the left, `ຍົກເລີກ` ghost
   button + `ບັນທຶກຜົນການກວດ` primary button on the right. The submit
   button lives outside the form via `form="emrForm"` so it can sit in
   the footer instead of inline at the bottom of the tab content.

## Removed tab

The previous **OPD Card** tab contained `OPD Card Summary` (HN, name,
gender/age, department, date/time, recorded-by) plus a `Vital Signs`
table — every field of which is now in the always-visible banner +
vitals strip. The user explicitly called this duplication out
("ມີຊັກປະຫວັດມາສະແດງຊ້ຳກັນ").

To avoid breaking the existing JS writers, **the `emrOpd*` element IDs
are kept in a hidden `.emr-opd-mirror-ids` block** inside the form, with
`display: none`:

```html
<div class="emr-opd-mirror-ids" aria-hidden="true" style="display:none;">
  <span id="emrOpdPatientId"></span><span id="emrOpdPatientName"></span>
  <span id="emrOpdGenderAge"></span><span id="emrOpdDepartment"></span>
  <span id="emrOpdDateTime"></span><span id="emrOpdRecordedBy"></span>
  <span id="emrOpdBp"></span><span id="emrOpdTemp"></span>...
</div>
```

`safeSetText('emrOpdBp', ...)` style calls in `main.js` therefore continue
to find their target element and run without error; nothing is rendered
to the user.

## Design notes

User feedback after the first iteration was that the UI looked **"ຢາກຄື AI
ເກີນໄປ"** (too AI-ish). The original draft had:

- gradient title bar (`linear-gradient(180deg, #0f3b6b, #1d508c)`)
- per-vital coloured icon backgrounds (red BP, amber Temp, blue PR, cyan
  RR, green SpO₂, purple Wt, orange Ht, gray BMI)
- glowy status pill with an inner shadow dot
- 6 px corner radii + drop shadows everywhere
- gradient primary button with shadow

The flat redesign uses:

- solid `#1f5f97` (Luckxay primary) — no gradients
- 3-4 px corner radii
- single accent-blue icon colour for all vitals
- inline outline status pill (no background)
- compact 44 px banner photo (was 64 px), 3 px chips
- flat solid primary button, no shadow

## Files modified

- [`public/partials/modals/emr-modals.html`](../public/partials/modals/emr-modals.html)
  — title strip, patient banner, vitals strip, body wrapper, footer; tabs
  trimmed to Overview / Lab / Rx; hidden mirror IDs for removed OPD Card.
- [`src/style.css`](../src/style.css) — new `.emr-his-*` block above the
  `===== TOP NAVBAR =====` section. Class prefix deliberately uses `-his`
  to avoid collision with the existing `.emr-*` rules used elsewhere.

## Responsive

- ≥ 1100 px: vitals strip in one row with CC + 8 tiles.
- 760 – 1099 px: vitals strip wraps to a 5-column grid; CC spans 5.
- < 760 px: 4-column grid; banner collapses to photo + name with the
  allergy moving below.

## Verification

Standalone preview harness at [`tmp/emr-preview/index.html`](../tmp/emr-preview/index.html)
loads `emr-modals.html` + `style.css` and shows the modal in the open
state with sample data — no Supabase login required. Visually verified
at 1400 × 900, 1280 × 820, and 830 × 800. All three remaining tabs
(`Overview / Lab / Rx`) switch correctly via Bootstrap's tab API.
