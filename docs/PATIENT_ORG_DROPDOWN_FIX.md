# ແກ້ໄຂ Dropdown ລະຫັດລູກຄ້າໃນໜ້າລົງທະບຽນຄົນເຈັບ

## ບັນຫາ

1. **Dropdown ສະແດງຜົນບໍ່ຄົບ** — ສະແດງພຽງ 10 ລາຍການ ເນື່ອງຈາກ Supabase PostgREST-js ມີ default limit ຖ້າບໍ່ໄດ້ລະບຸ `.limit()`
2. **Dropdown ສະແດງສະເພາະອົງກອນທີ່ Status = 'Active'** — ອົງກອນທີ່ບໍ່ມີ Status (NULL) ຈາກການ import ຂໍ້ມູນເກົ່າຖືກຕັດອອກ
3. **Dropdown ບໍ່ໄດ້ Refresh ເມື່ອເປີດ Modal** — ຂໍ້ມູນຖືກດຶງພຽງຕອນໂຫຼດໜ້າຄັ້ງທຳອິດ
4. **ປ່ຽນການສະແດງຜົນຈາກ Org Code ເປັນ Customer ID**

## ການແກ້ໄຂ

### ແຟ້ມ: `src/main.js`

#### 1. `refreshPatientOrgDropdown()`
- ເພີ່ມ `.limit(9999)` ເພື່ອຮັບປະກັນວ່າ Supabase ສົ່ງຄືນທຸກແຖວ
- ປ່ຽນຈາກ `.eq('Status', 'Active')` ເປັນການກັ່ນຕອງ Status ໃນ JavaScript: ຖ້າ Status ເປັນ NULL ຫຼື 'Active' ໃຫ້ສະແດງ
- ປ່ຽນການສະແດງຜົນຈາກ `Org_Code - Org_Name` ເປັນ `Cus_ID_Ex - Name`
- ປ່ຽນຄ່າ placeholder ຈາກ 'ເລືອກອົງກອນ' ເປັນ 'ເລືອກລູກຄ້າ'

#### 2. `openNewPatientModal()`
- ເພີ່ມ `window.refreshPatientOrgDropdown()` ເພື່ອດຶງຂໍ້ມູນລ່າສຸດທຸກຄັ້ງທີ່ເປີດ Modal

#### 3. `editPatient()`
- ເພີ່ມ `window.refreshPatientOrgDropdown()` ຄືກັນ

#### 4. `fetchOrg()`
- ເພີ່ມການກວດສອບ `error` ຈາກ Supabase
- ໃຊ້ `.or('Org_ID.eq."${c}",Org_Code.eq."${c}"')` ເພື່ອຄົ້ນຫາທັງ Org_ID ແລະ Org_Code

#### 5. `preloadDropdownDataCallback()`
- ເພີ່ມ `.limit(9999)` ໃນ query ດຶງອົງກອນ (ສຳລັບ Appointment modal)

#### 6. `loadOrgs()`
- ເພີ່ມ `.limit(9999)` ໃນ query ດຶງອົງກອນ (ສຳລັບໜ້າຈັດການອົງກອນ)

### ແຟ້ມ: `public/partials/modals/patient-modal.html`

- ປ່ຽນປ້າຍກຳກັບຈາກ "ລະຫັດອົງກອນ" ເປັນ "ລະຫັດລູກຄ້າ"
- ປ່ຽນ placeholder ຈາກ "-- ເລືອກອົງກອນ --" ເປັນ "-- ເລືອກລູກຄ້າ --"

## ວິທີທົດສອບ

1. ເປີດເຊີບເວີ: `npm run dev`
2. ເຂົ້າໄປທີ່ `http://localhost:5180`
3. ເປີດໜ້າລົງທະບຽນຄົນເຈັບໃໝ່
4. ກົດ F12 > Console ເພື່ອເບິ່ງ log: `refreshPatientOrgDropdown: loaded X organizations`
5. ກວດເບິ່ງ dropdown ລະຫັດລູກຄ້າວ່າສະແດງ `Cus_ID_Ex - Name`
6. ກວດເບິ່ງວ່າສາມາດລຶບ/ເລືອກໃໝ່ໄດ້
