import { useAGI } from "../../store/useAGI";
import { Panel } from "@/ui/components/Panel";
import { colors } from "@/ui/tokens/colors";
import { spacing } from "@/ui/tokens/spacing";
import { typography } from "@/ui/tokens/typography";

const tagColors: Record<string, { bg: string; color: string; border: string }> =
  {
    "pt-p0": {
      bg: `${colors.semantic.status.critical}26`,
      color: colors.semantic.status.critical,
      border: `1px solid ${colors.semantic.status.critical}40`,
    },
    "pt-p1": {
      bg: `${colors.semantic.status.warning}1F`,
      color: colors.semantic.status.warning,
      border: `1px solid ${colors.semantic.status.warning}38`,
    },
    "pt-p2": {
      bg: `${colors.semantic.status.healthy}1A`,
      color: colors.semantic.status.healthy,
      border: `1px solid ${colors.semantic.status.healthy}33`,
    },
    "pt-p3": {
      bg: `${colors.semantic.status.healthy}1A`,
      color: colors.semantic.status.healthy,
      border: `1px solid ${colors.semantic.status.healthy}33`,
    },
    "pt-p4": {
      bg: `${colors.semantic.status.info}14`,
      color: colors.semantic.status.info,
      border: `1px solid ${colors.semantic.status.info}2E`,
    },
    "pt-p5": {
      bg: `${colors.semantic.data.series5}14`,
      color: colors.semantic.data.series5,
      border: `1px solid ${colors.semantic.data.series5}2E`,
    },
  };

export function PrioritiesView() {
  const { prios, togglePrio } = useAGI();
  const done = prios.filter((p) => p.done).length;
  const pct = Math.round((done / prios.length) * 100);

  return (
    <>
      <div
        style={{
          height: 3,
          background: `${colors.semantic.content.primary}0D`,
          borderRadius: spacing.semantic.radius.sm,
          overflow: "hidden",
          marginBottom: spacing.semantic.gap.sm,
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
              <span style={{ color: colors.semantic.status.active }}>▶</span>{" "}
              Live Priority Queue — Click to Mark Done
            </>
          }
        />
        <Panel.Body>
          {prios.map((p, i) => {
            const tc = tagColors[p.cls] ?? tagColors["pt-p4"];
            return (
              <div
                key={i}
                onClick={() => togglePrio(i)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: spacing.semantic.gap.sm,
                  padding: `${spacing.semantic.gap.sm} 0`,
                  borderBottom:
                    i < prios.length - 1
                      ? `1px solid ${colors.semantic.border.subtle}`
                      : "none",
                  cursor: "pointer",
                  borderRadius: spacing.semantic.radius.sm,
                  opacity: p.done ? 0.45 : 1,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: spacing.semantic.radius.sm,
                    flexShrink: 0,
                    marginTop: 2,
                    border: `1px solid ${p.done ? colors.semantic.status.healthy : colors.semantic.border.default}`,
                    background: p.done
                      ? `${colors.semantic.status.healthy}33`
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: typography.semantic.dataSmall.size,
                    color: colors.semantic.status.healthy,
                  }}
                >
                  {p.done ? "✓" : ""}
                </div>
                <div
                  style={{
                    fontSize: typography.semantic.dataSmall.size,
                    fontWeight: 700,
                    padding: `${spacing.semantic.gap.xs} ${spacing.semantic.gap.sm}`,
                    borderRadius: spacing.semantic.radius.sm,
                    letterSpacing: typography.semantic.label.tracking,
                    flexShrink: 0,
                    marginTop: 2,
                    ...tc,
                  }}
                >
                  {p.tag}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: typography.semantic.bodySmall.size,
                      color: p.done
                        ? colors.semantic.content.tertiary
                        : colors.semantic.content.primary,
                      textDecoration: p.done ? "line-through" : "none",
                      marginBottom: 3,
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontSize: typography.semantic.dataSmall.size,
                      color: colors.semantic.content.secondary,
                      lineHeight: typography.semantic.body.leading,
                    }}
                  >
                    {p.detail}
                  </div>
                  {p.cmd && (
                    <div
                      style={{
                        fontSize: typography.semantic.dataSmall.size,
                        color: colors.semantic.status.active,
                        marginTop: 4,
                      }}
                    >
                      {p.cmd}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Panel.Body>
      </Panel>

      <Panel elevation="raised" padding="md" variant="default">
        <Panel.Header
          title={
            <>
              <span style={{ color: colors.semantic.status.active }}>◈</span>{" "}
              Valuation Gates
            </>
          }
        />
        <Panel.Body>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${colors.semantic.border.subtle}`,
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    fontSize: typography.semantic.caption.size,
                    letterSpacing: typography.semantic.caption.tracking,
                    textTransform: "uppercase",
                    color: colors.semantic.content.tertiary,
                  }}
                >
                  State
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    fontSize: typography.semantic.caption.size,
                    letterSpacing: typography.semantic.caption.tracking,
                    textTransform: "uppercase",
                    color: colors.semantic.content.tertiary,
                  }}
                >
                  Range
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    fontSize: typography.semantic.caption.size,
                    letterSpacing: typography.semantic.caption.tracking,
                    textTransform: "uppercase",
                    color: colors.semantic.content.tertiary,
                  }}
                >
                  Gap
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                style={{
                  borderBottom: `1px solid ${colors.semantic.border.subtle}`,
                }}
              >
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.status.warning,
                  }}
                >
                  → Current
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  $180K–$400K
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.secondary,
                  }}
                >
                  Baseline
                </td>
              </tr>
              <tr
                style={{
                  borderBottom: `1px solid ${colors.semantic.border.subtle}`,
                }}
              >
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  Demo + 50 beta users
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  $800K–$2.5M
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.status.warning,
                  }}
                >
                  P0 + P1 done
                </td>
              </tr>
              <tr
                style={{
                  borderBottom: `1px solid ${colors.semantic.border.subtle}`,
                }}
              >
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  ≥65% AI acceptance
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  $3–6M seed
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.secondary,
                  }}
                >
                  P0 + P1 + P3
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  $120K ARR (500 users)
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.primary,
                  }}
                >
                  $4.8–9.6M
                </td>
                <td
                  style={{
                    padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                    color: colors.semantic.content.secondary,
                  }}
                >
                  12mo post-launch
                </td>
              </tr>
            </tbody>
          </table>
        </Panel.Body>
      </Panel>
    </>
  );
}
