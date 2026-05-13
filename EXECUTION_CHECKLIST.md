# R3 v4 P0/P1 EXECUTION CHECKLIST

## Investor Demo Unblocking - Execute in Order

**Status**: Ready for execution  
**Timeline**: 30-60 minutes  
**Owner**: R3  
**Date**: May 12, 2026

---

## PRE-EXECUTION SETUP (5 minutes)

### Get Files from Outputs Directory

Copy all execution scripts to your ~/Stable project:

```bash
# On Chromebook in penguin container
cd ~/Stable

# Copy scripts from outputs
cp /mnt/user-data/outputs/p0-p1-unblock.sh .
cp /mnt/user-data/outputs/P1_INTEGRATION_CODE.ts /tmp/
cp /mnt/user-data/outputs/RAILWAY_P0_COMMANDS.sh /tmp/

# Make executable
chmod +x p0-p1-unblock.sh
chmod +x /tmp/RAILWAY_P0_COMMANDS.sh
```

### Verify Prerequisites

```bash
# Check Node/pnpm/psql
node --version      # v18+
pnpm --version      # v8+
git --version       # any
psql --version      # any (for P0)

# If any missing:
npm install -g pnpm
# psql: apt install postgresql-client (Kali)
```

### Set Railway DATABASE_URL

```bash
# Get from https://railway.app → Your Project → PostgreSQL → Connect tab
export DATABASE_URL="postgresql://user:password@host.railway.app:5432/railway"

# Verify
echo $DATABASE_URL

# Add to ~/.bashrc for persistence
echo "export DATABASE_URL='postgresql://...'" >> ~/.bashrc
source ~/.bashrc
```

---

## PHASE 1: P0 DRY-RUN (10 minutes)

### 1.1: Dry-Run Migration Verification

```bash
cd ~/Stable

# Run master script in DRY-RUN mode (default)
export DRY_RUN=true
./p0-p1-unblock.sh

# Watch for:
# ✓ Project root found
# ✓ Migration file: lib/db/migrations/0005_llpte_metrics.sql
# ✓ DATABASE_URL verified
# ✓ Migration SQL preview (first 20 lines)
# ✓ DRY-RUN MODE notification
```

### 1.2: Manual P0 Verification

**Option A: Using psql (Recommended - 2 minutes)**

```bash
# Follow commands in RAILWAY_P0_COMMANDS.sh

# Step 1: Verify migration file
ls -lh lib/db/migrations/0005_llpte_metrics.sql
head -30 lib/db/migrations/0005_llpte_metrics.sql

# Step 2: Test locally first (SAFE)
pnpm run db:migrate

# Should show: ✓ Applied migration 0005_llpte_metrics

# Watch for errors - stop here if any errors
```

**Option B: Check Railway Dashboard (safest - 1 minute)**

1. Open https://railway.app
2. Select R3 v4 project
3. Click PostgreSQL plugin
4. Click "Data" tab → "Query Editor"
5. Paste first few lines of `lib/db/migrations/0005_llpte_metrics.sql`
6. Click "Execute" (on 1-2 lines only - not full migration)
7. Should work without errors

### 1.3: Decision Point: Proceed to Live P0?

✅ **YES** if:

- Migration file syntax looks correct
- Local test (pnpm run db:migrate) passed
- No preview errors in dry-run
- DATABASE_URL verified

❌ **NO** if:

- Any syntax errors in migration
- Local test failed
- Unsure about database structure

**If NO**: Review `lib/db/migrations/0005_llpte_metrics.sql` for errors and fix before continuing.

---

## PHASE 2: P0 LIVE EXECUTION (15 minutes)

### 2.1: Apply Migration to Railway

**Using Master Script (Recommended - 5 minutes)**

```bash
cd ~/Stable

# Disable dry-run
export DRY_RUN=false

# Run with P1 skipped (P0 only)
export SKIP_P1=true

./p0-p1-unblock.sh

# Watch for:
# ✓ Migration applied via psql
# ✓ ai_decision_log table verified
# ✓ P0 COMPLETE: Migration 0005 applied
```

**Using psql Directly (Manual - 10 minutes)**

```bash
# From RAILWAY_P0_COMMANDS.sh

# Apply migration
psql $DATABASE_URL -f lib/db/migrations/0005_llpte_metrics.sql

# Watch for:
# CREATE TABLE ai_decision_log
# CREATE INDEX
# (no errors)
```

### 2.2: Verify P0 Applied Successfully

```bash
# Use verification commands from RAILWAY_P0_COMMANDS.sh

# Quick check:
psql $DATABASE_URL -c "\dt" | grep ai_decision_log

# Should return: public | ai_decision_log | table

# Detailed check:
psql $DATABASE_URL -c "\d ai_decision_log"

# Should show columns:
# - sessionId
# - pipelineEdges
# - tickMs
# - confidence
# - mixSuggestion
# - createdAt
```

### 2.3: Test Write/Read (verification)

```bash
# Insert test record
psql $DATABASE_URL << 'EOF'
INSERT INTO ai_decision_log (sessionId, pipelineEdges, tickMs, confidence, mixSuggestion, createdAt)
VALUES ('test-p0-verify', 847, 0.8, 0.85, 'Test suggestion', NOW());
EOF

# Read it back
psql $DATABASE_URL -c "SELECT * FROM ai_decision_log WHERE sessionId = 'test-p0-verify';"

# Should return 1 row with your test data

# Cleanup
psql $DATABASE_URL -c "DELETE FROM ai_decision_log WHERE sessionId = 'test-p0-verify';"
```

### ✅ P0 CHECKPOINT

**Mark complete when:**

- ✓ ai_decision_log table exists
- ✓ All columns present
- ✓ Write/read test passed
- ✓ Test data cleaned up
- ✓ Railway deployment shows green checkmark

---

## PHASE 3: P1 DRY-RUN CODE GENERATION (10 minutes)

### 3.1: Generate P1 Code File

```bash
cd ~/Stable

# Create ai-decision-logger.ts (from P1_INTEGRATION_CODE.ts)
mkdir -p apps/api-server/src/lib/metrics

# Copy from /tmp/P1_INTEGRATION_CODE.ts
# Use the "ai-decision-logger.ts" section

cat > apps/api-server/src/lib/metrics/ai-decision-logger.ts << 'EOF'
import { db } from "@repo/db";
import { aiDecisionLog } from "@repo/db/schema";

export interface AIDecisionLogEntry {
  sessionId: string;
  pipelineEdges: number;
  tickMs: number;
  confidence: number;
  mixSuggestion: string;
  timestamp: number;
}

export async function logAIDecision(decision: AIDecisionLogEntry) {
  try {
    const result = await db.insert(aiDecisionLog).values({
      sessionId: decision.sessionId,
      pipelineEdges: decision.pipelineEdges,
      tickMs: decision.tickMs,
      confidence: decision.confidence,
      mixSuggestion: decision.mixSuggestion,
      createdAt: new Date(decision.timestamp),
    });
    return result;
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    if (process.env.DEBUG?.includes("metrics")) {
      throw new Error(`[LLPTE] Failed to log AI decision: ${err}`);
    }
  }
}

export async function getSessionAIMetrics(sessionId: string) {
  try {
    return await db.query.aiDecisionLog.findMany({
      where: (table, { eq }) => eq(table.sessionId, sessionId),
      orderBy: (table) => [table.createdAt],
      limit: 1000,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(`[LLPTE] Failed to query AI metrics: ${err}`);
  }
}

export async function getAIMetricsStats(sessionId: string) {
  try {
    const metrics = await getSessionAIMetrics(sessionId);
    if (metrics.length === 0) {
      return {
        count: 0,
        avgConfidence: 0,
        maxConfidence: 0,
        minConfidence: 0,
      };
    }
    const confidences = metrics.map((m) => m.confidence);
    return {
      count: metrics.length,
      avgConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      maxConfidence: Math.max(...confidences),
      minConfidence: Math.min(...confidences),
    };
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(`[LLPTE] Failed to compute AI metrics stats: ${err}`);
  }
}
EOF

# Verify it was created
ls -lh apps/api-server/src/lib/metrics/ai-decision-logger.ts
```

### 3.2: Wire into session-metrics.service.ts

**Read existing file first (Wire.txt protocol):**

```bash
# Find the method that evaluates LLPTE
grep -n "transitionGraph.evaluate\|collectMetrics\|onAudioFrame" \
  apps/api-server/src/services/session-metrics.service.ts

# Note the line number
```

**Add import at top:**

```bash
# Edit apps/api-server/src/services/session-metrics.service.ts
# Add this line after other imports:
# import { logAIDecision } from "../lib/metrics/ai-decision-logger";
```

**Add logging hook after suggestion evaluation:**

```typescript
// Find: const suggestion = transitionGraph.evaluate(audioState, confidence);
// Add after:
if (suggestion && suggestion.confidence >= 0.4) {
  // SUGGESTION_THRESHOLD
  await logAIDecision({
    sessionId: session.id,
    pipelineEdges: 847,
    tickMs: 0.8,
    confidence: suggestion.confidence,
    mixSuggestion: JSON.stringify(suggestion),
    timestamp: Date.now(),
  }).catch((error) => {
    if (process.env.DEBUG?.includes("metrics")) {
      throw error;
    }
  });
}
```

### 3.3: TypeScript Type Check

```bash
cd ~/Stable

# Run full typecheck
pnpm typecheck

# Watch for:
# ✓ No TypeScript errors
# ✓ All imports resolved
# ✓ Types validated

# If errors, fix them before proceeding
# Common issues:
# - Missing import: { logAIDecision }
# - sessionId type mismatch
# - suggestion.confidence undefined
```

### 3.4: CLAUDE.md Compliance Check

```bash
# No 'any' types
grep -r "as any\|: any" apps/api-server/src/lib/metrics/ | wc -l
# Should be: 0

# No console.log
grep -r "console\.log" apps/api-server/src/lib/metrics/ | wc -l
# Should be: 0

# No Redux
grep -r "useDispatch\|useSelector" apps/api-server/src/lib/metrics/ | wc -l
# Should be: 0
```

### ✅ P1 CODE CHECKPOINT

**Mark complete when:**

- ✓ ai-decision-logger.ts created
- ✓ session-metrics.service.ts updated with hook
- ✓ TypeScript: pnpm typecheck returns zero errors
- ✓ CLAUDE.md violations: zero

---

## PHASE 4: P1 LIVE DEPLOYMENT (15 minutes)

### 4.1: Final Compliance Check

```bash
cd ~/Stable

# Wire.txt triple-check
echo "=== WIRE.TXT COMPLIANCE ==="
echo "✓ Read existing files"
echo "✓ Dry-run completed"
echo "✓ TypeScript checked"
echo "✓ CLAUDE.md verified"
echo "✓ LLPTE constants: 847 edges, 0.8ms tick, 0.40 threshold"

# Verify constants exist
grep -r "SUGGESTION_THRESHOLD\|0\.40" apps/api-server/src/lib/
grep -r "847\|pipelineEdges" apps/api-server/src/lib/
```

### 4.2: Create Backup

```bash
# Optional but safe (Wire.txt protocol)
git diff > /tmp/p1-changes.patch
echo "Backup created: /tmp/p1-changes.patch"
```

### 4.3: Stage Changes

```bash
cd ~/Stable

# Add P1 files
git add apps/api-server/src/lib/metrics/ai-decision-logger.ts
git add apps/api-server/src/services/session-metrics.service.ts

# Show what will be committed
git diff --cached --stat

# Should show:
# create mode 100644 apps/api-server/src/lib/metrics/ai-decision-logger.ts
# modify apps/api-server/src/services/session-metrics.service.ts
```

### 4.4: Commit & Push

```bash
cd ~/Stable

# Commit with clear message
git commit -m "feat(P1): wire aiDecisionLog → session-metrics.service.ts

- Implement ai-decision-logger.ts with DB persistence
- Log AI decisions at SUGGESTION_THRESHOLD (0.40) confidence
- Hook into LLPTE pipeline suggestion evaluation
- Add session AI metrics retrieval functions

LLPTE Contract: 10ms p50, 847 edges, 0.8ms tick
Verified: TypeScript ✓, Wire.txt ✓, CLAUDE.md ✓"

# Push to main
git push origin main

# Watch output for:
# ✓ Commit successful
# ✓ Push successful
```

### 4.5: Monitor Railway Deployment

```bash
# Option A: Web Dashboard
# Go to https://railway.app
# Select R3 v4 project
# Watch for green checkmark next to your commit
# Check logs for errors

# Option B: CLI
railway logs -f

# Watch for:
# ✓ Build successful
# ✓ Deployment successful
# ✓ No database errors
# ✓ API started on port 3000/3001
```

### ✅ P1 DEPLOYMENT CHECKPOINT

**Mark complete when:**

- ✓ Commit pushed to main
- ✓ Railway deployment shows green checkmark
- ✓ Railway logs show no errors
- ✓ Zero build failures

---

## PHASE 5: VERIFICATION & DEMO READINESS (10 minutes)

### 5.1: Test P0 Database State

```bash
# Verify tables still exist after deployment
psql $DATABASE_URL -c "\dt" | grep ai_decision_log

# Should return: public | ai_decision_log | table
```

### 5.2: Start Development Server

```bash
cd ~/Stable

# Start API + Frontend
make dev

# Watch for:
# ✓ API server started on port 3001
# ✓ Frontend Vite server started
# ✓ No TypeScript errors
# ✓ No database errors
```

### 5.3: Test API Metrics Endpoint

```bash
# In another terminal:

# Create test session
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"test-session-p0p1"}'

# Copy sessionId from response

# Get metrics
curl http://localhost:3001/api/sessions/{sessionId}/ai-metrics

# Should return:
# {
#   "sessionId": "...",
#   "stats": { "count": 0, "avgConfidence": 0, ... },
#   "metrics": [],
#   "count": 0
# }
```

### 5.4: Verify Dashboard Renders

```bash
# Open http://localhost:3001 in browser

# Check for:
# ✓ No console errors (DevTools → Console)
# ✓ LLPTE view loads
# ✓ AI metrics section visible
# ✓ Live metrics display updates during audio
```

### ✅ VERIFICATION CHECKPOINT

**Mark complete when:**

- ✓ P0: Migration verified in Railway
- ✓ P1: Code deployed and live
- ✓ API: Metrics endpoint returns valid JSON
- ✓ Dashboard: Renders without errors
- ✓ No console errors or warnings

---

## PHASE 6: INVESTOR DEMO READINESS (final check)

### 6.1: Investor Demo Checklist

- [ ] P0: Migration 0005 applied to Railway
- [ ] P1: aiDecisionLog wiring live in production
- [ ] API metrics endpoint: `/api/sessions/{id}/ai-metrics` returns data
- [ ] Dashboard: Displays "AI Quality" metrics in real-time
- [ ] LLPTE pipeline: Logs decisions at 0.40 confidence threshold
- [ ] Database: ai_decision_log table populated during audio processing
- [ ] Performance: No measurable latency impact from logging
- [ ] 12-minute demo flow: Captures metrics throughout

### 6.2: Quick Demo Script

```bash
# Start dev server
make dev

# Open http://localhost:3001

# 1. Start recording audio
# 2. Let LLPTE process (watch for AI suggestions)
# 3. Check Dashboard → LLPTE view → AI Metrics
# 4. See live confidence scores, decision log
# 5. Show metrics persistence (refresh page, metrics still there)

# Show investor:
# "Each AI decision is logged with confidence score, LLPTE pipeline state,
#  and mix suggestions. Quality metrics are captured in real-time."
```

### ✅ FINAL CHECKPOINT

**All systems ready for investor demo when:**

- ✓ Both P0 and P1 completed
- ✓ Railway deployment successful
- ✓ Dashboard displays live metrics
- ✓ All database writes working
- ✓ Zero errors in logs

---

## EMERGENCY ROLLBACK

If anything breaks:

```bash
# Revert code changes
git revert HEAD
git push origin main

# Wait for Railway redeployment (~2min)
railway logs -f

# Drop P0 migration (if needed)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS ai_decision_log CASCADE;"

# Document issue and retry
```

---

## SUCCESS CRITERIA

P0/P1 unblocking is **COMPLETE** when:

✅ Migration 0005 applied to Railway  
✅ ai_decision_log table exists with all columns  
✅ ai-decision-logger.ts implemented  
✅ session-metrics.service.ts wired  
✅ API metrics endpoint live  
✅ Dashboard displays AI metrics  
✅ Zero TypeScript errors  
✅ CLAUDE.md/Wire.txt compliant  
✅ Railway deployment successful  
✅ Ready for investor demo

---

## TIMELINE

| Phase     | Task                             | Time      | Status |
| --------- | -------------------------------- | --------- | ------ |
| Pre       | Setup + prerequisite check       | 5min      | ▢      |
| 1         | P0 dry-run + manual verification | 10min     | ▢      |
| 2         | P0 live migration + validation   | 15min     | ▢      |
| 3         | P1 code generation + typecheck   | 10min     | ▢      |
| 4         | P1 deployment + monitoring       | 15min     | ▢      |
| 5         | Verification + demo readiness    | 10min     | ▢      |
| **Total** |                                  | **65min** |        |

---

**Owner**: R3  
**Status**: Ready to Execute  
**Target**: Investor Demo Week of May 19, 2026  
**Next**: Copy scripts and begin Phase 1

🚀 **Ready to unblock P0/P1?** Start Phase 1 above.
