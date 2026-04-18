import { useAGI } from "../store/useAGI";

const views = [
  { id: "overview", icon: "◈", label: "Overview" },
  { id: "priorities", icon: "▶", label: "Priorities", badge: true },
  {
    id: "llpte",
    icon: "⬡",
    label: "LLPTE Live",
    badgeText: "LIVE",
    badgeCls: "nb-vi",
  },
  {
    id: "asi",
    icon: "◉",
    label: "ASI Pipeline",
    badgeText: "NEW",
    badgeCls: "nb-vi",
  },
  {
    id: "intelligence",
    icon: "⚡",
    label: "Intelligence Layer",
    badgeText: "NEW",
    badgeCls: "nb-ok",
  },
  {
    id: "agi-cmd",
    icon: "⬡",
    label: "AGI CMD v3",
    badgeText: "NEW",
    badgeCls: "nb-ok",
  },
  {
    id: "api",
    icon: "⊗",
    label: "API Reference",
    badgeText: "v2",
    badgeCls: "nb-ok",
  },
  {
    id: "patch",
    icon: "⊕",
    label: "Patch Plan",
    badgeText: "2 OPEN",
    badgeCls: "nb-warn",
  },
  { id: "checklist", icon: "✓", label: "Pre-flight" },
  { id: "tree", icon: "⊞", label: "Project Tree" },
  { id: "verify", icon: "▷", label: "Verification" },
  { id: "prd", icon: "◉", label: "PRD v4 State" },
];

const completed = [
  "TSC: 0 errors ✓",
  "P1: aiDecisionLog writes wired ✓",
  "11 routers total",
  "aiDecisionLog schema + migration 0005 (local)",
  "SessionChip + SessionSummaryPanel wired",
  "15 any violations fixed",
  "billing.ts (LemonSqueezy) removed",
  "authStore.ts fixed",
];

const stack = [
  { color: "var(--accent)", label: "tRPC + Express 4.22.1" },
  { color: "var(--accent)", label: "Drizzle 0.39.3 + PG" },
  { color: "var(--accent)", label: "Wouter · Zustand" },
  { color: "var(--violet)", label: "LLPTE — 6 packages" },
  { color: "var(--done)", label: "Stripe 20.4.1 ONLY" },
];

const badgeCls: Record<string, { bg: string; color: string; border: string }> =
  {
    "nb-bad": {
      bg: "rgba(255,61,113,.12)",
      color: "var(--bad)",
      border: "1px solid rgba(255,61,113,.2)",
    },
    "nb-ok": {
      bg: "rgba(163,230,53,.1)",
      color: "var(--good)",
      border: "1px solid rgba(163,230,53,.2)",
    },
    "nb-warn": {
      bg: "rgba(245,158,11,.1)",
      color: "var(--warn)",
      border: "1px solid rgba(245,158,11,.2)",
    },
    "nb-done": {
      bg: "rgba(16,185,129,.1)",
      color: "var(--done)",
      border: "1px solid rgba(16,185,129,.2)",
    },
    "nb-vi": {
      bg: "rgba(139,92,246,.1)",
      color: "var(--violet)",
      border: "1px solid rgba(139,92,246,.2)",
    },
  };

export function Sidebar() {
  const { activeView, setView, setFocus, prios } = useAGI();
  const openCount = prios.filter((p) => !p.done).length;

  return (
    <nav
      style={{
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        padding: "12px 0",
        background: "rgba(9,9,11,.7)",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 8,
            letterSpacing: 3,
            color: "var(--dim)",
            padding: "0 13px 6px",
            textTransform: "uppercase",
          }}
        >
          Views
        </div>
        {views.map((v) => {
          const bc = v.badgeCls ? badgeCls[v.badgeCls] : null;
          const badgeText = v.badge
            ? openCount + " OPEN"
            : (v.badgeText ?? null);
          const badgeStyle = v.badge
            ? openCount > 0
              ? badgeCls["nb-bad"]
              : badgeCls["nb-done"]
            : bc;

          return (
            <div
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 13px",
                cursor: "pointer",
                color: activeView === v.id ? "var(--accent)" : "var(--text2)",
                fontSize: 11,
                transition: "all .1s",
                borderLeft: `2px solid ${activeView === v.id ? "var(--accent)" : "transparent"}`,
                background:
                  activeView === v.id ? "rgba(163,230,53,.05)" : "transparent",
              }}
            >
              <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>
                {v.icon}
              </span>
              {v.label}
              {badgeText && badgeStyle && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 8,
                    padding: "1px 5px",
                    borderRadius: 2,
                    background: badgeStyle.bg,
                    color: badgeStyle.color,
                    border: badgeStyle.border,
                  }}
                >
                  {badgeText}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 8,
            letterSpacing: 3,
            color: "var(--dim)",
            padding: "0 13px 6px",
            textTransform: "uppercase",
          }}
        >
          Quick Patches
        </div>
        {[
          {
            label: "migration 0005 → Railway",
            badge: "P0",
            badgeCls: "nb-bad",
            patch: "p0",
            focus:
              "P0: Apply migration 0005 to Railway production — need real DB URL from railway.app",
          },
          {
            label: "presets.ts any×4",
            badge: "P2",
            badgeCls: "nb-warn",
            patch: "all",
            focus:
              "P2: Fix 4 as any casts in server/routes/presets.ts lines 10,11,16,17",
          },
          {
            label: "Mix Suggestion backend",
            badge: "P3",
            badgeCls: "nb-ok",
            patch: "all",
            focus:
              "P3: Wire Mix Suggestion System tRPC procedure — read server/services/ first",
          },
        ].map((q) => {
          const bc = badgeCls[q.badgeCls];
          return (
            <div
              key={q.label}
              onClick={() => {
                setView("patch");
                setFocus(q.focus);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 13px",
                cursor: "pointer",
                color: "var(--text2)",
                fontSize: 11,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  width: 16,
                  textAlign: "center",
                  color: "var(--warn)",
                }}
              >
                →
              </span>
              {q.label}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 8,
                  padding: "1px 5px",
                  borderRadius: 2,
                  background: bc.bg,
                  color: bc.color,
                  border: bc.border,
                }}
              >
                {q.badge}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 8,
            letterSpacing: 3,
            color: "var(--dim)",
            padding: "0 13px 6px",
            textTransform: "uppercase",
          }}
        >
          Completed ✓
        </div>
        {completed.map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 13px",
              color: "var(--text2)",
              fontSize: 11,
            }}
          >
            <span
              style={{
                fontSize: 13,
                width: 16,
                textAlign: "center",
                color: "var(--done)",
              }}
            >
              ✓
            </span>
            {label}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 8,
            letterSpacing: 3,
            color: "var(--dim)",
            padding: "0 13px 6px",
            textTransform: "uppercase",
          }}
        >
          Stack
        </div>
        {stack.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 13px",
              color: "var(--text2)",
              fontSize: 10,
              cursor: "default",
            }}
          >
            <span
              style={{
                fontSize: 13,
                width: 16,
                textAlign: "center",
                color: s.color,
              }}
            >
              ◻
            </span>
            {s.label}
          </div>
        ))}
      </div>

      <div
        style={{
          margin: "0 13px 8px",
          padding: "8px 10px",
          background: "rgba(163,230,53,.05)",
          border: "1px solid rgba(163,230,53,.15)",
          borderRadius: 3,
        }}
      >
        <div
          style={{
            fontSize: 8,
            letterSpacing: 2,
            color: "var(--dim)",
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          Tier
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--accent)",
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          pro_artist
        </div>
        <div style={{ fontSize: 8, color: "var(--text2)", marginTop: 2 }}>
          explorer · creator · pro_artist
        </div>
      </div>
    </nav>
  );
}
