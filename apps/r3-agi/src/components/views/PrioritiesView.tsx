import { useAGI } from "../../store/useAGI";
import { Card } from "../ui/Card";

const tagColors: Record<string, { bg: string; color: string; border: string }> =
  {
    "pt-p0": {
      bg: "rgba(255,61,113,.15)",
      color: "var(--bad)",
      border: "1px solid rgba(255,61,113,.25)",
    },
    "pt-p1": {
      bg: "rgba(245,158,11,.12)",
      color: "var(--warn)",
      border: "1px solid rgba(245,158,11,.22)",
    },
    "pt-p2": {
      bg: "rgba(163,230,53,.1)",
      color: "var(--good)",
      border: "1px solid rgba(163,230,53,.2)",
    },
    "pt-p3": {
      bg: "rgba(16,185,129,.1)",
      color: "var(--done)",
      border: "1px solid rgba(16,185,129,.2)",
    },
    "pt-p4": {
      bg: "rgba(0,229,255,.08)",
      color: "var(--accent)",
      border: "1px solid rgba(0,229,255,.18)",
    },
    "pt-p5": {
      bg: "rgba(139,92,246,.08)",
      color: "var(--violet)",
      border: "1px solid rgba(139,92,246,.18)",
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
            <span style={{ color: "var(--acid)" }}>▶</span> Live Priority Queue
            — Click to Mark Done
          </>
        }
      >
        {prios.map((p, i) => {
          const tc = tagColors[p.cls] ?? tagColors["pt-p4"];
          return (
            <div
              key={i}
              onClick={() => togglePrio(i)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 11,
                padding: "10px 0",
                borderBottom:
                  i < prios.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
                borderRadius: 2,
                opacity: p.done ? 0.45 : 1,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 2,
                  flexShrink: 0,
                  marginTop: 2,
                  border: `1px solid ${p.done ? "var(--done)" : "var(--bor2)"}`,
                  background: p.done ? "rgba(16,185,129,.2)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "var(--done)",
                }}
              >
                {p.done ? "✓" : ""}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 2,
                  letterSpacing: 1,
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
                    fontSize: 12,
                    color: p.done ? "var(--dim)" : "var(--text)",
                    textDecoration: p.done ? "line-through" : "none",
                    marginBottom: 3,
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text2)",
                    lineHeight: 1.6,
                  }}
                >
                  {p.detail}
                </div>
                {p.cmd && (
                  <div
                    style={{ fontSize: 10, color: "var(--acid)", marginTop: 4 }}
                  >
                    {p.cmd}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <Card
        title={
          <>
            <span style={{ color: "var(--acid)" }}>◈</span> Valuation Gates
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
            <tr>
              <td style={{ color: "var(--warn)" }}>→ Current</td>
              <td>$180K–$400K</td>
              <td>Baseline</td>
            </tr>
            <tr>
              <td>Demo + 50 beta users</td>
              <td>$800K–$2.5M</td>
              <td style={{ color: "var(--warn)" }}>P0 + P1 done</td>
            </tr>
            <tr>
              <td>≥65% AI acceptance</td>
              <td>$3–6M seed</td>
              <td style={{ color: "var(--text2)" }}>P0 + P1 + P3</td>
            </tr>
            <tr>
              <td>$120K ARR (500 users)</td>
              <td>$4.8–9.6M</td>
              <td style={{ color: "var(--text2)" }}>12mo post-launch</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </>
  );
}
