#!/usr/bin/env bash
# ============================================================
# HIS System — Create Supabase Storage Bucket
# ============================================================
# Creates 'database-backups' bucket via Supabase Admin API.
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BUCKET_NAME="${1:-database-backups}"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Supabase Storage Bucket Creator${NC}"
echo -e "${GREEN}  Bucket: $BUCKET_NAME${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Try to read from environment or .env file
load_env() {
  if [ -f ".env" ]; then
    set -a; source .env; set +a
  fi
  if [ -f "backup/.env" ]; then
    set -a; source backup/.env; set +a
  fi
}

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  load_env
  SUPABASE_URL="${SUPABASE_URL:-}"
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
fi

# Fallback: try to read from GitHub secrets via gh cli
if [ -z "$SUPABASE_URL" ]; then
  SUPABASE_URL=$(gh secret list 2>/dev/null | grep "^SUPABASE_URL" | awk -F'=' '{print $2}' || echo "")
fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  SUPABASE_SERVICE_ROLE_KEY=$(gh secret list 2>/dev/null | grep "^SUPABASE_SERVICE_ROLE_KEY" | awk -F'=' '{print $2}' || echo "")
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}✖  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY${NC}"
  echo ""
  echo -e "Set them via:"
  echo "  export SUPABASE_URL=https://xxxxx.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  echo "  Or put them in backup/.env"
  echo ""
  exit 1
fi

SUPABASE_URL=$(echo "$SUPABASE_URL" | sed 's|/$||')

echo -e "${YELLOW}→ Checking if bucket '$BUCKET_NAME' exists...${NC}"

# List buckets
list_resp=$(curl -s -w "\n%{http_code}" \
  "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

http_code=$(echo "$list_resp" | tail -1)
body=$(echo "$list_resp" | sed '$d')

if echo "$body" | grep -q "\"name\":\"$BUCKET_NAME\"\|\"name\": \"$BUCKET_NAME\""; then
  echo -e "${GREEN}✓  Bucket '$BUCKET_NAME' already exists.${NC}"
  exit 0
fi

echo -e "${YELLOW}→ Creating bucket '$BUCKET_NAME'...${NC}"

create_resp=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/storage/v1/bucket" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$BUCKET_NAME\",\"public\":false}")

create_code=$(echo "$create_resp" | tail -1)
create_body=$(echo "$create_resp" | sed '$d')

if [ "$create_code" = "200" ] || [ "$create_code" = "201" ]; then
  echo -e "${GREEN}✓  Bucket '$BUCKET_NAME' created successfully!${NC}"
else
  echo -e "${RED}✖  Failed to create bucket (HTTP $create_code):${NC}"
  echo "  $create_body"
  exit 1
fi
