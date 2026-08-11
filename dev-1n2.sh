#!/bin/bash
set -e

echo "=========================================="
echo "  R3v4 + Agi-Suite Startup Validator"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill old processes on ports
echo "== Cleaning up stale processes =="
for port in 3000 3001 5174 5176; do
  pids=$(lsof -ti:$port 2>/dev/null || true)
  if [ ! -z "$pids" ]; then
    echo "Stopping process(es) on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
done
sleep 1
echo "✓ Ports cleared"
echo ""

# === VALIDATE R3v4 .ENV ===
echo "== Validating ~/Stable/.env =="
R3_ENV_FILE=~/Stable/.env
if [ ! -f "$R3_ENV_FILE" ]; then
  echo -e "${RED}✗ MISSING: $R3_ENV_FILE${NC}"
  exit 1
fi

# Count INTERNAL_SECRET entries
SECRET_COUNT=$(grep -c "^INTERNAL_SECRET=" "$R3_ENV_FILE" 2>/dev/null || echo 0)
echo "Found $SECRET_COUNT INTERNAL_SECRET entries"

if [ "$SECRET_COUNT" -gt 1 ]; then
  echo -e "${YELLOW}⚠ WARNING: Multiple INTERNAL_SECRET entries detected${NC}"
  echo "Current .env entries:"
  grep "^INTERNAL_SECRET=" "$R3_ENV_FILE" | nl
  echo ""
  echo "Keeping FIRST entry, removing duplicates..."
  
  # Extract the first INTERNAL_SECRET value
  FIRST_SECRET=$(grep "^INTERNAL_SECRET=" "$R3_ENV_FILE" | head -1)
  
  # Create temp file with first entry only
  temp_file=$(mktemp)
  grep -v "^INTERNAL_SECRET=" "$R3_ENV_FILE" > "$temp_file"
  echo "$FIRST_SECRET" >> "$temp_file"
  mv "$temp_file" "$R3_ENV_FILE"
  
  echo -e "${GREEN}✓ Cleaned up duplicates${NC}"
  echo "Using: $(grep '^INTERNAL_SECRET=' $R3_ENV_FILE)"
fi

R3_SECRET=$(grep "^INTERNAL_SECRET=" "$R3_ENV_FILE" | cut -d= -f2)
echo "R3v4 SECRET: ${R3_SECRET:0:16}..."
echo ""

# === VALIDATE Agi-Suite .ENV ===
echo "== Validating ~/Agi-Suite/apps/api-server/.env =="
AGI_ENV_FILE=~/Agi-Suite/apps/api-server/.env
if [ ! -f "$AGI_ENV_FILE" ]; then
  echo -e "${RED}✗ MISSING: $AGI_ENV_FILE${NC}"
  exit 1
fi

AGI_SECRET=$(grep "^INTERNAL_SECRET=" "$AGI_ENV_FILE" | cut -d= -f2)
echo "Agi-Suite SECRET: ${AGI_SECRET:0:16}..."
echo ""

# === COMPARE SECRETS ===
echo "== Comparing INTERNAL_SECRET alignment =="
if [ "$R3_SECRET" = "$AGI_SECRET" ]; then
  echo -e "${GREEN}✓ Secrets match (inter-service auth will work)${NC}"
else
  echo -e "${RED}✗ MISMATCH! Agi-Suite will fail to call R3v4 internal endpoints${NC}"
  echo "  R3v4:       $R3_SECRET"
  echo "  Agi-Suite:  $AGI_SECRET"
  echo ""
  echo "Fix: Update Agi-Suite to match R3v4 secret?"
  echo "  sed -i 's/^INTERNAL_SECRET=.*/INTERNAL_SECRET=$R3_SECRET/' $AGI_ENV_FILE"
  read -p "Apply fix? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    sed -i "s/^INTERNAL_SECRET=.*/INTERNAL_SECRET=$R3_SECRET/" "$AGI_ENV_FILE"
    AGI_SECRET=$(grep "^INTERNAL_SECRET=" "$AGI_ENV_FILE" | cut -d= -f2)
    echo -e "${GREEN}✓ Updated Agi-Suite secret${NC}"
  else
    echo -e "${RED}Continuing with mismatched secrets (401 errors likely)${NC}"
  fi
fi
echo ""

# === CHECK NODE VERSIONS ===
echo "== Checking Node.js environment =="
node_version=$(node -v)
pnpm_version=$(pnpm -v)
echo "Node: $node_version"
echo "pnpm: $pnpm_version"
echo ""

# === READY TO START ===
echo "=========================================="
echo -e "${GREEN}✓ Validation complete${NC}"
echo "=========================================="
echo ""
echo "To start servers, run in separate terminals:"
echo ""
echo "  Terminal 1 (R3v4):"
echo "    cd ~/Stable && pnpm dev"
echo ""
echo "  Terminal 2 (Agi-Suite):"
echo "    cd ~/Agi-Suite && pnpm dev"
echo ""
echo "Then visit:"
echo "  R3v4 Client:  http://localhost:5174/"
echo "  Agi-Suite:    http://localhost:5176/"
echo ""