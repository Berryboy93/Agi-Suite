import { Panel } from "@/ui/components/Panel";
import { colors } from "@/ui/tokens/colors";
import { spacing } from "@/ui/tokens/spacing";
import { typography } from "@/ui/tokens/typography";

const steps = [
  {
    status: "done",
    desc: "Type-check — zero errors",
    cmd: "pnpm tsc --noEmit",
    note: "Passing — confirmed 2026-04-09",
    noteColor: colors.semantic.status.healthy,
  },
  {
    status: "warn",
    desc: "Test suite",
    cmd: "pnpm test",
    note: "Runner broken — fix vitest.config.ts (P4) first",
    noteColor: colors.semantic.status.warning,
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
    <Panel elevation="raised" padding="md" variant="default">
      <Panel.Header
        title={
          <>
            <span style={{ color: colors.semantic.status.active }}>▷</span>{" "}
            Post-Patch Verification — Wire.txt: After Every Write
          </>
        }
      />
      <Panel.Body>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: spacing.semantic.gap.sm,
              padding: `${spacing.semantic.gap.sm} 0`,
              borderBottom:
                i < steps.length - 1
                  ? `1px solid ${colors.semantic.border.subtle}`
                  : "none",
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
                      background: `${colors.semantic.status.healthy}26`,
                      border: `1px solid ${colors.semantic.status.healthy}`,
                      color: colors.semantic.status.healthy,
                    }
                  : s.status === "warn"
                    ? {
                        border: `1px solid ${colors.semantic.border.default}`,
                        color: colors.semantic.status.warning,
                      }
                    : {
                        border: `1px solid ${colors.semantic.border.default}`,
                        color: colors.semantic.content.tertiary,
                      }),
              }}
            >
              {s.status === "done" ? "✓" : s.status === "warn" ? "!" : s.status}
            </div>
            <div>
              <div
                style={{
                  fontSize: typography.semantic.caption.size,
                  color: colors.semantic.content.primary,
                  marginBottom: 3,
                }}
              >
                {s.desc}
              </div>
              {s.cmd && (
                <div
                  style={{
                    fontSize: typography.semantic.dataSmall.size,
                    color: colors.semantic.status.active,
                    marginTop: 3,
                    whiteSpace: "pre-line",
                  }}
                >
                  {s.cmd}
                </div>
              )}
              {s.note && (
                <div
                  style={{
                    fontSize: typography.semantic.dataSmall.size,
                    color: s.noteColor,
                    marginTop: 2,
                  }}
                >
                  {s.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </Panel.Body>
    </Panel>
  );
}
