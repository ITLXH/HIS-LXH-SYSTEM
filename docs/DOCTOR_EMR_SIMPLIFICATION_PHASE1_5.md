# Doctor EMR Simplification Phase 1.5

Local development only. No deployment, commit, or push.

## Objective

Phase 1.5 simplifies the Doctor EMR workspace for first-time doctors. The goal is not to add more functions, but to make the normal OPD workflow obvious and fast enough to complete in 2-3 minutes.

## Before vs After

| Area | Before | After |
| --- | --- | --- |
| Patient header | Many patient facts and encounter details shown at once | Only HN, VN, name, age, gender, allergy, and chronic disease |
| Allergy | One fact among many | Strong visible warning card |
| Navigation | Clinical tabs plus results and technical sections | Five clear workflow steps |
| Assessment | Chief complaint, HPI, full exam fields | Required main symptom, optional history, quick normal exam buttons |
| Diagnosis | Search can show several ICD-10 rows immediately | Search starts empty and shows only the best few matches |
| Investigation | Lab/radiology plus priority and reason visible | Common Lab and Imaging first; advanced details collapsed |
| Treatment | Doctor types most medication data | Common medication templates fill dose, route, frequency, duration |
| Summary | More clinical completion details | Short review and complete button |

## User Workflow

1. See patient information.
2. Record symptoms.
3. Select diagnosis.
4. Order investigation.
5. Add treatment.
6. Complete visit.

The visible EMR step guide maps this into five buttons:

1. ອາການ
2. ວິນິດໄສ
3. ສັ່ງກວດ
4. ຮັກສາ
5. ສຳເລັດ

## UI Changes

- Simplified fixed patient header.
- Made drug allergy the most visible patient safety warning.
- Replaced complex tab feeling with a five-step guide.
- Removed the separate result tab from the primary workflow.
- Shows LIS results inline after sending orders.
- Collapsed advanced order fields under `ຂໍ້ມູນເພີ່ມເຕີມ`.
- Reduced assessment to main symptom, optional history, and simple physical exam.
- Added quick normal buttons for General, Heart, and Lung.
- Added common medication templates.
- Kept Lao as the primary UI language, with technical terms such as EMR, ICD-10, LIS, Vital Signs, CBC, CRP, LFT, and route abbreviations.

## Training Benefit

This design is easier for a doctor who has never used EMR because the page now answers the next action visually:

- The current step is highlighted.
- Required work is minimal.
- Optional fields are collapsed.
- The doctor can finish common cases without reading long explanations.
- Templates reduce typing and reduce prescription variance.
- The final review shows only the key completion items.

## Local Test Scenario

Tested scenario should confirm:

1. Doctor opens patient.
2. Doctor sees allergy warning immediately.
3. Doctor enters `ອາການຫຼັກ`.
4. Doctor searches diagnosis using `ໄຂ້` or `Pneumonia`.
5. Doctor selects `J18.9`.
6. Doctor selects `CBC`.
7. Doctor sends order to LIS.
8. Doctor sees returned CBC result inline.
9. Doctor selects Paracetamol template.
10. Doctor adds medication.
11. Doctor completes encounter.

## Issues To Watch In Training

- Doctors may still need one short orientation that the step guide is clickable.
- Some doctors may expect results to be a separate page; Phase 1.5 keeps it inline to reduce navigation.
- Medication templates should be validated by pharmacy before real use.
- ICD-10 catalog is currently a small local demo list and needs production data mapping later.

## Future Improvements

- Add department-specific default templates.
- Add favorite diagnoses by department.
- Add pharmacy-approved medication sets.
- Add real LIS order/result status with polling or event updates.
- Add visit-specific autosave.
- Add audit trail for every final sign action.
- Add role-based edit rules after encounter completion.

## 2026-07-22 — Phase 1.6: ລ້າງໂຄດຊ້ຳ + ເຮັດ workflow ໃຫ້ງ່າຍຂຶ້ນສຳລັບໝໍທີ່ບໍ່ເຄີຍໃຊ້ EMR (local only, ບໍ່ commit/push)

### ບັນຫາທີ່ພົບກ່ອນແກ້

1. `src/main.js` ມີໂຄດ OPD Test **3 ຊຸດຊ້ອນກັນ** (v10 Treatment Follow-up, Phase 1, Phase 1.5) ≈ 840 ແຖວ — ຊຸດສຸດທ້າຍທັບຊຸດກ່ອນ, 2 ຊຸດທຳອິດເປັນ dead code ທັງໝົດ
2. `src/style.css` ມີ CSS class ຈາກ layout v1–v10 ເກົ່າ (emrt-sec, emrt-quick-card, opdt-follow-*, opdt-soap-*, opdt-doctor-tabs, opdt-timeline ...) ≈ 620 ແຖວ ທີ່ບໍ່ມີ HTML ອ້າງເຖິງແລ້ວ
3. ທ່ານໝໍໃໝ່ຕ້ອງ **ຮູ້ເອງ** ວ່າຕ້ອງກົດ step guide ເທິງສຸດເພື່ອໄປຂັ້ນຕອນຕໍ່ໄປ — ບໍ່ມີປຸ່ມ ຕໍ່ໄປ/ກັບຄືນ
4. ເພີ່ມຢາຈາກ template ຕ້ອງກົດ 2 ເທື່ອ (ກົດ template ແລ້ວກົດ ເພີ່ມຢາ ອີກ)
5. ຖ້າກົດ ສຳເລັດການກວດ ແລ້ວຂາດຂໍ້ມູນ — ມີແຕ່ຂໍ້ຄວາມເຕືອນ, ບໍ່ພາໄປຫາຂັ້ນຕອນທີ່ຂາດ
6. ບັງຄັບຕ້ອງມີຢາ ≥1 ສະເໝີ ເຖິງແມ່ນ case ທີ່ບໍ່ຕ້ອງຈ່າຍຢາ

### ການແກ້ໄຂ

**ລ້າງໂຄດ (ບໍ່ປ່ຽນພຶດຕິກຳທີ່ດີຢູ່ແລ້ວ):**

- `src/main.js`: ລວມ 3 ຊຸດເຫຼືອ **block ດຽວ** ທ້າຍໄຟລ໌ (18,401 → 17,932 ແຖວ). State ປ່ຽນຊື່ເປັນ `window.opdTestState` ອັນດຽວ (ເກົ່າ: opdTestSimpleState / opdTestPhase1State / opdTestPhase15State ຊີ້ໃສ່ກັນມົ້ວ). Key handler ເປັນ `opdTestKeyHandler` ອັນດຽວ. ຟັງຊັນ v10/Phase1 ທີ່ຕາຍແລ້ວຖືກລຶບໝົດ (RenderFollowups, AddFollowup, SimpleSetStatus, SetNoteMode, ApplyTemplate, SetProgress, RefreshResults ...)
- `src/style.css`: ຂຽນ script ກັ່ນຕອງ (scratchpad) ລຶບ rule ທີ່ອ້າງ class emrt-/opdt- ທີ່ບໍ່ມີໃນ HTML/JS ປັດຈຸບັນ — 13,855 → 13,255 ແຖວ. Media query ຫວ່າງຖືກລຶບນຳ. ກວດ brace balance ຜ່ານ

**UX ສຳລັບໝໍທີ່ບໍ່ເຄີຍໃຊ້ (public/partials/views/opd_test.html + JS):**

1. **ປຸ່ມ ຕໍ່ໄປ/ກັບຄືນ ທຸກຂັ້ນຕອນ** (`.opdt-step-nav` + `opdTestGoStep(delta)`) — ປຸ່ມ ຕໍ່ໄປ ບອກຊື່ຂັ້ນຕອນຖັດໄປ ເຊັ່ນ "ຕໍ່ໄປ: ວິນິດໄສ →" ບໍ່ຕ້ອງຮູ້ວ່າ step guide ກົດໄດ້
2. **Enter ໃນຊ່ອງຄົ້ນຫາ ICD-10 = ເລືອກຜົນທຳອິດ** (`opdTestDxSearchKeydown`)
3. **ກົດ template ຢາ = ເພີ່ມເຂົ້າລາຍການທັນທີ** (ກັນຊ້ຳ: ກົດຊ້ຳຈະເຕືອນ "ມີຢານີ້ແລ້ວ") — ຟອມປ້ອນເອງຍັງຢູ່ສຳລັບຢານອກ template
4. **Validation ພາໄປຫາຂັ້ນຕອນທີ່ຂາດ** — ກົດສຳເລັດແລ້ວຂາດ CC/Dx/LIS ຈະ switch ໄປ pane ນັ້ນກ່ອນສະແດງຄຳເຕືອນ
5. **ຢາບໍ່ບັງຄັບແລ້ວ** — ຖ້າ 0 ລາຍການ ຈະຖາມຢືນຢັນ "ສຳເລັດໂດຍບໍ່ມີການສັ່ງຢາ?" (ກົດ ກັບໄປເພີ່ມຢາ ຈະພາໄປຂັ້ນຕອນ 4)
6. ອາການຫຼັກພິມແລ້ວ step 1 ຕິກຂຽວທັນທີ (`oninput` → `opdTestRefreshStepGuide`)
7. ຂັ້ນຕອນ 3 ຂຽນບອກກົງໆວ່າ "ຖ້າບໍ່ສັ່ງກວດ ກົດ ຕໍ່ໄປ ໄດ້ເລີຍ"
8. ສຳເລັດແລ້ວ auto-switch ໄປ tab ສຳເລັດ ໃຫ້ເຫັນສະຫຼຸບທີ່ຖືກ lock

### ຜົນທົດສອບ (Chrome ຈິງ, localhost:5175/opd/test, 2026-07-22)

- Flow ໄວສຸດ: ພິມອາການ → ຕໍ່ໄປ → ພິມ "ໄຂ້" + Enter → ຕໍ່ໄປ → ຕໍ່ໄປ (ຂ້າມກວດ) → ກົດ +Paracetamol → ຕໍ່ໄປ → ສຳເລັດການກວດ ≈ **7 ຄລິກ + ພິມ 2 ບ່ອນ**
- ທົດສອບແລ້ວ: Enter ເລືອກ J18.9 ✓ · template ເພີ່ມທັນທີ ✓ · ຂ້າມ orders ຜ່ານ ✓ · lock + badge ສຳເລັດແລ້ວ ✓ · ບໍ່ມີ console error ✓
- ເສັ້ນທາງສົ່ງ LIS (CBC → ຜົນ inline) ທົດສອບກ່ອນ refactor ✓

### ສະຖານະ

- Local only — **ບໍ່ commit / ບໍ່ push** ຕາມສັ່ງ. ລໍຜູ້ໃຊ້ກົດທົດສອບເອງໃນ app.

## 2026-07-22 (v2) — Phase 2: ຫຍຸບ 5 ຂັ້ນຕອນເປັນໜ້າດຽວ (single-page fast workflow)

Feedback: ຄົນເຈັບ 1 ຄົນໃຊ້ເວລາບັນທຶກດົນເກີນໄປ — ໃຫ້ວ່ອງໄວ ກະທັດຫັດ ບໍ່ຫຼາຍເກີນໄປ.

### ສາເຫດຄວາມຊ້າ

ແບບ 5 ຂັ້ນຕອນ (Phase 1.5/1.6) ບັງຄັບໃຫ້ **ປ່ຽນໜ້າ 4 ເທື່ອ** ຕໍ່ຄົນເຈັບ 1 ຄົນ ເຖິງແມ່ນ case ທຳມະດາ. ຂັ້ນຕອນ "ສຳເລັດ" ຍັງເປັນໜ້າແຍກຕ່າງຫາກທີ່ຕ້ອງເຂົ້າໄປອີກກ່ອນປິດ visit.

### ການປ່ຽນແປງ

**`public/partials/views/opd_test.html` ຂຽນໃໝ່:** ຖິ້ມ step guide + 5 panes + ປຸ່ມ ຕໍ່ໄປ/ກັບຄືນ ທັງໝົດ → ເຫຼືອ **ໜ້າດຽວ scroll ດຽວ 4 ຂໍ້** (`.opdt-flow-section`):

1. **ອາການ*** — textarea ດຽວ; ປະຫວັດອາການ + ກວດຮ່າງກາຍ (ຄ່າເລີ່ມຕົ້ນ "ປົກກະຕິ") ຍຸບໃນ `<details>`
2. **ວິນິດໄສ*** — ຄົ້ນຫາ + Enter ເລືອກຜົນທຳອິດ, ລາຍການທີ່ເລືອກຢູ່ລຸ່ມຊ່ອງຄົ້ນຫາເລີຍ
3. **ສັ່ງກວດ (ຖ້າຕ້ອງການ)** — checkbox 6 ໂຕ + ປຸ່ມ "ສົ່ງ LIS (n)" ໃນແຖວດຽວ; ຜົນ LIS ສະແດງລຸ່ມ section; **ບໍ່ມີ popup ຢືນຢັນ** ແລ້ວ (badge ປ່ຽນເປັນ ສົ່ງແລ້ວ·ເລກຄຳສັ່ງ)
4. **ຢາ** — ກົດ template ເພີ່ມທັນທີ; ຟອມເຕັມຍຸບໃນ "ເພີ່ມຢານອກລາຍການ"

ທ້າຍໜ້າ: ການປະເມີນ/ແຜນ/ນັດຕິດຕາມ ຍຸບໃນ `<details>` + ປຸ່ມ **ສຳເລັດການກວດ** ໃຫຍ່ (ຊ້ຳກັບປຸ່ມ header). ຫົວແຕ່ລະຂໍ້ມີ ✓ ຂຽວເມື່ອຂໍ້ມູນຄົບ.

**`src/main.js`:** block opdTest ຂຽນໃໝ່ — ລຶບ `opdTestSwitchTab` / `opdTestGoStep` / `opdTestStepPanes` / `opdTestRefreshStepGuide` / `opdTestRenderEncounterReview` / Alt+1-5. ເພີ່ມ `opdTestFocusSection` (validation ບໍ່ຜ່ານ → scroll + focus ໃສ່ຂໍ້ທີ່ຂາດ), `opdTestRefreshChecks` (✓ ຫົວຂໍ້). ເລືອກ dx ແລ້ວ focus ກັບຊ່ອງຄົ້ນຫາເພື່ອພິມໂຕຕໍ່ໄປໄດ້ເລີຍ. ເພີ່ມຢານອກລາຍການແລ້ວລ້າງຟອມ. ໄຟລ໌ 17,932 → 17,880 ແຖວ.

**`src/style.css`:** prune ຮອບ 2 (step-guide/step-nav/emrt-pane/pane-heading/order-group/encounter-review ອອກ) + ເພີ່ມ `.opdt-flow-section/.opdt-flow-head/.opdt-flow-check/.opdt-order-inline` + ແກ້ layout ແຖວ `.opdt-med-list > div` ທີ່ຫຼຸດຫາຍຕອນ prune ຮອບທຳອິດ. 13,255 → ~12,970 ແຖວ.

### ຄວາມໄວ (ທົດສອບຈິງ, Chrome, 2026-07-22)

| Case | ເມື່ອກ່ອນ (5 ຂັ້ນຕອນ) | ຕອນນີ້ (ໜ້າດຽວ) |
|---|---|---|
| ທຳມະດາ ບໍ່ສັ່ງກວດ | ~7 ຄລິກ + ປ່ຽນໜ້າ 4 ເທື່ອ | **3 ຄລິກ** (dx Enter · +ຢາ · ສຳເລັດ) + ພິມ 2 ບ່ອນ, scroll ດຽວ |
| ມີສັ່ງ lab | ~9 ຄລິກ | 5 ຄລິກ (ຕິກ lab + ສົ່ງ LIS ເພີ່ມ) |

ທົດສອບຜ່ານ: Enter ເລືອກ J06.9 ✓ · +Paracetamol ເພີ່ມທັນທີ ✓ · ✓ ຂຽວຫົວຂໍ້ 1/2/4 ✓ · ສຳເລັດ + lock ✓ · ບໍ່ມີ console error ✓

### ສະຖານະ

- Local only — **ບໍ່ commit / ບໍ່ push**. ລໍຜູ້ໃຊ້ທົດສອບເອງ.

## 2026-07-23 — Phase 2: Department template engine + progress strip + summary preview

Per the beginner-doctor spec: keep the single-page 8-section layout, add a sticky 5-step overview strip on top of the workspace card, and drive per-department content from a reusable config. Local only, no commit/push.

### What changed (files)

- `public/partials/views/opd_test.html` — rewritten:
  - Sidebar: added `#opdTestDeptPicker` (7 depts) + `ເບິ່ງທັງໝົດ` history button; replaced `.opdt-history-item` demo with compact `.opdt-summary-row`s
  - New `.opdt-progress-strip` at the top of `.card-body` with 5 buttons that call `opdTestFocusSection`
  - Section 1: added `.opdt-chip-row#opdTestSymptomChips` under CC + hint bubble `data-hint-id="cc"`
  - Section 3: added `.opdt-suggest-block` with `#opdTestDxCommonChips` + `#opdTestDxRecentChips` + hint `data-hint-id="dx"`
  - Section 4: expanded checkboxes to 12 (added Glucose/UA/ECG/Troponin/Lipid/Echo); added `<option value="STAT">STAT</option>` to priority; renamed button to `ຢືນຢັນສົ່ງຄຳສັ່ງກວດ`; hint `data-hint-id="orders"`
  - Section 5: replaced hardcoded med chip row with `#opdTestMedChips` (dept-driven); hint `data-hint-id="meds"`; added optional `#opdTestMedInstr` field
  - Section 6: unfolded from `<details>` to always-open form; added `#opdTestAdviceChips` + `.opdt-followup-presets` (None/3d/7d/14d/Custom)
  - New section between 6 and 7: `#opdTestSecSummary` with `#opdTestSummaryPreview` (read-only generated summary)
- `src/main.js` — opdTest block (lines 17577+) rewritten:
  - State adds `dept`, `recentDx`, `followupPreset`, `hintsDismissed`
  - New `opdTestDeptTemplates` with 7 depts (general/im/cardio/ortho/ent/obgyn/peds), each with `quickSymptoms/examSections/commonDiagnoses/commonInvestigations/commonMedications`
  - Expanded `opdTestDiagnosisCatalog` to 16 codes, `opdTestMedicationTemplates` to 9 drugs (still local demo; production Supabase `Drugs_Master`/`Labs_Master` wiring deferred to Phase 3D)
  - New: `opdTestApplyDept`, `opdTestAppendChip`, `opdTestRenderSymptomChips`, `opdTestRenderMedChips`, `opdTestRenderDxCommonChips`, `opdTestRenderExamGrid`, `opdTestRenderAdviceChips`, `opdTestSetFollowup`, `opdTestRenderSummaryPreview`, `opdTestRenderProgress`, `opdTestSummaryReady`, `opdTestCertaintyLabel`, `opdTestPriorityLabel`, `opdTestDispositionLabel`, `opdTestLoadHints`, `opdTestApplyHintsFromStorage`, `opdTestDismissHint`, `opdTestShowFullHistory`, `opdTestInit`
  - Rewritten: `opdTestAddDiagnosis` (first → Primary, else Secondary; records to `recentDx`), `opdTestToggleDxCertainty` (cycles Primary→Secondary→Suspected), `opdTestRenderDiagnoses` (uses certainty label), `opdTestSendOrders` (Swal confirm summary before push), `opdTestBuildLocalResults` (adds `low` flag + ref ranges), `opdTestRenderResults` (renders `↑`/`↓` arrows, ref-range small text), `opdTestCompleteVisit` (collect missing[] → single Swal; PE/Orders/Meds are warnings, not blocks; REQUIRED = CC + ≥1 Dx + (Assessment or Plan) + Disposition), `opdTestRefreshSimple` (calls new render funcs)
  - `main.js:3592` hook changed from `opdTestRefreshSimple` → `opdTestInit` so chip rendering runs after the partial is in the DOM
- `src/style.css` — appended styles for `.opdt-progress-strip`/`.opdt-progress-step` + `.done/.partial/.empty`, `.opdt-chip-row/.opdt-chip`, `.opdt-hint`, `.opdt-dx-cert.is-primary/.is-secondary/.is-suspected`, `.opdt-result-card .is-low`, `.opdt-followup-presets`, `.opdt-summary-grid/-label/-value/-cert`, `.opdt-history-btn`

### Beginner walk-through — Chrome test result (2026-07-23)

| # | Step | Result |
|---|---|---|
| 1 | Page loads at /opd/test | ✓ progress strip + hints visible |
| 2 | Allergy Penicillin visible in sidebar | ✓ red block, sticky |
| 3 | Change dept to Cardiology | ✓ chips/med/dx/PE labels update |
| 4 | Click symptom chip `+ ເຈັບໜ້າເອິກ` | ✓ appended to CC (not replaced) |
| 5 | Click `ກວດປົກກະຕິທັງໝົດ` | ✓ all 5 fields = "ປົກກະຕິ" |
| 6 | Add ICD-10 I10 then I20.9 | ✓ I10=Primary, I20.9=Secondary |
| 7 | Cycle 2nd certainty | ✓ Secondary → Suspected → Primary |
| 8 | Tick Troponin + ສົ່ງ LIS | ✓ "ຢືນຢັນສົ່ງຄຳສັ່ງກວດ" modal with test + priority |
| 9 | Confirm order | ✓ Troponin recorded to state.orders |
| 10 | Click +Amoxicillin | ✓ ຄຳເຕືອນແພ້ຢາ! red confirm dialog |
| 11 | Cancel allergy alert | ✓ Amoxicillin NOT added |
| 12 | Click +Paracetamol | ✓ added silently (no allergy) |
| 13 | Follow-up preset 7d | ✓ date = today + 7 |
| 14 | Sign-off with blank assessment + no disposition | ✓ "ຂໍ້ມູນຈຳເປັນຍັງບໍ່ຄົບ" lists the missing items |
| 15 | Dismiss `cc` hint | ✓ hidden + localStorage `["cc"]` |
| 16 | `npm run build` | ✓ succeeds in 1.03s (761 KB gzip 179 KB) |
| 17 | Progress strip states | ✓ 1-2 done, 3-4 ຂ້າມໄດ້, 5 partial ("ບໍ່ຄົບ") |
| 18 | STAT priority option | ✓ present |
| 19 | Sticky sidebar on scroll | ✓ patient info + dept picker + actions stay visible |
| 20 | Summary preview updates live | ✓ CC/Dx/Orders/Meds/Assessment/Disposition reflected |

Console clean (0 errors) throughout the run. `npm run build` succeeded.

### Skips (deferred per plan)

- Print templates (prescription / appointment / referral / certificate) — Phase 3C
- Real Supabase Drugs_Master / Labs_Master wiring — Phase 3D
- Real drug-drug interaction engine — kept Penicillin-group check only
- Real visit-history fetch — kept Swal placeholder
- Full antenatal OB workflow — stub only

Not committed. Awaiting the doctor's manual click-through review.

## 2026-07-23 (v2) — Compact fit-to-screen pass

Feedback: "ປັບ UI/UX font ຂະໜາດໃໝ່ໃຫ້ມັນພໍດີໜ້າ"

Existing sizes were too generous — the 8 sections + progress strip + sidebar didn't fit within a single 812px viewport without heavy scrolling. Tightened everything without changing structure.

### Numeric changes (src/style.css)

| Element | Before | After |
|---|---|---|
| `.opdt-flow-section` padding | 12px 14px | 8px 10px |
| `.opdt-flow-section` margin-bottom | 12px | 8px |
| `.opdt-flow-head` gap / margin-bottom | 9px / 10px | 7px / 6px |
| `.opdt-flow-head b` (number circle) | 24×24, 12.5px | 20×20, 11px |
| `.opdt-flow-head h5` | 15px / 800 | 13px / 700 |
| Workspace card-body padding | 16px | 10px |
| Progress strip padding / gap | 8px 4px / 6px | 4px 2px / 4px |
| Progress step layout | vertical (col) | 2-col grid: number + label/status |
| Progress step label / status | 12px / 10.5px | 11.5px / 10px |
| `.opdt-chip` padding / size | 4px 10px / 12px | 2px 8px / 11.5px |
| `.opdt-hint` padding / size | 6px 10px / 12.5px | 3px 8px / 11.5px |
| Form-control default size | Bootstrap 16px | 12.5px, min-height 30px |
| Form labels | 14px | 11px |
| Textarea min-height | ~74px | 42px |
| Check-row labels | ~13px | 11.5px |
| Order options label | ~13px | 11.5px, padding 2px 6px |
| Dispo button padding / size | 10px 6px / 12.5px | 6px 4px / 11.5px |
| Dispo button icon | 16px | 14px |
| Sign strip padding / label size | 10px 12px / 11px | 6px 10px / 10px |
| Audit note | 11.5px | 10.5px |
| Print row buttons | 12.5px | 11.5px |
| Summary preview label / value | 10.5px / 12.5px | 10px / 12px |
| Follow-up presets padding / size | 4px 10px / 12px | 2px 8px / 11px |
| Sidebar patient name | 16px | 14px |
| Sidebar summary rows | ~13px | 11.5px |
| Sidebar action buttons | 12.5px | 11.5px |

### Result

Chrome walk-through (2026-07-23):
- Sections 1–3 (Subjective + PE + Diagnosis) now fit within one 812px viewport with dept picker + sidebar visible
- Progress strip trimmed from ~90px to ~52px height
- Sections 5–8 (Meds + Advice + Preview + Dispo + Sign) all fit within a second viewport-worth of scroll
- All chip rows keep to a single row on the 1499px screenshot; labels still readable at 11.5px

`npm run build` — passes (no CSS parse errors).

Local only, not committed.
