import { useState } from "react";
import { Panel } from "../../ui/components/Panel";
import { colors } from "../../ui/tokens/colors";
import { spacing } from "../../ui/tokens/spacing";
import { typography } from "../../ui/tokens/typography";

interface CheckItem {
  done: boolean;
  label: string;
  critical: boolean;
}

const INITIAL_ITEMS: CheckItem[] = [
  {
    done: false,
    label:
      "pnpm drizzle-kit migrate → confirm 0005 applied to Railway production",
    critical: true,
  },
  {
    done: false,
    label:
      "Verify ai_decision_log table exists in production DB (column count query)",
    critical: true,
  },
  {
    done: false,
    label: "Confirm ANTHROPIC_API_KEY in Railway env vars",
    critical: true,
  },
  {
    done: true,
    label:
      "logAIDecision + updateAIDecisionOutcome wired (session-metrics.service.ts + aiMix.router.ts)",
    critical: true,
  },
  {
    done: true,
    label: "users.isAdmin column confirmed in server/db/schema.ts",
    critical: false,
  },
  {
    done: true,
    label: "adminRouter wired in server/procedures.ts",
    critical: false,
  },
  {
    done: true,
    label: "/admin/agents route in App.tsx with ProtectedRoute",
    critical: false,
  },
  { done: true, label: "TSC pnpm tsc --noEmit → 0 errors", critical: false },
  {
    done: true,
    label: "authStore.ts — stored token read restored",
    critical: false,
  },
  {
    done: true,
    label: "billing.ts — dead LemonSqueezy file removed",
    critical: false,
  },
  {
    done: true,
    label:
      "SessionChip + SessionSummaryPanel wired in DAW.tsx (lines 1782 + 1750)",
    critical: false,
  },
  {
    done: false,
    label: "pnpm test → fix vitest config include pattern (P4)",
    critical: false,
  },
  {
    done: false,
    label: "Mix Suggestion System — backend tRPC procedure wired (P3)",
    critical: true,
  },
  {
    done: false,
    label: "Smoke: admin login → /admin/agents → Expert Agents loads",
    critical: false,
  },
  {
    done: false,
    label:
      "Demo: play session → stop → SessionSummaryPanel shows real data (requires Railway migration)",
    critical: true,
  },
  {
    done: false,
    label: "python3 r3_hygiene.py → hygiene score improves from 10/100",
    critical: false,
  },
  {
    done: false,
    label: 'Demo environment confirmed using pro_artist tier (NOT "Pro")',
    critical: true,
  },
];

export function ChecklistView() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const critical = items.filter((i) => i.critical && !i.done).length;

  function toggle(i: number) {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i ? { ...item, done: !item.done } : item,
      ),
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: spacing.semantic.gap.sm,
          marginBottom: spacing.semantic.gap.md,
        }}
      >
        {[
          {
            label: "Completed",
            val: done + "/" + items.length,
            color: colors.semantic.status.healthy,
          },
          {
            label: "Progress",
            val: pct + "%",
            color: colors.semantic.status.active,
          },
          {
            label: "Critical Open",
            val: String(critical),
            color:
              critical > 0
                ? colors.semantic.status.critical
                : colors.semantic.status.healthy,
          },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: colors.semantic.background.surface,
              border: `1px solid ${colors.semantic.border.subtle}`,
              borderRadius: spacing.semantic.radius.sm,
              padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: typography.family.sans,
                fontSize: typography.semantic.h3.size,
                fontWeight: 800,
                color: c.color,
              }}
            >
              {c.val}
            </div>
            <div
              style={{
                fontSize: typography.semantic.dataSmall.size,
                letterSpacing: typography.semantic.label.tracking,
                color: colors.semantic.content.tertiary,
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          height: 3,
          background: `${colors.semantic.content.primary}0D`,
          borderRadius: spacing.semantic.radius.sm,
          overflow: "hidden",
          marginBottom: spacing.semantic.gap.md,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: spacing.semantic.radius.sm,
            background: `linear-gradient(90deg, ${colors.semantic.status.active}, ${colors.semantic.status.healthy})`,
            width: pct + "%",
            transition: "width .6s ease",
          }}
        />
      </div>

      <Panel elevation="raised" padding="md" variant="default">
        <Panel.Header
          title={
            <>
              <span style={{ color: colors.semantic.status.active }}>🛫</span>{" "}
              Pre-flight Checklist — Click to Toggle
            </>
          }
        />
        <Panel.Body>
          {items.map((item, i) => (
            <div
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.semantic.gap.sm,
                padding: `${spacing.semantic.gap.xs} 0`,
                borderBottom:
                  i < items.length - 1
                    ? `1px solid ${colors.semantic.border.subtle}`
                    : "none",
                fontSize: typography.semantic.caption.size,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: item.done
                    ? colors.semantic.status.healthy
                    : item.critical
                      ? colors.semantic.status.critical
                      : colors.semantic.content.tertiary,
                  boxShadow: item.done
                    ? `0 0 5px ${colors.semantic.status.healthy}`
                    : item.critical
                      ? `0 0 5px ${colors.semantic.status.critical}`
                      : undefined,
                }}
              />
              <div
                style={{
                  flex: 1,
                  color: colors.semantic.content.primary,
                  textDecoration: item.done ? "line-through" : "none",
                  opacity: item.done ? 0.6 : 1,
                }}
              >
                {item.label}
              </div>
              {item.critical && !item.done && (
                <div
                  style={{
                    fontSize: typography.semantic.dataSmall.size,
                    color: colors.semantic.status.critical,
                    fontWeight: 700,
                    letterSpacing: typography.semantic.label.tracking,
                  }}
                >
                  CRITICAL
                </div>
              )}
              {item.done && (
                <div
                  style={{
                    fontSize: typography.semantic.dataSmall.size,
                    color: colors.semantic.status.healthy,
                  }}
                >
                  ✓
                </div>
              )}
            </div>
          ))}
        </Panel.Body>
      </Panel>
    </>
  );
}
