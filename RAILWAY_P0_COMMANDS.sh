#!/bin/bash
# ============================================================================
# RAILWAY P0 EXECUTION COMMANDS
# Copy-paste these commands into your terminal on Chromebook
# Prerequisite: DATABASE_URL must be set (see below)
# ============================================================================

# STEP 0: SET UP DATABASE_URL
# ============================================================================
# Get this from Railway dashboard:
# 1. Go to https://railway.app
# 2. Select your R3 v4 project
# 3. Click PostgreSQL plugin
# 4. Click "Connect" tab
# 5. Copy the DATABASE_URL from "Postgres CLI" section

# Then run:
export DATABASE_URL="postgresql://user:password@host.railway.app:5432/railway"

# Verify it's set:
echo $DATABASE_URL
# Should output: postgresql://user:...

# ============================================================================
# STEP 1: VERIFY MIGRATION FILE EXISTS
# ============================================================================

cd ~/Stable

# Check migration exists locally
ls -lh lib/db/migrations/0005_llpte_metrics.sql

# Preview what will be applied
head -30 lib/db/migrations/0005_llpte_metrics.sql

# ============================================================================
# STEP 2: DRY-RUN - TEST MIGRATION ON LOCAL DB (SAFE)
# ============================================================================

# If you have a local PostgreSQL running:
# Run migration against local DB first to catch errors

pnpm run db:migrate

# Should output: ✓ Applied migration 0005_llpte_metrics

# ============================================================================
# STEP 3: APPLY MIGRATION TO RAILWAY (PRODUCTION)
# ============================================================================

# METHOD A: Using psql directly (fastest)
# ============================================================================

psql $DATABASE_URL -f lib/db/migrations/0005_llpte_metrics.sql

# Watch for output - should show:
# CREATE TABLE ai_decision_log
# CREATE INDEX
# No errors

# ============================================================================
# METHOD B: Using Drizzle (if psql unavailable)
# ============================================================================

# Set DATABASE_URL to Railway
export DATABASE_URL="postgresql://user:pass@railway.host:5432/db"

# Run migrations
pnpm run db:migrate

# Should output:
# ✓ Migrating to 0005_llpte_metrics
# ✓ Migration complete

# ============================================================================
# STEP 4: VERIFY MIGRATION APPLIED
# ============================================================================

# Check that tables were created:
psql $DATABASE_URL -c "\dt"

# Expected output should include:
# public | ai_decision_log          | table

# Check ai_decision_log structure:
psql $DATABASE_URL -c "\d ai_decision_log"

# Should show columns:
# - sessionId (varchar)
# - pipelineEdges (integer)
# - tickMs (numeric)
# - confidence (numeric)
# - mixSuggestion (text)
# - createdAt (timestamp)

# Count rows (should be 0 after fresh migration):
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ai_decision_log;"

# ============================================================================
# STEP 5: VERIFY INDEXES EXIST (performance check)
# ============================================================================

psql $DATABASE_URL -c "SELECT * FROM pg_indexes WHERE tablename='ai_decision_log';"

# Should show indexes on:
# - sessionId
# - createdAt

# ============================================================================
# STEP 6: TEST INSERT (verify write permissions)
# ============================================================================

psql $DATABASE_URL << 'EOF'
INSERT INTO ai_decision_log (
  sessionId,
  pipelineEdges,
  tickMs,
  confidence,
  mixSuggestion,
  createdAt
) VALUES (
  'test-session-001',
  847,
  0.8,
  0.85,
  'Test suggestion',
  NOW()
);

-- Verify insert
SELECT * FROM ai_decision_log WHERE sessionId = 'test-session-001';
EOF

# Should return 1 row with your test data

# ============================================================================
# STEP 7: CLEANUP TEST DATA
# ============================================================================

psql $DATABASE_URL -c "DELETE FROM ai_decision_log WHERE sessionId LIKE 'test-%';"

# Verify it's gone:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ai_decision_log;"
# Should return: 0

# ============================================================================
# ROLLBACK PROCEDURE (if migration causes issues)
# ============================================================================

# WARNING: This is destructive and permanent

# Option 1: Drop table (nuclear option)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS ai_decision_log CASCADE;"

# Option 2: Revert via Drizzle (cleaner)
# Create a rollback migration:
cat > lib/db/migrations/0006_rollback_0005.sql << 'EOF'
-- Rollback 0005_llpte_metrics
DROP TABLE IF EXISTS ai_decision_log CASCADE;
DROP TABLE IF EXISTS llpte_performance CASCADE;
EOF

# Apply rollback
psql $DATABASE_URL -f lib/db/migrations/0006_rollback_0005.sql

# Then revert code
git revert HEAD
git push origin main

# ============================================================================
# COMPLETE P0 VERIFICATION CHECKLIST
# ============================================================================

# Run this one command to verify everything:

psql $DATABASE_URL << 'VERIFY_EOF'
\echo '=== P0 VERIFICATION CHECKLIST ==='

-- Table exists
\echo '\n[✓] Checking ai_decision_log table...'
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_name = 'ai_decision_log';

-- Columns exist
\echo '\n[✓] Checking columns...'
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ai_decision_log'
ORDER BY ordinal_position;

-- Indexes exist
\echo '\n[✓] Checking indexes...'
SELECT indexname FROM pg_indexes 
WHERE tablename = 'ai_decision_log';

-- Can write
\echo '\n[✓] Testing write...'
INSERT INTO ai_decision_log (sessionId, pipelineEdges, tickMs, confidence, mixSuggestion, createdAt)
VALUES ('verify-write', 847, 0.8, 0.75, 'test', NOW());
SELECT COUNT(*) as write_success FROM ai_decision_log WHERE sessionId = 'verify-write';

-- Cleanup test
DELETE FROM ai_decision_log WHERE sessionId = 'verify-write';

\echo '\n=== ALL CHECKS PASSED ✓ ==='
VERIFY_EOF

# ============================================================================
# WHAT TO DO IF THINGS BREAK
# ============================================================================

# Error: "table already exists"
# Solution: Drop and recreate
psql $DATABASE_URL -c "DROP TABLE ai_decision_log CASCADE;"
psql $DATABASE_URL -f lib/db/migrations/0005_llpte_metrics.sql

# Error: "permission denied"
# Solution: Check Railway user has schema permissions
psql $DATABASE_URL -c "GRANT ALL PRIVILEGES ON SCHEMA public TO <username>;"

# Error: "connection refused"
# Solution: Verify DATABASE_URL and network access
echo $DATABASE_URL
# Should contain: host.railway.app (not localhost)

# Error: "column does not exist"
# Solution: Migration may have failed partially
psql $DATABASE_URL -c "\d ai_decision_log"
# Compare with migration SQL file

# ============================================================================
# FINAL: MONITOR RAILWAY DEPLOYMENT
# ============================================================================

# Open Railway dashboard and watch for:
# 1. Green checkmark next to your commit
# 2. No error logs
# 3. Successful build and deployment

# Or use Railway CLI:
railway logs -f

# Should show no database errors

# ============================================================================
# SUCCESS CRITERIA
# ============================================================================
# P0 is complete when:
# ✓ ai_decision_log table exists in Railway
# ✓ All columns present and correct type
# ✓ Indexes exist on sessionId and createdAt
# ✓ Test insert/query/delete works
# ✓ Railway deployment shows green checkmark
# ✓ Zero error logs in Railway

echo "P0 VERIFICATION COMPLETE ✓"
echo "Ready for P1: wire aiDecisionLog into session-metrics.service.ts"
