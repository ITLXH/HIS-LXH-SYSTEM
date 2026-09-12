# Patient Sticker (ພິມ Sticker 3 ໃບ/A4)

## 2026-08-24 — ເພີ່ມປະກັນ/ອົງກອນໃຕ້ LXH (local, not committed)

- ເພີ່ມແຖວ `ປະກັນ/ອົງກອນ` ໃຕ້ເລກ LXH ແລະກ່ອນຊື່ຄົນເຈັບໃນສະຕິກເກີທັງ 3 ໃບ.
- ເລືອກຂໍ້ມູນຕາມລຳດັບ `Insurance_Company`, `Organization_Name`, `Name_Org`.
- ຖ້າບໍ່ມີປະກັນ/ອົງກອນ ຈະເຊື່ອງແຖວນີ້ ແລະ layout ເກົ່າບໍ່ປ່ຽນ.
- ໃຊ້ກ່ອງສີຟ້າອ່ອນ, ຂອບຟ້າ ແລະຊື່ສີນ້ຳເງິນເຂັ້ມ ເພື່ອແຍກສິດການຮັກສາອອກຈາກຂໍ້ມູນຕົວຕົນ.
- ສະເພາະບັດທີ່ມີ payer ຈະຫຼຸດ font/gap ເລັກນ້ອຍ ເພື່ອຮັກສາ 3 ໃບຕໍ່ A4.
- ຊື່ payer ທີ່ຍາວຈະໃຊ້ font ນ້ອຍລົງອັດຕະໂນມັດ ແລະຢູ່ໃນແຖວດຽວ.
- ໄຟລ໌: `public/partials/print-areas.html`, `src/main.js`, `src/style.css`.
- ກວດ local preview ດ້ວຍ `LXH2026-003624`: payer ແລະເບີໂທສະແດງຄົບ, card height 336.375px ແລະ scroll height 333px ຈຶ່ງບໍ່ມີ content overflow; 3 ບັດລວມ 1031.8px ຍັງຢູ່ໃນ A4 ໜ້າດຽວ.
- ກວດ `LXH2026-003628` ທີ່ບໍ່ມີ payer: ແຖວ payer ຖືກເຊື່ອງຄົບທັງ 3 ບັດ.
- ກວດ `node --check src/main.js`, `npm run build` ແລະ targeted `git diff --check` ຜ່ານ.
- ສະຖານະ: local only; ບໍ່ commit ແລະບໍ່ push.

## 2026-07-21 — ທົດສອບ local: ແຍກເບີໂທເປັນແຖວໃໝ່ + ຂະຫຍາຍ font

User feedback: ໃນສະຕິກເກີ ໃຫ້ເອົາເບີໂທລົງມາແຖວໃໝ່ ແລະປັບ font ທັງໝົດໃຫ້ໃຫຍ່ຂຶ້ນ. ວຽກນີ້ເຮັດເພື່ອທົດສອບໃນ local ກ່ອນ; ຍັງບໍ່ commit/push.

### ການປັບ

- `public/partials/print-areas.html`: ແຍກ `#printPhone1-3` ອອກຈາກແຖວແຂວງ ແລະໃຫ້ຢູ່ໃນ `.pcard-row-phone` ແຖວໃໝ່.
- `src/style.css`: ຂະຫຍາຍ font ສະຕິກເກີ:
  - `.pcard-id` 44px → 52px
  - `.pcard-label` 26px → 30px
  - `.pcard-value` / `.pcard-time` 30px → 37px
  - `.pcard-name` 32px → 39px
  - ຫຼຸດ gap/padding ແລະ line-height ລົງເພື່ອໃຫ້ 3 sticker ຍັງຢູ່ໃນ A4 ໜ້າດຽວ.
- `src/main.js`: bump partial cache key ເປັນ `2026-07-21-sticker-phone-row-v2` ເພື່ອໃຫ້ local browser ໂຫຼດ template ໃໝ່.

### Layout ຫຼັງປັບ

```text
LXH2026-XXXXXX
ຊື່ ແລະ ນາມສະກຸນ: <ຊື່>
ວັນເດືອນປີເກີດ: yyyy-mm-dd (X ປີ)
ບ້ານ: ...  ເມືອງ: ...
ແຂວງ: ...
ເບີໂທ: ...
```

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

## 2026-07-22 — OPD Card: insurance badge under logo + logos aligned/moved up (local, not committed)

Feedback: "ເພີ່ມລູກຄ້າປະກັນໄພໃສ່ ຖ້າມີໃຫ້ຂຶ້ນສະແດງຢູ່ຈຸດແດງ · ຍັບ Logo ຂຶ້ນເທິງ · Logo ທັງສອງໜ້າ ປັບຂະໜາດໃຫ້ເທົ່າກັນ"

- **Insurance badge**: `#popd_insurance_badge` ໃໝ່ ໃນ `.opdref-header-left` ຂອງໜ້າ 1 — ກ່ອງຂອບຟ້າ `#eaf3fb`/`#1672b8`, ຂຽນ "ປະກັນໄພ / Insurance" ດ້ານເທິງ + ຊື່ອົງກອນດ້ານລຸ່ມ. ສະແດງເມື່ອ `printOrg.name` ບໍ່ຫວ່າງ (ໃຊ້ id/name ຈາກ Organizations table ຄືເກົ່າ), ເຊື່ອງໃສ່ຄົນເຈັບທົ່ວໄປ
- **ຍ້າຍ logo ຂຶ້ນເທິງ**: header-row `align-items: center` → `start` + header-left `padding-top: 0` + `flex-direction: column` (ໃສ່ badge ໄດ້) — ໜ້າ 1 ແລະ ໜ້າ 2 ຄືກັນ
- **Logo ເທົ່າກັນ 2 ໜ້າ**: ໜ້າ 2 ເປັນ 41mm × 29mm ຢູ່ · ຕອນນີ້ຄື ໜ້າ 1: **44mm × 34mm**. Grid cols ຂອງ p2-header-row ຕິດຕາມ (46/1fr/56 → 48/1fr/64)
- ໄຟລ໌: `public/partials/print-areas.html` (badge HTML) · `src/main.js` line ~9309 (badge JS) · `src/style.css` (header align + logo size + `.opdref-insurance-badge/-label/-name`)

### ວິທີທົດສອບ

1. ເປີດ localhost:5175, ໄປໜ້າ OPD ຫຼື ຄິວ, ກົດປຸ່ມ ພິມ OPD Card ໃນຄົນເຈັບທີ່ມີ Organization
2. ໜ້າ 1 ຄວນເຫັນກ່ອງຟ້າຂຽນຊື່ອົງກອນ/ປະກັນໄພ ຢູ່ໃຕ້ logo, logo ຄ້າຍຊິດຂອບເທິງກວ່າກ່ອນ
3. ໜ້າ 2 (ໃບຕິດຕາມການປິ່ນປົວ) logo ຄວນຂະໜາດເທົ່າໜ້າ 1 ແລ້ວ
4. ຄົນເຈັບບໍ່ມີ Organization → ບໍ່ຕ້ອງມີກ່ອງປະກັນໄພ

ຍັງບໍ່ commit — ລໍທ່ານໝໍທົດສອບພິມຈິງ.

## 2026-07-22 (v2) — Insurance: plain label + red name + also on page 2, logos moved up more

Feedback: "ປະກັນໄພໃສ່ເປັນ font ທຳມະດາຄືກັນກັບຂໍ້ມູນຄົນເຈັບ ແຕ່ຖ້າມີການເລືອກປະກັນໄພມາ ໃຫ້ຊື່ປະກັນໄພສະແດງເປັນ font ສີແດງ · ໜ້າ 2 ຍັງບໍ່ເຫັນປະກັນໄພຂຶ້ນ · ຍັບ logo ຂຶ້ນເທິງອີກ"

- ຖີ້ມກ່ອງຟ້າ `.opdref-insurance-badge` (v1) → ໃຊ້ `.opdref-insurance-line` ແທນ: 1 ແຖວ, font Times ຂະໜາດ 10pt ຄືຂໍ້ມູນຄົນເຈັບ, label ດຳ (`ປະກັນໄພ/Insurance:`), ຊື່ອົງກອນ **ສີແດງ #c62828 ຕົວໜາ** — ບໍ່ມີກ່ອງ, ບໍ່ມີພື້ນຫຼັງ
- ໜ້າ 2 ເພີ່ມ `#popd2_insurance_badge` + `#popd2_insurance_name` ໃນ `.opdref-header-left` — JS ຮອບດຽວຕັ້ງທັງ 2 ໜ້າ (`['popd', 'popd2'].forEach`)
- Logo ຂຶ້ນເທິງອີກ: `.opdref-header-row` + `.opdref-p2-header-row` ໄດ້ `margin-top: -3mm` (ທັງ screen + print media)
- ຍັງບໍ່ commit

## 2026-07-22 (v3) — Insurance ເປັນແຖວ patient-info + logo shift ຖີ້ມ, page 2 ID/barcode ຍ້າຍລົງ

Feedback: "ໜ້າ 1 ຂໍ້ມູນດ້ານເທິງບໍ່ເຫັນຍັບລົງມາ ປັບ font ປະກັນໄພ ແລະ ແຖວໃຫ້ຄືກັບ ຄຳນຳໜ້າ · ໜ້າ 2 ເອົາ ID+barcode+ວັນທີ ຍັບລົງ ສ່ວນອື່ນບໍ່ຕ້ອງຍັບ"

- ຖີ້ມ rule `margin-top: -3mm` ຢູ່ `.opdref-header-row` — ນັ້ນເປັນສາເຫດຫົວໜ້າ 1 ຫາຍໄປນອກຂອບ
- **ໜ້າ 1**: ຍ້າຍປະກັນໄພຈາກໃຕ້ logo ອອກ, ໃສ່ເປັນ `.opdref-row.opdref-row-full-line#popd_insurance_row` ຢູ່**ລະຫວ່າງ rule ກັບ ຫົວ "Client's Profile"** — ໃຊ້ class `.opdref-row/.opdref-fill` ຄືແຖວ ຄຳນຳໜ້າ → font Times 12.5pt ອັດຕະໂນມັດ, ມີເສັ້ນຂາຍໃຕ້
- **ໜ້າ 2**: ເພີ່ມແຖວປະກັນໄພຄືກັນຢູ່ຈຸດເທິງສຸດຂອງ `.opdref-p2-header` ກ່ອນແຖວຊື່, + ຕັ້ງ `.opdref-p2-header-row .opdref-header-right { margin-top: 3mm }` ໃຫ້ ID+barcode+ວັນທີ ຍັບລົງ (logo/ຫົວຂໍ້ບໍ່ຍັບ)
- **ຊື່ອົງກອນ**: ຄົງ**ສີແດງ #c62828 ຕົວໜາ** — ໃຊ້ selector `.opdref-insurance-row .opdref-insurance-name` ໃສ່ສະເພາະ value
- JS: `row.style.display` ແທນ `badge.style.display` (id ປ່ຽນຊື່ badge → row)
- ຍັງບໍ່ commit
