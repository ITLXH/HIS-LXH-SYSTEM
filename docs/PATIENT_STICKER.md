# Patient Sticker (ພິມ Sticker 3 ໃບ/A4)

## 2026-07-17 — ກູ້ຄືນແຖວ ວັນທີມາກວດ + ຂະຫຍາຍໂຕໜັງສື

Feedback: sticker ທີ່ພິມອອກມາ ຂາດແຖວ "ວັນທີມາກວດ" ແລະໂຕໜັງສືເບິ່ງນ້ອຍກວ່າ sticker ເກົ່າ.

### ສາເຫດ (ຍອມຮັບຄວາມຜິດພາດ)

Commit `64372f6` (2026-07-16) ທີ່ shipping "ວຽກຄ້າງ" ຈາກ session ກ່ອນ ມີການປ່ຽນ sticker ຕິດໄປນຳໂດຍບໍ່ໄດ້ເຈດຕະນາ:

- ລຶບແຖວ `ວັນທີມາກວດ: <date> <time>` ອອກຈາກທັງ 3 ບັດໃນ `print-areas.html`
- ລຶບ dialog ເລືອກວັນທີ/ເວລາກ່ອນພິມ + helper `getStickerDateTimeDefaults` / `formatStickerPrintDate` ໃນ `main.js`

### ການແກ້ໄຂ

1. **ກູ້ຄືນຈາກ commit `70514f3`** (ເວີຊັນທີ່ຖືກຕ້ອງຫຼ້າສຸດ):
   - ແຖວ ວັນທີມາກວດ (`#printDate1-3` + `#printTime1-3`) ໃນ [print-areas.html](../public/partials/print-areas.html) ທັງ 3 ບັດ
   - `getStickerDateTimeDefaults()`, `formatStickerPrintDate()` (ISO → dd/mm/yyyy) ແລະ dialog ເລືອກວັນທີ/ເວລາໃນ `printQRCard()` — ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້/ຕອນນີ້, ແກ້ໄດ້ກ່ອນພິມ
2. **ຂະໜາດໂຕໜັງສື: ຄືນເປັນຄ່າເດີມ** (feedback "ແກ້ກັບຄືນ" — ທຳອິດລອງຂະຫຍາຍ 28/33/35px ແລ້ວຜູ້ໃຊ້ໃຫ້ເອົາຄືນ):
   - `.pcard-label` **26px** · `.pcard-value`/`.pcard-time` **30px** · `.pcard-name` **32px** · `.pcard-id` **44px** · gap **2.2mm** — ກົງກັບ commit `70514f3` ທຸກຄ່າ
3. ອາຍຸໃນແຖວວັນເກີດໃຊ້ `formatAgeFromDob` (ເດັກຕ່ຳກວ່າ 1 ປີ = ເດືອນ/ວັນ) — ຈຸດດຽວທີ່ຕ່າງຈາກ `70514f3` ໂດຍເຈດຕະນາ

### Layout ບັດ (5 ແຖວ)

```
LXH2026-XXXXXX  (44px, ເສັ້ນກັ້ນລຸ່ມ)
ວັນທີມາກວດ: dd/mm/yyyy HH:MM
ຊື່ ແລະ ນາມສະກຸນ: <ຊື່ສີຟ້າ 32px, wrap ໄດ້>
ວັນເດືອນປີເກີດ: yyyy-mm-dd (X ປີ/ເດືອນ/ວັນ)
ບ້ານ: ...  ເມືອງ: ...
ແຂວງ: ...  ເບີໂທ: ...
```
