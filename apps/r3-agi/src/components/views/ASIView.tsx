import { useState } from "react";
import { Card } from "@/components/Card";

type AgentStatus = "idle" | "running" | "pass" | "fail" | "healing";

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  border: string;
  icon: string;
}

const AGENTS: Agent[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "Controls flow · assigns tasks · gates commits",
    color: "var(--accent)",
    border: "rgba(163,230,53,.4)",
    icon: "⬡",
  },
  {
    id: "auditor",
    name: "Auditor",
    role: "Repo scan · PRD rule check · dependency graph",
    color: "var(--violet)",
    border: "rgba(139,92,246,.4)",
    icon: "◈",
  },
  {
    id: "refactor",
    name: "Refactor Agent",
    role: "Scoped patch generation · Wire.txt protocol",
    color: "#00e5ff",
    border: "rgba(0,229,255,.35)",
    icon: "⊕",
  },
  {
    id: "validator",
    name: "Validator",
    role: "Triple-check pipeline · regression guard",
    color: "var(--done)",
    border: "rgba(16,185,129,.4)",
    icon: "▷",
  },
];

const VALIDATION_LAYERS: {
  label: string;
  desc: string;
  color: string;
  activeBorder: string;
  activeBg: string;
  icon: string;
}[] = [
  {
    label: "Static Check",
    desc: "TypeScript strict · ESLint · dependency graph · no any · no console.log",
    color: "var(--accent)",
    activeBorder: "rgba(163,230,53,.35)",
    activeBg: "rgba(163,230,53,.06)",
    icon: "1",
  },
  {
    label: "Runtime Check",
    desc: "Isolated execution · component rendering · WebSocket handshake",
    color: "var(--violet)",
    activeBorder: "rgba(139,92,246,.35)",
    activeBg: "rgba(139,92,246,.05)",
    icon: "2",
  },
  {
    label: "Regression Check",
    desc: "Behavior vs baseline · LLPTE contract · VITEST 42+ cases",
    color: "var(--done)",
    activeBorder: "rgba(16,185,129,.35)",
    activeBg: "rgba(16,185,129,.04)",
    icon: "3",
  },
];

const HARD_GUARDS = [
  { guard: "No any", check: "unknown + type guard required", ok: true },
  {
    guard: "No swallowed exceptions",
    check: "All async functions handle errors explicitly",
    ok: true,
  },
  {
    guard: "No console.log",
    check: "Use morgan or structured logger — 5 violations open",
    ok: false,
  },
  {
    guard: "No write without read",
    check: "Wire.txt protocol — enforced",
    ok: true,
  },
  {
    guard: "No patch without dry-run",
    check: "Confirmation required before apply",
    ok: true,
  },
  {
    guard: "No LemonSqueezy",
    check: "@lemonsqueezy removed from package.json",
    ok: true,
  },
  {
    guard: "No Redux",
    check: "Zustand only — never @reduxjs/toolkit",
    ok: true,
  },
  { guard: "No react-router-dom", check: "Wouter only — confirmed", ok: true },
  {
    guard: "Post-login → /instrument",
    check: "Never /daw — enforced in authStore",
    ok: true,
  },
  {
    guard: "No free tier string",
    check: "Use explorer — corrected in all routers",
    ok: true,
  },
];

const LOOP_STEPS: {
  label: string;
  sub: string;
  color: string;
  activeBorder: string;
}[] = [
  {
    label: "Intent",
    sub: "User / CI trigger",
    color: "var(--text2)",
    activeBorder: "rgba(255,255,255,.2)",
  },
  {
    label: "Orchestrator",
    sub: "Assign + gate",
    color: "var(--accent)",
    activeBorder: "rgba(163,230,53,.4)",
  },
  {
    label: "Auditor",
    sub: "PRD scan",
    color: "var(--violet)",
    activeBorder: "rgba(139,92,246,.4)",
  },
  {
    label: "Refactor",
    sub: "Patch gen",
    color: "#00e5ff",
    activeBorder: "rgba(0,229,255,.35)",
  },
  {
    label: "Validator",
    sub: "Triple check",
    color: "var(--done)",
    activeBorder: "rgba(16,185,129,.4)",
  },
  {
    label: "Pass ×3?",
    sub: "Gate",
    color: "var(--warn)",
    activeBorder: "rgba(245,158,11,.35)",
  },
  {
    label: "Commit",
    sub: "Safe merge",
    color: "var(--done)",
    activeBorder: "rgba(16,185,129,.4)",
  },
];

function StatusDot({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { color: string; label: string }> = {
    idle: { color: "var(--dim)", label: "IDLE" },
    running: { color: "var(--warn)", label: "RUNNING" },
    pass: { color: "var(--done)", label: "PASS" },
    fail: { color: "var(--bad)", label: "FAIL" },
    healing: { color: "var(--violet)", label: "HEALING" },
  };
  const { color, label } = map[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          boxShadow: status !== "idle" ? `0 0 6px ${color}` : undefined,
          animation:
            status === "running" || status === "healing"
              ? "slaPulse 1.5s ease-in-out infinite"
              : undefined,
        }}
      />
      <span style={{ fontSize: 9, color, letterSpacing: 1, fontWeight: 700 }}>
        {label}
      </span>
    </div>
  );
}

function useSimulatedPipeline() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({
    orchestrator: "idle",
    auditor: "idle",
    refactor: "idle",
    validator: "idle",
  });
  const [activeLayer, setActiveLayer] = useState<number>(-1);
  const [running, setRunning] = useState(false);

  function runPipeline() {
    if (running) return;
    setRunning(true);
    setStatuses({
      orchestrator: "idle",
      auditor: "idle",
      refactor: "idle",
      validator: "idle",
    });
    setActiveLayer(-1);

    const seq: Array<() => void> = [
      () => setStatuses((s) => ({ ...s, orchestrator: "running" })),
      () =>
        setStatuses((s) => ({
          ...s,
          orchestrator: "pass",
          auditor: "running",
        })),
      () =>
        setStatuses((s) => ({ ...s, auditor: "pass", refactor: "running" })),
      () => {
        setStatuses((s) => ({ ...s, refactor: "pass", validator: "running" }));
        setActiveLayer(0);
      },
      () => setActiveLayer(1),
      () => setActiveLayer(2),
      () => {
        setStatuses((s) => ({ ...s, validator: "pass" }));
        setActiveLayer(-1);
        setRunning(false);
      },
    ];

    let i = 0;
    const tick = () => {
      if (i < seq.length) {
        seq[i]();
        i++;
        setTimeout(tick, 900);
      }
    };
    tick();
  }

  return { statuses, activeLayer, running, runPipeline };
}

export function ASIView() {
  const { statuses, activeLayer, running, runPipeline } =
    useSimulatedPipeline();

  return (
    <>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: 14,
          marginBottom: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span style={{ color: "var(--violet)", fontSize: 14 }}>◈</span>
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            ASI Autonomous Engineering System — v2
          </span>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 9, color: "var(--text2)" }}>
              TRUST NOTHING · VERIFY ×3
            </span>
            <button
              onClick={runPipeline}
              disabled={running}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                padding: "4px 12px",
                borderRadius: 2,
                cursor: running ? "not-allowed" : "pointer",
                background: running
                  ? "rgba(139,92,246,.08)"
                  : "rgba(163,230,53,.1)",
                border: running
                  ? "1px solid rgba(139,92,246,.3)"
                  : "1px solid rgba(163,230,53,.3)",
                color: running ? "var(--violet)" : "var(--acid)",
                letterSpacing: 1,
              }}
            >
              {running ? "● RUNNING" : "▶ SIMULATE"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            overflowX: "auto",
          }}
        >
          {LOOP_STEPS.map((step, i) => {
            const agentId = AGENTS[i - 1]?.id;
            const isActive =
              i > 0 &&
              i < 5 &&
              agentId !== undefined &&
              statuses[agentId] === "pass";
            return (
              <div
                key={step.label}
                style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    padding: "8px 12px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,.02)",
                    border: `1px solid ${isActive ? step.activeBorder : "var(--border)"}`,
                    transition: "border-color .4s ease",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: step.color,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--dim)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.sub}
                  </div>
                </div>
                {i < LOOP_STEPS.length - 1 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--dim)",
                      padding: "0 4px",
                      animation: running
                        ? "arrowPulse 1.2s ease-in-out infinite"
                        : undefined,
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "var(--dim)", padding: "0 4px" }}>
            ↺
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 13,
        }}
      >
        {AGENTS.map((a) => (
          <div
            key={a.id}
            style={{
              background: "var(--surface)",
              border: `1px solid ${statuses[a.id] !== "idle" ? a.border : "var(--border)"}`,
              borderRadius: 3,
              padding: 13,
              transition: "border-color .4s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 7,
              }}
            >
              <span style={{ fontSize: 15, color: a.color }}>{a.icon}</span>
              <span
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {a.name}
              </span>
              <div style={{ marginLeft: "auto" }}>
                <StatusDot status={statuses[a.id]} />
              </div>
            </div>
            <div
              style={{ fontSize: 10, color: "var(--text2)", lineHeight: 1.6 }}
            >
              {a.role}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: 13,
          marginBottom: 13,
        }}
      >
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span style={{ color: "var(--accent)" }}>▷</span> Triple Validation
          Pipeline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {VALIDATION_LAYERS.map((layer, i) => (
            <div
              key={layer.label}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 3,
                background:
                  activeLayer === i ? layer.activeBg : "rgba(255,255,255,.02)",
                border: `1px solid ${activeLayer === i ? layer.activeBorder : "var(--border)"}`,
                transition: "all .4s ease",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 2,
                  flexShrink: 0,
                  background:
                    activeLayer === i
                      ? layer.activeBg
                      : "rgba(255,255,255,.04)",
                  border: `1px solid ${activeLayer === i ? layer.activeBorder : "var(--bor2)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--sans)",
                  fontSize: 11,
                  fontWeight: 800,
                  color: layer.color,
                }}
              >
                {layer.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: layer.color,
                    fontWeight: 600,
                    marginBottom: 3,
                  }}
                >
                  {layer.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text2)",
                    lineHeight: 1.6,
                  }}
                >
                  {layer.desc}
                </div>
              </div>
              {activeLayer === i && (
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 9,
                    color: layer.color,
                    fontWeight: 700,
                    letterSpacing: 1,
                    animation: "slaPulse 1s ease-in-out infinite",
                  }}
                >
                  ● ACTIVE
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 13,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: 13,
          }}
        >
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--bad)" }}>↺</span> Self-Heal Loop
          </div>
          {[
            { step: "Rollback", desc: "Restore backup · undo patch" },
            { step: "Diagnose", desc: "Root cause from TSC + lint output" },
            { step: "Regenerate", desc: "New patch from Refactor Agent" },
            { step: "Re-validate", desc: "Triple-check again · count resets" },
            {
              step: "Escalate",
              desc: "After 3 failures → surface to engineer",
            },
          ].map((s, i) => (
            <div
              key={s.step}
              style={{
                display: "flex",
                gap: 9,
                padding: "5px 0",
                borderBottom: i < 4 ? "1px solid var(--border)" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: 1,
                  color: "var(--dim)",
                  paddingTop: 2,
                  minWidth: 18,
                  textAlign: "right",
                }}
              >
                {i + 1}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text)",
                    fontWeight: 600,
                  }}
                >
                  {s.step}
                </div>
                <div style={{ fontSize: 9, color: "var(--text2)" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: 13,
          }}
        >
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--warn)" }}>⊗</span> Bug Resistance Model
          </div>
          {[
            {
              phase: "Prevention",
              color: "var(--done)",
              desc: "Pre-analysis before any write — PRD + hard guard scan",
              pct: 85,
            },
            {
              phase: "Detection",
              color: "var(--accent)",
              desc: "Triple validation catches remaining bugs",
              pct: 12,
            },
            {
              phase: "Correction",
              color: "var(--violet)",
              desc: "Self-heal loop auto-fixes detected issues",
              pct: 3,
            },
          ].map((b) => (
            <div key={b.phase} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 10, color: b.color, fontWeight: 600 }}>
                  {b.phase}
                </span>
                <span style={{ fontSize: 9, color: "var(--dim)" }}>
                  {b.pct}%
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  background: "rgba(255,255,255,.05)",
                  overflow: "hidden",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    background: b.color,
                    width: b.pct + "%",
                  }}
                />
              </div>
              <div style={{ fontSize: 9, color: "var(--text2)" }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <Card
        title={
          <>
            <span style={{ color: "var(--bad)" }}>⊗</span> Hard Guard Status
          </>
        }
      >
        {HARD_GUARDS.map((g, i) => (
          <div
            key={g.guard}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 0",
              borderBottom:
                i < HARD_GUARDS.length - 1 ? "1px solid var(--border)" : "none",
              fontSize: 11,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flexShrink: 0,
                background: g.ok ? "var(--done)" : "var(--bad)",
                boxShadow: `0 0 5px ${g.ok ? "var(--done)" : "var(--bad)"}`,
              }}
            />
            <div
              style={{ minWidth: 140, color: "var(--text)", fontWeight: 600 }}
            >
              {g.guard}
            </div>
            <div style={{ flex: 1, fontSize: 10, color: "var(--text2)" }}>
              {g.check}
            </div>
            <div
              style={{
                fontSize: 9,
                color: g.ok ? "var(--done)" : "var(--bad)",
                fontWeight: 700,
              }}
            >
              {g.ok ? "PASS" : "OPEN"}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
