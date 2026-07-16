# Patient Age Display

## 2026-07-16 — ອາຍຸຕ່ຳກວ່າ 1 ປີ ໃຫ້ສະແດງເປັນ ເດືອນ ຫຼື ວັນ

Feedback: ຄົນເຈັບເດັກນ້ອຍ (ຕົວຢ່າງ LXH2026-002978, ເກີດ 2025-08-20) ສະແດງອາຍຸ "-" ໃນຕາຕະລາງທະບຽນ ແລະ "0 ປີ" ໃນ modal ເບິ່ງລາຍລະອຽດ — ຖ້າອາຍຸຕ່ຳກວ່າ 1 ປີ ໃຫ້ສະແດງເປັນເດືອນ ຫຼື ວັນແທນ.

### ສາເຫດ

- ຕາຕະລາງທະບຽນ (`loadPatients` render) ຄິດອາຍຸເປັນປີເຕັມ, ຖ້າໄດ້ 0 → ສະແດງ "-"
- Modal (`viewPatientDetail`) ໃຊ້ `data.Age` ຈາກຖານຂໍ້ມູນໂດຍກົງ (integer ປີ) → ເດັກນ້ອຍ = "0 ປີ"

### ການແກ້ໄຂ

ເພີ່ມ helper ໃໝ່ `window.formatAgeFromDob(dob, fallbackAgeYears)` ໃນ `src/main.js` (ຖັດຈາກ `ageFromDob`):

| ອາຍຸຈິງ | ສະແດງ |
|---|---|
| ≥ 1 ປີ | `X ປີ` |
| 1–11 ເດືອນ | `X ເດືອນ` |
| < 1 ເດືອນ | `X ວັນ` (ເກີດມື້ນີ້ = `0 ວັນ`) |
| DOB ບໍ່ມີ/ຜິດ | ໃຊ້ `Age` ຈາກ DB ຖ້າ > 0, ບໍ່ດັ່ງນັ້ນ `-` |
| DOB ອະນາຄົດ | `-` |

- ຄິດຈາກ `Date_of_Birth` ກ່ອນສະເໝີ (ແມ່ນຍຳກວ່າ `Age` ທີ່ເປັນຄ່າຄ້າງໃນ DB)
- ໜ່ວຍຜ່ານ i18n: ເພີ່ມ key `patients.monthUnit` / `patients.dayUnit` (lo: ເດືອນ/ວັນ, en: months/days)

### ຈຸດທີ່ປ່ຽນ

| ຈຸດ | ກ່ອນ | ຫຼັງ |
|---|---|---|
| ຕາຕະລາງທະບຽນຄົນເຈັບ (ຄໍລໍາ ອາຍຸ) | ຄິດປີເອງ inline, 0 → "-" | `formatAgeFromDob(r.Date_of_Birth, r.Age)` |
| Modal ເບິ່ງລາຍລະອຽດ `#view_p_age` | `data.Age + ' ປີ'` | `formatAgeFromDob(data.Date_of_Birth, data.Age)` |

ຈຸດອື່ນທີ່ຍັງສະແດງເປັນປີຢ່າງດຽວ (OPD queue, EMR header, dropdown ຄົນເຈັບ) ຍັງບໍ່ໄດ້ປ່ຽນ — ຖ້າຢາກໃຫ້ໃຊ້ format ດຽວກັນທົ່ວລະບົບ ให້ເອີ້ນ helper ຕົວດຽວກັນນີ້.

### ທົດສອບ (node, ວັນທີ 2026-07-16)

- `2025-08-20` → 10 ເດືອນ · `2026-07-01` → 15 ວັນ · ເກີດມື້ນີ້ → 0 ວັນ
- `2025-07-17` → 11 ເດືອນ · `2025-07-16` → 1 ປີ · `1990-05-12` → 36 ປີ
- ບໍ່ມີ DOB + Age 54 → 54 ປີ · Age 0 → `-` · DOB ອະນາຄົດ → `-`

## 2026-07-16 (v2) — ນຳໃຊ້ format ດຽວກັນທົ່ວລະບົບ (ຊັກປະຫວັດ, OPD, Report, Timeline, IPD)

Feedback: "age ທັງ ຊັກປະຫວັດ ແລະ OPD ທຸກອັນໃຫ້ປ່ຽນຄືກັນ" — ໃຫ້ທຸກຈຸດທີ່ສະແດງອາຍຸໃຊ້ ເດືອນ/ວັນ ສຳລັບເດັກຕ່ຳກວ່າ 1 ປີ ຄືກັນໝົດ.

### ຈຸດທີ່ປ່ຽນເພີ່ມ (src/main.js)

| ຈຸດ | ວິທີປ່ຽນ |
|---|---|
| Report + ປະຫວັດການກວດ (`buildPatientVisitSummaryData`) | ຊ່ອງ `age` ປ່ຽນເປັນ text ພ້ອມໜ່ວຍຈາກ `formatAgeFromDob` — ຕາຕະລາງ Report, ຕາຕະລາງ Visit History, Excel/PDF export ໄດ້ຄ່າດຽວກັນໝົດ |
| Report detail modal | ຕັດ " ປີ" ທີ່ຕໍ່ທ້າຍອອກ (ຄ່າໃໝ່ມີໜ່ວຍໃນໂຕແລ້ວ) |
| ຄິວຊັກປະຫວັດ (triage builder) | ເພີ່ມຊ່ອງ `ageText` — ໃຊ້ໃນຕາຕະລາງຄິວ (badge ອາຍຸ) + modal "ບັນທຶກການຊັກປະຫວັດ" |
| ຄິວ OPD (queue builder) | ເພີ່ມຊ່ອງ `ageText` — ໃຊ້ໃນ modal ລາຍລະອຽດຄິວ + ຫົວ EMR OPD (`emrOpdGenderAge`) |
| ພິມ OPD Card (`printAge`) | `formatAgeFromDob(d.Date_of_Birth, d.Age)` |
| ພິມ QR/Sticker (`dobText`) | `${dob} (${formatAgeFromDob(...)})` |
| Timeline ຄົນເຈັບ (`#timeline_p_info`) | `formatAgeFromDob(p.Date_of_Birth, p.Age)` |
| IPD ຕາຕະລາງ admission (`ageSex`) | `formatAgeFromDob(patient?.Date_of_Birth, patient?.Age)` |

- ຊ່ອງ `age` ເລກເດີມໃນ queue objects ຍັງຄົງໄວ້ (ບໍ່ມີໃຜໃຊ້ຂຽນ DB — ກວດແລ້ວ) ເພື່ອບໍ່ກະທົບ logic ອື່ນ
- ຟອມລົງທະບຽນ (`#ageInput`) ຍັງເປັນຕົວເລກປີຄືເກົ່າ (ເປັນ field ປ້ອນຂໍ້ມູນ ບໍ່ແມ່ນສະແດງຜົນ)
- `node --check` ຜ່ານ
