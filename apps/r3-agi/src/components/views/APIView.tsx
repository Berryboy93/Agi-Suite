import { useState } from "react";
import { Card } from "@/components/Card";

interface Proc {
  name: string;
  type: string;
  auth: boolean;
  input?: string;
  returns?: string;
  note?: string;
  limit?: string;
}

interface Router {
  id: string;
  label: string;
  color: string;
  note: string;
  procs: Proc[];
}

const acid = "var(--acid)";
const warn = "var(--warn)";
const done = "var(--done)";
const bad = "var(--bad)";
const violet = "var(--violet)";
const dim = "var(--dim)";
const text2 = "var(--text2)";
const mono = "var(--mono)";
const border = "var(--border)";

const ROUTERS: Router[] = [
  {
    id: "ping",
    label: "ping",
    color: done,
    note: "public",
    procs: [
      {
        name: "ping.health",
        type: "query",
        auth: false,
        returns: "{ status: 'ok', ts: string }",
      },
    ],
  },
  {
    id: "sessions",
    label: "sessions",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "sessions.start",
        type: "mutation",
        auth: true,
        input: "{ bpm, trackIds }",
        returns: "{ sessionId }",
      },
      {
        name: "sessions.stop",
        type: "mutation",
        auth: true,
        input: "{ sessionId }",
        returns: "{ sessionId, durationSeconds, timeSavedSeconds }",
      },
      {
        name: "sessions.getSummary",
        type: "query",
        auth: true,
        input: "{ sessionId }",
        returns: "SessionMetricsSummary | null",
      },
    ],
  },
  {
    id: "sessionMetrics",
    label: "sessionMetrics",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "sessionMetrics.getAcceptanceRate",
        type: "query",
        auth: true,
        input: "{ sessionId }",
        returns: "{ accepted, total, rate }  ← PRD ≥65% gate",
      },
      {
        name: "sessionMetrics.getTimeSavings",
        type: "query",
        auth: true,
        input: "{ sessionId }",
        returns: "{ totalSavedSeconds, percentageFaster }",
      },
    ],
  },
  {
    id: "aiMix",
    label: "aiMix",
    color: violet,
    note: "LLPTE — protected",
    procs: [
      {
        name: "aiMix.analyze",
        type: "mutation",
        auth: true,
        input:
          "{ genre, targetLoudness (LUFS), enableStemSeparation, sessionId? }",
        returns:
          "{ suggestions: [{ channelId, type, confidence, decision, decisionId }], latencyMs }",
        note: "Confidence auto-gates: ≥0.65 auto_applied · ≥0.40 suggested · <0.40 discarded",
        limit: "30 req / min",
      },
      {
        name: "aiMix.recordOutcome",
        type: "mutation",
        auth: true,
        input: "{ decisionId, outcome: 'accepted'|'rejected'|'ignored' }",
        returns: "void",
      },
      {
        name: "aiMix.getTransitions",
        type: "query",
        auth: true,
        input: "{ fromTrackId, toTrackId }",
        returns: "{ transitions: [{ type, confidence, camelotScore }] }",
      },
    ],
  },
  {
    id: "mixer",
    label: "mixer",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "mixer.getState",
        type: "query",
        auth: true,
        returns: "{ tracks, masterGain }",
      },
      {
        name: "mixer.updateTrack",
        type: "mutation",
        auth: true,
        input: "{ trackId, gain, mute, solo }",
      },
      {
        name: "mixer.applyAISuggestion",
        type: "mutation",
        auth: true,
        input: "{ trackId, gainLinear, decisionId }",
        note: "AudioParam.setTargetAtTime() — click-free",
      },
    ],
  },
  {
    id: "dj",
    label: "dj",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "dj.setCrossfader",
        type: "mutation",
        auth: true,
        input: "{ position: 0–1 }",
      },
      {
        name: "dj.setHotCue",
        type: "mutation",
        auth: true,
        input: "{ deckId, cueIndex: 0–7, positionMs }",
      },
      {
        name: "dj.getCues",
        type: "query",
        auth: true,
        input: "{ deckId }",
        returns: "{ cues: [{ index, positionMs, label, color }] }",
      },
    ],
  },
  {
    id: "subscription",
    label: "subscription",
    color: warn,
    note: "Stripe — protected",
    procs: [
      {
        name: "subscription.getStatus",
        type: "query",
        auth: true,
        returns:
          "{ tier: 'explorer'|'creator'|'pro_artist', status, currentPeriodEnd }",
      },
      {
        name: "subscription.createCheckout",
        type: "mutation",
        auth: true,
        input: "{ tier, successUrl, cancelUrl }",
        returns: "{ checkoutUrl }",
      },
      {
        name: "subscription.cancelSubscription",
        type: "mutation",
        auth: true,
        returns: "{ canceledAt, expiresAt }",
      },
    ],
  },
  {
    id: "projects",
    label: "projects",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "projects.list",
        type: "query",
        auth: true,
        returns: "{ projects: [{ id, name, createdAt, updatedAt }] }",
      },
      {
        name: "projects.get",
        type: "query",
        auth: true,
        input: "{ projectId }",
        returns: "{ id, name, arrangementJSON, createdAt }",
      },
      {
        name: "projects.create",
        type: "mutation",
        auth: true,
        input: "{ name, arrangementJSON }",
        returns: "{ projectId }",
      },
      {
        name: "projects.update",
        type: "mutation",
        auth: true,
        input: "{ projectId, arrangementJSON }",
      },
      {
        name: "projects.delete",
        type: "mutation",
        auth: true,
        input: "{ projectId }",
      },
    ],
  },
  {
    id: "presets",
    label: "presets",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "presets.listEffects",
        type: "query",
        auth: true,
        returns: "{ presets: EffectPreset[] }",
      },
      {
        name: "presets.createEffectPreset",
        type: "mutation",
        auth: true,
        input: "{ name, type, data, isFactory }",
      },
      {
        name: "presets.updateEffectPreset",
        type: "mutation",
        auth: true,
        input: "{ presetId, data }",
      },
      {
        name: "presets.deleteEffectPreset",
        type: "mutation",
        auth: true,
        input: "{ presetId }",
      },
    ],
  },
  {
    id: "settings",
    label: "settings",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "settings.get",
        type: "query",
        auth: true,
        returns: "{ theme, audioLatency, midiEnabled, autoSave, … 17 cols }",
      },
      {
        name: "settings.update",
        type: "mutation",
        auth: true,
        input: "{ theme?, audioLatency?, midiEnabled?, … }",
      },
    ],
  },
  {
    id: "admin",
    label: "admin",
    color: bad,
    note: "isAdmin required",
    procs: [
      {
        name: "admin.checkAccess",
        type: "query",
        auth: true,
        returns: "{ isAdmin: boolean }",
      },
      {
        name: "admin.agentChat",
        type: "mutation",
        auth: true,
        input: "{ message, history }",
        returns: "{ reply }",
        note: "Anthropic calls server-side ONLY — never browser-exposed",
      },
    ],
  },
  {
    id: "daw",
    label: "daw",
    color: acid,
    note: "protected",
    procs: [
      {
        name: "daw.*",
        type: "mixed",
        auth: true,
        note: "DAW state + arrangement — see appRouter for full procedures",
      },
    ],
  },
];

const RATE_LIMITS = [
  { surface: "Auth endpoints", limit: "10 req", window: "1 min" },
  { surface: "tRPC procedures", limit: "100 req", window: "1 min" },
  { surface: "/waveform/*", limit: "50 req", window: "1 min" },
  { surface: "aiMix.analyze", limit: "30 req", window: "1 min" },
];

const ERRORS = [
  { code: "UNAUTHORIZED", http: 401, desc: "No valid JWT" },
  { code: "FORBIDDEN", http: 403, desc: "Insufficient tier / role" },
  { code: "NOT_FOUND", http: 404, desc: "Resource not found" },
  { code: "BAD_REQUEST", http: 400, desc: "Zod validation failure" },
  { code: "INTERNAL_SERVER_ERROR", http: 500, desc: "Unhandled server error" },
];

const LEGACY_REST = [
  {
    method: "GET/POST",
    path: "/api/effects/presets",
    desc: "List / create effect presets",
  },
  {
    method: "GET/PUT/DELETE",
    path: "/api/effects/presets/:id",
    desc: "CRUD single preset",
  },
  {
    method: "GET/POST",
    path: "/api/effects/chains",
    desc: "Effect chain operations",
  },
  { method: "POST", path: "/api/waveform/analyze", desc: "Analyze audio file" },
  { method: "POST", path: "/api/waveform/slice", desc: "Slice by transients" },
  { method: "POST", path: "/api/waveform/edit", desc: "Apply edit operation" },
  {
    method: "GET/POST",
    path: "/api/presets",
    desc: "All presets (effects + DJ)",
  },
];

const METHOD_CLR: Record<string, string> = {
  query: done,
  mutation: warn,
  mixed: violet,
};

function RouterCard({
  r,
  expanded,
  onToggle,
}: {
  r: Router;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        border: `1px solid ${expanded ? r.color + "44" : border}`,
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 8,
        transition: "border-color .15s",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 11px",
          cursor: "pointer",
          background: expanded ? `${r.color}08` : "var(--surface)",
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: r.color,
            fontWeight: 700,
            minWidth: 130,
          }}
        >
          {r.label}
        </span>
        <span style={{ fontSize: 9, color: dim }}>{r.note}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: dim }}>
          {r.procs.length} proc{r.procs.length !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 10, color: dim, marginLeft: 6 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${border}`,
            background: "rgba(0,0,0,.25)",
          }}
        >
          {r.procs.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                borderBottom:
                  i < r.procs.length - 1 ? `1px solid ${border}` : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: p.input || p.returns || p.note ? 5 : 0,
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    padding: "1px 5px",
                    borderRadius: 2,
                    background: `${METHOD_CLR[p.type]}18`,
                    color: METHOD_CLR[p.type],
                    border: `1px solid ${METHOD_CLR[p.type]}30`,
                    fontFamily: mono,
                    letterSpacing: 0.5,
                    flexShrink: 0,
                  }}
                >
                  {p.type.toUpperCase()}
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#fff" }}>
                  {p.name}
                </span>
                {!p.auth && (
                  <span style={{ fontSize: 8, color: done, marginLeft: 4 }}>
                    public
                  </span>
                )}
                {p.limit && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 8,
                      color: warn,
                      fontFamily: mono,
                    }}
                  >
                    {p.limit}
                  </span>
                )}
              </div>
              {p.input && (
                <div
                  style={{
                    fontSize: 10,
                    color: text2,
                    fontFamily: mono,
                    marginBottom: 2,
                    paddingLeft: 4,
                  }}
                >
                  <span style={{ color: dim }}>in </span>
                  {p.input}
                </div>
              )}
              {p.returns && (
                <div
                  style={{
                    fontSize: 10,
                    color: text2,
                    fontFamily: mono,
                    marginBottom: 2,
                    paddingLeft: 4,
                  }}
                >
                  <span style={{ color: dim }}>out </span>
                  {p.returns}
                </div>
              )}
              {p.note && (
                <div
                  style={{
                    fontSize: 9,
                    color: violet,
                    marginTop: 3,
                    paddingLeft: 4,
                  }}
                >
                  {p.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function APIView() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    aiMix: true,
    sessions: true,
  });
  const [tab, setTab] = useState<"routers" | "auth" | "errors" | "rest">(
    "routers",
  );

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () =>
    setExpanded(Object.fromEntries(ROUTERS.map((r) => [r.id, true])));
  const collapseAll = () => setExpanded({});

  return (
    <div>
      <Card
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
            }}
          >
            <span style={{ color: acid }}>⬡</span>
            <span>API Reference</span>
            <span style={{ fontSize: 9, color: dim, fontFamily: mono }}>
              v2.0.0 · 2026-04-12
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 9,
                color: text2,
                fontFamily: mono,
              }}
            >
              Transport: tRPC · Base:{" "}
              <span style={{ color: acid }}>localhost:3000/trpc</span>
            </span>
          </div>
        }
      >
        <div style={{ fontSize: 10, color: text2, marginBottom: 10 }}>
          11 routers · JWT Bearer auth on all protected procedures · Stripe
          v20.4.1 billing
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 13 }}>
          {(["routers", "auth", "errors", "rest"] as const).map((t) => (
            <div
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 9,
                padding: "3px 9px",
                borderRadius: 2,
                cursor: "pointer",
                background:
                  tab === t ? "rgba(163,230,53,.15)" : "rgba(255,255,255,.04)",
                color: tab === t ? acid : text2,
                border: `1px solid ${tab === t ? "rgba(163,230,53,.3)" : border}`,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {t === "rest" ? "Legacy REST" : t}
            </div>
          ))}
        </div>

        {tab === "routers" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <span
                onClick={expandAll}
                style={{
                  fontSize: 9,
                  color: acid,
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                EXPAND ALL
              </span>
              <span style={{ color: dim }}>·</span>
              <span
                onClick={collapseAll}
                style={{
                  fontSize: 9,
                  color: dim,
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                COLLAPSE ALL
              </span>
            </div>
            {ROUTERS.map((r) => (
              <RouterCard
                key={r.id}
                r={r}
                expanded={!!expanded[r.id]}
                onToggle={() => toggle(r.id)}
              />
            ))}
          </>
        )}

        {tab === "auth" && (
          <div>
            <div style={{ fontSize: 10, color: text2, marginBottom: 10 }}>
              Standard REST endpoint (not tRPC) for JWT issuance. All other
              endpoints use{" "}
              <span style={{ color: acid, fontFamily: mono }}>
                Authorization: Bearer &lt;token&gt;
              </span>
              .
            </div>
            <div
              style={{
                border: `1px solid ${border}`,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 11px",
                  background: "var(--surface)",
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    padding: "1px 5px",
                    borderRadius: 2,
                    background: "rgba(245,158,11,.12)",
                    color: warn,
                    border: `1px solid rgba(245,158,11,.25)`,
                    fontFamily: mono,
                  }}
                >
                  POST
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: "#fff" }}>
                  /api/auth/login
                </span>
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(0,0,0,.25)",
                  borderTop: `1px solid ${border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: dim,
                    marginBottom: 6,
                    letterSpacing: 1,
                  }}
                >
                  REQUEST
                </div>
                <pre
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    color: text2,
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >{`{ "email": "user@example.com", "password": "…" }`}</pre>
                <div
                  style={{
                    fontSize: 9,
                    color: done,
                    marginTop: 10,
                    marginBottom: 6,
                    letterSpacing: 1,
                  }}
                >
                  RESPONSE 200
                </div>
                <pre
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    color: text2,
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >{`{ "token": "eyJ…", "user": { "id", "email", "tier", "isAdmin" } }`}</pre>
                <div
                  style={{
                    fontSize: 9,
                    color: bad,
                    marginTop: 10,
                    marginBottom: 6,
                    letterSpacing: 1,
                  }}
                >
                  RESPONSE 401
                </div>
                <pre
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    color: text2,
                    margin: 0,
                  }}
                >{`{ "error": "Invalid credentials" }`}</pre>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: "rgba(163,230,53,.04)",
                border: `1px solid rgba(163,230,53,.15)`,
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: dim,
                  marginBottom: 4,
                  letterSpacing: 1,
                }}
              >
                TIERS (Stripe ONLY)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["explorer", "creator", "pro_artist"].map((t) => (
                  <span
                    key={t}
                    style={{ fontFamily: mono, fontSize: 10, color: acid }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 9, color: bad, marginTop: 6 }}>
                NEVER: "free" · "Pro" · "Studio" · "Starter"
              </div>
            </div>
          </div>
        )}

        {tab === "errors" && (
          <div>
            <div style={{ fontSize: 10, color: text2, marginBottom: 12 }}>
              tRPC errors use standard{" "}
              <span style={{ fontFamily: mono, color: acid }}>
                TRPCClientError
              </span>{" "}
              — check{" "}
              <span style={{ fontFamily: mono, color: acid }}>
                err.data?.code
              </span>{" "}
              +{" "}
              <span style={{ fontFamily: mono, color: acid }}>err.message</span>
              .
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
              }}
            >
              <thead>
                <tr>
                  {["TRPCError Code", "HTTP", "Meaning"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        color: dim,
                        fontSize: 9,
                        letterSpacing: 1,
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ERRORS.map((e, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                    <td
                      style={{
                        padding: "5px 8px",
                        fontFamily: mono,
                        color: warn,
                      }}
                    >
                      {e.code}
                    </td>
                    <td style={{ padding: "5px 8px", color: text2 }}>
                      {e.http}
                    </td>
                    <td style={{ padding: "5px 8px", color: text2 }}>
                      {e.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                marginTop: 14,
                fontSize: 9,
                color: dim,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              RATE LIMITS
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
              }}
            >
              <thead>
                <tr>
                  {["Surface", "Limit", "Window"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        color: dim,
                        fontSize: 9,
                        letterSpacing: 1,
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RATE_LIMITS.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                    <td
                      style={{
                        padding: "5px 8px",
                        fontFamily: mono,
                        color: acid,
                        fontSize: 10,
                      }}
                    >
                      {r.surface}
                    </td>
                    <td style={{ padding: "5px 8px", color: warn }}>
                      {r.limit}
                    </td>
                    <td style={{ padding: "5px 8px", color: text2 }}>
                      {r.window}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "rest" && (
          <div>
            <div style={{ fontSize: 10, color: warn, marginBottom: 10 }}>
              Legacy REST endpoints alongside tRPC for the effects/waveform
              surface. These are not type-safe — use tRPC where possible.
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
              }}
            >
              <thead>
                <tr>
                  {["Method", "Path", "Description"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        color: dim,
                        fontSize: 9,
                        letterSpacing: 1,
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEGACY_REST.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                    <td
                      style={{
                        padding: "5px 8px",
                        fontFamily: mono,
                        color: done,
                        fontSize: 9,
                      }}
                    >
                      {r.method}
                    </td>
                    <td
                      style={{
                        padding: "5px 8px",
                        fontFamily: mono,
                        color: acid,
                        fontSize: 10,
                      }}
                    >
                      {r.path}
                    </td>
                    <td style={{ padding: "5px 8px", color: text2 }}>
                      {r.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 9, color: dim }}>
              See API_REFERENCE v1.0.0 for full waveform endpoint documentation.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
