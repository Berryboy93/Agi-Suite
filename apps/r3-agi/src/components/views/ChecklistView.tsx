import { useState } from "react";
import { Card } from "../ui/Card";

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
          gap: 8,
          marginBottom: 13,
        }}
      >
        {[
          {
            label: "Completed",
            val: done + "/" + items.length,
            color: "var(--done)",
          },
          { label: "Progress", val: pct + "%", color: "var(--accent)" },
          {
            label: "Critical Open",
            val: String(critical),
            color: critical > 0 ? "var(--bad)" : "var(--done)",
          },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--sans)",
                fontSize: 18,
                fontWeight: 800,
                color: c.color,
              }}
            >
              {c.val}
            </div>
            <div
              style={{
                fontSize: 8,
                letterSpacing: 2,
                color: "var(--dim)",
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
          background: "rgba(255,255,255,.05)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 13,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 2,
            background: "linear-gradient(90deg,var(--acid),var(--done))",
            width: pct + "%",
            transition: "width .6s ease",
          }}
        />
      </div>

      <Card
        title={
          <>
            <span style={{ color: "var(--acid)" }}>🛫</span> Pre-flight
            Checklist — Click to Toggle
          </>
        }
      >
        {items.map((item, i) => (
          <div
            key={i}
            onClick={() => toggle(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom:
                i < items.length - 1 ? "1px solid var(--border)" : "none",
              fontSize: 11,
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
                  ? "var(--done)"
                  : item.critical
                    ? "var(--bad)"
                    : "var(--dim)",
                boxShadow: item.done
                  ? "0 0 5px var(--done)"
                  : item.critical
                    ? "0 0 5px var(--bad)"
                    : undefined,
              }}
            />
            <div
              style={{
                flex: 1,
                color: "var(--text)",
                textDecoration: item.done ? "line-through" : "none",
                opacity: item.done ? 0.6 : 1,
              }}
            >
              {item.label}
            </div>
            {item.critical && !item.done && (
              <div
                style={{
                  fontSize: 9,
                  color: "var(--bad)",
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                CRITICAL
              </div>
            )}
            {item.done && (
              <div style={{ fontSize: 10, color: "var(--done)" }}>✓</div>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
