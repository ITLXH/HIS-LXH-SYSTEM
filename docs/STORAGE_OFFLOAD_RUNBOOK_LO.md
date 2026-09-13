# HIS Supabase Storage → Google Drive Safe Offload

Runbook ນີ້ຄຸ້ມຄອງ 2 ຊັ້ນ: **backup archive** ໃນ bucket `his-backups`
ແລະ PDF ຜົນກວດເກົ່າໃນ `order-result-files`. `patient-photos`,
`his-staff-avatars`, database ຫຼັກ ແລະໄຟລ໌ LIS ໃໝ່ທີ່ຢູ່ໃນ hot window
ຈະບໍ່ຖືກປ່ຽນ ຫຼືລຶບ.

## ຫຼັກການຄວາມປອດໄພ

ລຳດັບຂອງທຸກ archive ແມ່ນ:

1. ດາວໂຫຼດ backup ZIP ຈາກ Supabase.
2. ກວດ ZIP CRC ແລະ `manifest.json`.
3. ດາວໂຫຼດ sidecar ແລະກວດ `size_bytes` + SHA-256.
4. Upload/reuse ໄຟລ໌ໃນ Drive ຕາມ SHA-256.
5. ສ້າງ Drive sidecar index ສຳລັບ auto-fetch ຕອນ restore.
6. ກວດ Drive file size + MD5 ແລະກວດ index ທຸກ entry.
7. ຮັກສາ sidecar ທີ່ backup ໃໝ່ ຫຼື backup ທີ່ຍັງກວດບໍ່ຜ່ານອ້າງອີງຢູ່.
8. ລຶບຈາກ Supabase ສະເພາະ object ທີ່ພິສູດແລ້ວວ່າຢູ່ Drive.

Orphan object ຈະຖືກລາຍງານເທົ່ານັ້ນ. ລະບົບບໍ່ລຶບ orphan ອັດຕະໂນມັດ.
ຖ້າ ZIP ໃດໜຶ່ງເສຍ ຫຼືອ່ານ manifest ບໍ່ໄດ້, sidecar ທັງໝົດຈະຖືກຮັກສາໄວ້.

## 1. ຕັ້ງ GitHub Secrets

Repository → Settings → Secrets and variables → Actions → Secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` = `his-backups`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_FOLDER_ID`

Google Drive folder ຕ້ອງ share ໃຫ້ email ຂອງ Service Account ເປັນ Editor.
ຫ້າມເຮັດ folder ຫຼື backup ເປັນ public.

## 2. ຮັນ Audit — ບໍ່ມີການລຶບ

Workflow ຈະຮັນ audit ອ່ານຢ່າງດຽວທຸກວັນອາທິດ 08:30
(Asia/Bangkok). ຖ້າ Storage ລວມຂອງ project ເກີນ 70 GiB, workflow ຈະ fail
ເພື່ອໃຫ້ GitHub Actions ສົ່ງການເຕືອນ. Scheduled run ບໍ່ສາມາດ
copy ຫຼືລຶບຂໍ້ມູນໄດ້.

GitHub → Actions → `Supabase Storage Safe Offload` → Run workflow:

- `mode`: `audit`
- `retention_days`: `14`
- `confirmation`: ປ່ອຍວ່າງ

ດາວໂຫຼດ artifact `storage-offload-report-*` ແລະກວດ:

- `archive_bytes` ແລະ `sidecar_bytes`
- `bucket_summary` — ຈຳນວນ object ແລະ size ແຍກຕາມ bucket
- `verified_old_archives`
- `planned_delete_count`
- `protected_sidecars`
- `orphan_count`
- `failures`

## 3. Copy ແລະ Verify — ຍັງບໍ່ລຶບ

ຮັນ workflow ອີກຄັ້ງ:

- `mode`: `copy`
- `retention_days`: `14`
- `confirmation`: ປ່ອຍວ່າງ

ຂັ້ນນີ້ copy backup ເກົ່າກວ່າ 14 ມື້ໄປ Drive, ສ້າງ sidecar index
ແລະກວດ checksum. Supabase ຈະບໍ່ຖືກລຶບ.

## 4. Restore dry-run ຈາກ Google Drive

ເປີດໜ້າ Backup ຂອງ HIS ຫຼື GitHub workflow `Supabase DB Restore`:

- `source`: `gdrive`
- `gdrive_file_id`: ເລືອກ Drive backup ທີ່ copy ສຳເລັດ
- `dry_run`: `true`
- `confirmation`: ປ່ອຍວ່າງ

Dry-run ຈະດຶງ ZIP ແລະ Storage blobs ຈາກ Drive ອັດຕະໂນມັດ,
ກວດ row count, SHA-256 ແລະ Storage index ໂດຍບໍ່ຂຽນຂໍ້ມູນໃສ່ production.

ຫຼັງຈາກ dry-run ສຳເລັດ ໃຫ້ສ້າງ Repository Variable:

- `DRIVE_RESTORE_VERIFIED` = `1`

## 5. Cleanup ສະເພາະ backup ທີ່ກວດຜ່ານ

ຮັນ `Supabase Storage Safe Offload`:

- `mode`: `cleanup`
- `retention_days`: `14`
- `confirmation`: `OFFLOAD_VERIFIED_BACKUPS`

Cleanup ຈະບໍ່ເລີ່ມຖ້າ:

- Drive credentials ບໍ່ຄົບ
- Drive folder ຂຽນບໍ່ໄດ້
- `DRIVE_RESTORE_VERIFIED` ບໍ່ແມ່ນ `1`
- confirmation ບໍ່ກົງ
- archive/manifest/index/hash ກວດບໍ່ຜ່ານ
- bucket ບໍ່ແມ່ນ `his-backups`

## 6. ການຮັນ Backup ປະຈຳວັນ

Workflow `Supabase DB Backup` ຍັງຮັນທຸກມື້. ຄ່າປອດໄພເລີ່ມຕົ້ນ:

- Supabase hot retention: 14 ມື້
- Drive retention: 3650 ມື້
- Supabase cleanup: ປິດ
- Drive cleanup: ປິດ
- daily sidecar offload: ປິດຖາວອນ

ຢ່າເປີດ `SUPABASE_OFFLOAD_AFTER_DRIVE` ໃນ daily workflow. ການລຶບ sidecar
ຕ້ອງຜ່ານ `Supabase Storage Safe Offload` ເທົ່ານັ້ນ ເພາະ workflow ນີ້
ຈະກວດວ່າບໍ່ມີ backup ໃນ hot window ອ້າງອີງ sidecar ນັ້ນຢູ່.

## 7. LIS PDF archive ແລະ auto-fetch

Workflow `LIS Result File Safe Archive` ໃຊ້ສຳລັບ bucket `order-result-files` ເທົ່ານັ້ນ.
ໄຟລ໌ໃນ 14 ມື້ຫຼ້າສຸດຍັງຢູ່ Supabase. ໄຟລ໌ເກົ່າຈະຖືກຕັ້ງຊື່ໃນ Drive
ດ້ວຍ SHA-256 ແທນ HN/ຊື່ໄຟລ໌ ແລະກວດ size + MD5 + SHA-256 ກ່ອນຖືວ່າສຳເລັດ.

HIS ໃຊ້ `/api/lis/result-file` ເປັນ dual-read gateway:

- ຖ້າໄຟລ໌ຍັງຢູ່ Supabase ຈະ redirect ໄປຫາ URL ເດີມ.
- ຖ້າໄຟລ໌ຖືກ archive ແລ້ວ ຈະຄົ້ນຫາດ້ວຍ path SHA-256 ແລະ stream ຈາກ Drive.
- LIS table ແລະ `storage_path` ບໍ່ຖືກແກ້ ຈຶ່ງ rollback ໄດ້ງ່າຍ.

ກ່ອນ deploy gateway, Cloudflare Pages production ຕ້ອງມີ secrets ດຽວກັບ GitHub Actions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_DRIVE_OAUTH_JSON` ຫຼື `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_FOLDER_ID`

ລຳດັບເປີດໃຊ້:

1. Deploy gateway ແລະກວດ hot-file redirect.
2. ຮັນ `audit` ເພື່ອກວດ age/size ຂອງເກນ 14 ມື້.
3. ຮັນ `copy` ດ້ວຍ `max_objects=1` ເປັນ canary.
4. ກວດວ່າ canary PDF ເປີດຜ່ານ gateway ໄດ້.
5. ຮັນ copy ທັງໝົດ ແລະກວດ report ວ່າ failure = 0.
6. ຕັ້ງ `LIS_ARCHIVE_RESTORE_VERIFIED=1`.
7. ຮັນ cleanup ດ້ວຍ confirmation `ARCHIVE_VERIFIED_ORDER_RESULTS`.
8. ຫຼັງກວດ production ຄົບ ຈຶ່ງຕັ້ງ `LIS_ARCHIVE_AUTOMATION_ENABLED=1`.

Scheduled cleanup ຈະບໍ່ເຮັດວຽກຖ້າ 2 variables ຂ້າງເທິງບໍ່ແມ່ນ `1`.

## Rollback

ຖ້າຕ້ອງການຢຸດ offload ທັນທີ:

1. ຫ້າມຮັນ maintenance workflow ໃນ mode `cleanup`.
2. Backup ປະຈຳວັນຍັງເກັບ Supabase + Drive ໂດຍບໍ່ລຶບ.
3. ເລືອກ Drive backup ໃນ HIS Backup page ເພື່ອ dry-run ຫຼື restore.

## ໝາຍເຫດສຳຄັນ

`patient-photos` ແລະ `his-staff-avatars` ບໍ່ຢູ່ໃນ archive workflow. ຢ່າຍ້າຍ
bucket ເຫຼົ່ານີ້ຈົນກວ່າຈະມີ resolver ແລະ restore drill ແຍກຕ່າງຫາກ.
