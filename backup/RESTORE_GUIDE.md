# HIS Backup ແລະ Restore Guide


## Backup recovery update — 2026-10-19

- Runs #151/#152 failed safely before ZIP creation because primary-key discovery
  depended on ignored `backup/schema_public.sql`, absent from GitHub checkouts.
  `table_primary_keys.json` now packages DDL-derived cursor keys; live OpenAPI PK
  annotations take precedence for new or changed tables. Count and duplicate-key
  checks remain enabled; unknown unsafe pagination still fails closed.
- All Drive writers use system > year > English month > one DD/MM/YYYY folder,
  e.g. `LIS Backup > 2026 > Oct > 19/10/2026`. Aware timestamps use Bangkok time.
  HIS ZIP/index and newly uploaded shared Storage blobs use the same dated folder.
  Existing blobs remain referenced by file ID, independent of their folder path.
- `organize_drive_backups.py` defaults to audit. Explicit --apply records original
  parents before moving known backups inside the verified root, merges lookup
  properties, and verifies unchanged IDs, size and MD5. It never edits file bytes
  or permissions and leaves unclassified files untouched. Keep its journal local.
- Retrieval uses Drive file IDs/root lookup tags, so moving files does not change
  archive links. Restore verification must check both ZIP and sidecar index/blobs;
  a successful folder move alone does not prove clinical database restoration.
- UXI copy-only archiving in current main already targets `uxi-results` and reuses
  this folder helper. PMC production source/schema coverage is not established;
  an empty PMC Backup folder is not evidence that PMC data has been backed up.
- Supabase backup retention cleanup now requires both SUPABASE_CLEANUP_ENABLED=1
  and DRIVE_RESTORE_VERIFIED=1. Both are off by default; repairing a backup does
  not authorize deleting earlier recovery points before a Drive restore drill.

## Production verification (2026-07-31)

- Backup run `30641028459`: success — 54 tables, 51,504 rows and 376 application Storage objects.
- Restore dry-run `30641934982`: success — the production archive and every external Storage snapshot were downloaded and verified without writing data.
- Verified object: `backups/2026/07/backup-2026-07-31_20260731_150037.zip`.
- Full evidence: [`docs/BACKUP_LOCAL_TEST_2026-07-31.md`](../docs/BACKUP_LOCAL_TEST_2026-07-31.md).

## ສະຖານະ Production ລ່າສຸດ (2026-10-17)

- DB backup run `#150` ລົ້ມໃນຂັ້ນ Supabase Storage upload ດ້ວຍ HTTP 520; ບໍ່ມີ ZIP ໃໝ່ຖືກຢືນຢັນໃນ Supabase ແລະຂັ້ນ Google Drive ບໍ່ໄດ້ຮັນ.
- LIS PDF archive run `#37` copy ແລະກວດຢືນຢັນໄດ້ 1,823 ຈາກ 1,825 ໄຟລ໌; 2 ລາຍການຜິດພາດຈາກການເຊື່ອມຕໍ່ EOF/timeout.
- ໄດ້ເພີ່ມ retry, ກວດ hash ເພື່ອ reconcile ການ upload ທີ່ຜົນຕອບກຳກວມ, ແລະ retry ການດາວໂຫຼດ/Google API. ການຢືນຢັນຫຼັງແກ້ຍັງລໍຖ້າ deploy ແລະ workflow run ຖັດໄປ; ຍັງບໍ່ຖືວ່າ production ຜ່ານ.
- ໂຄງສ້າງ `HIS Backup/DD/MM/YYYY` ແລະການຮັນປະຈຳວັນ 23:00/23:30 ຢູ່ໃນ working tree ເທົ່ານັ້ນ; ຈະເລີ່ມໃຊ້ຫຼັງຈາກ commit/push ແລະ workflow run ຢືນຢັນຜ່ານ.

## ຂອບເຂດ Backup

Production workflow ສຳຮອງ:

- ທຸກ table ທີ່ expose ຜ່ານ Supabase PostgREST;
- ຂໍ້ມູນຄົນເຈັບ/ລູກຄ້າ, appointments, visits, admissions, orders ແລະ results;
- users, permissions, organizations, locations, rooms, wards, master data ແລະ settings;
- files ທັງໝົດຈາກ application Storage buckets, ຍົກເວັ້ນ bucket `his-backups` ເອງ;
- PostgREST OpenAPI metadata ສຳລັບກວດ table/view ແລະ restore capability.

Archive version 2 ມີ typed JSON, CSV ແລະ `manifest.json`. Storage files ຖືກເກັບເປັນ sidecar snapshots ແຕ່ລະ object ເພື່ອບໍ່ເກີນ Supabase 50 MB Spend-Cap limit. Manifest ບັນທຶກ row count, SHA-256, writable/read-only status, Storage size, object hashes ແລະ sidecar paths ເພື່ອ restore ກັບຄືນອັດຕະໂນມັດ.
Archive version 3 ເພີ່ມ incremental Storage: ໄຟລ໌ໃໝ່/ປ່ຽນແປງຖືກເກັບໃນ `blobs/sha256/...`; ໄຟລ໌ທີ່ບໍ່ປ່ຽນຈະ reuse blob ເກົ່າ. Manifest ແຕ່ລະມື້ຍັງຄົງອ້າງອີງໄຟລ໌ຄົບທັງໝົດ ຈຶ່ງ restore ກັບໄດ້ເຕັມ snapshot ໂດຍບໍ່ເກັບ 10+ GiB ຊ້ຳ.
Backup ZIP ໃໝ່ຈະຢູ່ໃນ Supabase `HIS Backup/DD/MM/YYYY/` ແລະ Drive ໃນ `HIS Backup/YYYY/Mon/DD/MM/YYYY/`; Drive Storage blobs ທີ່ deduplicate ຈະຢູ່ພາຍໃຕ້ `HIS Backup/YYYY/Mon/DD/MM/YYYY/Storage Objects/`. API ຍັງອ່ານ archive ເກົ່າໃນ `backups/` ແລະ ZIP ເກົ່າໃນ Drive root.

LIS files ທີ່ເກົ່າກວ່າ hot window ຈະຖືກ copy ແລະກວດຂະໜາດ/hash ໃນ Drive `LIS Backup/YYYY/Mon/DD/MM/YYYY/`; ຊື່ໄຟລ໌ໃຊ້ HN, ຊື່, ອາຍຸ ແລະລະຫັດສັ້ນເພື່ອບໍ່ຊ້ຳ. ໄຟລ໌ຕົ້ນສະບັບຢູ່ Supabase ຈົນກວ່າມີ cleanup workflow ທີ່ຜ່ານ restore verification; LIS backup schedule ແຍກຈາກ HIS 23:00 ເປັນ 23:30 ເພື່ອຫຼຸດການແຍ່ງ resource.

Production log ພົບ bucket `uxi-results` ໃນ Supabase project ທີ່ HIS backup ໃຊ້; workflow ຈະເອົາ bucket ນີ້ເຂົ້າ whole-system snapshot ເມື່ອ backup run ສຳເລັດ. Run `#150` ລົ້ມກ່ອນອັບໂຫຼດ ZIP ຈຶ່ງຍັງບໍ່ມີ snapshot ທີ່ຢືນຢັນກູ້ຄືນໄດ້ຈາກ run ນັ້ນ. ການຈັດ PDF ແຍກເປັນ `UXI Backup` ແລະ PMC ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ: ຕ້ອງຢືນຢັນ production source, file mapping ແລະ Drive permission ກ່ອນເພີ່ມ folder ທີ່ມີ HN/ຊື່/ອາຍຸ.

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

## Google Drive backup scope

The current scheduled workflow calls `upload_complete_bundle`: it stores the database/settings ZIP plus SHA-256-deduplicated application Storage blobs and a sidecar index. These are needed to restore the complete snapshot from Drive without depending on the Supabase backup bucket.

Older Drive files marked `his_backup_scope=database_only` contain no application Storage. The restore script detects that legacy scope and restores only database/settings for those files. Check the archive scope and successful upload run before treating a Drive copy as complete.

Historical production evidence from July 2026:

- Full Supabase backup run `30682154926`: 54 tables, 51,689 rows and 382/382 Storage objects; success.
- Google Drive database-only restore dry-run `30682898230`: 54 tables and 51,689 rows verified, 0 Storage objects by design; success.
- Complete Supabase restore dry-run `30681645725`: 54 tables, 51,687 rows and 380/380 Storage objects; success.
- Incremental zero-change backup run `30685479107`: 383 Storage objects reused without download, 0 objects/0 bytes uploaded; success.
- Incremental full restore dry-run `30685890975`: 54 tables, 51,704 rows and 383/383 Storage objects verified without production writes; success.
