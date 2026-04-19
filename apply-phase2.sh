#!/usr/bin/env bash

set -euo pipefail

echo "=================================================="
echo "🧠 Adaptive DAG Intelligence System v1"
echo "=================================================="

# --------------------------------------------------
# 1. ROOT + SNAPSHOT SAFETY
# --------------------------------------------------
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ ROOT: $ROOT"

SNAPSHOT_DIR="$ROOT/.repo_snapshots"
mkdir -p "$SNAPSHOT_DIR"

SNAPSHOT_ID="$(date +%Y%m%d_%H%M%S)"
SNAPSHOT_PATH="$SNAPSHOT_DIR/$SNAPSHOT_ID.tar.gz"

echo "→ Creating snapshot: $SNAPSHOT_ID"
tar -czf "$SNAPSHOT_PATH" . >/dev/null 2>&1 || true

# --------------------------------------------------
# 2. STAGE RESOLUTION (INTELLIGENT DISCOVERY)
# --------------------------------------------------
echo ""
echo "=============================="
echo "🧭 STAGE DISCOVERY"
echo "=============================="

CANDIDATES=(
  "$HOME/Downloads/phase2"
  "$HOME/Downloads"
  "$HOME/Agi-Suite/phase2-staging"
)

STAGE=""

for dir in "${CANDIDATES[@]}"; do
  if [ -d "$dir" ]; then
    if ls "$dir"/*.{ts,yaml,sh} >/dev/null 2>&1; then
      STAGE="$dir"
      break
    fi
  fi
done

if [ -z "$STAGE" ]; then
  echo "❌ No valid staging source found"
  exit 1
fi

STAGE="$(realpath "$STAGE")"
echo "→ STAGE: $STAGE"

# --------------------------------------------------
# 3. ADAPTIVE DAG GENERATION ENGINE
# --------------------------------------------------
echo ""
echo "=============================="
echo "🧠 GENERATING ADAPTIVE DAG"
echo "=============================="

NODES=()

# Detect API layer
if ls "$STAGE"/*api*.ts >/dev/null 2>&1; then
  NODES+=("api_layer")
fi

# Detect routing layer
if ls "$STAGE"/*route*.ts >/dev/null 2>&1; then
  NODES+=("routing_layer")
fi

# Detect DB layer
if ls "$STAGE"/*db*.ts >/dev/null 2>&1; then
  NODES+=("db_layer")
fi

# Detect UI layer
if ls "$STAGE"/*.tsx >/dev/null 2>&1; then
  NODES+=("ui_layer")
fi

# Detect CI layer
if [ -f "$STAGE/ci.yml" ]; then
  NODES+=("ci_layer")
fi

echo "→ Adaptive Nodes Generated:"
printf ' - %s\n' "${NODES[@]}"

# --------------------------------------------------
# 4. SAFE EXECUTION ENGINE
# --------------------------------------------------
safe_cp () {
  mkdir -p "$(dirname "$2")"
  cp "$1" "$2"
}

run_api_layer() {
  echo "→ [NODE] api_layer"
  safe_cp "$STAGE/openapi.yaml" lib/api-spec/openapi.yaml
  safe_cp "$STAGE/auth.ts" artifacts/api-server/src/middlewares/auth.ts
  safe_cp "$STAGE/app.ts" artifacts/api-server/src/app.ts
}

run_routing_layer() {
  echo "→ [NODE] routing_layer"
  safe_cp "$STAGE/routes-index.ts" artifacts/api-server/src/routes/index.ts
  safe_cp "$STAGE/metrics.ts" artifacts/api-server/src/routes/metrics.ts
}

run_db_layer() {
  echo "→ [NODE] db_layer"
  safe_cp "$STAGE/db-schema.ts" lib/db/src/schema/index.ts
}

run_ui_layer() {
  echo "→ [NODE] ui_layer"
  safe_cp "$STAGE/main.tsx" artifacts/r3-agi/src/main.tsx
  mkdir -p artifacts/r3-agi/src/components
}

run_ci_layer() {
  echo "→ [NODE] ci_layer"
  mkdir -p .github/workflows
  safe_cp "$STAGE/ci.yml" .github/workflows/ci.yml
  safe_cp "$STAGE/eslint.config.js" eslint.config.js
}

# --------------------------------------------------
# 5. ADAPTIVE EXECUTION ENGINE
# --------------------------------------------------
echo ""
echo "=============================="
echo "⚙️ EXECUTING ADAPTIVE DAG"
echo "=============================="

for node in "${NODES[@]}"; do
  case "$node" in
    api_layer) run_api_layer ;;
    routing_layer) run_routing_layer ;;
    db_layer) run_db_layer ;;
    ui_layer) run_ui_layer ;;
    ci_layer) run_ci_layer ;;
  esac
done

# --------------------------------------------------
# 6. PARTIAL VERIFICATION ENGINE
# --------------------------------------------------
echo ""
echo "=============================="
echo "🔍 VERIFICATION ENGINE"
echo "=============================="

VERIFY_OK=true

CHECK_FILES=(
  "lib/api-spec/openapi.yaml"
  "artifacts/api-server/src/app.ts"
)

for f in "${CHECK_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    VERIFY_OK=false
  fi
done

if [ "$VERIFY_OK" = false ]; then
  echo "❌ Partial failure detected → rolling back"
  tar -xzf "$SNAPSHOT_PATH" -C "$ROOT"
  exit 1
fi

echo "✔ Core verification passed"

# --------------------------------------------------
# 7. TARGETED REPAIR ENGINE
# --------------------------------------------------
echo ""
echo "=============================="
echo "🧯 REPAIR ENGINE"
echo "=============================="

PATCH="$STAGE/agent-panel-patch.sh"

if [ -f "$PATCH" ]; then
  echo "→ Executing repair module"
  bash "$PATCH"
else
  echo "→ No repair module detected"
fi

# --------------------------------------------------
# 8. ADAPTIVE REPORT
# --------------------------------------------------
echo ""
echo "=============================="
echo "📊 ADAPTIVE REPORT"
echo "=============================="

cat > adaptive-dag-report.json <<EOF
{
  "status": "success",
  "mode": "adaptive-dag-v1",
  "stage": "$STAGE",
  "nodes_executed": ${#NODES[@]},
  "timestamp": "$(date -Iseconds)"
}
EOF

echo "=================================================="
echo "✅ ADAPTIVE DAG COMPLETE"
echo "📄 Report: adaptive-dag-report.json"
echo "=================================================="