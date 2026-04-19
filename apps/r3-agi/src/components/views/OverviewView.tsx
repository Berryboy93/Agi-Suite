import { useEffect, useRef, useState } from "react";
import { Card } from "../ui/Card";

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
  done: "var(--done)",
  ok: "var(--good)",
  bad: "var(--bad)",
  warn: "var(--warn)",
  vi: "var(--violet)",
  dim: "var(--dim)",
};
const detailColors: Record<string, string> = {
  done: "var(--done)",
  ok: "var(--good)",
  bad: "var(--bad)",
  warn: "var(--warn)",
  dim: "var(--text2)",
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
  return (
    <div
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
          flexShrink: 0,
          background: dotColors[dot] ?? "var(--dim)",
          boxShadow: dot !== "dim" ? `0 0 5px ${dotColors[dot]}` : undefined,
        }}
      />
      <div style={{ flex: 1, color: "var(--text)" }}>{label}</div>
      {detail && (
        <div
          style={{
            fontSize: 10,
            color: dCls ? detailColors[dCls] : "var(--text2)",
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
        background: "var(--surface)",
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 18,
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontSize: 8,
          letterSpacing: 2,
          color: "var(--dim)",
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
    sc: "var(--warn)",
  },
  {
    state: "Demo + 50 beta users",
    range: "$800K–$2.5M",
    gap: "P0 done",
    sc: "var(--text2)",
  },
  {
    state: "≥65% AI acceptance",
    range: "$3–6M seed",
    gap: "P0 + P3",
    sc: "var(--text2)",
  },
  {
    state: "$120K ARR",
    range: "$4.8–9.6M",
    gap: "12mo post-launch",
    sc: "var(--text2)",
  },
];

export function OverviewView() {
  const kpis: KpiDef[] = [
    { num: 11, color: "var(--done)", label: "Routers" },
    { num: 3, denom: 4, color: "var(--accent)", label: "MVP Done" },
    { num: 5, color: "var(--warn)", label: "any Left" },
    { num: 0, suffix: "P0", color: "var(--bad)", label: "Migration" },
    { num: 0, color: "var(--done)", label: "TSC Errors" },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 1,
          border: "1px solid var(--border)",
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 13,
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
          gap: 8,
          marginBottom: 13,
        }}
      >
        {[
          {
            label: "PRD Version",
            val: "v4.1",
            sub: "Updated 2026-04-12",
            color: "var(--accent)",
          },
          {
            label: "Session",
            val: "2026-04-16",
            sub: "Last priorities update",
            color: "var(--text)",
          },
          {
            label: "Hygiene",
            val: "10/100",
            sub: "Target: 90 — P5 open",
            color: "var(--warn)",
          },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: "var(--dim)",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: "var(--sans)",
                fontSize: 15,
                fontWeight: 800,
                color: c.color,
              }}
            >
              {c.val}
            </div>
            <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 2 }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      <Card
        title={
          <>
            <span style={{ color: "var(--acid)" }}>⚡</span> Codebase State —
            2026-04-16
          </>
        }
      >
        {checkRows.map((r, i) => (
          <CheckRow
            key={i}
            dot={r.dot}
            label={r.label}
            detail={r.detail}
            dCls={r.dCls}
          />
        ))}
      </Card>

      <Card
        title={
          <>
            <span style={{ color: "var(--violet)" }}>◈</span> Valuation Gates
          </>
        }
      >
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Range</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody>
            {valuationRows.map((v) => (
              <tr key={v.state}>
                <td style={{ color: v.sc }}>{v.state}</td>
                <td>{v.range}</td>
                <td style={{ color: "var(--text2)" }}>{v.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title={
          <>
            <span style={{ color: "var(--violet)" }}>🔒</span> Security
            Architecture
          </>
        }
      >
        {secRows.map((r, i) => (
          <CheckRow
            key={i}
            dot={r.dot}
            label={r.label}
            detail={r.detail}
            dCls={r.dCls}
          />
        ))}
      </Card>
    </>
  );
}
