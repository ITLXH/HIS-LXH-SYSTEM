# ຜົນກວດສອບ HIS Backup ແລະ Restore

ວັນທີກວດສອບ: **2026-07-31**  
Repository: `ITLXH/HIS-LXH-SYSTEM`  
Branch: `main`  
Production commit: `aa89234090fd4ac9916896b313269bfc7599aeef`

## ສະຫຼຸບຜົນ

ລະບົບ backup ແລະ restore ໃຊ້ງານໄດ້ແລ້ວໃນ production. Backup ຄອບຄຸມຂໍ້ມູນຄົນເຈັບ/ລູກຄ້າ, users, permissions, settings, master data, visits, admissions, orders/results ແລະໄຟລ໌ໃນ application Storage.

| ລາຍການ | ຜົນ |
|---|---|
| Production backup run | `30641028459` — Success |
| Restore dry-run | `30641934982` — Success |
| Tables | `54` |
| Rows | `51,504` |
| Table export failures | `0` |
| Application Storage | `376` objects, upload ແລະ checksum verify ຄົບ |
| Metadata ZIP | `3,612,512 bytes` (`3.4 MB`) |
| ZIP SHA-256 | `b065fa4c76b165c75e9876f4ee4fde42771652da73d4060a9c6a3972313ea041` |
| Supabase object | `backups/2026/07/backup-2026-07-31_20260731_150037.zip` |

- Backup run: <https://github.com/ITLXH/HIS-LXH-SYSTEM/actions/runs/30641028459>
- Restore dry-run: <https://github.com/ITLXH/HIS-LXH-SYSTEM/actions/runs/30641934982>
- Production UI: <https://his-lxh-system.pages.dev/backup>

## ຂອບເຂດ Backup

- export ທຸກ table/view ທີ່ Supabase PostgREST/OpenAPI expose;
- ບັງຄັບໃຫ້ມີ core tables: `HIS_One_Patients`, `HIS_One_Settings`, `HIS_One_Users`, `lis_one_settings`, `lis_one_users`;
- ບັນທຶກ typed JSON ສຳລັບ restore, CSV ສຳລັບກວດສອບ, OpenAPI metadata ແລະ `manifest.json`;
- ສຳຮອງ application Storage ທຸກ bucket ຍົກເວັ້ນ `his-backups`;
- ບັນທຶກ row count, object size ແລະ SHA-256 ແລ້ວ verify ຫຼັງ upload;
- fail-safe: ຖ້າຂາດ table, export ບໍ່ຄົບ, upload/verify ບໍ່ຜ່ານ ຈະບໍ່ລາຍງານ backup ສຳເລັດ;
- retry ອັດຕະໂນມັດສຳລັບ HTTP `408`, `425`, `429`, `500`, `502`, `503`, `504`;
- cleanup backup ເກົ່າກວ່າ 30 ມື້.

Storage files ຖືກເກັບເປັນ content-addressed blobs ຕາມ SHA-256 ເພື່ອຮອງຮັບ Supabase global upload limit 50 MB ແລະບໍ່ຄັດລອກໄຟລ໌ 10+ GiB ຊ້ຳທຸກມື້. Main ZIP ເກັບ database data ແລະ manifest ທີ່ຊີ້ໄປຫາ blob ແຕ່ລະໄຟລ໌. ຖ້າ source ETag/updated time ແລະ size ບໍ່ປ່ຽນ, workflow ຈະ reuse blob ເກົ່າໂດຍບໍ່ download ຫຼື upload ໃໝ່.

## Restore

Restore dry-run ດາວໂຫຼດ main ZIP ແລະ sidecars ກັບຈາກ private Supabase bucket, ກວດ ZIP CRC, path traversal, manifest, table row counts, table hashes, Storage sizes ແລະ Storage hashes. Run `30641934982` ຜ່ານຄົບໂດຍບໍ່ຂຽນຂໍ້ມູນ production.

ສຳລັບ restore ຈິງ:

1. ຕ້ອງກຳນົດ `dry_run=false` ແລະພິມ confirmation `RESTORE`.
2. Workflow ຈະສ້າງແລະ verify pre-restore safety backup ກ່ອນ.
3. Tables ຖືກ upsert ດ້ວຍ Primary Key; Storage files ຖືກ upsert ແລະ verify SHA-256 ຫຼັງຂຽນ.
4. Read-only views ບໍ່ຖືກຂຽນ; ຂໍ້ມູນຈະກັບຄືນຈາກ source tables.

ບໍ່ໄດ້ຮັນ restore ຈິງໃສ່ production ໃນການທົດສອບນີ້ ເພາະຈະແກ້ໄຂຂໍ້ມູນໂດຍບໍ່ຈຳເປັນ. Dry-run ໄດ້ພິສູດວ່າ archive ສາມາດດາວໂຫຼດ, ກວດ ແລະກຽມ restore ໄດ້ຄົບ.

## ຜົນທົດສອບ Local

| ຄຳສັ່ງ | ຜົນ |
|---|---|
| `python -m unittest discover -s backup/tests -v` | PASS — 16 tests |
| `python -m py_compile backup/scripts/backup_rest.py backup/scripts/restore_rest.py` | PASS |
| `npm run build` | PASS |

## ການເຮັດວຽກອັດຕະໂນມັດ

Workflow `supabase-backup.yml` ຮັນທຸກມື້ຕາມ cron `0 0 * * *` (`07:00` ເວລາລາວ/ບາງກອກ). Admin ສາມາດກົດ **Backup Now** ຈາກໜ້າ `/backup` ໄດ້.

GitHub Actions secrets ທີ່ໃຊ້:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=his-backups`

Secret ບໍ່ໄດ້ຖືກບັນທຶກໃນ source code ຫຼືເອກະສານ.

## ຂໍ້ຈຳກັດ

Application restore ຕ້ອງມີ database schema ຢູ່ແລ້ວ. Database DDL ເຊັ່ນ functions, triggers, RLS policies, roles ແລະ extensions ບໍ່ສາມາດສ້າງຄືນຜ່ານ service-role REST API. ເມື່ອສ້າງ Supabase project ໃໝ່ຈາກສູນ ຕ້ອງ deploy schema/migrations ຈາກ repository ກ່ອນ ແລ້ວຈຶ່ງ restore archive.

## Production re-verification (2026-08-01)

- Backup run `30682154926` succeeded. Supabase received 54 tables, 51,689 rows and 382/382 application Storage objects. The verified object is `backups/2026/08/backup-2026-08-01_20260801_033136.zip`.
- The same run uploaded the Google Drive database-only file `backup-2026-08-01_20260801_033136.zip` (`3,622,681` bytes), with Drive size/MD5 verification and `his_backup_scope=database_only`.
- Google Drive restore dry-run `30682898230` succeeded: 54 tables and 51,689 rows were verified without production writes; application Storage was intentionally skipped.
- Complete Supabase restore dry-run `30681645725` also succeeded: 54 tables, 51,687 rows and 380/380 Storage objects were downloaded and verified without production writes.
- Supabase is the complete backup destination: database/settings plus all application Storage objects.
- Google Drive is intentionally database-only. Each scheduled run uploads the verified database/settings ZIP (about 3.5 MB) and never duplicates the 10.23 GiB application PDF Storage collection.
- A Drive restore marked `his_backup_scope=database_only` restores and verifies tables but intentionally skips application Storage. Complete application recovery uses the Supabase copy.
- Incremental Supabase Storage uses SHA-256 blob paths. Unchanged objects are reused; only new or changed content consumes additional backup space.
- Retention cleanup first scans every retained manifest and never deletes a blob that is still referenced by any recoverable backup.
- Local validation: `python -m unittest discover -s backup/tests -p 'test_*.py' -v` passed 23 tests, and `npm run build` passed.

## Incremental production verification (2026-08-01)

- Migration run [`30684617276`](https://github.com/ITLXH/HIS-LXH-SYSTEM/actions/runs/30684617276) found 383 Storage objects. One genuinely new object (`30,797,381` bytes) was uploaded and 382 existing objects were reused; the 10.23 GiB collection was not uploaded again.
- Zero-change run [`30685479107`](https://github.com/ITLXH/HIS-LXH-SYSTEM/actions/runs/30685479107) uploaded `0` Storage objects and `0` bytes. All 383 objects were reused from metadata without downloading their contents.
- Incremental restore dry-run [`30685890975`](https://github.com/ITLXH/HIS-LXH-SYSTEM/actions/runs/30685890975) verified 54 tables, 51,704 rows and all 383/383 Storage blobs. It prepared 51,702 writable rows, skipped one read-only view and made no production writes.
