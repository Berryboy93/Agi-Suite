import { Card } from "@/components/Card";

const FLYWHEEL_STEPS = [
  {
    label: "User Action",
    sub: "Mix event · EQ tweak · transition trigger",
    color: "var(--text2)",
    icon: "◉",
  },
  {
    label: "AI Suggestion",
    sub: "LLPTE pipeline · ≥0.40 confidence",
    color: "var(--accent)",
    icon: "⬡",
  },
  {
    label: "Accept / Reject",
    sub: "User response → labeled training signal",
    color: "#00e5ff",
    icon: "◈",
  },
  {
    label: "aiDecisionLog",
    sub: "Confidence · latency · outcome stored",
    color: "var(--violet)",
    icon: "⊕",
  },
  {
    label: "Model Training",
    sub: "Gain classifier · EQ classifier · thresholds",
    color: "var(--warn)",
    icon: "▶",
  },
  {
    label: "Updated Model",
    sub: "Better thresholds · personalized per user",
    color: "var(--done)",
    icon: "✓",
  },
  {
    label: "Better Suggestions",
    sub: "Higher acceptance rate → data flywheel",
    color: "var(--acid)",
    icon: "⚡",
  },
];

const EVOLUTION_STAGES = [
  {
    label: "Stage 1 — Rules",
    status: "done",
    color: "var(--done)",
    desc: "Static thresholds: 0.65 auto-apply · 0.40 suggest · <0.40 discard. Deterministic, inspectable, no learning.",
    items: [
      "Confidence gates fixed in code",
      "LLPTE contract enforced",
      "aiDecisionLog schema designed",
    ],
  },
  {
    label: "Stage 2 — Hybrid",
    status: "current",
    color: "var(--warn)",
    desc: "aiDecisionLog writes wired (P1 DONE). Accumulating training data. Railway migration P0 needed to activate in prod.",
    items: [
      "logAIDecision() implemented ✓",
      "updateAIDecisionOutcome() implemented ✓",
      "Training data accumulating after migration 0005",
    ],
  },
  {
    label: "Stage 3 — Learned System",
    status: "future",
    color: "var(--dim)",
    desc: "Train gain + EQ classifiers from aiDecisionLog.outcome. Personalized thresholds per user. Self-improving moat.",
    items: [
      "Gain decisions classifier (first model)",
      "EQ suggestion classifier (second model)",
      "Per-user threshold adaptation",
      "mv_ai_acceptance_rates driving calibration",
    ],
  },
];

const MATERIALIZED_VIEWS = [
  {
    name: "mv_user_session_averages",
    purpose: "Time Savings baseline calculation",
    status: "pending",
    migration: "0006",
    unblocks: "Time Savings % panel real data",
  },
  {
    name: "mv_ai_acceptance_rates",
    purpose: "Confidence calibration per user",
    status: "pending",
    migration: "0006",
    unblocks: "Personalized AI thresholds · Stage 3",
  },
];

const PERSONALIZATION_EXAMPLES = [
  {
    signal: "User rejects EQ suggestions repeatedly",
    action: "Reduce EQ frequency · raise suggestion threshold",
    color: "var(--warn)",
  },
  {
    signal: "User accepts transitions consistently",
    action: "Auto-apply more aggressively · lower gate to 0.55",
    color: "var(--done)",
  },
  {
    signal: "User in techno/industrial genre",
    action: "Weight hard transitions · boost Camelot jump score",
    color: "var(--accent)",
  },
  {
    signal: "Low acceptance rate session",
    action: "Pull back AI suggestions · surface confidence scores",
    color: "var(--violet)",
  },
];

function FlywheelStep({
  step,
  i,
  total,
}: {
  step: (typeof FLYWHEEL_STEPS)[0];
  i: number;
  total: number;
}) {
  const isLast = i === total - 1;
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "8px 11px",
          borderRadius: 3,
          background: "rgba(255,255,255,.02)",
          border: `1px solid rgba(255,255,255,.07)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 14, color: step.color }}>{step.icon}</div>
        <div
          style={{
            fontSize: 10,
            color: step.color,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {step.label}
        </div>
        <div
          style={{
            fontSize: 8,
            color: "var(--dim)",
            whiteSpace: "nowrap",
            maxWidth: 110,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {step.sub}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg,transparent,rgba(163,230,53,.04),transparent)",
            animation: "shimmer 4s ease infinite",
            animationDelay: `${i * 0.5}s`,
          }}
        />
      </div>
      {!isLast && (
        <div
          style={{
            fontSize: 12,
            color: "var(--dim)",
            padding: "0 4px",
            animation: "arrowPulse 2s ease-in-out infinite",
            animationDelay: `${i * 0.3}s`,
          }}
        >
          →
        </div>
      )}
      {isLast && (
        <div
          style={{
            fontSize: 12,
            color: "var(--acid)",
            padding: "0 4px",
            fontWeight: 700,
          }}
        >
          ↺
        </div>
      )}
    </div>
  );
}

export function IntelligenceView() {
  return (
    <>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(163,230,53,.2)",
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
          <span style={{ color: "var(--acid)", fontSize: 14 }}>⚡</span>
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Intelligence Layer — Data Flywheel
          </span>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 9,
              color: "var(--text2)",
              letterSpacing: 1,
            }}
          >
            ACTIVATES AFTER MIGRATION 0005 → RAILWAY
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {FLYWHEEL_STEPS.map((step, i) => (
            <FlywheelStep
              key={step.label}
              step={step}
              i={i}
              total={FLYWHEEL_STEPS.length}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 8,
          marginBottom: 13,
        }}
      >
        {[
          {
            label: "Labeled Decisions/mo",
            val: "780K",
            sub: "At 5K users · 3 sessions/wk",
            color: "var(--accent)",
            live: false,
          },
          {
            label: "Acceptance Rate",
            val: "—",
            sub: "Requires migration 0005",
            color: "var(--bad)",
            live: false,
          },
          {
            label: "Active Sessions",
            val: "0",
            sub: "Local DB live",
            color: "var(--warn)",
            live: false,
          },
          {
            label: "Beta Users",
            val: "0 / 50",
            sub: "Gate: 50 for $800K val",
            color: "var(--bad)",
            live: false,
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
                lineHeight: 1,
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
                marginTop: 4,
                marginBottom: 3,
              }}
            >
              {c.label}
            </div>
            <div style={{ fontSize: 9, color: "var(--text2)" }}>{c.sub}</div>
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
          <span style={{ color: "var(--violet)" }}>▶</span> LLPTE Evolution Path
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {EVOLUTION_STAGES.map((stage, i) => (
            <div
              key={stage.label}
              style={{
                display: "flex",
                gap: 13,
                padding: "12px 14px",
                borderRadius: 3,
                background:
                  stage.status === "current"
                    ? "rgba(245,158,11,.04)"
                    : stage.status === "done"
                      ? "rgba(16,185,129,.03)"
                      : "rgba(255,255,255,.015)",
                border: `1px solid ${stage.status === "current" ? "rgba(245,158,11,.25)" : stage.status === "done" ? "rgba(16,185,129,.2)" : "var(--border)"}`,
              }}
            >
              <div style={{ flexShrink: 0, paddingTop: 2 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      stage.status === "done"
                        ? "rgba(16,185,129,.2)"
                        : stage.status === "current"
                          ? "rgba(245,158,11,.15)"
                          : "rgba(255,255,255,.05)",
                    border: `1px solid ${stage.color}`,
                    fontFamily: "var(--sans)",
                    fontSize: 10,
                    fontWeight: 800,
                    color: stage.color,
                  }}
                >
                  {i + 1}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: stage.color,
                      fontWeight: 700,
                    }}
                  >
                    {stage.label}
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      padding: "1px 6px",
                      borderRadius: 2,
                      fontWeight: 700,
                      letterSpacing: 1,
                      background:
                        stage.status === "done"
                          ? "rgba(16,185,129,.15)"
                          : stage.status === "current"
                            ? "rgba(245,158,11,.12)"
                            : "rgba(255,255,255,.05)",
                      color: stage.color,
                      border: `1px solid ${stage.status === "done" ? "rgba(16,185,129,.3)" : stage.status === "current" ? "rgba(245,158,11,.3)" : "rgba(255,255,255,.1)"}`,
                    }}
                  >
                    {stage.status === "done"
                      ? "COMPLETE"
                      : stage.status === "current"
                        ? "IN PROGRESS"
                        : "FUTURE"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text2)",
                    lineHeight: 1.6,
                    marginBottom: 8,
                  }}
                >
                  {stage.desc}
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  {stage.items.map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 10,
                        color:
                          stage.status === "future"
                            ? "var(--dim)"
                            : "var(--text2)",
                      }}
                    >
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: stage.color,
                          flexShrink: 0,
                        }}
                      />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
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
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span style={{ color: "var(--accent)" }}>◈</span> Pending:
          Materialized Views (Migration 0006)
        </div>
        {MATERIALIZED_VIEWS.map((v, i) => (
          <div
            key={v.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom:
                i < MATERIALIZED_VIEWS.length - 1
                  ? "1px solid var(--border)"
                  : "none",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--dim)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text)",
                  fontFamily: "var(--mono)",
                  marginBottom: 2,
                }}
              >
                {v.name}
              </div>
              <div style={{ fontSize: 9, color: "var(--text2)" }}>
                {v.purpose}
              </div>
            </div>
            <div
              style={{
                fontSize: 9,
                color: "var(--warn)",
                padding: "2px 7px",
                borderRadius: 2,
                background: "rgba(245,158,11,.08)",
                border: "1px solid rgba(245,158,11,.2)",
              }}
            >
              migration {v.migration}
            </div>
            <div style={{ fontSize: 9, color: "var(--text2)" }}>
              → {v.unblocks}
            </div>
          </div>
        ))}
      </div>

      <Card
        title={
          <>
            <span style={{ color: "var(--violet)" }}>⬡</span> Personalization
            Engine — Examples
          </>
        }
      >
        {PERSONALIZATION_EXAMPLES.map((ex, i) => (
          <div
            key={i}
            style={{
              padding: "8px 0",
              borderBottom:
                i < PERSONALIZATION_EXAMPLES.length - 1
                  ? "1px solid var(--border)"
                  : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 3,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: ex.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ fontSize: 10, color: "var(--text2)" }}>
                Signal: {ex.signal}
              </div>
            </div>
            <div style={{ fontSize: 10, color: ex.color, paddingLeft: 11 }}>
              → {ex.action}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
