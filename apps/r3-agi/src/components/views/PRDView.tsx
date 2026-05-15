import { Panel } from "@/ui/components/Panel";
import { colors } from "@/ui/tokens/colors";
import { spacing } from "@/ui/tokens/spacing";
import { typography } from "@/ui/tokens/typography";

export function PRDView() {
  const rows = [
    {
      section: "§1 Stack",
      claim: "Zustand · Wouter · Stripe ONLY",
      status: "✓ Verified",
      color: colors.semantic.status.healthy,
    },
    {
      section: "§1 Tiers",
      claim: "explorer · creator · pro_artist",
      status: "✓ Correct",
      color: colors.semantic.status.healthy,
    },
    {
      section: "§8 MVP 1–2",
      claim: "Auto-Leveling (20t) · Smart Transitions (22t)",
      status: "✓ Complete",
      color: colors.semantic.status.healthy,
    },
    {
      section: "§8 MVP 3",
      claim: "Time Savings — SessionChip + Panel",
      status: "✓ DAW.tsx wired",
      color: colors.semantic.status.healthy,
    },
    {
      section: "§8 MVP 4",
      claim: "Mix Suggestion System",
      status: "Frontend built · backend pending",
      color: colors.semantic.status.warning,
    },
    {
      section: "§12 Schema",
      claim: "aiDecisionLog — migration 0005",
      status: "Schema done · Railway PENDING",
      color: colors.semantic.status.warning,
    },
    {
      section: "§13 appRouter",
      claim: "11 routers in procedures.ts",
      status: "✓ All wired",
      color: colors.semantic.status.healthy,
    },
    {
      section: "§8 LLPTE",
      claim: "10ms p50 · 847 edges · 0.8ms tick",
      status: "✓ Confirmed",
      color: colors.semantic.status.healthy,
    },
    {
      section: "§11 Guards",
      claim: "TSC 15 errors · 5 any · 5 console.log remaining",
      status: "15 TSC + 5+5 to fix",
      color: colors.semantic.status.critical,
    },
  ];

  const cellPadding = `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`;
  const headerStyle: React.CSSProperties = {
    textAlign: "left",
    padding: cellPadding,
    fontSize: typography.semantic.caption.size,
    letterSpacing: typography.semantic.caption.tracking,
    textTransform: "uppercase",
    color: colors.semantic.content.tertiary,
  };

  return (
    <Panel elevation="raised" padding="md" variant="default">
      <Panel.Header
        title="PRD v4.0 State — 2026-04-09"
        icon={<span style={{ color: colors.semantic.data.series5 }}>◉</span>}
      />
      <Panel.Body>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${colors.semantic.border.subtle}`,
              }}
            >
              <th style={headerStyle}>Section</th>
              <th style={headerStyle}>Claim</th>
              <th style={headerStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.section}
                style={{
                  borderBottom: `1px solid ${colors.semantic.border.subtle}`,
                }}
              >
                <td
                  style={{
                    padding: cellPadding,
                    color: colors.semantic.content.secondary,
                  }}
                >
                  {r.section}
                </td>
                <td
                  style={{
                    padding: cellPadding,
                    color: colors.semantic.content.primary,
                  }}
                >
                  {r.claim}
                </td>
                <td
                  style={{
                    padding: cellPadding,
                    color: r.color,
                    fontWeight: 600,
                  }}
                >
                  {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel.Body>
    </Panel>
  );
}
