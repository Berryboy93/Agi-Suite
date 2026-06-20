#!/bin/bash
# scripts/fix-approval-events-schema.sh
# Fix approval_events table schema in test fixture

set -e

FIXTURE_FILE="packages/cli/__tests__/fixtures/db.fixture.ts"

if [ ! -f "$FIXTURE_FILE" ]; then
  echo "❌ Error: $FIXTURE_FILE not found"
  exit 1
fi

echo "🔧 Fixing approval_events schema in $FIXTURE_FILE..."

# Add 'resource TEXT,' after approval_id in the CREATE TABLE statement
sed -i '' \
  '/CREATE TABLE IF NOT EXISTS approval_events/,/)/s/approval_id TEXT NOT NULL,/approval_id TEXT NOT NULL,\n    resource TEXT,/' \
  "$FIXTURE_FILE"

echo "✅ Schema fixed successfully!"
echo "📝 Change: Added 'resource TEXT,' column to approval_events table"
echo ""
echo "Running tests to verify the fix..."
cd packages/cli && pnpm test __tests__/integration/approve-workflow.test.ts
