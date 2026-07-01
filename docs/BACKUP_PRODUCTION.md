# HIS System — Production Backup Guide

## Architecture

```
Supabase PostgreSQL
       │
       ├── pg_dump → .sql  ─┐
       ├── psql COPY → .csv ─┼──→ zip → Google Drive
       └─── github actions ──┘          └──→ Supabase Storage (database-backups)
```

Backup runs on **GitHub Actions** only.
Auto-scheduled daily at 12:00 AM **or** manual `workflow_dispatch`.
**No files are committed to this repo.**

---

## Required GitHub Secrets

Go to: `GitHub repo > Settings > Secrets and variables > Actions`

| Secret | Required | How to get |
|--------|----------|------------|
| `SUPABASE_HOST` | ✅ | From connection string: `db.xxxxx.supabase.co` |
| `SUPABASE_PASSWORD` | ✅ | From connection string (after last `:`) |
| `SUPABASE_URL` | ✅ | Full URL: `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Dashboard → Settings → API → `service_role` key |
| `SUPABASE_STORAGE_BUCKET` | ✅ | Bucket name where backups go (e.g. `database-backups`) |
| `GOOGLE_DRIVE_CREDENTIALS_JSON` | ✅ | Service account JSON (one line) |
| `GOOGLE_DRIVE_FOLDER_ID` | ✅ | From Drive folder URL |

### Get Supabase credentials
1. Dashboard → Settings → Database
2. **Connection string** → Transaction mode
3. Host = `db.xxxxx.supabase.co`
4. Password = value after last `:` before `/postgres`
5. Settings → API → copy `service_role` (secret) key

### Get Google Drive credentials
1. Google Cloud → Credentials → Create Service Account → Key → JSON
2. Share Drive folder with service account email as **Editor**
3. Folder ID = last part of URL: `drive.google.com/drive/folders/<THIS>`

### Create Supabase Storage bucket
1. Dashboard → Storage → **new bucket**
2. Name: `database-backups`
3. Keep it **private** (no public access)
4. No need to create folder — workflow creates `backups/YYYY/MM/`

---

## Manual Trigger

### UI Method
Repo → **Actions** → "Supabase DB Backup" → **Run workflow**

### API Method
```bash
curl -X POST \
  -H "Authorization: Bearer {PAT}" \
  https://api.github.com/repos/{OWNER}/{REPO}/actions/workflows/supabase-backup.yml/dispatches \
  -d '{"ref":"main"}'
```

---

## Restore from Backup

### Download from Google Drive
1. Open Google Drive folder
2. Download `backup-YYYY-MM-DD.zip`
3. Extract

### Download from Supabase Storage
```bash
# Using Supabase CLI or curl
curl -o backup.zip \
  -H "Authorization: Bearer {service_role_key}" \
  "https://xxxxx.supabase.co/storage/v1/object/database-backups/backups/2025/01/backup-2025-01-15.zip"
```

### SQL Restore
```bash
unzip backup-2025-01-15.zip
PGPASSWORD="your_password" psql \
  -h db.xxxxx.supabase.co -p 6543 -U postgres -d postgres \
  -f output/sql/full-backup-2025-01-15.sql
```

### CSV Restore
```bash
PGPASSWORD="your_password" psql \
  -h db.xxxxx.supabase.co -p 6543 -U postgres -d postgres \
  -c "\copy public.patients FROM output/csv/patients.csv csv header"
```

---

## Cloudflare Deployment

HIS runs on Cloudflare Pages (static site). No changes needed — backup UI works the same way:
- **Backup Now** → opens GitHub Actions or triggers API dispatch
- **Show status** → reads GH Actions API for last run result
- **Show destinations** → both Google Drive and Supabase Storage

---

## File Map

| File | Purpose |
|------|---------|
| `.github/workflows/supabase-backup.yml` | GH Actions workflow |
| `backup/scripts/gdrive_upload.py` | Upload to Google Drive |
| `backup/scripts/gdrive_cleanup.py` | Cleanup GDrive > 30 days |
| `backup/scripts/supabase_cleanup.py` | Cleanup Supabase > 30 days |
| `public/partials/views/backup.html` | Admin UI |
| `docs/BACKUP_PRODUCTION.md` | This guide |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| pg_dump connection refused | Check `SUPABASE_HOST`, no IP restriction blocking GitHub runners |
| Google Drive 403 | Share folder with service account email as Editor |
| Supabase Storage 401 | Verify `SUPABASE_SERVICE_ROLE_KEY` is correct (not anon key) |
| Backup not uploading | Check workflow step `continue-on-error: true` — verify step logs |
| Workflow won't trigger | Ensure workflow file is on `main` branch |
| Backup page shows red "Failed to fetch" in local dev | Expected — see "Local dev behaviour" below. The `/api/backup/*` Functions only exist when deployed or under `npm run pages:dev`. As of 2026-07-01 the UI degrades gracefully instead of erroring. |

---

## Local dev behaviour (2026-07-01)

The Backup view (`/backup`) talks to **Cloudflare Pages Functions** at `/api/backup/*`
(`status`, `runs`, `list`, `gdrive-list`, `run`, `signed-url`, `restore`). These routes
**do not exist under plain `vite dev`** (port 5174) — only when the app is deployed to
Cloudflare Pages, or when running `npm run build && npm run pages:dev` locally.

Previously each panel did a bare `fetch()` and, when the route was missing, surfaced a
`TypeError: Failed to fetch` (or choked on Vite's HTML SPA fallback breaking `resp.json()`),
showing scary red errors on every panel even though nothing was actually broken.

**Fix:** all backup fetches now go through one resilient helper:

- `window._backupApiFetch(url, opts)` → returns `{ unavailable: true }` for any network
  failure / `404` / non-JSON response, otherwise `{ ok, status, data }`.
- `window._backupUnavailableRow(colspan)` → a single clean "API ໃຊ້ໄດ້ສະເພາະຕອນ deploy
  ຫຼື `npm run pages:dev`" table row.

Rewired callers: `loadLatestBackupStatus`, `renderBackupHistory`, `loadBackupFileList`,
`loadGdriveBackupList`, `runManualBackup`. **No behaviour change in production** — when the
Functions respond normally the helper just passes their JSON through. Backup remains a
deploy-only feature (requires GH token + Supabase service-role key + optional Google service
account); local dev now shows a clear, non-alarming message instead of looking broken.
