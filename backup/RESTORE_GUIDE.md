# HIS Backup ແລະ Restore Guide

## Production verification (2026-07-31)

- Backup run `30641028459`: success — 54 tables, 51,504 rows and 376 application Storage objects.
- Restore dry-run `30641934982`: success — the production archive and every external Storage snapshot were downloaded and verified without writing data.
- Verified object: `backups/2026/07/backup-2026-07-31_20260731_150037.zip`.
- Full evidence: [`docs/BACKUP_LOCAL_TEST_2026-07-31.md`](../docs/BACKUP_LOCAL_TEST_2026-07-31.md).

## ຂອບເຂດ Backup

Production workflow ສຳຮອງ:

- ທຸກ table ທີ່ expose ຜ່ານ Supabase PostgREST;
- ຂໍ້ມູນຄົນເຈັບ/ລູກຄ້າ, appointments, visits, admissions, orders ແລະ results;
- users, permissions, organizations, locations, rooms, wards, master data ແລະ settings;
- files ທັງໝົດຈາກ application Storage buckets, ຍົກເວັ້ນ bucket `his-backups` ເອງ;
- PostgREST OpenAPI metadata ສຳລັບກວດ table/view ແລະ restore capability.

Archive version 2 ມີ typed JSON, CSV ແລະ `manifest.json`. Storage files ຖືກເກັບເປັນ sidecar snapshots ແຕ່ລະ object ເພື່ອບໍ່ເກີນ Supabase 50 MB Spend-Cap limit. Manifest ບັນທຶກ row count, SHA-256, writable/read-only status, Storage size, object hashes ແລະ sidecar paths ເພື່ອ restore ກັບຄືນອັດຕະໂນມັດ.
Archive version 3 ເພີ່ມ incremental Storage: ໄຟລ໌ໃໝ່/ປ່ຽນແປງຖືກເກັບໃນ `blobs/sha256/...`; ໄຟລ໌ທີ່ບໍ່ປ່ຽນຈະ reuse blob ເກົ່າ. Manifest ແຕ່ລະມື້ຍັງຄົງອ້າງອີງໄຟລ໌ຄົບທັງໝົດ ຈຶ່ງ restore ກັບໄດ້ເຕັມ snapshot ໂດຍບໍ່ເກັບ 10+ GiB ຊ້ຳ.

Workflow ຈະ fail ຖ້າຂາດ core tables ເຫຼົ່ານີ້:

- `HIS_One_Patients`
- `HIS_One_Settings`
- `HIS_One_Users`
- `lis_one_settings`
- `lis_one_users`

## ຄວາມປອດໄພກ່ອນ Restore

Restore ເປັນ manual workflow ເທົ່ານັ້ນ. ກ່ອນ restore ຈິງ:

1. ຕ້ອງຢືນຢັນດ້ວຍຄຳວ່າ `RESTORE`.
2. Workflow ສ້າງ pre-restore safety backup ໃໝ່ ແລະ verify ໃຫ້ສຳເລັດກ່ອນ.
3. Restore script ກວດ ZIP CRC, path traversal, manifest, table row counts, table SHA-256, Storage sizes ແລະ Storage SHA-256 ກ່ອນຂຽນຂໍ້ມູນ.
4. ຂໍ້ມູນຖືກ restore ຈາກ typed JSON; CSV ໃຊ້ສະເພາະ archive version ເກົ່າທີ່ບໍ່ມີ JSON.
5. Tables ໃຊ້ upsert/merge ດ້ວຍ Primary Key. Rows ໃໝ່ທີ່ສ້າງຫຼັງ backup ຈະບໍ່ຖືກລົບ.
6. Read-only database views ຈະບໍ່ຖືກຂຽນ; ຂໍ້ມູນ view ຈະກັບຄືນຈາກ source tables.
7. Storage files ໃຊ້ upsert ແລະດາວໂຫຼດກັບຄືນມາ verify SHA-256 ຫຼັງຂຽນ.

## ທົດສອບ Restore ໂດຍບໍ່ຂຽນຂໍ້ມູນ

ໃນ GitHub Actions ເລືອກ workflow **Supabase DB Restore**:

- `source`: `supabase`
- `backup_name`: object path ທີ່ສະແດງໃນໜ້າ `/backup`
- `dry_run`: `true`
- `confirmation`: ປ່ອຍວ່າງໄດ້

Dry-run ຈະດາວໂຫຼດ ແລະກວດ backup ທັງໝົດ ແຕ່ບໍ່ POST/UPDATE ຂໍ້ມູນ.

## Restore ຈິງ

ເລືອກ backup ໃນ production `/backup`, ກົດ Restore ແລະພິມ `RESTORE`. ຫຼື run workflow ໂດຍກຳນົດ:

- `dry_run`: `false`
- `confirmation`: `RESTORE`

ຫ້າມ restore ຊ້ຳ ຫຼືປິດ workflow ລະຫວ່າງການເຮັດວຽກ. ຫຼັງ workflow ສຳເລັດ ໃຫ້ກວດ patients, settings, users, orders/results ແລະ Storage files ໃນລະບົບ.

## ຂໍ້ຈຳກັດ

Application backup ນີ້ສາມາດ restore ຂໍ້ມູນໃສ່ project ທີ່ມີ database schema ຢູ່ແລ້ວ. Database DDL ເຊັ່ນ functions, triggers, RLS policies, roles ແລະ extensions ບໍ່ສາມາດສ້າງຄືນຜ່ານ service-role REST API. ສຳລັບການສ້າງ Supabase project ໃໝ່ຈາກສູນ ຕ້ອງນຳ schema/migrations ຈາກ repository ໄປ deploy ກ່ອນ ແລ້ວຈຶ່ງ restore archive.

## Google Drive database-only copy

Google Drive intentionally stores only the verified database/settings ZIP, currently about 3.5 MB per scheduled backup. Application Storage files are not uploaded to Drive; the complete copy of those files remains in Supabase Storage.

Drive files are marked with `his_backup_scope=database_only`. A Drive restore verifies and restores the database tables but skips application Storage. Use the Supabase backup source when complete recovery must include patient/result files.

Latest production evidence:

- Full Supabase backup run `30682154926`: 54 tables, 51,689 rows and 382/382 Storage objects; success.
- Google Drive database-only restore dry-run `30682898230`: 54 tables and 51,689 rows verified, 0 Storage objects by design; success.
- Complete Supabase restore dry-run `30681645725`: 54 tables, 51,687 rows and 380/380 Storage objects; success.
- Incremental zero-change backup run `30685479107`: 383 Storage objects reused without download, 0 objects/0 bytes uploaded; success.
- Incremental full restore dry-run `30685890975`: 54 tables, 51,704 rows and 383/383 Storage objects verified without production writes; success.
