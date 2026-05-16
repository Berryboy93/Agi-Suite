import { useEffect, useRef, useState } from "react";
import { Panel } from "@/ui/components/Panel";
import { colors } from "@/ui/tokens/colors";
import { spacing } from "@/ui/tokens/spacing";
import { typography } from "@/ui/tokens/typography";

const checkRows = [
  {
    dot: "done",
    label: (
      <>
        <code>server/procedures.ts</code> — appRouter fully wired
      </>
    ),
    detail: "11 routers confirmed",
    dCls: "done",
  },
  {
    dot: "done",
    label: (
      <>
        <code>aiDecisionLog</code> schema + migration 0005 generated
      </>
    ),
    detail: "0005_overjoyed_gambit.sql · applied local ✓",
    dCls: "done",
  },
  {
    dot: "bad",
    label: (
      <>
        <code>migration 0005</code> — NOT applied to Railway production
      </>
    ),
    detail: "P0 BLOCKER — acceptance rate = 0 in prod",
    dCls: "bad",
  },
  {
    dot: "done",
    label: (
      <>
        <code>logAIDecision</code> + <code>updateAIDecisionOutcome</code> wired
      </>
    ),
    detail: "session-metrics.service.ts + aiMix.router.ts ✓",
    dCls: "done",
  },
  {
    dot: "done",
    label: (
      <>
        <code>SessionChip</code> + <code>SessionSummaryPanel</code> wired in
        DAW.tsx
      </>
    ),
    detail: "Lines 1782 + 1750",
    dCls: "done",
  },
  {
    dot: "done",
    label: "TSC — 0 errors",
    detail: "Zero errors · verified post all patches",
    dCls: "done",
  },
  {
    dot: "done",
    label: (
      <>
        <code>billing.ts</code> — dead LemonSqueezy file removed
      </>
    ),
    detail: "Hard guard compliance restored",
    dCls: "done",
  },
  {
    dot: "warn",
    label: (
      <>
        <code>pnpm test</code> — runner returning no output
      </>
    ),
    detail: "vitest.config.ts missing include pattern — P4",
    dCls: "warn",
  },
  {
    dot: "warn",
    label: "Hygiene score: 10/100",
    detail: "Target: 90/100 — 9 phantom dirs + hard guards open",
    dCls: "warn",
  },
];

const secRows = [
  {
    dot: "done",
    label: "Two-layer route protection",
    detail: "ProtectedRoute + admin.checkAccess (tRPC)",
    dCls: "done",
  },
  {
    dot: "done",
    label: "API key never exposed to browser",
    detail: "All Anthropic calls server-side via tRPC",
    dCls: "done",
  },
  {
    dot: "done",
    label: (
      <>
        'Hard guard: no <code>hydrateFromToken()</code> in render
      </>
    ),
    detail: "Confirmed in AgentSuitePage.tsx",
    dCls: "done",
  },
  {
    dot: "warn",
    label: (
      <>
        <code>ANTHROPIC_API_KEY</code> in Railway env
      </>
    ),
    detail: "Confirm in Railway dashboard",
    dCls: "warn",
  },
];

const dotColors: Record<string, string> = {
  done: colors.semantic.status.healthy,
  ok: colors.semantic.status.healthy,
  bad: colors.semantic.status.critical,
  warn: colors.semantic.status.warning,
  vi: colors.semantic.data.series5,
  dim: colors.semantic.content.tertiary,
};

const detailColors: Record<string, string> = {
  done: colors.semantic.status.healthy,
  ok: colors.semantic.status.healthy,
  bad: colors.semantic.status.critical,
  warn: colors.semantic.status.warning,
  dim: colors.semantic.content.secondary,
};

function CheckRow({
  dot,
  label,
  detail,
  dCls,
}: {
  dot: string;
  label: React.ReactNode;
  detail?: string;
  dCls?: string;
}) {
  const dotColor = dotColors[dot] ?? colors.semantic.content.tertiary;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.semantic.gap.sm,
        padding: `${spacing.semantic.gap.xs} 0`,
        borderBottom: `1px solid ${colors.semantic.border.subtle}`,
        fontSize: typography.semantic.caption.size,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          flexShrink: 0,
          background: dotColor,
          boxShadow: dot !== "dim" ? `0 0 5px ${dotColor}` : undefined,
        }}
      />
      <div style={{ flex: 1, color: colors.semantic.content.primary }}>
        {label}
      </div>
      {detail && (
        <div
          style={{
            fontSize: typography.semantic.dataSmall.size,
            color: dCls
              ? detailColors[dCls]
              : colors.semantic.content.secondary,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}

const DURATION_MS = 600;

function useCountUp(target: number) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    let start: number | null = null;
    function step(ts: number) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return val;
}

interface KpiDef {
  num: number;
  denom?: number;
  suffix?: string;
  color: string;
  label: string;
}

function KpiCard({ num, denom, suffix, color, label }: KpiDef) {
  const animated = useCountUp(num);
  const display =
    denom !== undefined
      ? `${animated}/${denom}`
      : suffix
        ? `${suffix}`
        : String(animated);
  return (
    <div
      style={{
        background: colors.semantic.background.surface,
        padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: typography.family.sans,
          fontSize: typography.semantic.h3.size,
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: typography.semantic.dataSmall.size,
          letterSpacing: typography.semantic.label.tracking,
          color: colors.semantic.content.tertiary,
          marginTop: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

const valuationRows = [
  {
    state: "→ Current",
    range: "$180K–$400K",
    gap: "Baseline",
    sc: colors.semantic.status.warning,
  },
  {
    state: "Demo + 50 beta users",
    range: "$800K–$2.5M",
    gap: "P0 done",
    sc: colors.semantic.content.secondary,
  },
  {
    state: "≥65% AI acceptance",
    range: "$3–6M seed",
    gap: "P0 + P3",
    sc: colors.semantic.content.secondary,
  },
  {
    state: "$120K ARR",
    range: "$4.8–9.6M",
    gap: "12mo post-launch",
    sc: colors.semantic.content.secondary,
  },
];

export function OverviewView() {
  const kpis: KpiDef[] = [
    { num: 11, color: colors.semantic.status.healthy, label: "Routers" },
    {
      num: 3,
      denom: 4,
      color: colors.semantic.status.active,
      label: "MVP Done",
    },
    { num: 5, color: colors.semantic.status.warning, label: "any Left" },
    {
      num: 0,
      suffix: "P0",
      color: colors.semantic.status.critical,
      label: "Migration",
    },
    { num: 0, color: colors.semantic.status.healthy, label: "TSC Errors" },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 1,
          border: `1px solid ${colors.semantic.border.subtle}`,
          borderRadius: spacing.semantic.radius.sm,
          overflow: "hidden",
          marginBottom: spacing.semantic.gap.md,
        }}
      >
        {kpis.map((s) => (
          <KpiCard key={s.label} {...s} />
        ))}
      </div>

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
            label: "PRD Version",
            val: "v4.1",
            sub: "Updated 2026-04-12",
            color: colors.semantic.status.active,
          },
          {
            label: "Session",
            val: new Date().toISOString().split("T")[0],
            sub: "Last priorities update",
            color: colors.semantic.content.primary,
          },
          {
            label: "Hygiene",
            val: "10/100",
            sub: "Target: 90 — P5 open",
            color: colors.semantic.status.warning,
          },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: colors.semantic.background.surface,
              border: `1px solid ${colors.semantic.border.subtle}`,
              borderRadius: spacing.semantic.radius.sm,
              padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
            }}
          >
            <div
              style={{
                fontSize: typography.semantic.dataSmall.size,
                letterSpacing: typography.semantic.label.tracking,
                color: colors.semantic.content.tertiary,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: typography.family.sans,
                fontSize: typography.semantic.h4.size,
                fontWeight: 800,
                color: c.color,
              }}
            >
              {c.val}
            </div>
            <div
              style={{
                fontSize: typography.semantic.dataSmall.size,
                color: colors.semantic.content.secondary,
                marginTop: 2,
              }}
            >
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <Panel elevation="raised" padding="md" variant="default">
        <Panel.Header
          title={
            <>
              <span style={{ color: colors.semantic.status.active }}>⚡</span>{" "}
              Codebase State — {new Date().toISOString().split("T")[0]}
            </>
          }
        />
        <Panel.Body>
          {checkRows.map((r, i) => (
            <CheckRow
              key={i}
              dot={r.dot}
              label={r.label}
              detail={r.detail}
              dCls={r.dCls}
            />
          ))}
        </Panel.Body>
      </Panel>

      <Panel elevation="raised" padding="md" variant="default">
        <Panel.Header
          title={
            <>
              <span style={{ color: colors.semantic.data.series5 }}>◈</span>{" "}
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
              {valuationRows.map((v) => (
                <tr
                  key={v.state}
                  style={{
                    borderBottom: `1px solid ${colors.semantic.border.subtle}`,
                  }}
                >
                  <td
                    style={{
                      padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                      color: v.sc,
                    }}
                  >
                    {v.state}
                  </td>
                  <td
                    style={{
                      padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                      color: colors.semantic.content.primary,
                    }}
                  >
                    {v.range}
                  </td>
                  <td
                    style={{
                      padding: `${spacing.semantic.gap.sm} ${spacing.semantic.gap.md}`,
                      color: colors.semantic.content.secondary,
                    }}
                  >
                    {v.gap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel.Body>
      </Panel>

      <Panel elevation="raised" padding="md" variant="default">
        <Panel.Header
          title={
            <>
              <span style={{ color: colors.semantic.data.series5 }}>🔒</span>{" "}
              Security Architecture
            </>
          }
        />
        <Panel.Body>
          {secRows.map((r, i) => (
            <CheckRow
              key={i}
              dot={r.dot}
              label={r.label}
              detail={r.detail}
              dCls={r.dCls}
            />
          ))}
        </Panel.Body>
      </Panel>
    </>
  );
}
