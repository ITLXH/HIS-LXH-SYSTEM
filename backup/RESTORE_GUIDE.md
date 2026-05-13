# ຄູ່ມື Restore Database HIS ຈາກ Google Drive Backup

## ສິ່ງທີ່ຕ້ອງການ
- Python 3.8+
- credentials ຄືເກົ່າ (`backup/.env`, `config/google-drive-credentials.json`, `backup/google-token.json`)
- `pip install -r backup/requirements.txt`

## ວິທີ Restore

### 1. ເບິ່ງ backup ທີ່ມີໃນ Drive
```bash
cd /mnt/c/Users/asus/Desktop/Project/HIS-sys-main
python backup/restore.py --list
```
ຈະສະແດງລາຍການ backup ທັງໝົດ ເຊັ່ນ:
```
backup-2025-01-15.zip   created=2025-01-15   size=150,000 bytes
backup-2025-01-14.zip   created=2025-01-14   size=148,000 bytes
backup-2025-01-13.zip   created=2025-01-13   size=145,000 bytes
```

### 2. Restore ຈາກ backup ທີ່ຕ້ອງການ
```bash
python backup/restore.py backup-2025-01-15.zip
```
Script ຈະ:
1. download zip ຈາກ Google Drive
2. unzip ລົງ temp folder
3. restore ທຸກ CSV ໄປ Supabase ຜ່ານ REST API (upsert)
4. ຖ້າມີ his-dump.sql ຈະ restore ຜ່ານ psql ນຳ

### 3. ກວດສອບຫຼັງ restore
ເຂົ້າ Supabase SQL editor ຫຼືແອັບ ເບິ່ງວ່າຂໍ້ມູນມາຄົບ:
```sql
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'test_orders', COUNT(*) FROM test_orders
UNION ALL
SELECT 'test_results', COUNT(*) FROM test_results;
```

## ສຳຄັນ

- **REST restore ໃຊ້ upsert** -- ບໍ່ລົບຂໍ້ມູນເກົ່າ ແຕ່ merge/overwrite ຖ້າ id ກົງກັນ ຖ້າຕ້ອງການເລີ່ມໃໝ່ໝົດ: ລົບ table ກ່ອນ
- **SQL dump restore** ຕ້ອງໃສ່ DB credentials ໃນ `.env` (`SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD`) ແລ້ວ `psql` ເທົ່າທີ່ຈະໃຊ້ໄດ້
- **Windows Task Scheduler** restore ໄດ້: `python.exe C:\Users\asus\Desktop\Project\HIS-sys-main\backup\restore.py backup-2025-01-15.zip`
