# ຜົນກວດສອບ HIS Backup → Supabase Storage

ວັນທີກວດສອບ: **2026-07-31**

Repository: `ITLXH/HIS-LXH-SYSTEM`

Branch: `main`

Production commit: `7077609a6007872201043ab165a8f56414a7d42a`

## ສະຫຼຸບຜົນ

ລະບົບ backup ໃຊ້ງານໄດ້ແລ້ວໃນ production. GitHub Actions run **#49** ສຳເລັດ ແລະໄຟລ໌ ZIP ຖືກ upload ແລະ verify ໃນ private Supabase Storage bucket `his-backups`.

| ລາຍການ | ຜົນ |
|---|---|
| GitHub Actions run | `#49` — Success |
| Run ID | `30629874413` |
| Tables ທີ່ export | `54` |
| Rows ທັງໝົດ | `51,433` |
| Tables ທີ່ລົ້ມເຫຼວ | `0` |
| ຂະໜາດ ZIP | `3,555,647 bytes` (`3.4 MB`) |
| SHA-256 | `5233dd3a5324e78bc815f7561a744a68950324e14df0739bd0681d7fd0e57236` |
| Supabase object | `backups/2026/07/backup-2026-07-31_20260731_121437.zip` |
| Production UI | ສະແດງໄຟລ໌ `3.4 MB` ແລະ run `#49 Success` |

GitHub Actions URL: <https://github.com/ITLXH/HIS-LXH-SYSTEM/actions/runs/30629874413>

## ສິ່ງທີ່ໄດ້ຕັ້ງຄ່າ

GitHub Actions Secrets ຖືກຕັ້ງແລ້ວ:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=his-backups`

ໝາຍເຫດສຳຄັນ: Storage API ຕ້ອງໃຊ້ legacy `service_role` JWT. Supabase `sb_secret_...` key ອ່ານ PostgREST ໄດ້ ແຕ່ Storage upload ຕອບ `Invalid Compact JWS`; ຈຶ່ງໄດ້ປ່ຽນ GitHub Secret ເປັນ legacy service-role JWT. Secret ບໍ່ໄດ້ຖືກບັນທຶກໃນ source code ຫຼືເອກະສານນີ້.

Cloudflare Pages ມີ server-side secrets ສຳລັບ trigger/list backup ແລ້ວ. Production page:

<https://his-lxh-system.pages.dev/backup>

## ການແກ້ໄຂ Code

- default bucket ເປັນ `his-backups`;
- ສ້າງ private bucket ອັດຕະໂນມັດຖ້າຍັງບໍ່ມີ;
- export ທຸກ table ທີ່ PostgREST/OpenAPI ສະແດງ ໂດຍ pagination;
- ບັນທຶກ CSV, JSON ແລະ manifest ໃນ ZIP;
- ກວດຈຳນວນ rows ແລະບໍ່ອະນຸຍາດ incomplete backup;
- verify object ຫຼັງ upload ໂດຍກວດຂະໜາດໄຟລ໌;
- workflow ຈະ fail ຖ້າ export, upload ຫຼື verify ບໍ່ສຳເລັດ;
- cleanup backup ທີ່ເກົ່າກວ່າ `30` ມື້;
- ສະແດງ error annotation ທີ່ອ່ານງ່າຍໃນ GitHub Actions.

Commits:

- `9059290` — Make Supabase backups fail-safe and self-provisioning
- `7077609` — Expose backup failure reasons in Actions

## ຜົນທົດສອບ Local

| ຄຳສັ່ງ | ຜົນ |
|---|---|
| `python -m unittest discover -s backup/tests -v` | PASS — 6 tests |
| `npm run build` | PASS |

Unit tests ຄອບຄຸມ bucket creation, upload success/failure, table discovery, pagination ແລະ row-count verification.

## ການເຮັດວຽກອັດຕະໂນມັດ

Workflow `supabase-backup.yml` ຮັນທຸກມື້ຕາມ cron `0 0 * * *`:

- `00:00 UTC`
- `07:00` ເວລາລາວ/ບາງກອກ (UTC+7)

ຜູ້ໃຊ້ສາມາດກົດ **Backup Now** ໃນໜ້າ `/backup` ເພື່ອ run manual ໄດ້. Google Drive ຍັງຖືກ skip ເພາະບໍ່ມີ `GOOGLE_SERVICE_ACCOUNT_JSON`; ບໍ່ມີຜົນຕໍ່ Supabase backup.

## ຂອບເຂດຂອງ Backup

Backup ນີ້ປ້ອງກັນຂໍ້ມູນ rows ຂອງ 54 tables ທີ່ expose ຜ່ານ Supabase PostgREST. ມັນບໍ່ແມ່ນ full PostgreSQL dump ແລະຍັງບໍ່ຄອບຄຸມ:

- database schema, functions, triggers, policies, roles ແລະ extensions;
- Supabase Auth users;
- objects ຈາກ Storage buckets ອື່ນ;
- tables/schemas ທີ່ບໍ່ expose ຜ່ານ PostgREST.

ສຳລັບ disaster recovery ແບບເຕັມຮູບແບບ ຄວນເພີ່ມ scheduled PostgreSQL dump ແລະ backup Storage objects ແຍກຕ່າງຫາກ. ກ່ອນ restore ຂໍ້ມູນຈິງ ຄວນທົດສອບໃນ non-production project ກ່ອນ.
