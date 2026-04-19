import { Card } from "../ui/Card";

const steps = [
  {
    status: "done",
    desc: "Type-check — zero errors",
    cmd: "pnpm tsc --noEmit",
    note: "Passing — confirmed 2026-04-09",
    noteColor: "var(--done)",
  },
  {
    status: "warn",
    desc: "Test suite",
    cmd: "pnpm test",
    note: "Runner broken — fix vitest.config.ts (P4) first",
    noteColor: "var(--warn)",
  },
  {
    status: "3",
    desc: "Apply migration 0005 — verify aiDecisionLog in Railway",
    cmd: 'pnpm drizzle-kit migrate\npsql $DATABASE_URL -c "\\d ai_decision_log"',
  },
  {
    status: "4",
    desc: "Admin login → /admin/agents → Expert Agents loads",
    cmd: '# Use pro_artist tier — NOT "Pro"',
  },
  { status: "5", desc: "Non-admin → /admin/agents → AdminForbidden renders" },
  {
    status: "6",
    desc: "Demo: play session → stop → SessionSummaryPanel shows real data",
    cmd: "# Zeros = migration 0005 not applied",
  },
  { status: "7", desc: "Hygiene audit", cmd: "python3 r3_hygiene.py" },
];

export function VerifyView() {
  return (
    <Card
      title={
        <>
          <span style={{ color: "var(--acid)" }}>▷</span> Post-Patch
          Verification — Wire.txt: After Every Write
        </>
      }
    >
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 0",
            borderBottom:
              i < steps.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              flexShrink: 0,
              marginTop: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              ...(s.status === "done"
                ? {
                    background: "rgba(16,185,129,.15)",
                    border: "1px solid var(--done)",
                    color: "var(--done)",
                  }
                : s.status === "warn"
                  ? { border: "1px solid var(--bor2)", color: "var(--warn)" }
                  : { border: "1px solid var(--bor2)", color: "var(--text2)" }),
            }}
          >
            {s.status === "done" ? "✓" : s.status === "warn" ? "!" : s.status}
          </div>
          <div>
            <div
              style={{ fontSize: 11, color: "var(--text)", marginBottom: 3 }}
            >
              {s.desc}
            </div>
            {s.cmd && (
              <div
                style={{
                  fontSize: 10,
                  color: "var(--acid)",
                  marginTop: 3,
                  whiteSpace: "pre-line",
                }}
              >
                {s.cmd}
              </div>
            )}
            {s.note && (
              <div style={{ fontSize: 10, color: s.noteColor, marginTop: 2 }}>
                {s.note}
              </div>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
