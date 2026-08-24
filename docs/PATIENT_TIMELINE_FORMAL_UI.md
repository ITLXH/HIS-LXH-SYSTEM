# Patient Timeline — Formal Clinical UI

## 2026-08-24

ປັບ modal ປະຫວັດຄົນເຈັບຈາກ dashboard/card style ໃຫ້ເປັນຮູບແບບແຟ້ມປະຫວັດທາງການຂອງໂຮງໝໍ ໂດຍບໍ່ປ່ຽນ database, API ຫຼື data binding ເກົ່າ.

## ຈຸດທີ່ປັບ

- ປ່ຽນ header ສີດຳເປັນ header ສີຂາວແບບ clinical record ແລະໃຊ້ຊື່ `ແຟ້ມປະຫວັດຄົນເຈັບ`.
- ຈັດ patient identity ໃໝ່: ຮູບ, ຄຳນຳໜ້າ, ຊື່-ນາມສະກຸນ, HN, ເພດ, ອາຍຸ ແລະ ແຂວງ.
- ຮູບຄົນເຈັບທີ່ໂຫຼດບໍ່ໄດ້ຈະສະແດງ placeholder ແທນ ບໍ່ສະແດງ broken image.
- ປ່ຽນ summary 5 cards ເປັນແຖບສະຫຼຸບດຽວ ມີ divider ຊັດເຈນ ແລະຫຼຸດສີທີ່ບໍ່ຈຳເປັນ.
- ແຍກວັນທີ ແລະ ເວລາເປັນຄໍລໍາຂ້າງຊ້າຍ; ລາຍລະອຽດ encounter ຢູ່ຂ້າງຂວາ.
- ປັບ encounter, doctor note, nursing note, vital signs, medication ແລະ investigation sections ໃຫ້ໃຊ້ border/spacing ແບບເອກະສານ ແທນກ່ອງຫຼາຍສີ.
- ຖອນ animation ເລື່ອນ card ເວລາ hover.
- ປັບ loading, empty ແລະ error states ໃຫ້ສັ້ນ, ສຸພາບ ແລະອ່ານງ່າຍ.
- ປັບ responsive: tablet ລົດ clinical grid ເຫຼືອ 1 ຄໍລໍາ; mobile ຍ້າຍວັນທີເຂົ້າເທິງ encounter card.
- modal ປັບຄວາມສູງຕາມເນື້ອຫາເມື່ອມີປະຫວັດໜ້ອຍ ແລະຍັງ scroll ໄດ້ເມື່ອມີປະຫວັດຫຼາຍ.

## Files Modified

- `public/partials/modals/patient-timeline-modal.html`
- `src/main.js`
- `src/style.css`

## ສິ່ງທີ່ບໍ່ໄດ້ປ່ຽນ

- Supabase schema ແລະ queries
- OPD/IPD/LIS/Observation data aggregation
- Patient Timeline modal ID ແລະ field IDs
- ປຸ່ມເປີດ IPD admission chart
- ລຳດັບ timeline ຈາກໃໝ່ຫາເກົ່າ

## Verification

- `node --check src/main.js` — passed.
- `npm run build` — passed (Vite 6.4.3, 118 modules).
- Live local check at `/visit_history` with patient `LXH2026-003627` — modal opens, data loads, patient placeholder works, summary and OPD encounter render correctly.
- Mobile viewport `390 × 844` — no horizontal overflow; summary changes to one column and timeline remains scrollable.
- Browser console — no new error/warning during the live check.
- Work remains local only; no commit and no push.
