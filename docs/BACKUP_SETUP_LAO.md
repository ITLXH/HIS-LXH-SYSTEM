# สรุปการเปลี่ยนแปลง Backup System

## UX ใหม่ — Admin กดปุ่มเดียว เสร็จในหน้า

### สิ่งที่เกิดขึ้นเมื่อ Admin กด "Backup Now":

```
1. Admin กດ "Backup Now"
   ↓
2. SweetAlert 加载: "ກຳລັງ backup ຂໍ້ມູນ..."
   ↓
3. POST /api/backup/run
   └── Cloudflare Function (server-side, ບໍ່ມີ token ໃນ browser)
         └── GitHub API → workflow_dispatch
               └── GitHub Actions → Supabase Storage
   ↓
4. Poll GET /api/backup/status ແຕ່ລະ 10 ວິນາທີ
   └── ໃນຂະນະນັ້ນ: SweetAlert ສະແດງ "Workflow ກຳລັງຮັນ... (10s)"
   ↓
5a. ຖ້າ success → SweetAlert "Backup ສຳເລັດ" + Run # + ເວລາ
5b. ຖ້າ failure → SweetAlert "Backup ບໍ່ສຳເລັດ" + error message
   ↓
6. Backup History table ອັບເດດອັດຕະໂນມັດ
```

**ບໍ່ມີ redirect, ບໍ່ມີ open new tab, ບໍ່ອອກຈາກໜ້າ backup.**

---

## Files ທີ່ແກ້/ສ້າງໃໝ່

| File | Status | Description |
|------|--------|-------------|
| `functions/api/backup/run.js` | ✅ New | POST endpoint → trigger workflow_dispatch |
| `functions/api/backup/status.js` | ✅ New | GET endpoint → return latest run status |
| `functions/_utils/gh-api.js` | ✅ New | GitHub API helper (server-side, token ຢູ່ນີ້) |
| `functions/package.json` | ✅ New | Cloudflare Functions package |
| `src/main.js` | ✅ Modified | Backup JS functions (322 lines, polling + history) |
| `public/partials/views/backup.html` | ✅ Modified | Backup page UI (simpled: 1 button + status + history) |
| `docs/BACKUP_CLOUDFLARE_SETUP.md` | ✅ New | Full setup guide for Cloudflare env vars |
| `backup/backup-config.example.js` | ✅ Modified | Depracation notice |
| `backup/backup-config-template.js` | ✅ Modified | Depracation notice |

---

## Security Check ✅

```
✅ BACKUP_GH_TOKEN: 0 occurrences in frontend bundle
✅ BACKUP_GH_OWNER: 0 occurrences in frontend bundle
✅ BACKUP_GH_REPO: 0 occurrences in frontend bundle
✅ Token stays in Cloudflare Functions (server-side only)
✅ Admin-only access in initBackupView()
```

---

## ວິທີ Test

### 1. Local dev (ບໍ່ມີ Cloudflare Functions):
```bash
npm run dev
# ເຂົ້າໜ້າ backup → ກົດ Backup Now
# API ຈະ return 404 (expected, ເພາະບໍ່ມີ CF Functions locally)
```

### 2. Local with Wrangler (ມີ CF Functions):
```bash
npm run build
wrangler pages dev dist/ --local
# ຕັ້ງຄ່າ env vars ໃນ wrangler.toml ຫຼື .env
```

### 3. Production (Cloudflare Pages):
```
1. ຕັ້ງຄ່າ env vars ໃນ Cloudflare Pages dashboard:
   - BACKUP_GH_OWNER = it977
   - BACKUP_GH_REPO  = HIS-sys
   - BACKUP_GH_TOKEN = ghp_xxx...
   - BACKUP_WORKFLOW_FILE = supabase-backup.yml

2. Deploy dist/ + functions/ ໄປ Cloudflare Pages

3. Admin ເຂົ້າໜ້າ Backup → ກົດ Backup Now

4. ຄາດຫວັງຜົນ:
   ✅ SweetAlert loading: "ກຳລັງ backup ຂໍ້ມູນ..."
   ✅ Polling ແຕ່ລະ 10 ວິນາທີ
   ✅ ຖ້າสำเร็จ: "Backup ສຳເລັດ" + Run #
   ✅ ຖ້າລົ້ມເຫຼວ: "Backup ບໍ່ສຳເລັດ" + error
   ✅ History table ອັບເດດ
   ✅ ບໍ່ມີ redirect ຫຼື open tab ໃໝ່
```

---

## Environment Variables ທີ່ຕ້ອງຕັ້ງຄ່າ

### Cloudflare Pages Settings → Environment variables:

```
BACKUP_GH_OWNER      = it977
BACKUP_GH_REPO       = HIS-sys
BACKUP_GH_TOKEN      = ghp_xxx...  (Fine-grained PAT, Actions: Read+Write)
BACKUP_WORKFLOW_FILE = supabase-backup.yml
```

### GitHub Repository Secrets (ຍັງຕ້ອງການ):
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```
