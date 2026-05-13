# 🚀 Backup Quick Setup (5 ขั้นตอน)

## ขั้นตอนที่ 1: ติดตั้ง GitHub CLI

https://cli.github.com/

```bash
brew install gh        # macOS
sudo apt install gh    # Ubuntu/WSL
choco install gh       # Windows
```

## ขั้นตอนที่ 2: Login GitHub

```bash
gh auth login
# เลือก HTTPS + paste token หรือ browser login
```

## ขั้นตอนที่ 3: รัน Setup Wizard

```bash
cd HIS-sys-main
chmod +x scripts/setup-backup-secrets.sh
./scripts/setup-backup-secrets.sh
```

Wizard จะถามค่าทีละตัว แล้ว upload เป็น GitHub Secrets อัตโนมัติ:
- `SUPABASE_HOST`
- `SUPABASE_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_CREDENTIALS_JSON`

## ขั้นตอนที่ 4: (Optional) สร้าง Storage Bucket

```bash
chmod +x scripts/create-supabase-backup-bucket.sh
./scripts/create-supabase-backup-bucket.sh
```

หรือสร้างเองผ่าน Supabase Dashboard: Storage → New Bucket → `database-backups`

## ขั้นตอนที่ 5: ทดสอบ

```bash
gh workflow run supabase-backup.yml --ref main
```

หรือเปิด GitHub → Actions → **Supabase DB Backup** → Run workflow

ดูผลลัพธ์ที่: GitHub → Actions → คลิกล่าสุด

---

## ค่าที่ต้องการ

### Supabase

| ค่า | ได้จากไหน |
|-----|----------|
| `HOST` | Settings → Database → Connection string |
| `PASSWORD` | Connection string หลัง `:` |
| `URL` | Settings → API → Project URL |
| `SERVICE_ROLE_KEY` | Settings → API → `service_role` key |
| `STORAGE_BUCKET` | ชื่อ bucket ที่ต้องการ (เช่น `database-backups`) |

### Google Drive

| ค่า | ได้จากไหน |
|-----|----------|
| `FOLDER_ID` | จาก URL ของโฟลเดอร์ Drive |
| `CREDENTIALS_JSON` | GCP Console → Service Account → Keys → JSON |
