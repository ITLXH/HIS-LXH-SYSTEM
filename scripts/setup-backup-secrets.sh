#!/usr/bin/env bash
# ============================================================
# HIS System — Backup Secrets Setup Wizard
# ============================================================
# Sets up all GitHub Actions secrets for the backup workflow.
# Requires: gh CLI (GitHub CLI) logged in.
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")

if [ -z "$repo" ]; then
  echo -e "${RED}✖  GitHub CLI not logged in or not in a repo.${NC}"
  echo ""
  echo -e "${YELLOW}Before running this script:${NC}"
  echo "  1. Install GitHub CLI: https://cli.github.com/"
  echo "  2. Run: gh auth login"
  echo "  3. cd into this repo"
  echo ""
  exit 1
fi

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  HIS Backup Setup Wizard${NC}"
echo -e "${GREEN}  Repo: $repo${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# ── Helper: ask secret ─────────────────────────────────────
ask() {
  local key="$1" desc="$2" required="${3:-true}"
  local val=""

  echo -e "${BLUE}?${NC} $desc"
  if [ "$required" = "mask" ]; then
    # For long tokens, read into variable without echo
    read -r val </dev/tty
  else
    read -r val </dev/tty
  fi

  val="${val:-}"
  val="$(echo "$val" | xargs)"

  if [ -z "$val" ] && [ "$required" = "true" ]; then
    echo -e "${RED}  ⚠  Value required, skipping.${NC}"
    return
  fi
  if [ -z "$val" ] && [ "$required" != "true" ]; then
    echo -e "${YELLOW}  (empty — will be skipped)${NC}"
    return
  fi

  echo -e "${GREEN}  ✓  Setting $key = ***(masked)***${NC}"
  echo "$val" | gh secret set "$key" --repo "$repo" 2>/dev/null \
    || echo -e "${RED}    ✖ Failed to set $key${NC}"
}

# ── Supabase ──────────────────────────────────────────────
echo -e "${YELLOW}--- Supabase Database ---${NC}"
ask "SUPABASE_HOST"           "Supabase DB Host (e.g. db.xxxxxxxx.supabase.co):" "true"
ask "SUPABASE_PASSWORD"        "Supabase DB Password:" "mask"
echo ""

echo -e "${YELLOW}--- Supabase API / Storage ---${NC}"
ask "SUPABASE_URL"             "Supabase Project URL (e.g. https://xxxxxxx.supabase.co):" "true"
ask "SUPABASE_SERVICE_ROLE_KEY" "Supabase service_role key (starts with eyJ...):" "mask"
ask "SUPABASE_STORAGE_BUCKET"   "Storage bucket name (default: database-backups):"
echo ""

# ── Google Drive ──────────────────────────────────────────
echo -e "${YELLOW}--- Google Drive ---${NC}"
ask "GOOGLE_DRIVE_FOLDER_ID"   "Google Drive Folder ID (from folder URL):"
echo ""
echo -e "${BLUE}?${NC} Google Drive Service Account JSON (paste full JSON, press Ctrl-D when done):"
json_input=$(cat </dev/tty 2>/dev/null || echo "")
json_input="$(echo "$json_input" | tr -d '\n' | xargs)"
if [ -n "$json_input" ]; then
  echo -e "${GREEN}  ✓  Setting GOOGLE_DRIVE_CREDENTIALS_JSON = ***(masked)***${NC}"
  echo "$json_input" | gh secret set GOOGLE_DRIVE_CREDENTIALS_JSON --repo "$repo" 2>/dev/null \
    || echo -e "${RED}    ✖ Failed to set GOOGLE_DRIVE_CREDENTIALS_JSON${NC}"
else
  echo -e "${YELLOW}  (empty — Google Drive upload will be skipped)${NC}"
fi

# ── Summary ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Done! Secrets uploaded to GitHub Actions.${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Verify:  gh secret list --repo ${BLUE}${repo}${NC}"
echo ""
echo -e "  Next: Trigger a backup:"
echo -e "  1. Go to Actions → ${YELLOW}Supabase DB Backup${NC} → Run workflow"
echo -e "  2. Or run: ${BLUE}gh workflow run supabase-backup.yml --repo $repo${NC}"
echo ""
echo -e "  Docs:  ${BLUE}docs/BACKUP_QUICK_SETUP.md${NC}"
echo ""
