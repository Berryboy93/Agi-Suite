#!/bin/bash

echo "=========================================="
echo "  R3v4 + Agi-Suite Diagnostic Report"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# === R3V4 PROJECT ===
echo -e "${BLUE}=== R3v4 (Stable) ===${NC}"
if [ -d "$HOME/Stable" ]; then
  echo -e "${GREEN}✓ Found at ~/Stable${NC}"
  
  # Check key files
  echo ""
  echo "Key files:"
  [ -f "$HOME/Stable/.env" ] && echo "  ✓ .env exists" || echo "  ✗ .env missing"
  [ -f "$HOME/Stable/package.json" ] && echo "  ✓ package.json exists" || echo "  ✗ package.json missing"
  [ -d "$HOME/Stable/server" ] && echo "  ✓ /server directory exists" || echo "  ✗ /server missing"
  
  # Check for latency implementation
  echo ""
  echo "Latency implementation:"
  if [ -f "$HOME/Stable/server/lib/latency-buffer.ts" ]; then
    echo -e "${GREEN}  ✓ latency-buffer.ts exists${NC}"
    wc -l "$HOME/Stable/server/lib/latency-buffer.ts" | awk '{print "    Lines: " $1}'
  else
    echo -e "${RED}  ✗ latency-buffer.ts MISSING${NC}"
  fi
  
  # Check server routes
  if grep -q "latency" "$HOME/Stable/server/routes/internal.ts" 2>/dev/null; then
    echo -e "${GREEN}  ✓ Latency route in internal.ts${NC}"
  else
    echo -e "${YELLOW}  ? Latency route in internal.ts (not confirmed)${NC}"
  fi
  
else
  echo -e "${RED}✗ Not found at ~/Stable${NC}"
fi
echo ""

# === AGI-SUITE PROJECT ===
echo -e "${BLUE}=== Agi-Suite ===${NC}"
if [ -d "$HOME/Agi-Suite" ]; then
  echo -e "${GREEN}✓ Found at ~/Agi-Suite${NC}"
  
  # Check structure
  echo ""
  echo "Project structure:"
  [ -d "$HOME/Agi-Suite/apps" ] && echo "  ✓ /apps directory exists" || echo "  ✗ /apps missing"
  
  if [ -d "$HOME/Agi-Suite/apps/api-server" ]; then
    echo -e "${GREEN}  ✓ /apps/api-server exists${NC}"
    [ -f "$HOME/Agi-Suite/apps/api-server/.env" ] && echo "    ✓ .env exists" || echo "    ✗ .env missing"
    
    # Check for latency route
    if [ -f "$HOME/Agi-Suite/apps/api-server/src/routes/latency.ts" ]; then
      echo -e "${GREEN}    ✓ latency.ts exists${NC}"
      wc -l "$HOME/Agi-Suite/apps/api-server/src/routes/latency.ts" | awk '{print "      Lines: " $1}'
    else
      echo -e "${RED}    ✗ latency.ts MISSING${NC}"
    fi
  else
    echo -e "${YELLOW}  ? /apps/api-server (not confirmed)${NC}"
  fi
  
  if [ -d "$HOME/Agi-Suite/apps/r3-agi" ]; then
    echo -e "${GREEN}  ✓ /apps/r3-agi exists${NC}"
    
    # Check for dashboard component
    if [ -f "$HOME/Agi-Suite/apps/r3-agi/src/components/dashboards/LatencyDashboard.tsx" ]; then
      echo -e "${GREEN}    ✓ LatencyDashboard.tsx exists${NC}"
      wc -l "$HOME/Agi-Suite/apps/r3-agi/src/components/dashboards/LatencyDashboard.tsx" | awk '{print "      Lines: " $1}'
    else
      echo -e "${RED}    ✗ LatencyDashboard.tsx MISSING${NC}"
    fi
  else
    echo -e "${YELLOW}  ? /apps/r3-agi (not confirmed)${NC}"
  fi
else
  echo -e "${RED}✗ Not found at ~/Agi-Suite${NC}"
fi
echo ""

# === ENV SECRETS ===
echo -e "${BLUE}=== INTERNAL_SECRET Alignment ===${NC}"

r3_secret=""
agi_secret=""

if [ -f "$HOME/Stable/.env" ]; then
  r3_secret=$(grep "^INTERNAL_SECRET=" "$HOME/Stable/.env" | tail -1 | cut -d= -f2)
  [ -n "$r3_secret" ] && echo "R3v4: ${r3_secret:0:16}... (✓ set)" || echo "R3v4: $(tput setaf 1)NOT SET$(tput sgr0)"
else
  echo "R3v4: $(tput setaf 1).env not found$(tput sgr0)"
fi

if [ -f "$HOME/Agi-Suite/apps/api-server/.env" ]; then
  agi_secret=$(grep "^INTERNAL_SECRET=" "$HOME/Agi-Suite/apps/api-server/.env" | tail -1 | cut -d= -f2)
  [ -n "$agi_secret" ] && echo "Agi-Suite: ${agi_secret:0:16}... (✓ set)" || echo "Agi-Suite: $(tput setaf 1)NOT SET$(tput sgr0)"
else
  echo "Agi-Suite: $(tput setaf 1).env not found$(tput sgr0)"
fi

echo ""
if [ "$r3_secret" = "$agi_secret" ] && [ -n "$r3_secret" ]; then
  echo -e "${GREEN}✓ Secrets MATCH (inter-service calls will work)${NC}"
elif [ -z "$r3_secret" ] || [ -z "$agi_secret" ]; then
  echo -e "${YELLOW}⚠ One or both secrets are not set${NC}"
else
  echo -e "${RED}✗ Secrets MISMATCH (expect 401 errors)${NC}"
fi
echo ""

# === DUPLICATE ENTRIES CHECK ===
echo -e "${BLUE}=== Duplicate INTERNAL_SECRET Entries ===${NC}"
if [ -f "$HOME/Stable/.env" ]; then
  count=$(grep -c "^INTERNAL_SECRET=" "$HOME/Stable/.env" || echo 0)
  if [ "$count" -gt 1 ]; then
    echo -e "${YELLOW}⚠ WARNING: R3v4 .env has $count INTERNAL_SECRET entries${NC}"
    echo "Entries:"
    grep "^INTERNAL_SECRET=" "$HOME/Stable/.env" | nl
  elif [ "$count" -eq 1 ]; then
    echo -e "${GREEN}✓ R3v4 .env has exactly 1 INTERNAL_SECRET entry${NC}"
  fi
fi
echo ""

# === PORT STATUS ===
echo -e "${BLUE}=== Port Status ===${NC}"
for port in 3000 3001 5174 5176; do
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    pid=$(lsof -Pi :$port -sTCP:LISTEN -t | head -1)
    name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Port $port: LISTENING (PID $pid, $name)${NC}"
  else
    echo "  Port $port: available"
  fi
done
echo ""

echo "=========================================="
echo "End of Diagnostic Report"
echo "=========================================="