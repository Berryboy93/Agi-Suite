#!/usr/bin/env bash
# Phase 2 — Hardening implementation script
# Run from ~/Agi-Suite root
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAGE="$ROOT/../phase2-staging"  # adjust if you move the staging dir
echo "=== Phase 2 — Hardening ==="

# ── FR-022 + FR-016: openapi, auth, app, routes ────────────────────────────────
echo "→ FR-022 / FR-016: error responses + auth"
cp "$STAGE/openapi.yaml"       lib/api-spec/openapi.yaml
cp "$STAGE/auth.ts"            artifacts/api-server/src/middlewares/auth.ts
cp "$STAGE/app.ts"             artifacts/api-server/src/app.ts
cp "$STAGE/routes-index.ts"    artifacts/api-server/src/routes/index.ts

# ── FR-021: DB schema + metrics route ─────────────────────────────────────────
echo "→ FR-021: DB persistence"
cp "$STAGE/db-schema.ts"       lib/db/src/schema/index.ts
cp "$STAGE/metrics.ts"         artifacts/api-server/src/routes/metrics.ts

# ── FR-016 client side ─────────────────────────────────────────────────────────
echo "→ FR-016: client auth wiring"
mkdir -p artifacts/r3-agi/src/lib
cp "$STAGE/api-secret.ts"      artifacts/r3-agi/src/lib/api-secret.ts
cp "$STAGE/main.tsx"           artifacts/r3-agi/src/main.tsx

# ── FR-017: streaming cancel (AgentSuitePanel patches) ─────────────────────────
echo "→ FR-017: streaming cancel"
bash "$STAGE/agent-panel-patch.sh"

# ── FR-018: ESLint ────────────────────────────────────────────────────────────
echo "→ FR-018: ESLint"
cp "$STAGE/eslint.config.js"   eslint.config.js

# ── FR-019: api-zod tests ─────────────────────────────────────────────────────
echo "→ FR-019: api-zod tests"
cp "$STAGE/api-zod-generated.ts"    lib/api-zod/src/generated/api.ts
cp "$STAGE/api.test.ts"             lib/api-zod/src/generated/api.test.ts
cp "$STAGE/api-zod-vitest.config.ts" lib/api-zod/vitest.config.ts

# ── FR-020: CI ────────────────────────────────────────────────────────────────
echo "→ FR-020: CI pipeline"
mkdir -p .github/workflows
cp "$STAGE/ci.yml"             .github/workflows/ci.yml

echo ""
echo "=== Files applied. Now run: ==="
echo "  1. Add env vars (see below)"
echo "  2. pnpm add -D -w eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks eslint-config-prettier"
echo "  3. Verify @workspace/db package name (see metrics.ts import note)"
echo "  4. pnpm --filter @workspace/db generate   # create migration"
echo "  5. pnpm --filter @workspace/db push       # apply to dev DB"
echo "  6. pnpm install"
echo "  7. pnpm typecheck"
echo "  8. pnpm lint"
echo "  9. pnpm test"
