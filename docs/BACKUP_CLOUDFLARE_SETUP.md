# HIS Backup System — Production Setup Guide

## Overview

The HIS backup system runs automatically via **GitHub Actions** daily at midnight UTC, and can be triggered manually through the **Backup Now** button in the admin dashboard.

```
Admin Dashboard (Backup Now)
  └── POST /api/backup/run
        └── Cloudflare Function (server-side, token hidden)
              └── GitHub API → workflow_dispatch
                    └── GitHub Actions → Supabase Storage (CSV/ZIP)
```

Backup files are stored in **Supabase Storage** bucket with timestamped filenames.

---

## Architecture

### Frontend (Static — Cloudflare Pages)
- `public/partials/views/backup.html` — Admin-only backup page
- `src/main.js` — Backup UI functions (SweetAlert polling, history)
- **No secrets or tokens in frontend bundle**

### Backend Proxy (Cloudflare Functions)
- `functions/api/backup/run.js` — Triggers GitHub Actions workflow_dispatch
- `functions/api/backup/status.js` — Returns latest workflow run status
- `functions/_utils/gh-api.js` — GitHub API helper (uses server-side env vars)

### CI/CD Pipeline
- `.github/workflows/supabase-backup.yml` — GitHub Actions workflow
  - Exports all HIS tables to CSV via Supabase REST API
  - Creates ZIP archive with timestamped filename
  - Uploads to Supabase Storage bucket
  - Runs daily at `0 0 * * *` (midnight UTC)

---

## Required Environment Variables (Cloudflare Pages)

Set these in Cloudflare Pages dashboard → Settings → Environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKUP_GH_OWNER` | GitHub owner/org name | `it977` |
| `BACKUP_GH_REPO` | GitHub repository name | `HIS-sys` |
| `BACKUP_GH_TOKEN` | GitHub PAT with `repo` scope | `ghp_xxxx...` |
| `BACKUP_WORKFLOW_FILE` | Workflow filename (optional) | `supabase-backup.yml` |

### Generating the GitHub Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Create a new **Fine-grained personal access token**
3. Select the target repository (e.g., `it977/HIS-sys`)
4. Grant **Actions → Read and write** permissions
5. Copy the token and set it as `BACKUP_GH_TOKEN` in Cloudflare Pages

> **Security:** The token is only used in Cloudflare Functions (server-side). It is **never** sent to the browser or included in the frontend bundle.

### Required GitHub Secrets

These must already be configured in the GitHub repo:

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for REST API access |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (e.g., `backups`) |

---

## Setup Instructions

### 1. Enable Cloudflare Functions

The project uses Cloudflare Pages Functions. Ensure your `public/` directory is set as the build output, and the `functions/` directory is present at the project root.

Cloudflare will automatically detect and deploy functions from the `functions/` directory.

### 2. Set Cloudflare Environment Variables

In Cloudflare Pages dashboard:
1. Go to your project → **Settings** → **Environment variables**
2. Add the 4 variables listed above
3. Redeploy the project for changes to take effect

```bash
# Or via Wrangler CLI:
wrangler pages secret put BACKUP_GH_TOKEN
wrangler pages secret put BACKUP_GH_OWNER
wrangler pages secret put BACKUP_GH_REPO
wrangler pages secret put BACKUP_WORKFLOW_FILE
```

### 3. Deploy

```bash
npm run build
# Upload dist/ to Cloudflare Pages
# functions/ will be auto-deployed with Pages Functions
```

---

## API Endpoints

### POST /api/backup/run

Trigger a manual backup. Admin-only.

**Request:** POST (no body needed)
```http
POST /api/backup/run
```

**Response:**
```json
{ "success": true, "message": "Backup started" }
```

**Error:**
```json
{ "success": false, "error": "GitHub API 401: Bad credentials" }
```

### GET /api/backup/status

Get the latest workflow run status.

**Response:**
```json
{
  "status": "success",
  "run_id": 25803088436,
  "run_number": 42,
  "created_at": "2026-05-13T13:44:45Z",
  "updated_at": "2026-05-13T13:45:16Z",
  "trigger": "workflow_dispatch",
  "html_url": "https://github.com/it977/HIS-sys/actions/runs/25803088436",
  "duration": 31,
  "error": null
}
```

Possible `status` values: `success`, `failure`, `in_progress`, `queued`, `none`, `error`

---

## Frontend UX Flow

1. Admin clicks **Backup Now** button
2. SweetAlert shows: *"ກຳລັງ backup ຂໍ້ມູນ..."* with loading spinner
3. POST `/api/backup/run` → triggers GitHub Actions
4. Polls `GET /api/backup/status` every 10 seconds
5. On **success**: SweetAlert shows *"Backup ສຳເລັດ"* with run details
6. On **failure**: SweetAlert shows *"Backup ບໍ່ສຳເລັດ"* with error message
7. Backup history table updates automatically (cached in localStorage)

**The user never leaves the backup page — no redirects, no new tabs.**

---

## Backup History

Backup run history is stored in `localStorage` under key `his_backup_history`. Each entry contains:

- `id` — GitHub run ID
- `date` — ISO timestamp
- `filename` — Backup filename
- `size` — File size
- `status` — `success` | `failure` | `running`
- `destination` — Always `Supabase Storage`
- `error` — Error message (if failed)

Maximum 50 entries. Automatically refreshed on each page load and after each backup.

---

## Local Development

To test the backup UI locally without Cloudflare:

```bash
# Run Vite dev server
npm run dev
# Access http://localhost:5173
# Login as admin → click Backup
```

⚠️ The API endpoints (`/api/backup/run`, `/api/backup/status`) will return 404 locally since Cloudflare Functions are not running. You can mock them by creating `functions/` locally with Wrangler:

```bash
wrangler pages dev dist/ --local
```

This serves both the static site and the Cloudflare Functions locally.

---

## Security

- ✅ GitHub token is **server-side only** in Cloudflare Functions
- ✅ Token is **never** included in frontend JavaScript bundle
- ✅ Backup page is **admin-only** (checked in `currentUser.role`)
- ✅ API endpoints are only accessible through Cloudflare Functions (not exposed via GitHub)
- ✅ No secrets committed to repository
