import { useState } from "react";
import { useAGI } from "../../store/useAGI";
import { Card } from "@/components/Card";

function CopyPre({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [, addLog] = [null, useAGI((s) => s.addLog)];

  function copy() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        addLog("COPY", code.substring(0, 60) + "...", "lt-cmd");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div style={{ position: "relative", margin: "8px 0" }}>
      <pre style={{ paddingRight: 48 }}>{code}</pre>
      <button
        onClick={copy}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          fontFamily: "var(--mono)",
          fontSize: 9,
          letterSpacing: 1,
          padding: "3px 8px",
          borderRadius: 2,
          cursor: "pointer",
          background: copied ? "rgba(16,185,129,.15)" : "rgba(163,230,53,.08)",
          color: copied ? "var(--done)" : "var(--accent)",
          border: `1px solid ${copied ? "rgba(16,185,129,.25)" : "rgba(163,230,53,.2)"}`,
          textTransform: "uppercase" as const,
        }}
      >
        {copied ? "COPIED" : "COPY"}
      </button>
    </div>
  );
}

const TABS = ["all", "tsc", "p0", "p1", "admin", "ambig"];
const TAB_LABELS = [
  "All",
  "TSC Bugs ×15",
  "Migration P0",
  "aiDecisionLog P1",
  "Admin ✓",
  "Ambiguities",
];

const TSC_BUGS = [
  {
    id: "BUG 4",
    file: "packages/llpte-signal/tsconfig.json",
    errors: 3,
    codes: "TS6305 ×3",
    step: 2,
    stepLabel: "Step 2 — Build shared, verify server",
    status: "open",
    tallyAfter: 11,
    detail:
      "shared/dist/ does not exist. llpte-signal is node 2 of the LLPTE pipeline. spectralAnalyzer — FFT/RMS/LUFS — is entirely dark until shared builds.",
    anchor: "No source change required — build order only.",
    cmd: `cd ~/R3v4
pnpm --filter shared exec tsc --build
ls ~/R3v4/shared/dist/   # must exist before continuing`,
    gate: `pnpm --filter llpte-signal exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS6305 ×3 gone)`,
  },
  {
    id: "BUG 5",
    file: "server/services/audio-analysis.ts",
    errors: 1,
    codes: "TS2307 ×1",
    step: 2,
    stepLabel: "Step 2 (same build gate)",
    status: "open",
    tallyAfter: 11,
    detail:
      "import { analyzeAudio } from '@llpte/llpte-signal' cannot resolve. Downstream consequence of BUG 4. Workspace symlink resolves once llpte-signal compiles.",
    anchor:
      "let AudioContext: any on line 18 carries a legitimate eslint-disable (no .d.ts). That exemption is not in scope here.",
    cmd: `pnpm --filter server exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0 — if TS2307 persists, run:
pnpm install --frozen-lockfile`,
    gate: `pnpm --filter server exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0`,
  },
  {
    id: "BUG 3",
    file: "packages/llpte-execution/tsconfig.json",
    errors: 2,
    codes: "TS6059 ×1 + TS6307 ×1",
    step: 3,
    stepLabel: "Step 3 — Fix llpte-execution/tsconfig.json",
    status: "open",
    tallyAfter: 9,
    detail:
      '"composite": true + "rootDir": "./src" conflict. AutoLevelExecutor.ts imports ../../../shared/auto-level.types — outside src/. llpte-execution is outputBus — node 5 of 5. A compile error silences the entire output stage.',
    anchor:
      "Fix: remove rootDir, add project reference to ../../shared. Same pattern as working llpte-signal tsconfig.",
    cmd: `# Anchor check:
grep -n "rootDir" ~/R3v4/packages/llpte-execution/tsconfig.json
# Expected: exactly one line at 15:    "rootDir": "./src"

# Apply patch (remove rootDir, add reference to ../../shared):
python3 patch_llpte_execution_tsconfig.py --apply`,
    gate: `pnpm --filter llpte-execution exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS6059 ×1 + TS6307 ×1 gone)`,
  },
  {
    id: "BUG 1",
    file: "packages/llpte-ai/src/AutoLevelEngine.ts:155",
    errors: 6,
    codes: "TS1005 ×2 direct + cascade ×4",
    step: 4,
    stepLabel: "Step 4 — Fix AutoLevelEngine.ts:155",
    status: "open",
    tallyAfter: 3,
    detail:
      "const declaration pasted inside the eq: EQSuggestion object literal. TypeScript cannot parse the object remainder. Cascade: llpte-ai (2) → llpte-core (2) → client (2) = 6 errors from one line.",
    anchor:
      "SUGGESTION_THRESHOLD = 0.40 is the confidence gate contract. At module scope it is named and inspectable. Inside a suggestion object it is invisible to the confidence check logic.",
    cmd: `# Anchor check:
grep -n "const SUGGESTION_THRESHOLD" ~/R3v4/packages/llpte-ai/src/AutoLevelEngine.ts
# Expected: 155:        const SUGGESTION_THRESHOLD = 0.40;

# Remove from object, hoist to module scope after import block:
python3 patch_autolevel_syntax.py          # dry-run first
python3 patch_autolevel_syntax.py --apply  # apply if clean`,
    gate: `pnpm --filter llpte-ai exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS1005 ×2 + cascade ×4 gone)
grep -n "minimumConfidence\\|SUGGESTION_THRESHOLD" packages/llpte-ai/src/AutoLevelEngine.ts
# Expected: SUGGESTION_THRESHOLD once at module scope — no duplicate`,
  },
  {
    id: "BUG 2",
    file: "client/src/pages/DAW.tsx:1840–1870",
    errors: 3,
    codes: "TS17014 + TS1381 + TS1005",
    step: 5,
    stepLabel: "Step 5 — Fix DAW.tsx JSX fragment (⛔ BLOCKED)",
    status: "blocked",
    tallyAfter: 0,
    detail:
      "JSX fragment <> opened at line 1840, never closed. Stray } at line 1868 breaks expression context. Origin: SessionChip / SessionSummaryPanel wiring. Client cannot compile — demo fails entirely.",
    anchor:
      "BLOCKED: must read DAW.tsx lines 1820–1875 before fix can be written. Fix is written from the paste output.",
    cmd: `# ⛔ READ FIRST — paste output before applying any fix:
cat -n ~/R3v4/client/src/pages/DAW.tsx | sed -n '1820,1875p'`,
    gate: `pnpm --filter client exec tsc --noEmit --pretty false 2>&1 | grep "error TS"
# Expected: 0  (TS17014 ×1 + TS1381 ×1 + TS1005 ×1 gone)`,
  },
];

function TscBugsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalErrors = TSC_BUGS.reduce((s, b) => s + b.errors, 0);

  return (
    <>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(255,61,113,.25)",
          borderRadius: 3,
          padding: "10px 14px",
          marginBottom: 13,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 8,
              letterSpacing: 2,
              color: "var(--dim)",
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            Wire.txt Protocol — PRD v4.0 §18.6 Hygiene Upgrade
          </div>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            TypeScript Error Resolution:{" "}
            <span style={{ color: "var(--bad)" }}>{totalErrors} errors</span> →{" "}
            <span style={{ color: "var(--accent)" }}>0 target</span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div
            style={{
              textAlign: "center",
              padding: "5px 10px",
              background: "rgba(255,61,113,.1)",
              border: "1px solid rgba(255,61,113,.2)",
              borderRadius: 3,
            }}
          >
            <div
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 800,
                fontSize: 16,
                color: "var(--bad)",
              }}
            >
              5
            </div>
            <div style={{ fontSize: 8, color: "var(--dim)", letterSpacing: 1 }}>
              BUGS
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "5px 10px",
              background: "rgba(255,61,113,.1)",
              border: "1px solid rgba(255,61,113,.2)",
              borderRadius: 3,
            }}
          >
            <div
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 800,
                fontSize: 16,
                color: "var(--bad)",
              }}
            >
              {totalErrors}
            </div>
            <div style={{ fontSize: 8, color: "var(--dim)", letterSpacing: 1 }}>
              TS ERRORS
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              padding: "5px 10px",
              background: "rgba(163,230,53,.06)",
              border: "1px solid rgba(163,230,53,.2)",
              borderRadius: 3,
            }}
          >
            <div
              style={{
                fontFamily: "var(--sans)",
                fontWeight: 800,
                fontSize: 16,
                color: "var(--accent)",
              }}
            >
              0
            </div>
            <div style={{ fontSize: 8, color: "var(--dim)", letterSpacing: 1 }}>
              TARGET
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          marginBottom: 13,
          overflow: "hidden",
        }}
      >
        <table style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Bug</th>
              <th>File</th>
              <th>Errors</th>
              <th>Type</th>
              <th>Step</th>
              <th>Tally After</th>
            </tr>
          </thead>
          <tbody>
            {TSC_BUGS.map((b) => (
              <tr
                key={b.id}
                style={{ cursor: "pointer" }}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <td
                  style={{
                    color:
                      b.status === "blocked" ? "var(--bad)" : "var(--warn)",
                    fontWeight: 700,
                  }}
                >
                  {b.id}
                </td>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--text2)",
                  }}
                >
                  {b.file}
                </td>
                <td style={{ color: "var(--bad)", fontWeight: 700 }}>
                  {b.errors}
                </td>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: "var(--violet)",
                  }}
                >
                  {b.codes}
                </td>
                <td style={{ color: "var(--text2)" }}>{b.step}</td>
                <td
                  style={{
                    color: b.tallyAfter === 0 ? "var(--accent)" : "var(--warn)",
                    fontWeight: 700,
                  }}
                >
                  {b.tallyAfter}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {TSC_BUGS.map((b) => (
        <div
          key={b.id}
          style={{
            border: `1px solid ${b.status === "blocked" ? "rgba(255,61,113,.3)" : "var(--bor2)"}`,
            borderRadius: 3,
            marginBottom: 10,
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setExpanded(expanded === b.id ? null : b.id)}
            style={{
              background: "rgba(255,255,255,.025)",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              borderBottom:
                expanded === b.id ? "1px solid var(--border)" : "none",
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 2,
                background:
                  b.status === "blocked"
                    ? "rgba(255,61,113,.12)"
                    : "rgba(245,158,11,.1)",
                color: b.status === "blocked" ? "var(--bad)" : "var(--warn)",
                border: `1px solid ${b.status === "blocked" ? "rgba(255,61,113,.2)" : "rgba(245,158,11,.2)"}`,
              }}
            >
              {b.id}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text2)",
              }}
            >
              {b.file}
            </span>
            <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: 4 }}>
              {b.codes}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 9,
                color: "var(--bad)",
                fontWeight: 700,
              }}
            >
              −{b.errors} errors
            </span>
            <span style={{ fontSize: 9, color: "var(--dim)", marginLeft: 6 }}>
              {expanded === b.id ? "▲" : "▼"}
            </span>
          </div>
          {expanded === b.id && (
            <div style={{ padding: "11px 12px", fontSize: 11 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  marginBottom: 5,
                }}
              >
                {b.stepLabel}
              </div>
              <p
                style={{
                  color: "var(--text2)",
                  lineHeight: 1.7,
                  marginBottom: 8,
                }}
              >
                {b.detail}
              </p>
              <p
                style={{
                  color: "var(--dim)",
                  fontSize: 10,
                  fontStyle: "italic",
                  marginBottom: 8,
                  borderLeft: "2px solid var(--border)",
                  paddingLeft: 8,
                }}
              >
                {b.anchor}
              </p>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                Commands
              </div>
              <CopyPre code={b.cmd} />
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  marginBottom: 3,
                  marginTop: 8,
                }}
              >
                TSC Gate
              </div>
              <CopyPre code={b.gate} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  padding: "5px 8px",
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                }}
              >
                <span style={{ fontSize: 9, color: "var(--dim)" }}>
                  Errors remaining after this step:
                </span>
                <span
                  style={{
                    fontFamily: "var(--sans)",
                    fontWeight: 800,
                    color: b.tallyAfter === 0 ? "var(--accent)" : "var(--warn)",
                  }}
                >
                  {b.tallyAfter}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      <Card
        title={
          <>
            <span style={{ color: "var(--violet)" }}>◈</span> PRD Gates Impacted
          </>
        }
      >
        {[
          {
            gate: "§0 Build State",
            req: "TSC: 0 errors",
            bug: "All 5 bugs",
            color: "var(--bad)",
          },
          {
            gate: "§6 AI Auto-Leveling",
            req: "Acceptance ≥65% — confidence gate at module scope",
            bug: "BUG 1",
            color: "var(--warn)",
          },
          {
            gate: "§8.5 LLPTE Contract",
            req: "Full pipeline compiles — all 5 nodes operational",
            bug: "BUG 3 + BUG 4",
            color: "var(--warn)",
          },
          {
            gate: "§18.6 Hygiene",
            req: "TSC errors: 0 target",
            bug: "All 5 bugs",
            color: "var(--bad)",
          },
          {
            gate: "§15 MVP Checklist",
            req: "Client compiles — SessionChip + SessionSummaryPanel render",
            bug: "BUG 2",
            color: "var(--bad)",
          },
        ].map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom: i < 4 ? "1px solid var(--border)" : "none",
              fontSize: 11,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flexShrink: 0,
                background: r.color,
                boxShadow: `0 0 5px ${r.color}`,
              }}
            />
            <div style={{ flex: 1, color: "var(--text)" }}>
              <strong>{r.gate}</strong> — {r.req}
            </div>
            <div style={{ fontSize: 9, color: "var(--dim)", flexShrink: 0 }}>
              {r.bug}
            </div>
          </div>
        ))}
      </Card>

      <Card
        title={
          <>
            <span style={{ color: "var(--accent)" }}>⚡</span> Step 6 — Final
            Verification
          </>
        }
      >
        <CopyPre
          code={`cd ~/R3v4

# 1. Full repo — must be zero
pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l

# 2. LLPTE confidence gates intact (PRD §8.5)
grep -n "SUGGESTION_THRESHOLD\\|0\\.40\\|0\\.65" packages/llpte-ai/src/AutoLevelEngine.ts

# 3. shared/dist confirmed
ls ~/R3v4/shared/dist/*.d.ts | head -5

# 4. rootDir removed from llpte-execution
grep "rootDir" ~/R3v4/packages/llpte-execution/tsconfig.json

# 5. Backup cleanup
find ~/R3v4 \\( -name "*.ts.bak-*" -o -name "*.json.bak-*" \\) | sort`}
        />
      </Card>
    </>
  );
}

export function PatchView() {
  const { activePatchTab, setPatchTab } = useAGI();

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--bor2)",
          marginBottom: 13,
          overflowX: "auto",
        }}
      >
        {TABS.map((t, i) => (
          <div
            key={t}
            onClick={() => setPatchTab(t)}
            style={{
              padding: "6px 13px",
              fontSize: 10,
              letterSpacing: 1,
              cursor: "pointer",
              textTransform: "uppercase" as const,
              whiteSpace: "nowrap",
              color: activePatchTab === t ? "var(--accent)" : "var(--text2)",
              borderBottom: `2px solid ${activePatchTab === t ? "var(--accent)" : "transparent"}`,
            }}
          >
            {TAB_LABELS[i]}
          </div>
        ))}
      </div>

      {activePatchTab === "all" && (
        <>
          {[
            {
              file: "Railway — pnpm drizzle-kit migrate",
              type: "P0 BLOCKER",
              typeCls: "edit",
              body: (
                <>
                  Apply <code>0005_overjoyed_gambit.sql</code> — creates{" "}
                  <code>ai_decision_log</code> (11 cols). Zero acceptance rate
                  until applied.
                </>
              ),
              code: 'cd ~/Stable\npnpm drizzle-kit migrate\n# Verify: psql $DATABASE_URL -c "\\d ai_decision_log"',
            },
            {
              file: "server/services/session-metrics.service.ts",
              type: "P1 — WIRE AILOG",
              typeCls: "edit",
              body: (
                <>
                  Wire <code>aiDecisionLog</code> INSERT calls. Every AI action
                  must write a row with 11 fields.
                </>
              ),
              code: "// Required fields (Wire.txt: read file first):\n{ id, sessionId, nodeId, actionType, trackId,\n  inputConfidence, displayedConfidence, decision,\n  outcome, latencyMs, timestamp }",
            },
            {
              file: "server/routers/adminRouter.ts",
              type: "DONE",
              typeCls: "done2",
              body: (
                <>
                  Admin tRPC router wired. <code>admin.checkAccess</code> +{" "}
                  <code>admin.agentChat</code> confirmed in procedures.ts.
                </>
              ),
            },
            {
              file: "server/routes/presets.ts",
              type: "P2 — ANY×4",
              typeCls: "edit",
              body: (
                <>
                  Lines 10,11,16,17: use <code className="bad">as any</code> on
                  Drizzle inserts. Fix:{" "}
                  <code>typeof effectPresetsTable.$inferInsert</code> typed
                  values.
                </>
              ),
            },
            {
              file: "server/index.ts:300-308",
              type: "P2 — CONSOLE.LOG×5",
              typeCls: "edit",
              body: (
                <>
                  Replace with morgan structured logger. Hard guard: no{" "}
                  <code>console.log</code> in committed code.
                </>
              ),
              code: "# Read first:\nsed -n '295,315p' ~/Stable/server/index.ts",
            },
          ].map((b, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--bor2)",
                borderRadius: 3,
                marginBottom: 11,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,.025)",
                  padding: "7px 11px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--red)",
                  }}
                >
                  {b.file}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 8,
                    letterSpacing: 2,
                    padding: "2px 6px",
                    borderRadius: 2,
                    ...(b.typeCls === "done2"
                      ? {
                          background: "rgba(16,185,129,.1)",
                          color: "var(--done)",
                          border: "1px solid rgba(16,185,129,.2)",
                        }
                      : b.typeCls === "edit"
                        ? {
                            background: "rgba(245,158,11,.1)",
                            color: "var(--warn)",
                            border: "1px solid rgba(245,158,11,.2)",
                          }
                        : {
                            background: "rgba(163,230,53,.1)",
                            color: "var(--good)",
                            border: "1px solid rgba(163,230,53,.2)",
                          }),
                  }}
                >
                  {b.type}
                </span>
              </div>
              <div
                style={{
                  padding: "11px 12px",
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.7,
                }}
              >
                {b.body}
                {b.code && <CopyPre code={b.code} />}
              </div>
            </div>
          ))}
        </>
      )}

      {activePatchTab === "tsc" && <TscBugsTab />}

      {activePatchTab === "p0" && (
        <Card title="P0 — Apply Migration 0005 to Railway">
          {[
            {
              dot: "warn",
              label: "Confirm Railway DATABASE_URL is in env",
              detail: "Required for migrate command to hit prod",
              dc: "warn",
            },
            {
              dot: "warn",
              label: "Verify .env has correct Railway DB URL (not localhost)",
              detail: "",
              dc: "warn",
            },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--warn)",
                  boxShadow: "0 0 5px var(--warn)",
                }}
              />
              <div style={{ flex: 1, color: "var(--text)" }}>{r.label}</div>
              {r.detail && (
                <div style={{ fontSize: 10, color: "var(--warn)" }}>
                  {r.detail}
                </div>
              )}
            </div>
          ))}
          <CopyPre
            code={
              'cd ~/Stable\n# Check which DB you\'re pointing at:\ngrep DATABASE_URL .env\n\n# If pointing at Railway (not localhost), run:\npnpm drizzle-kit migrate\n\n# Verify table was created:\npsql $DATABASE_URL -c "\\d ai_decision_log"'
            }
          />
        </Card>
      )}

      {activePatchTab === "p1" && (
        <Card title="P1 — Wire aiDecisionLog Writes">
          <p style={{ marginBottom: 10, color: "var(--text2)", fontSize: 11 }}>
            Wire.txt: read before write. Confirm exact service file location
            first.
          </p>
          <CopyPre
            code={
              '# Step 1: Read the service\ncat ~/Stable/server/services/session-metrics.service.ts\n\n# Step 2: Reference for existing db.insert pattern\ngrep -n "db.insert" ~/Stable/server/services/ -r'
            }
          />
        </Card>
      )}

      {activePatchTab === "admin" && (
        <Card
          title={
            <>
              Admin Suite —{" "}
              <span style={{ color: "var(--done)" }}>COMPLETED</span>
            </>
          }
        >
          {[
            {
              label: (
                <>
                  <code>server/routers/adminRouter.ts</code> — wired in
                  procedures.ts
                </>
              ),
              detail: "✓",
            },
            {
              label: (
                <>
                  <code>client/src/pages/admin/AgentSuitePage.tsx</code> —
                  imported App.tsx:56
                </>
              ),
              detail: "✓",
            },
            {
              label: (
                <>
                  <code>/admin/agents</code> route — App.tsx:235 ProtectedRoute
                  wrapped
                </>
              ),
              detail: "✓",
            },
            {
              label: (
                <>
                  <code>authStore.ts</code> — stored token restored (wire§8 fix)
                </>
              ),
              detail: "✓ 2026-04-09",
            },
            {
              label: (
                <>
                  <code>billing.ts</code> — LemonSqueezy dead code removed
                </>
              ),
              detail: "✓ 2026-04-09",
            },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                fontSize: 11,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--done)",
                  boxShadow: "0 0 5px var(--done)",
                }}
              />
              <div style={{ flex: 1, color: "var(--text)" }}>{r.label}</div>
              <div style={{ fontSize: 10, color: "var(--done)" }}>
                {r.detail}
              </div>
            </div>
          ))}
        </Card>
      )}

      {activePatchTab === "ambig" && (
        <Card title="⚠ Open Ambiguities">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  DAW.tsx lines 1820–1875
                </td>
                <td style={{ color: "var(--bad)" }}>BLOCKS BUG 2</td>
                <td style={{ color: "var(--text2)" }}>
                  cat -n ~/R3v4/client/src/pages/DAW.tsx | sed -n '1820,1875p' —
                  paste output
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  server TS2307 symlink
                </td>
                <td style={{ color: "var(--warn)" }}>RESOLVED INLINE</td>
                <td style={{ color: "var(--text2)" }}>
                  Step 2 includes fallback: pnpm install --frozen-lockfile
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  ANTHROPIC_API_KEY
                </td>
                <td style={{ color: "var(--warn)" }}>UNVERIFIED</td>
                <td style={{ color: "var(--text2)" }}>
                  Confirm in Railway dashboard env vars
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  Mix Suggestions router
                </td>
                <td style={{ color: "var(--warn)" }}>OPEN</td>
                <td style={{ color: "var(--text2)" }}>
                  Read server/services/ — daw router or new suggestions router
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  Vitest test count
                </td>
                <td style={{ color: "var(--warn)" }}>UNKNOWN</td>
                <td style={{ color: "var(--text2)" }}>
                  Fix vitest.config.ts (P4) — PRD requires 42+ tests
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  users.isAdmin
                </td>
                <td style={{ color: "var(--done)" }}>VERIFIED</td>
                <td style={{ color: "var(--text2)" }}>
                  Hygiene Phase 6: isAdmin only on users table ✓
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--red)",
                    fontSize: 10,
                  }}
                >
                  admin route
                </td>
                <td style={{ color: "var(--done)" }}>DONE</td>
                <td style={{ color: "var(--text2)" }}>
                  App.tsx:235 + procedures.ts confirmed
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
