# ຄູ່ມືໃຊ້ງານລະບົບ IPD

## 1. ຮັບຄົນເຈັບເຂົ້ານອນ

1. ເຂົ້າເມນູ `IPD > ຈັດການຕຽງ`.
2. ກົດ `ຮັບຄົນເຈັບນອນ`.
3. ເລືອກຄົນເຈັບ, ແພດ, ພະຍາບານ, ວັນເວລາ, ຫ້ອງ/ຕຽງ ແລະບັນທຶກ Diagnosis.
4. ກົດບັນທຶກ. ຕຽງຈະປ່ຽນເປັນ `Occupied`.

## 2. ເປີດ IPD Clinical Chart

1. ຢູ່ຕຽງຂອງຄົນເຈັບ ກົດ `ຈັດການ`.
2. ເລືອກ `IPD Chart`.
3. Chart ປະກອບມີ Timeline, Care Tasks, Vitals, Notes, Orders ແລະ Discharge.

### ໃຊ້ໜ້າຈັດການຕຽງໃຫ້ໄວ

- ກົດ `ມີຄົນເຈັບ`, `ຕຽງວ່າງ` ຫຼື `ຕ້ອງຕິດຕາມ` ເພື່ອກອງຂໍ້ມູນທັນທີ.
- ກົດ `Ctrl + K` ເພື່ອໄປຫາຊ່ອງຄົ້ນຫາ; ຄົ້ນດ້ວຍຊື່, HN, AM, ຫ້ອງ, ຕຽງ ຫຼືແພດ.
- ກົດ card `ວຽກຮອດເວລາ` ເພື່ອເປີດ Nurse Station ແລະເບິ່ງວຽກດ່ວນທັງຫວອດ.
- ວຽກສີແດງແມ່ນກາຍກຳນົດ; ສີເຫຼືອງແມ່ນຈະຮອດເວລາພາຍໃນ 30 ນາທີ.
- ກົດ `ເປີດວຽກຢາ` ຫຼື `ເປີດວຽກກວດ` ເພື່ອໄປຫາ Care Tasks ຂອງຄົນເຈັບໂດຍກົງ.

## 3. ສັ່ງຢາ ແລະຈັດເວລາໃຫ້ຢາ

### ແພດ: ສ້າງ Medication Order

1. ເປີດ tab `Orders`.
2. ກົດ `Add Order` ໃນ Medication Orders.
3. ລະບຸ Drug, Dose, Frequency, Route, Duration ແລະຜູ້ສັ່ງ.
4. ກົດ Save.

### ພະຍາບານ: ສ້າງ MAR dose

1. ເປີດ tab `ວຽກພະຍາບານ / Care Tasks`.
2. ກົດ `ຈັດເວລາໃຫ້ຢາ`.
3. ເລືອກ Medication Order ແລະ Scheduled time.
4. ສ້າງ 1 MAR row ຕໍ່ 1 dose. ຖ້າຕ້ອງໃຫ້ຫຼາຍເວລາ ໃຫ້ສ້າງແຕ່ລະເວລາແຍກກັນ.
5. ເມື່ອຮອດເວລາ ກົດ `Record`, ກວດຄົນເຈັບ/ຢາ/Dose/Route ແລ້ວເລືອກ outcome:
   - `Given`: ໃຫ້ຢາແລ້ວ
   - `Held`: ພັກຢາຊົ່ວຄາວ
   - `Refused`: ຄົນເຈັບປະຕິເສດ
   - `Missed`: ບໍ່ໄດ້ໃຫ້ຕາມກຳນົດ
   - `Cancelled`: ຍົກເລີກ
6. Held/Refused/Missed/Cancelled ຕ້ອງບັນທຶກເຫດຜົນ.

## 4. ຈັດເວລາເກັບເລືອດ/ຕົວຢ່າງ

1. ເປີດ tab `Care Tasks`.
2. ກົດ `ເພີ່ມລາຍການເກັບ`.
3. ລະບຸ Test name, Specimen type, Scheduled time ແລະ Priority.
4. ເມື່ອເກັບຕົວຢ່າງ ໃຫ້ໃສ່ Specimen ID/Barcode, ຜູ້ເກັບ ແລະປ່ຽນສະຖານະເປັນ `Collected`.
5. ເມື່ອສົ່ງຫ້ອງ Lab ໃຫ້ປ່ຽນເປັນ `Sent`; ເມື່ອ Lab ຮັບແລ້ວປ່ຽນເປັນ `Received`.

## 5. ການແຈ້ງເຕືອນ

- ກ່ອນເວລາ 30 ນາທີ: ສະແດງ `Due`.
- ກາຍເວລາ: ສະແດງ `Overdue` ສີແດງ.
- ຈຳນວນວຽກທີ່ຮອດກຳນົດສະແດງຢູ່ badge ຂອງ Care Tasks.
- Desktop notification ຈະສະແດງຖ້າ browser ໄດ້ຮັບອະນຸຍາດ.

## 6. ບັນທຶກການຮນ江ົ້າ

- `Vitals`: ບັນທຶກ Temperature, BP, Pulse, Respiration, SpO2, Pain score ແລະອື່ນໆ.
- `Notes > Doctor Notes`: ບັນທຶກ SOAP/Diagnosis/Plan.
- `Notes > Nursing Notes`: ບັນທຶກອາການ, Nursing care, Response, Intake/Output, Pain, Fall risk ແລະ Allergy alert.
- `Timeline`: ເບິ່ງກິດຈະກຳຕາມລຳດັບເວລາ.

## 7. ຍ້າຍຕຽງ ແລະ Discharge

- ກົດ `ຈັດການ > Transfer` ເພື່ອຍ້າຍໄປຕຽງວ່າງອື່ນ.
- ກ່ອນ discharge ໃຫ້ແພດເປີດ tab `Discharge` ແລະບັນທຶກ Final diagnosis, Hospital course, Treatment, Discharge medication, Follow-up ແລະ Instructions.
- ຫຼັງ discharge ຕຽງຄວນເຂົ້າສະຖານະ `Cleaning`; ຫຼັງອະນາໄມຈຶ່ງປ່ຽນເປັນ `Available`.

> ຄຳເຕືອນ: MAR ແລະການເກັບຕົວຢ່າງເປັນບັນທຶກທາງການແພດ. ຜູ້ໃຊ້ຕ້ອງກວດຢືນຢັນຄົນເຈັບ, ຄຳສັ່ງແພດ, ຢາ, Dose, Route, Allergy ແລະ Specimen label ກ່ອນບັນທຶກ.
