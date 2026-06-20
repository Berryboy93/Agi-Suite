#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

FIXTURE_FILE="$PROJECT_ROOT/packages/cli/__tests__/fixtures/db.fixture.ts"

if [ ! -f "$FIXTURE_FILE" ]; then
  echo "❌ Error: $FIXTURE_FILE not found"
  echo "   Current directory: $(pwd)"
  echo "   Project root: $PROJECT_ROOT"
  exit 1
fi

echo "🔧 Fixing approval_events schema..."
echo "   File: $FIXTURE_FILE"

sed -i '' \
  '/CREATE TABLE IF NOT EXISTS approval_events/,/)/s/approval_id TEXT NOT NULL,/approval_id TEXT NOT NULL,\n    resource TEXT,/' \
  "$FIXTURE_FILE"

echo "✅ Schema fixed!"
echo "Running tests..."
cd "$PROJECT_ROOT/packages/cli" && pnpm test __tests__/integration/approve-workflow.test.ts
