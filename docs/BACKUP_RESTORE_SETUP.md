# Backup & Restore — full setup + verification

## Pipeline summary

Backup writes to **two destinations** (Google Drive is optional and is
skipped automatically when the credentials are missing):

```
                                                     ┌──── Supabase Storage  ✅ always
HIS app  ──▶  /api/backup/run  ──▶  supabase-backup.yml ────┤
(Pages)        (workflow_dispatch)   + cron 00:00 UTC       └──── Google Drive       (optional)
                                       │
                                       │ writes manifest + ZIP
                                       ▼
                                  output/backup-YYYY-MM-DD.zip


HIS app  ──▶  /api/backup/list           (Supabase Storage list)
         ──▶  /api/backup/gdrive-list    (Google Drive folder list)
         ──▶  /api/backup/signed-url     (10-min signed URL for download)
         ──▶  /api/backup/restore   {source: "supabase"|"gdrive", backup_name, gdrive_file_id, confirm: "RESTORE"}
                  │
                  ▼
            supabase-restore.yml  ──▶  restore_rest.py  ──▶  Supabase tables (upsert)
              (workflow_dispatch                              via REST API +
               only — never cron)                            Prefer: merge-duplicates
```

## What I changed (2026-06-29)

1. **Fixed the wrong repo defaults.** `functions/api/backup/run.js` and
   `status.js` had `owner='it977'`, `repo='HIS-sys'` baked in — that
   org/name does not exist. Changed defaults to **`ITLXH` / `HIS-LXH-SYSTEM`**
   (matches the current GitHub remote). Env vars `BACKUP_GH_OWNER` and
   `BACKUP_GH_REPO` still override.
2. **New `GET /api/backup/runs?limit=15`** — returns the last N workflow
   runs (success/failure/in_progress) so the History table is real data,
   not localStorage.
3. **New `GET /api/backup/list`** — lists ZIP files in the Supabase
   Storage bucket. Used by the Restore section.
4. **New `POST /api/backup/signed-url`** — issues a 10-minute signed URL
   so the user can download a backup ZIP directly from Supabase.
5. **New `POST /api/backup/restore`** — triggers the new restore
   workflow. Requires `{ backup_name, confirm: "RESTORE" }`. The literal
   string `"RESTORE"` is a manual safety gate.
6. **New `.github/workflows/supabase-restore.yml`** — workflow_dispatch
   only. Inputs: `backup_name` (required), `dry_run` (default false).
7. **New `backup/scripts/restore_rest.py`** — downloads the ZIP from
   Supabase Storage, walks `csv/*.csv`, and upserts each table via the
   REST API with `Prefer: resolution=merge-duplicates`.
8. **Backup view** ([public/partials/views/backup.html](../public/partials/views/backup.html))
   gained a **Restore** card (list of ZIPs + Download + Restore buttons)
   above the History table.
9. **`renderBackupHistory()`** in main.js switched from localStorage to
   `/api/backup/runs`. Six-column layout: date, Run #, status, trigger
   (Auto vs Manual), duration, link to GitHub run.
10. **`.dev.vars.example`** added for local Wrangler dev. `.dev.vars` is
    git-ignored.

## Local verification

```bash
# 1) Copy and fill in the local env
cp .dev.vars.example .dev.vars
#  edit .dev.vars and put:
#   BACKUP_GH_TOKEN=<your PAT with Actions read+write on ITLXH/HIS-LXH-SYSTEM>
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SUPABASE_STORAGE_BUCKET=his-backups

# 2) Build + serve with Functions
npm run build
npm run pages:dev    # serves on http://127.0.0.1:8788 by default

# 3) Open the app, log in as admin, go to Backup view.
#    - "Backup Now" should call /api/backup/run and start the workflow.
#    - "ປະຫວັດ Backup" should populate with real runs from GitHub.
#    - "ຄືນຄ່າ (Restore)" should list ZIPs from the bucket.
```

## Cloudflare Pages env vars (production)

In the Pages dashboard: **Settings → Environment variables → Production**

| Name | Required? | Value | Notes |
|---|---|---|---|
| `BACKUP_GH_TOKEN` | yes | PAT with Actions read+write on the repo | Encrypted. |
| `SUPABASE_URL` | yes | `https://<proj>.supabase.co` | Same project the JS frontend talks to. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | service-role JWT | Encrypted. |
| `SUPABASE_STORAGE_BUCKET` | yes | `his-backups` (or your bucket name) | Must already exist. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | optional | full JSON of the GCP service-account key | Encrypted. Enables the Google Drive list + restore. |
| `GOOGLE_DRIVE_FOLDER_ID` | optional | Drive folder ID | Folder must be shared with the service account email. |

(Optional overrides: `BACKUP_GH_OWNER`, `BACKUP_GH_REPO`,
`BACKUP_WORKFLOW_FILE`, `RESTORE_WORKFLOW_FILE`.)

## GitHub Actions secrets

Backup + restore workflows need:

| Name | Required? | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL of the Supabase that hosts HIS data + backup bucket. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key for the same project. |
| `SUPABASE_STORAGE_BUCKET` | yes | Bucket name where ZIPs are uploaded. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | optional | Enables Google Drive as second destination. |
| `GOOGLE_DRIVE_FOLDER_ID` | optional | Drive folder ID. Service account must be at least Editor. |

The Drive credentials are the **same** in both places (Cloudflare Pages
needs them for `/api/backup/gdrive-list`; GitHub Actions needs them for
the upload step in `supabase-backup.yml` and the optional Drive download
in `supabase-restore.yml`).

## Restore safety

- `/api/backup/restore` rejects the request unless `confirm === "RESTORE"`.
- The confirm dialog in the UI (`window.confirmRestoreBackup`) uses a
  SweetAlert input validator so the user must type **RESTORE** in caps.
- The workflow accepts a `dry_run` input — set to `true` in the GitHub
  UI to walk through the script without writing anything.
- Upsert mode (`Prefer: resolution=merge-duplicates`) means rows are
  matched by primary key and overwritten. Rows in production that do
  **not** appear in the backup are **left alone** (not deleted).
- For a "wipe and restore" you would also need TRUNCATE — not added
  here on purpose.

## Cron schedule

`.github/workflows/supabase-backup.yml` already runs at `0 0 * * *` UTC
(daily 00:00 UTC = 07:00 ICT). No change needed.

## Known limits

- `/api/backup/list` returns up to 100 newest objects in the bucket. If
  there are more, sort+filter happens server-side from Supabase Storage.
- The signed download URL lives 10 minutes by default — bump via
  `?expires=` if you need longer for very large ZIPs.
- The restore script only handles tables visible in the CSV — schema
  changes since the backup will fail with a 4xx from PostgREST. Use
  `dry_run=true` first when restoring an old backup.
