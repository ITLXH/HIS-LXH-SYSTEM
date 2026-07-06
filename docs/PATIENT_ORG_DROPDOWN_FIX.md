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

## 2026-07-06 — `loadOrgs()` paginate to bypass 1000-row cap

### ບັນຫາ
User uploaded `HIS_Organizations_Import_Template.xlsx` with **405 Dai-ichi customers** (`CUS-LXH-DICH-26-007-0001` … `-0405`). After upload the Orgs page showed **only 6 Dai-ichi rows**, and the DataTable footer said `1,000 ລາຍການ`.

### ວິເຄາະ (Root cause)
Direct query against Supabase (`GET /rest/v1/HIS_One_Organizations?…&Prefer: count=exact`) proved the upload actually worked — the DB really has **1,951 total Organizations** and **all 405 Dai-ichi rows are there**. The bug is display-side:
- `loadOrgs()` called `.select('*').limit(9999)`.
- Supabase PostgREST silently caps a single response at the server `Max Rows` setting (default **1,000**) regardless of `.limit()`.
- The query had no `.order()`, so the returned 1,000-row slice was arbitrary (roughly physical order) — most Dai-ichi rows (which were inserted last) fell past position 1,000 and were dropped by the server.
- On the client, DataTable sorted the 1,000 rows by ORG CODE, so the handful of Dai-ichi rows that *did* land in the slice appeared first (6 of 405). To the user this looked like "only 6 uploaded".

### ການແກ້ໄຂ — `src/main.js` `window.loadOrgs`
Replaced the single `.select().limit(9999)` with a `.range()` pagination loop:

```js
const PAGE = 1000;
const orgs = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabaseClient
    .from(dbTable('Organizations'))
    .select('*')
    .order('Org_Code', { ascending: true })
    .order('Cus_ID_Ex', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) { Swal.fire('Error', error.message, 'error'); return; }
  if (!data || data.length === 0) break;
  orgs.push(...data);
  if (data.length < PAGE) break;
}
```

The added `.order()` also makes the fetch deterministic (Org_Code then Cus_ID_Ex).

### ວິທີກວດສອບ
1. Open the Orgs page (`/orgs`). The DataTable footer should now show **1,951 ລາຍການ** (or the current true total), not 1,000.
2. In the search box type `Dai-ichi` — all **405 rows** should be listed.
3. Confirm via REST (still works as an audit path):
   ```
   curl -I "$SUPABASE_URL/rest/v1/HIS_One_Organizations?select=Org_ID&Org_Code=eq.Dai-ichi" \
     -H "apikey: $ANON" -H "Prefer: count=exact" -H "Range: 0-0"
   ```
   `Content-Range: 0-404/405`.

### Notes for future writers
Any other `loadX` reading a table that can exceed 1,000 rows (Patients, Visits, Drugs_Master, Labs_Master, Vaccines_Master…) is subject to the same silent PostgREST cap. `.limit(9999)` alone does **not** work — use `.range()` pagination + explicit `.order()`, otherwise the "missing rows" symptom will look exactly like a broken import.
