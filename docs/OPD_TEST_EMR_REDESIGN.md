# OPD Test — EMR Redesign Prototype

## 2026-07-15 — ສ້າງໜ້າ OPD Test (prototype, ຍັງບໍ່ commit / ບໍ່ຕໍ່ DB)

ໜ້າທົດລອງ layout EMR ໃໝ່ ຕາມແບບ EMR ສາກົນ (Epic/Cerner style) ເພື່ອໃຫ້ທີມເບີ່ງ ແລະ ຕັດສິນໃຈກ່ອນຈະ implement ຈິງແທນໜ້າ OPD consultation ປັດຈຸບັນ. **ຂໍ້ມູນທັງໝົດເປັນ demo data ຄົງທີ່ — ບໍ່ໄດ້ດຶງຈາກ Supabase.**

### ແນວຄິດການອອກແບບ

ໜ້າ EMR ເດີມ (Codex design) ຍັດ 10 ບລັອກໃນໜ້າດຽວ → ສັບສົນ. ໜ້າໃໝ່ແບ່ງເປັນ:

1. **Patient banner ຄົງທີ່** (ເທິງສຸດ) — ຊື່, HN/VN, ອາຍຸ/ເພດ, ພະແນກ, ສິດ, ປ້າຍແພ້ຢາສີແດງ, encounter + ສະຖານະ
2. **Chart tabs 5 ອັນ** — ພາບລວມ · SOAP Note · ສັ່ງຢາ (Rx) · Lab/ຜົນກວດ · ປະຫວັດ
3. **Vitals strip ແຄບ** — ຢູ່ເທິງທຸກ tab (BP, Temp, Pulse, RR, SpO₂, Weight, BMI, Pain)
4. **Queue rail ຊ້າຍ** (216px) — ຄິວ OPD ມື້ນີ້ + tag ອາການ + ປ້າຍແດງກໍລະນີດ່ວນ
5. **Context rail ຂວາ** (264px) — Allergy, ຢາປະຈຳ, Lab ຫຼ້າສຸດ, visit ຜ່ານມາ, audit
6. **Action bar ລຸ່ມ (sticky)** — Save Draft · ພິມ OPD Card · ນັດຕິດຕາມ · ສົ່ງ Lab · ສົ່ງໃບຢາ · Lock

Responsive: ຈໍ <1100px ເຊື່ອງ rail ຂວາ, <860px ເຊື່ອງ rail ຊ້າຍ + vitals ຫຍໍ້ເປັນ 4 ຄໍລໍາ.

### ໄຟລ໌ທີ່ແຕະ

| ໄຟລ໌ | ການປ່ຽນແປງ |
|---|---|
| `public/partials/views/opd_test.html` | **ໃໝ່** — view ທັງໜ້າ (`#view-opd_test`), demo data ຄົງທີ່ |
| `src/style.css` | Append styles prefix `.emrt-*` (ທ້າຍໄຟລ໌) — flat clinical, accent ດຽວ `var(--primary)`, radius 3–4px |
| `src/main.js` | 6 ຈຸດ: (1) `loadPartials()` views array + `'opd_test'` · (2) `HIS_NAV_ROUTES.opd_test` → `/opd/test` · (3) `HIS_PATH_ROUTES['/opd/test']` · (4) `loadView()` views list + `'opd_test'` · (5) `canUserAccessView` — ເຂົ້າໄດ້ຖ້າມີ perm `opd` · (6) `window.opdTestSwitchTab(el)` ທ້າຍໄຟລ໌ |
| `public/partials/navbar.html` | ເພີ່ມ nav item `#nav-opd_test` "OPD Test" (icon `fa-clipboard-check`, class `mnu-opd` — ເຫັນສະເພາະຄົນມີສິດ OPD) |

### ວິທີເປີດເບີ່ງ

1. `npm run dev` (port 5176)
2. Login ດ້ວຍ user ທີ່ມີສິດ OPD (ຫຼື admin)
3. ກົດເມນູ **OPD Test** ໃນ navbar ຫຼືເຂົ້າ URL `/opd/test`
4. ກົດສະຫຼັບ 5 tabs ເບີ່ງ layout

### ຂໍ້ຈຳກັດ (ໂດຍເຈດຕະນາ)

- ຂໍ້ມູນ demo ຄົງທີ່ທັງໝົດ — ປຸ່ມ/ລິ້ງທັງໝົດເປັນ placeholder (`onclick="return false;"`)
- ບໍ່ບັນທຶກ, ບໍ່ດຶງ DB, ບໍ່ກະທົບໜ້າ OPD ຈິງ
- ຖ້າຕົກລົງເອົາ layout ນີ້ → ຂັ້ນຕອນຕໍ່ໄປແມ່ນຕໍ່ສາຍ `loadQueue()` / `Visits` / `Prescription_JSON` / `Lab_Orders_JSON` ເຂົ້າ tabs ຕາມ pattern ຂອງ view `opd` ເດີມ
- ຖ້າບໍ່ເອົາ → ລຶບ 4 ຈຸດຂ້າງເທິງອອກໄດ້ງ່າຍ (view ໃໝ່ scoped ດ້ວຍ `emrt-` prefix ທັງໝົດ)

### Mockup ອ້າງອີງ

- Artifact (ກົດ tab ໄດ້): https://claude.ai/code/artifact/41accda9-f0fb-477f-ae2a-485d03e8900d
- ແຜນວິເຄາະ + sitemap: https://claude.ai/code/artifact/716d2a1c-579b-44c0-8129-5672f8770928

## 2026-07-15 (v2) — ປ່ຽນເປັນໜ້າກວດຄົນເຈັບຄົນດຽວ (Epic storyboard style)

Feedback ຈາກຜູ້ໃຊ້: ໜ້າກວດຕ້ອງເປັນຄົນເຈັບຄົນດຽວ — ບໍ່ສະແດງຄິວຄົນອື່ນ, ບໍ່ຕ້ອງຕາມ UI ຂອງ Codex, ໃຫ້ອອກແບບຕາມ EMR ສາກົນຕົວຈິງ.

### ການປ່ຽນແປງ

- **ລຶບ queue rail ຊ້າຍ** (ຄິວ OPD) ແລະ context rail ຂວາ ອອກທັງໝົດ
- **ເພີ່ມ Patient Storyboard** ແບບ Epic Hyperspace — ແຖບແນວຕັ້ງຊ້າຍ 232px ພື້ນນ້ຳເງິນເຂັ້ມ (`var(--primary-dark)`) ປະກອບມີ:
  - ປຸ່ມ "← ກັບຄິວ OPD" (ເອີ້ນ `loadView('opd')`)
  - ຮູບ + ຊື່ + ເພດ/ອາຍຸ/DOB + HN/VN + ໂທ
  - ກ່ອງແພ້ຢາສີແດງທຶບ
  - Encounter: ເລກທີ, ວັນທີ, ພະແນກ, ສິດ, ແພດ, ສະຖານະ
  - Vitals ຫຍໍ້ (grid 2 ຄໍລໍາ)
  - ຂັ້ນຕອນມື້ນີ້ (timeline ຈຸດຂຽວ=ແລ້ວ, ເຫຼືອງ=ກຳລັງ)
- **Workspace ຂວາ**: activity tabs 5 ອັນຄືເກົ່າ (ພາບລວມ · SOAP · ສັ່ງຢາ · Lab · ປະຫວັດ) + action bar ລຸ່ມ
- ຂໍ້ມູນ context (ຢາປະຈຳ, Lab ຫຼ້າສຸດ, visit ຜ່ານມາ) ຍ້າຍໄປຢູ່ tab "ພາບລວມ" ເປັນ 4 panels
- CSS block `.emrt-*` ໃນ `src/style.css` ຖືກຂຽນແທນທັງ block (v1 layout 3 ຄໍລໍາຖືກລຶບ)
- `main.js` / `navbar.html` ບໍ່ປ່ຽນ — wiring ເດີມໃຊ້ໄດ້ (`opdTestSwitchTab` ໃຊ້ class ຊື່ເກົ່າ)

### ຜົນທົດສອບ (local, 2026-07-15)

- Queue rail ບໍ່ມີແລ້ວ, storyboard ສີ navy ຖືກຕ້ອງ (rgb(17,88,146))
- 5 tabs ສະຫຼັບຖືກຕ້ອງ, timeline 6 ຂັ້ນຕອນ, ກ່ອງແພ້ຢາສະແດງ
- ຍັງບໍ່ commit — ລໍຖ້າຜູ້ໃຊ້ຢືນຢັນ layout

## 2026-07-15 (v3) — ປັບສີສັນ/ສະໄຕລ໌ໃຫ້ຄືໜ້າອື່ນໃນລະບົບ (house style)

Feedback: v2 (storyboard ສີ navy) ເບີ່ງຄື "AI ເກີນໄປ" — ໃຫ້ໃຊ້ສີສັນແບບດຽວກັບໜ້າທີ່ເຮັດມາກ່ອນ.

### ການປ່ຽນແປງ

- ຖິ້ມ storyboard ສີເຂັ້ມ + CSS custom ເກືອບໝົດ, ປ່ຽນມາໃຊ້ idiom ຂອງ repo:
  - Page header ແບບ `opd.html`: `h3 fw-bold text-dark` + icon `text-info` + subtitle `text-muted 11.5px`, ຂອບລຸ່ມ `2px solid var(--border-color)`
  - ຄໍລໍາຊ້າຍ (col-lg-3): `card card-outline card-primary shadow-sm` — ຮູບ, ຊື່, HN/VN badge, `alert alert-danger` ແພ້ຢາ, Encounter/Vitals ເປັນແຖວ key-value, timeline ຂັ້ນຕອນ
  - ຄໍລໍາຂວາ (col-lg-9): `card card-outline card-info` + **Bootstrap `nav nav-tabs`** ໃນ card-header + `card-footer` ເປັນ action bar
  - ຕາຕະລາງ: `table table-hover align-middle` + `thead bg-light` ຄືທຸກໜ້າ
  - ສະຖານະ: `badge bg-primary/bg-warning text-dark/bg-success/bg-danger`
  - ປຸ່ມ: `btn btn-info text-white fw-bold shadow-sm` / `btn-success` / `btn-outline-*`
- CSS block `.emrt-*` ຫຼຸດເຫຼືອ ~20 ແຖວ (ຮູບຄົນເຈັບ, pane toggle, key-value row, timeline dots) — scoped `#view-opd_test`
- `opdTestSwitchTab()` ປ່ຽນ selector ເປັນ `.nav-tabs .nav-link` + class `active` (Bootstrap ມາດຕະຖານ)

### ຜົນທົດສອບ (local)

- 5 tabs ສະຫຼັບຖືກ, pane ເຊື່ອງ/ສະແດງຖືກ, timeline dot ຂຽວ/ເຫຼືອງຕິດ
- ໝາຍເຫດ: browser cache CSS ແຮງ — ຖ້າ style ບໍ່ປ່ຽນໃຫ້ກົດ Ctrl+Shift+R

## 2026-07-16 (v4) — ຫຼຸດຂໍ້ມູນທີ່ບໍ່ຈຳເປັນອອກ (declutter)

Feedback: ຍັງສະແດງຂໍ້ມູນຫຼາຍເກີນໄປ — ບໍ່ຕ້ອງເອົາຂໍ້ມູນທີ່ບໍ່ຈຳເປັນມາສະແດງ.

### ຫຼັກຄິດ

ໃຫ້ເຫຼືອສະເພາະສິ່ງທີ່ແພດຕ້ອງເຫັນຕອນກວດ: **ຄົນເຈັບແມ່ນໃຜ + ແພ້ຫຍັງ + vitals + ບ່ອນຂຽນກວດ**. ຂໍ້ມູນອື່ນຍ້າຍໄປຢູ່ tab ຂອງມັນເອງ ຫຼືຕັດອອກ.

### ການປ່ຽນແປງ

- **ຖິ້ມຄໍລໍາຊ້າຍ (col-lg-3) ທັງແຖບ** — ເລກ encounter, ວັນທີ, ພະແນກ, ສິດ, timeline ຂັ້ນຕອນມື້ນີ້, ຊື່ອັງກິດ, DOB, VN, ເບີໂທ: ຕັດອອກໝົດ
- **ຖິ້ມ tab "ພາບລວມ"** — 4 cards ຂອງມັນຊ້ຳກັບບ່ອນອື່ນ (ສະຫຼຸບ encounter = SOAP · Lab ຫຼ້າສຸດ = tab Lab · visit ຜ່ານມາ = tab ປະຫວັດ · ຢາປະຈຳ = ຕັດອອກ)
- **ເພີ່ມ patient banner ແຖວດຽວ** ເທິງ tabs: ຮູບນ້ອຍ 44px + ຊື່ + "ຍິງ · 34 ປີ · HN · ແພດ" + badge ແດງແພ້ຢາ + **vitals strip inline** (BP · Temp · Pulse · RR · SpO₂ · ນ້ຳໜັກ) — ຕັດ BMI/Pain Score
- ເຫຼືອ **4 tabs**: SOAP (default) · ສັ່ງຢາ · Lab · ປະຫວັດ
- Tab ສັ່ງຢາ: ຖິ້ມ card "ຄຳສັ່ງອື່ນໆ" ທີ່ຫວ່າງເປົ່າ
- Tab Lab: ຕັດຄໍລໍາ Priority / ສະຖານະສັ່ງ+ຜົນຮວມເປັນ 2 ຄໍລໍາ / ຕັດຄ່າອ້າງອີງ / ຕັດປຸ່ມ eye
- Tab ປະຫວັດ: ເຫຼືອ 2 cards (ປະຫວັດເຂົ້າກວດ + ແພ້ຢາ) — ຖິ້ມເອກະສານແນບ ແລະ Notes
- Footer: ຄືເກົ່າ ແຕ່ຕັດຂໍ້ຄວາມ "ບັນທຶກອັດຕະໂນມັດ"
- CSS: ລຶບ `.emrt-krow` / `.emrt-tl`, ເພີ່ມ `.emrt-vs` (vitals strip), `.emrt-photo` ຫຍໍ້ເປັນ 44px — block ເຫຼືອ ~7 ແຖວ
- `main.js` / `navbar.html` ບໍ່ປ່ຽນ (`opdTestSwitchTab` ໃຊ້ໄດ້ຄືເກົ່າ)

### ສະຖານະ

- ຍັງບໍ່ commit — ລໍຖ້າຜູ້ໃຊ້ເປີດເບິ່ງໃນ app ຈິງ (Ctrl+Shift+R ຖ້າ CSS ບໍ່ປ່ຽນ)

## 2026-07-16 (v5) — ເອົາຄໍລໍາຄົນເຈັບ + Vitals ຄືນມາແບບເກົ່າ

Feedback: "ຂໍ້ມູນຄົນເຈັບ ແລະ Vital ໃຫ້ສະແດງແບບເກົ່າ" — banner ແຖວດຽວ (v4) ບໍ່ເອົາ, ໃຫ້ກັບໄປໃຊ້ຄໍລໍາຊ້າຍແບບ v3.

### ການປ່ຽນແປງ

- **ຄໍລໍາຊ້າຍ (col-lg-3) ກັບຄືນມາຄື v3**: ຮູບ 72px, ຊື່ລາວ + ຊື່ອັງກິດ + ເພດ/ອາຍຸ/DOB, badge HN + VN, ເບີໂທ, ກ່ອງແດງແພ້ຢາ, ແຖວ Encounter (ເລກທີ/ວັນທີ/ພະແນກ/ສິດ/ແພດ), ແຖວ Vitals ເຕັມ (BP/Temp/Pulse/RR/SpO₂/Weight+BMI/Pain Score)
- **ບໍ່ເອົາຄືນ**: timeline "ຂັ້ນຕອນມື້ນີ້" (ຍັງຖືວ່າບໍ່ຈຳເປັນ, ຜູ້ໃຊ້ບໍ່ໄດ້ຂໍ)
- **ຝັ່ງຂວາ (col-lg-9) ຄົງ v4**: 4 tabs (SOAP default · ສັ່ງຢາ · Lab · ປະຫວັດ), ບໍ່ມີ tab ພາບລວມ, ຕາຕະລາງ Lab ແບບຫຍໍ້, footer ບໍ່ມີຂໍ້ຄວາມ autosave
- CSS: `.emrt-photo` ກັບເປັນ 72px, `.emrt-krow` ເອົາຄືນມາ, `.emrt-vs` (vitals strip ຂອງ v4) ລຶບອອກ
- `main.js` / `navbar.html` ບໍ່ປ່ຽນ

### ສະຖານະ

- ຍັງບໍ່ commit — ລໍຖ້າຜູ້ໃຊ້ຢືນຢັນ layout ໃນ app ຈິງ

## 2026-07-16 (v6) — ຍ້າຍປຸ່ມຄຳສັ່ງຂຶ້ນເທິງ + ຕັດປຸ່ມທີ່ຍັງບໍ່ຈຳເປັນ

Feedback: ແມນູຕ່າງໆຄວນເອົາມາໄວ້ເທິງ ແລະ ໂຕໃດທີ່ຍັງບໍ່ຈຳເປັນເອົາອອກກ່ອນ.

### ການປ່ຽນແປງ

- **ລຶບ card-footer (action bar ລຸ່ມ) ອອກທັງແຖບ**
- **ຍ້າຍປຸ່ມຂຶ້ນ page header** (ແຖວດຽວກັບ badge In Progress ແລະປຸ່ມ ກັບຄິວ OPD):
  `In Progress · Save Draft · ສົ່ງ Lab · ສົ່ງໃບຢາ · ລົງລາຍເຊັນ/Lock · ກັບຄິວ OPD`
- **ຕັດອອກ (ຍັງບໍ່ຈຳເປັນ)**: ປຸ່ມ ພິມ OPD Card, ປຸ່ມ+ປ້າຍ ນັດຕິດຕາມ (date picker)
- CSS / main.js / navbar ບໍ່ປ່ຽນ

### ສະຖານະ

- ຍັງບໍ່ commit — ລໍຖ້າຜູ້ໃຊ້ຢືນຢັນໃນ app ຈິງ

## 2026-07-16 (v7) — ຍົກລະດັບເປັນ Enterprise Clinical EMR (Epic/Cerner-style workflow)

Spec ຈາກຜູ້ໃຊ້: ປ່ຽນ SOAP ງ່າຍໆ ເປັນ physician workflow ເຕັມຮູບແບບ ໂດຍຮັກສາ theme, ຄໍລໍາຄົນເຈັບຊ້າຍ, ປຸ່ມເທິງ, encounter ເດີມ — ບໍ່ມີ breaking change.

### Tabs ໃໝ່ (ແທນ SOAP · Rx · Lab · ປະຫວັດ)

1. **Clinical Note** (default) — accordion `<details>` 9 sections:
   - Chief Complaint (Complaint / Duration / Severity / Onset)
   - HPI (narrative / associated / aggravating / relieving)
   - Past Medical History (checkbox 9 ໂຕ: DM, HTN, CKD, Asthma, Heart, Cancer, TB, HIV, Other)
   - Family History (Father / Mother / Sibling / Genetic)
   - Social History (Smoking / Alcohol / Drug / Occupation / Exercise)
   - Review of Systems — collapsible 8 ລະບົບ (General, Respiratory, CV, GI, GU, Neuro, Skin, MSK) ເປັນ checkbox
   - Physical Examination — grid cards 9 ສ່ວນ (General, HEENT, Neck, Chest, Heart, Abdomen, Extremities, Neuro, Skin) ແຕ່ລະອັນມີ WNL checkbox + ຊ່ອງ findings (ບໍ່ແມ່ນ textarea ໃຫຍ່ອັນດຽວ)
   - Assessment — Primary / Secondary / Differential Dx + Clinical Impression (ICD-10 ຫຼາຍໂຕ)
   - Plan — Medication / Laboratory / Radiology / Procedure / Referral / Advice / Follow-up
2. **Orders** — Order Center ດຽວ (Lab / Radiology / Procedure / Referral checkbox ເລືອກຫຼາຍລາຍການ + ປຸ່ມບັນທຶກດຽວ), ຕາຕະລາງ orders ພ້ອມ badge ສະຖານະ LIS (Ordered→Accepted→Collected→Received→Running→Completed→Verified→Released→Cancelled), ຕາຕະລາງຜົນ Lab ແບບ structured (Parameter / Result / Unit / Reference / Flag / Comment + Verified by + PDF link) — ບໍ່ສະແດງແຕ່ PDF
3. **Medication** — ຢາປະຈຸບັນ + ໃບສັ່ງຢາໃໝ່ + ຄຳເຕືອນ 3 ຊັ້ນ (ແພ້ຢາ / drug interaction / duplicate check)
4. **Documents** — upload ຮູບ/PDF/ECG/Ultrasound/Referral/ລາຍງານພາຍນອກ
5. **Timeline** — clinical timeline ຕາມເວລາ (ລົງທະບຽນ → vitals → triage → ກວດ → ສັ່ງ lab → ເກັບຕົວຢ່າງ → ຜົນ → ຢາ → ຄິດເງິນ → ສຳເລັດ)
6. **History** — encounter ເກົ່າເປັນ `<details>` expandable, ພາຍໃນສະແດງ Dx / Medication / Laboratory / Radiology / Doctor

### ໄຟລ໌ທີ່ແຕະ

- `public/partials/views/opd_test.html` — ຂຽນ workspace ໃໝ່ທັງ 6 tabs (ຄໍລໍາຊ້າຍ + header buttons ຄົງ v5/v6)
- `src/style.css` — ເພີ່ມ `.emrt-sec` (accordion), `.emrt-ros`, `.emrt-pe-grid/.emrt-pe`, `.emrt-lbl`, `.emrt-check`, `.emrt-tl` (ເອົາຄືນ), `.emrt-sticky` (patient card sticky ຈໍ ≥992px)
- `docs/sql/opd_emr_clinical_tables.draft.sql` — **ຮ່າງ** DDL 12 ຕາຕະລາງໃໝ່ (additive): chief_complaints, history_present_illness, past_medical_history, family_history, social_history, review_of_systems, physical_exam, diagnosis, clinical_plan, clinical_orders, clinical_documents, clinical_timeline — ຍັງບໍ່ apply, ລໍ layout ຜ່ານກ່ອນຈຶ່ງຍ້າຍເຂົ້າ supabase/migrations/
- `main.js` / `navbar.html` ບໍ່ປ່ຽນ — `opdTestSwitchTab` ເປັນ generic data-pane, accordion ໃຊ້ `<details>` native ບໍ່ຕ້ອງ JS

### ຂໍ້ຈຳກັດ / ການຕີຄວາມ spec

- Spec ຂໍ React + API + LIS integration — ໂປຣເຈັກນີ້ເປັນ vanilla JS + jQuery + Bootstrap + Supabase, **ບໍ່ມີ React ແລະບໍ່ມີ LIS ຕົວຈິງ** → implement ເປັນ UI ຈິງ (static demo) + schema draft; ການຕໍ່ສາຍ Supabase/LIS API ຈະເຮັດເປັນ step ຕໍ່ໄປຫຼັງ layout ຜ່ານ (ຕາມ pattern ເດີມຂອງ prototype ນີ້)
- Backward compat: ຕາຕະລາງເດີມບໍ່ຖືກແຕະ — SOAP/Prescription_JSON/Lab_Orders_JSON ຂອງ Visits ຍັງເປັນ fallback (ລາຍລະອຽດຢູ່ຫົວ draft SQL)

### ສະຖານະ

- ຍັງບໍ່ commit — ລໍຖ້າຜູ້ໃຊ້ເປີດເບິ່ງ 6 tabs ໃນ app ຈິງ (Ctrl+Shift+R)

## 2026-07-21 (v8) — EMR module spec + full local data model

User request: "ລະບົບ EMR ຕ້ອງມີຫຍັງແນ່ ແລະ ເກັບຂໍ້ມູນຫຍັງແນ່ ... local ບໍ່ commit/push".

### ການປ່ຽນແປງ

- `public/partials/views/opd_test.html` ຖືກຂຽນໃໝ່ເປັນ local EMR prototype 6 tabs:
  Clinical Note · Orders/LIS · Medication · Documents · Timeline · Data Model
- Tab Clinical Note ເກັບທຸກ section ທີ່ EMR ຄວນມີ: CC, HPI, PMH, Family, Social, ROS, PE, Assessment, Diagnosis, Plan.
- Tab Orders/LIS ແຍກ workflow Lab order, LIS payload, status, specimen, structured result.
- Tab Medication ໃຊ້ MedicationRequest-style fields: drug, dose, frequency, duration, qty, safety checks.
- Tab Data Model ສະແດງ MS-01 ຫາ MS-10 ໃນ UI ເພື່ອໃຫ້ທີມເຫັນວ່າແຕ່ລະ module ຕ້ອງເກັບ field ໃດ.
- ເພີ່ມ `docs/EMR_MODULE_SPEC_AND_DATA_MODEL.md` ເປັນ module spec ແບບລະອຽດ.
- ຂຽນ `docs/sql/opd_emr_clinical_tables.draft.sql` ໃໝ່ເປັນ draft additive tables ຄົບສ່ວນ. ຍັງບໍ່ apply ແລະຍັງບໍ່ຍ້າຍເຂົ້າ `supabase/migrations/`.

### ສະຖານະ

- Local only.
- ບໍ່ commit.
- ບໍ່ push.
# v9 - Streamlined international encounter workflow (local only)

- Simplified the clinician workspace to three areas: Encounter Note, Medication, and History & Documents.
- Replaced the large clinical form with a focused SOAP note: Subjective, Objective, Assessment, and Plan.
- Removed Orders/LIS controls, status cards, payload preview, and the lab-order completion requirement from this page.
- Removed the developer-facing Data Model tab from the clinical user interface; technical specifications remain in the local docs.
- Encounter closure now requires a primary diagnosis and treatment plan, and only requires prescription submission when medication items exist.
- This remains a local prototype. No staging, commit, push, migration, or remote data write was performed.
# v10 - Treatment follow-up workflow (local only)

- Rebuilt `/opd/test` around the existing printed `Treatment Follow-up Form` instead of a generic encounter editor.
- Added a four-stage workflow: patient review, doctor assessment, treatment record, and doctor sign-off.
- Follow-up entries use the paper form's core fields: date/time, Symptoms, Treatment, Notes, provider, and role.
- Added the responsible nurse and doctor, clinical checklist, disposition, next appointment date, and patient advice.
- Adding a doctor entry advances stages 2-3; signing validates the doctor entry and next action, completes stage 4, and locks the workflow.
- Orders/LIS remain outside this screen.
- This remains a local prototype. No staging, commit, push, migration, or remote data write was performed.
