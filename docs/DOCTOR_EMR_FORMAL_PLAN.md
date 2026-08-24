# ແຜນ EMR ແພດ OPD ສະບັບເຕັມທາງການ (Formal Hospital EMR Plan)

2026-07-22 — ແຜນສະເໜີ (ຍັງບໍ່ implement, ລໍຜູ້ໃຊ້ອະນຸມັດ). Local only, ບໍ່ commit/push.

## ຫຼັກການອອກແບບ

ຄວາມຄົບຖ້ວນທາງການ ແລະ ຄວາມໄວ ບໍ່ຂັດກັນ ຖ້າໃຊ້ 3 ຊັ້ນ:

1. **ຊັ້ນຈຳເປັນ (ເຫັນສະເໝີ)** — ສິ່ງທີ່ທຸກ visit ຕ້ອງມີ: ອາການ, ກວດຮ່າງກາຍ, ວິນິດໄສ, ຢາ, disposition, ລາຍເຊັນ
2. **ຊັ້ນທາງການ (ຍຸບໄວ້, ເປີດເມື່ອຕ້ອງການ)** — HPI, PMH/ຄອບຄົວ/ສັງຄົມ, ROS, ຫັດຖະການ, ຄຳແນະນຳ/ນັດ
3. **ຊັ້ນເອກະສານ (ຫຼັງ lock)** — ພິມ OPD Card, ໃບຢາ, ໃບນັດ, ໃບສົ່ງຕໍ່, ໃບຢັ້ງຢືນແພດ

ຄ່າເລີ່ມຕົ້ນສະຫຼາດ: ກວດຮ່າງກາຍ default "ປົກກະຕິ", ຂຽນສະເພາະທີ່ຜິດປົກກະຕິ. Case ທຳມະດາຍັງຈົບໄດ້ ~4–5 ຄລິກ.

## ພາກສ່ວນທີ່ໂຮງໝໍທາງການຕ້ອງມີ (8 ພາກ)

| # | ພາກ | ຈຳເປັນ | ເນື້ອໃນ | ມີແລ້ວ? |
|---|---|---|---|---|
| — | Patient banner + Vitals | auto | HN/VN, ອາຍຸ/ເພດ, ແພ້ຢາເດັ່ນ, ພະຍາດຊຳເຮື້ອ, vitals ຈາກພະຍາບານ (read-only), triage level | ✅ ມີ (ຂາດ triage level) |
| 1 | ອາການ + ປະຫວັດ (Subjective) | CC* | CC*, HPI, ຍຸບໄວ້: PMH checkbox, ປະຫວັດຢາ, ຄອບຄົວ, ສັງຄົມ (ສູບຢາ/ເຫຼົ້າ) | ⚠️ ມີ CC/HPI — ຂາດ PMH/ຄອບຄົວ/ສັງຄົມ |
| 2 | ກວດຮ່າງກາຍ (Objective) | PE* | PE 5 ລະບົບ default ປົກກະຕິ + "ປົກກະຕິທັງໝົດ", ຍຸບໄວ້: ROS 8 ລະບົບ checkbox | ⚠️ ມີ PE — ຍັງບໍ່ບັງຄັບ, ຂາດ ROS |
| 3 | ວິນິດໄສ (Assessment) | ICD-10* | ຄົ້ນຫາ + Enter, ຫຼັກ/ຮ່ວມ, provisional/confirmed flag | ⚠️ ມີ — ຂາດ flag |
| 4 | ສັ່ງກວດ Lab/Imaging | ຂ້າມໄດ້ | checkbox + ສົ່ງ LIS + ຜົນ inline + ຄວາມດ່ວນ | ✅ ມີ (demo) |
| 5 | ຢາ + ຫັດຖະການ (Plan) | ຂ້າມໄດ້ (ຢືນຢັນ) | template 1 ຄລິກ, ຟອມເຕັມຍຸບ, ເຊັກແພ້ຢາອັດຕະໂນມັດ (Penicillin group), ຍຸບໄວ້: ຫັດຖະການ (ລ້າງແຜ, ຝັງເຂັມ ...) | ⚠️ ມີຢາ — ຂາດ allergy check ຈິງ + ຫັດຖະການ |
| 6 | ຄຳແນະນຳ + ນັດຕິດຕາມ | ຂ້າມໄດ້ | patient advice, ວັນນັດ + ເຫດຜົນ, health education | ⚠️ ມີແບບຫຍໍ້ |
| 7 | Disposition | ບັງຄັບ* | ປຸ່ມ radio ໃຫຍ່ 4 ອັນ: ກັບບ້ານ / ສັງເກດອາການ (OPD obs) / ນອນໂຮງໝໍ (admit IPD) / ສົ່ງຕໍ່ (refer + ບ່ອນຮັບ) | ❌ ບໍ່ມີ |
| 8 | ລົງລາຍເຊັນ + ປິດ visit | ບັງຄັບ* | ຊື່ແພດ + ເລກໃບອະນຸຍາດ + ເວລາ, lock, audit trail, ແກ້ຫຼັງ lock = addendum ເທົ່ານັ້ນ | ⚠️ ມີ lock — ຂາດລາຍເຊັນ/ເວລາ/audit |

ຫຼັງ lock: ແຖບປຸ່ມພິມ — OPD Card · ໃບຢາ · ໃບນັດ · ໃບສົ່ງຕົວ · ໃບຢັ້ງຢືນແພດ (ໃຊ້ pattern html2canvas + jsPDF ຕາມ OPD Card ເດີມ, ຫ້າມ window.print()).

## UI/UX ໃໝ່ (ຄົງ style ເດີມຂອງລະບົບ)

- ຄົງ **ໜ້າດຽວ scroll ດຽວ** — 8 ພາກໄລ່ເລກ 1–8, ຫົວພາກມີ ✓ ຂຽວເມື່ອຄົບ
- ພາກທາງການທີ່ຍຸບໄວ້ ສະແດງ **ສະຫຼຸບ 1 ແຖວ** ຕອນຍຸບ ເຊັ່ນ "PE: ປົກກະຕິທັງໝົດ" / "PMH: DM, HTN" — ແພດເຫັນພາບລວມໂດຍບໍ່ຕ້ອງເປີດ
- Disposition ເປັນປຸ່ມໃຫຍ່ 4 ອັນແຖວດຽວ (ເລືອກ 1) — ເລືອກ "ສົ່ງຕໍ່" ຈຶ່ງເປີດຊ່ອງບ່ອນຮັບ, ເລືອກ "ນັດ" ຈຶ່ງເປີດວັນນັດ
- ແຖບຄວາມຄືບໜ້ານ້ອຍ sticky ຂວາລຸ່ມ: "3/5 ຈຳເປັນຄົບແລ້ວ" + ປຸ່ມສຳເລັດ
- Validation ຍັງ scroll + focus ໄປຫາພາກທີ່ຂາດ (ມີແລ້ວ)
- ສີດຽວ accent ຟ້າ, flat, radius 3–4px — ບໍ່ມີ gradient (ຕາມ house style)

## ແຜນງານ

| Phase | ວຽກ | ຂອບເຂດ |
|---|---|---|
| **3A** UI ຄົບທາງການ (local demo) | ເພີ່ມພາກ PMH/ຄອບຄົວ/ສັງຄົມ, ROS, ຫັດຖະການ, Disposition, ລາຍເຊັນ+audit strip, ແຖບພິມ (ປຸ່ມ placeholder) | HTML/CSS/JS local, demo data |
| **3B** ຕໍ່ຖານຂໍ້ມູນ | ຕາຕະລາງຕາມ docs/sql/opd_emr_clinical_tables.draft.sql (additive, ບໍ່ແຕະຂອງເດີມ), autosave draft, audit log ຈິງ | Supabase migration + wiring |
| **3C** ເອກະສານພິມ | ໃບຢາ, ໃບນັດ, ໃບສົ່ງຕົວ, ໃບຢັ້ງຢືນແພດ (html2canvas + jsPDF) | ຕໍ່ຈາກ print-areas ເດີມ |
| **3D** ຄວາມປອດໄພຄລີນິກ | ICD-10 catalog ຈິງ, drug catalog + allergy/interaction check, ສິດແກ້ໄຂ + addendum ຫຼັງ lock | ຕ້ອງການຂໍ້ມູນຈາກຮ້ານຢາ |

## ຄຳຖາມທີ່ຕ້ອງຕັດສິນກ່ອນເລີ່ມ 3A

1. Disposition 4 ທາງເລືອກນີ້ພໍບໍ ຫຼືມີເພີ່ມ (ເຊັ່ນ ເສຍຊີວິດ / ໜີກັບ)?
2. ຫັດຖະການ (procedures) ຕ້ອງມີໃນ OPD ບໍ ຫຼືໄວ້ Phase ຫຼັງ?
3. ເອກະສານພິມໃດສຳຄັນສຸດກ່ອນ — ໃບຢາ ຫຼື ໃບນັດ?
4. ROS ເຕັມ 8 ລະບົບ ຈຳເປັນສຳລັບ OPD ທົ່ວໄປບໍ ຫຼືເອົາສະເພາະກໍລະນີສົ່ງຕໍ່/admit?

## ຄຳຕອບຜູ້ໃຊ້ (2026-07-22) — ຂອບເຂດ Phase 3A ສະຫຼຸບແລ້ວ

1. **Disposition: 6 ທາງເລືອກ** — ກັບບ້ານ / ສັງເກດອາການ / ນອນໂຮງໝໍ / ສົ່ງຕໍ່ / ປະຕິເສດການຮັກສາ-ໜີກັບ / ເສຍຊີວິດ
2. **ຫັດຖະການ: ມີໃນ 3A** ແບບຍຸບໄວ້ໃນພາກຢາ
3. **ເອກະສານພິມ (3C): ທັງ 4** — ໃບຢາ, ໃບນັດ, ໃບສົ່ງຕົວ, ໃບຢັ້ງຢືນແພດ (+ OPD Card ເດີມ)
4. **ROS: ຍຸບໄວ້ທຸກ visit** ບໍ່ບັງຄັບ

→ ເລີ່ມ implement Phase 3A ທັນທີ (local, ບໍ່ commit)

## 2026-07-22 — Phase 3A implemented (local, ບໍ່ commit)

ໜ້າດຽວ 8 ພາກຕາມແຜນ ຖືກ implement ແລະທົດສອບຜ່ານໃນ Chrome ຈິງ:

1. **ອາການ+ປະຫວັດ** — CC* + ຍຸບ: HPI, PMH checkbox 7 ໂຕ, ປະຫວັດຄອບຄົວ, ສູບຢາ/ດື່ມເຫຼົ້າ
2. **ກວດຮ່າງກາຍ*** — PE 5 ຊ່ອງ (ບັງຄັບ, default ປົກກະຕິ) + ຍຸບ: ROS 8 ລະບົບ
3. **ວິນິດໄສ ICD-10*** — ຄົ້ນຫາ+Enter, ຫຼັກ/ຮ່ວມ, ປຸ່ມສະຫຼັບ ຢືນຢັນ/ຄາດຄະເນ ຕໍ່ລາຍການ
4. **ສັ່ງກວດ** — checkbox 6 + ຄວາມດ່ວນ (Routine/Urgent) + ສົ່ງ LIS + ຜົນ inline
5. **ຢາ+ຫັດຖະການ** — template 4 ໂຕ (ມີ Amoxicillin ເພື່ອທົດສອບ allergy) + ຍຸບ: ຟອມຢາເຕັມ, ຫັດຖະການ 6 ຢ່າງ+ໝາຍເຫດ
6. **ຄຳແນະນຳ+ນັດ** — ຍຸບ: ການປະເມີນ/ແຜນ/ຄຳແນະນຳ/ວັນນັດ
7. **Disposition*** — ປຸ່ມໃຫຍ່ 6: ກັບບ້ານ/ສັງເກດອາການ/ນອນໂຮງໝໍ/ສົ່ງຕໍ່(+ຊ່ອງບ່ອນຮັບ)/ປະຕິເສດການຮັກສາ/ເສຍຊີວິດ
8. **ລົງລາຍເຊັນ** — ຊື່ແພດ+ເລກໃບອະນຸຍາດ (demo), ລາຍເຊັນ+ເວລາຕອນ lock, audit note, ແຖບພິມ 5 ໃບ (placeholder → Phase 3C)

**Safety ທີ່ທົດສອບຜ່ານ:** ກົດ +Amoxicillin → ເດັ້ງຄຳເຕືອນແດງ "ຄົນເຈັບແພ້ Penicillin — ກຸ່ມດຽວກັນ" ຕ້ອງຢືນຢັນຮັບຜິດຊອບເອງ · validation ຂາດ dx → scroll+focus ໄປຂໍ້ 3 · Refer ບັງຄັບບ່ອນຮັບ · ຫຼັງ lock ທຸກຢ່າງ disabled ຍົກເວັ້ນປຸ່ມພິມ

**ໄຟລ໌:** opd_test.html ຂຽນໃໝ່ (8 sections) · main.js block ເພີ່ມ disposition/allergy/certainty/sign/print (~+90 ແຖວ) · style.css ເພີ່ມ .opdt-check-row/.opdt-dispo-row/.opdt-sign-strip/.opdt-print-row/.opdt-dx-cert + ແກ້ grid selected-list/med-list

**ບັກທີ່ພົບ+ແກ້ຕອນທົດສອບ:** ຂໍ້ຄວາມ validation ຍັງອ້າງເລກຂັ້ນຕອນເກົ່າ (ຂໍ້ 2→3) · ປຸ່ມ certainty ຖືກ width 28px ຂອງປຸ່ມລຶບບີບ · empty-state ຢາຖືກ grid ບີບແນວຕັ້ງ

## 2026-07-22 (v2) — ຍ້າຍຂໍ້ມູນຄົນເຈັບຈາກ header ເທິງ ໄປຄໍລໍາຊ້າຍໝົດ

Feedback: "ປັບຂໍ້ມູນດ້ານເທິງ ຍ້າຍມາດ້ານຊ້າຍໝົດ"

- **ລຶບ `<header class="opdt-fixed-patient">` ອອກທັງແຖບ** — workspace 8 ພາກເລີ່ມເທິງສຸດຂອງໜ້າເລີຍ, ໄດ້ພື້ນທີ່ແນວຕັ້ງຄືນ ~140px
- ຄໍລໍາຊ້າຍເພີ່ມບລັອກ `.opdt-side-patient` ຢູ່ເທິງສຸດ (ຂອບລຸ່ມສີຟ້າ 2px ແຍກຈາກສ່ວນສະຫຼຸບ):
  ຮູບ 46px + ຊື່ + HN/VN → ແຖວ ອາຍຸ/ເພດ/ພະຍາດຊຳເຮື້ອ/ສະຖານະ (badge `opdTestVisitStatus`) → ກ່ອງແດງແພ້ຢາ `.opdt-side-allergy` → ແຖວປຸ່ມ `.opdt-side-actions` (ບັນທຶກຮ່າງ icon · ສຳເລັດການກວດ · ກັບຄິວ OPD)
- CSS: prune ຮອບ 3 ເອົາ rule ຂອງ header ເກົ່າອອກ (opdt-fixed-patient / s15-header / patient-facts / header-actions + media queries) ແລ້ວເພີ່ມ .opdt-side-patient/.opdt-side-id/.opdt-side-allergy/.opdt-side-actions — style.css ສຸດທິ ~12,960 ແຖວ
- JS ບໍ່ປ່ຽນ — id ທັງໝົດ (opdTestVisitStatus, opdTestCompleteBtn) ຍ້າຍຕາມ HTML, refreshSimple ໃຊ້ໄດ້ຄືເກົ່າ

### ຜົນທົດສອບ (Chrome, 2026-07-22)

- ຂໍ້ມູນຄົນເຈັບ+ແພ້ຢາ+ປຸ່ມ ຢູ່ຊ້າຍຄົບ, workspace ກວ້າງຂຶ້ນ
- ກົດ ສຳເລັດການກວດ ຈາກຕຳແໜ່ງໃໝ່ → validation ເດັ້ງໄປຂໍ້ 3 + focus ຊ່ອງຄົ້ນຫາ ຖືກຕ້ອງ
- ຍັງບໍ່ commit — ລໍຜູ້ໃຊ້ຢືນຢັນ

## 2026-07-22 (v3) — ຄໍລໍາຄົນເຈັບ sticky ຕອນ scroll

Feedback: "ໄດ້ເລື່ອນລົງລຸ່ມຫຼາຍເກີນໄປ ບໍ່ເຫັນຂໍ້ມູນດ້ານເທິງ"

- `.opdt-clinical-summary` ເປັນ `position: sticky; top: 70px` (≥992px) + `max-height: calc(100vh - 86px)` + scroll ພາຍໃນ (scrollbar ບາງ 5px) — ຂໍ້ມູນຄົນເຈັບ/ແພ້ຢາ/ປຸ່ມ ຄ້າງເທິງຈໍສະເໝີ, vitals/ປະຫວັດ ເລື່ອນເບິ່ງໃນ sidebar ໄດ້
- ບັກທີ່ພົບ: `.opdt-s15-layout` ມີ `align-items: flex-start` → col ຊ້າຍສູງເທົ່າ aside (742px) sticky ບໍ່ມີໄລຍະເດີນທາງ. ແກ້ດ້ວຍ `align-self: stretch` ໃສ່ col ທຳອິດ (≥992px)
- ທົດສອບ: scroll ຮອດພາກ 8 — ຄໍລໍາຊ້າຍຍັງເຫັນຄົບ ✓ (ກວດ computed style ດ້ວຍ JS: col 1659px, aside ຄ້າງ top 70px)
- ຍັງບໍ່ commit

## 2026-07-22 (v4) — ການສັ່ງກວດເປັນລາຍການບັນທຶກຖາວອນ

Feedback: "ສັ່ງກວດເລືອກ ແລະ ສັ່ງຢາ ໃຫ້ເປັນສາມາດຕິກບັນທຶກໄວ້ວ່າກວດຫຍັງແນ່"

- ເມື່ອກ່ອນ checkbox ສັ່ງກວດເປັນສະຖານະຊົ່ວຄາວ (ເອົາຕິກອອກ = ຄຳສັ່ງຫາຍ) — ບໍ່ມີບັນທຶກວ່າສັ່ງຫຍັງໄປແລ້ວ
- ຕອນນີ້: ຕິກ → ກົດສົ່ງ LIS → ແຕ່ລະລາຍການຖືກ**ບັນທຶກເປັນແຖວຖາວອນ** (`state.orders`) ສະແດງ ຊື່ການກວດ + ເວລາສັ່ງ + ເລກຄຳສັ່ງ LIS + ຄວາມດ່ວນ + ປຸ່ມຍົກເລີກ (ໃຊ້ style .opdt-med-list ຄືລາຍການຢາ)
- Checkbox ລ້າງເອງຫຼັງສົ່ງ → **ສັ່ງເພີ່ມໄດ້ຫຼາຍຮອບ** (ແຕ່ລະຮອບໄດ້ເລກ LIS ໃໝ່), ສັ່ງຊ້ຳລາຍການເກົ່າຈະຖືກຂ້າມ + ແຈ້ງ
- Badge ຫົວພາກ: "ບັນທຶກແລ້ວ n ລາຍການ" · ຜົນ LIS ສະຫຼຸບ "(x/n ມີຜົນ)" · ຍົກເລີກລາຍການ = ຜົນຖືກຄິດຄືນ
- Validation ຕອນລົງລາຍເຊັນ: ຖ້າມີຕິກຄ້າງທີ່ຍັງບໍ່ສົ່ງ ຈະເຕືອນ "ມີລາຍການຕິກຄ້າງໄວ້"
- ລາຍການຢາເປັນບັນທຶກຖາວອນຢູ່ແລ້ວ (ບໍ່ປ່ຽນ)
- JS: state.orders ແທນ ordersSent/orderNo/sentOrderItems; ເພີ່ມ opdTestRemoveOrder/opdTestRenderOrders; HTML ເພີ່ມ #opdTestOrderRows

### ຜົນທົດສອບ (Chrome, 2026-07-22)

- ຕິກ CBC+CRP → ສົ່ງ → 2 ແຖວບັນທຶກພ້ອມເວລາ/ເລກຄຳສັ່ງ ✓ · ຕິກ X-Ray ສົ່ງຮອບ 2 → ລວມ 3 ລາຍການ 2 ເລກຄຳສັ່ງ ✓ · ຜົນ "2/2 ມີຜົນ" → X-Ray ລໍຖ້າຜົນ ✓
- ຍັງບໍ່ commit
