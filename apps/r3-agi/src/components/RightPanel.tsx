import { useState, useRef, useEffect } from "react";
import { useAGI } from "../store/useAGI";

const SYSTEM_PROMPT = `You are the AGI Command Agent for R3 v4, an AI-native Digital Audio Workstation.

═══ IDENTITY ═══
- LLPTE = Low-Latency Processing Transition Engine (NOT Language-driven, NOT Language-Model)
- Stack: tRPC + Express 4.22.1 · Drizzle ORM 0.39.3 + PostgreSQL · Wouter (NOT react-router-dom) · Vite + React 18 · Zustand (NOT Redux)
- Tiers (Stripe ONLY, lowercase): explorer · creator · pro_artist — NEVER "free","Pro","Studio","Starter"
- Payments: Stripe v20.4.1 ONLY. Never LemonSqueezy. Never other payment providers.
- Post-login redirect: /instrument ONLY — never /daw
- Hard guard: never hydrateFromToken() inside ProtectedRoute render
- All Anthropic/AI calls: server-side ONLY via admin.agentChat — never expose API keys to browser

═══ LLPTE PIPELINE (PRD §8.5) ═══
Node order — NEVER reorder:
  inputRouter (llpte-adapters) → spectralAnalyzer (llpte-signal) → aiMixEngine (llpte-ai) → transitionGraph (llpte-transition-graph) → outputBus (llpte-execution)

HARD SLAs (non-negotiable):
- Inference latency: ≤15ms ceiling · p50 target: 10ms
- Tick rate: 0.8ms
- Active edges: 847
- Confidence gate for auto-apply: ≥0.65
- Confidence gate for suggestion: ≥0.40 (SUGGESTION_THRESHOLD — module-scope const in AutoLevelEngine.ts)
- Below 0.40: discard → log to aiDecisionLog only
- PRD acceptance rate gate: ≥65% — tracked via sessionMetrics.getAcceptanceRate

MODULE RULES:
- spectralAnalyzer lives in llpte-signal. There is NO @llpte/spectral package.
- .ts sources resolve before .js artifacts in shared/ — do not modify resolve.extensions order in vite.config.ts
- Audio: WASM + SharedArrayBuffer + AudioWorklet only — nothing on main thread
- Waveform: WebGPU renderer — no canvas 2D fallback in production
- Inference: quantized + SIMD — no unquantized model calls in hot path
- Zero GC pressure in hot path — typed array pool allocators only

═══ API SURFACE — v2.0.0 (2026-04-12) ═══
Transport: tRPC over HTTP · Base: localhost:3000/trpc (dev) | Railway URL (prod)
Auth: JWT via Authorization: Bearer <token> on all protected procedures

appRouter (11 routers):
  ping.health                    → { status, ts }  [PUBLIC]
  sessions.start                 mutate({ bpm, trackIds }) → { sessionId }
  sessions.stop                  mutate({ sessionId }) → { durationSeconds, timeSavedSeconds }
  sessions.getSummary            query({ sessionId }) → SessionMetricsSummary | null
  sessionMetrics.getAcceptanceRate query({ sessionId }) → { accepted, total, rate }  ← PRD ≥65% gate
  sessionMetrics.getTimeSavings  query({ sessionId }) → { totalSavedSeconds, percentageFaster }
  aiMix.analyze                  mutate({ genre, targetLoudness(LUFS), enableStemSeparation, sessionId? })
                                   → { suggestions: [{channelId, type, confidence, decision, decisionId}], latencyMs }
                                   Rate: 30 req/min
  aiMix.recordOutcome            mutate({ decisionId, outcome: 'accepted'|'rejected'|'ignored' }) → void
  aiMix.getTransitions           query({ fromTrackId, toTrackId }) → { transitions: [{type, confidence, camelotScore}] }
  mixer.getState                 query() → { tracks, masterGain }
  mixer.updateTrack              mutate({ trackId, gain, mute, solo })
  mixer.applyAISuggestion        mutate({ trackId, gainLinear, decisionId })  ← AudioParam.setTargetAtTime, click-free
  dj.setCrossfader               mutate({ position: 0–1 })
  dj.setHotCue                   mutate({ deckId, cueIndex: 0–7, positionMs })
  dj.getCues                     query({ deckId }) → { cues }
  subscription.getStatus         query() → { tier, status, currentPeriodEnd }
  subscription.createCheckout    mutate({ tier, successUrl, cancelUrl }) → { checkoutUrl }
  subscription.cancelSubscription mutate() → { canceledAt, expiresAt }
  projects.list/get/create/update/delete
  presets.listEffects/createEffectPreset/updateEffectPreset/deleteEffectPreset
  settings.get/update            (17 setting columns)
  admin.checkAccess              query() → { isAdmin }  ← requires users.isAdmin = true
  admin.agentChat                mutate({ message, history }) → { reply }  ← Anthropic server-side ONLY
  daw.*                          DAW state + arrangement procedures

Legacy REST (effects/waveform surface — NOT tRPC, not type-safe):
  GET/POST  /api/effects/presets · GET/PUT/DELETE /api/effects/presets/:id
  GET/POST  /api/effects/chains  · POST /api/waveform/analyze|slice|edit
  GET/POST  /api/presets         · GET/PUT/DELETE /api/presets/:id

Error codes: UNAUTHORIZED(401) · FORBIDDEN(403) · NOT_FOUND(404) · BAD_REQUEST(400) · INTERNAL_SERVER_ERROR(500)
Rate limits: Auth 10/min · tRPC 100/min · /waveform/* 50/min · aiMix.analyze 30/min

═══ DB SCHEMA (13 tables) ═══
users · sessions · sessionMetrics · subscriptions · projects · samples · presets · settings
aiDecisionLog(11 cols: id,sessionId,nodeId,actionType,trackId,inputConfidence,displayedConfidence,decision,outcome,latencyMs,timestamp)
effectPresetsTable · effectChainsTable · djCuesTable · waveformEditsTable

═══ CODEBASE STATE (2026-04-17) ═══
- TSC: 0 errors (after this session's fixes)
- appRouter: 11 routers wired (sessions,sessionMetrics,admin,daw,subscription,mixer,dj,aiMix,projects,presets,settings,ping)
- aiDecisionLog schema DONE · migration 0005_overjoyed_gambit.sql GENERATED — NOT applied to Railway (P0 BLOCKER)
- SessionChip L1782 + SessionSummaryPanel L1750 in DAW.tsx ✓
- Stripe v20.4.1 wired · billing.ts (LemonSqueezy) removed · authStore.ts token read restored
- card.tsx/Card.tsx casing conflict resolved · API key prefix literal removed from RightPanel

═══ PRIORITY QUEUE ═══
P0: pnpm drizzle-kit migrate — apply migration 0005 to Railway (DEMO BROKEN without aiDecisionLog)
P1: Wire aiDecisionLog writes in server/services/session-metrics.service.ts
P2: Fix routes/presets.ts as any ×4 (lines 10,11,16,17) · console.log ×5 (server/index.ts:300-308)
P3: Mix Suggestion System — MixSuggestionsPanel.tsx done, backend tRPC wiring missing
P4: Fix vitest.config.ts · migration 0006 materialized views (mv_user_session_averages, mv_ai_acceptance_rates)
P5: Consolidate 9 phantom dirs (client/src/store is LIVE — active imports, do NOT delete without migrating)

═══ WORKFLOW RULES (Wire.txt protocol) ═══
1. INTERVIEW BEFORE BUILDING — for any new feature/non-trivial change, ask:
   - What is the core problem this solves?
   - Who is this for (DJ, creator, or both)?
   - What does success look like (metric / SLA / behavior)?
   - What should this NOT do?
   Skip only for single-file bug fixes with no API surface changes.

2. VERIFICATION PLAN FIRST — before any work, state:
   - Which files will change and why
   - How correctness will be confirmed (tsc, Vitest, manual flow)
   - What regression risk exists and how it will be mitigated

3. SELF-REVIEW AFTER EVERY TASK:
   - All Hard Guards from CLAUDE.md respected
   - No redundant imports or dead code
   - No type errors, auth regressions, or store conflicts
   - pnpm tsc --noEmit passes clean

4. READ-BEFORE-WRITE (Wire.txt):
   - Read every file in the full import graph before any destructive action
   - Confirm file contents, occurrence counts, anchor text
   - Assert anchors match before applying patches
   - Never assume — read, then act
   - Python replace(old, new, 1) over sed for precision
   - Timestamped backup before destructive ops

Stack pins: TS 5.9.3 · Three.js 0.128.0 · Stripe 20.4.1 · ws 8.20.0 · Zod 3.25.76 · Node 22.x`;

const quickPrompts = [
  {
    label: "Apply migration P0",
    text: "Walk me through applying migration 0005 to Railway safely",
  },
  {
    label: "Wire aiDecisionLog P1",
    text: "Write the exact TypeScript to wire aiDecisionLog writes into session-metrics.service.ts",
  },
  {
    label: "Fix presets.ts any P2",
    text: "Fix the 4 as any casts in server/routes/presets.ts with proper Drizzle types",
  },
  {
    label: "Fix console.log P2",
    text: "How do I replace console.log in server/index.ts:300-308 with morgan?",
  },
  {
    label: "Mix Suggestions P3",
    text: "What is the correct architecture for Mix Suggestion System backend? Which router?",
  },
  {
    label: "Fix test runner P4",
    text: "Fix vitest.config.ts to output actual test results",
  },
  {
    label: "LLPTE pipeline",
    text: "Explain the LLPTE pipeline node order and what each package does",
  },
];

const memItems = [
  {
    key: "Codebase",
    val: (
      <>
        TSC: <code>0 errors</code> · Routers: <code>11/11</code> · MVP:{" "}
        <code>3/4</code>
      </>
    ),
  },
  {
    key: "P0 Blocker",
    val: (
      <>
        Migration <code>0005_overjoyed_gambit.sql</code> NOT applied to Railway.
        Demo acceptance rate = 0.
      </>
    ),
  },
  {
    key: "Hard Guards Remaining",
    val: (
      <>
        <code className="bad">5×any</code> routes/presets.ts ·{" "}
        <code className="bad">5×console.log</code> server/index.ts:300-308
      </>
    ),
  },
  {
    key: "LLPTE Contract",
    val: (
      <>
        10ms p50 · 847 edges · 0.8ms tick · spectralAnalyzer in{" "}
        <code>llpte-signal</code>
      </>
    ),
  },
  {
    key: "Fixes This Session",
    val: (
      <>
        authStore.ts stored token · billing.ts removed · App.tsx import · git
        credentials
      </>
    ),
  },
  {
    key: "Stack Rules",
    val: (
      <>
        Wouter (NOT react-router) · Zustand (NOT Redux) · Stripe ONLY (NOT
        LemonSqueezy)
      </>
    ),
  },
  {
    key: "Tiers",
    val: (
      <>
        <code>explorer</code> · <code>creator</code> · <code>pro_artist</code> —
        never "free", "Pro", "Studio"
      </>
    ),
  },
];

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line?.startsWith("```")) {
      const lang = line?.slice(3)?.trim() ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      nodes.push(
        <pre
          key={nodes.length}
          style={{
            background: "rgba(0,0,0,.6)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "10px 12px",
            fontSize: 10,
            lineHeight: 1.7,
            color: "#7a9eb8",
            margin: "6px 0",
            overflowX: "auto",
          }}
        >
          {lang && (
            <div
              style={{
                fontSize: 8,
                color: "var(--dim)",
                marginBottom: 5,
                letterSpacing: 1,
              }}
            >
              {lang.toUpperCase()}
            </div>
          )}
          {codeLines.join("\n")}
        </pre>,
      );
    } else if (line?.startsWith("- ") || line?.startsWith("* ")) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i]?.startsWith("- ") || lines[i]?.startsWith("* "))
      ) {
        listItems.push(lines[i]?.slice(2) ?? "");
        i++;
      }
      nodes.push(
        <ul
          key={nodes.length}
          style={{ listStyle: "none", padding: 0, margin: "4px 0" }}
        >
          {listItems.map((item, idx) => (
            <li
              key={idx}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
                marginBottom: 2,
              }}
            >
              <span
                style={{ color: "var(--acid)", flexShrink: 0, marginTop: 1 }}
              >
                ·
              </span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    } else if (line?.trim() === "") {
      nodes.push(<div key={nodes.length} style={{ height: 4 }} />);
    } else {
      nodes.push(
        <div key={nodes.length} style={{ lineHeight: 1.7 }}>
          {inlineMarkdown(line ?? "")}
        </div>,
      );
    }
    i++;
  }
  return nodes;
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    if (raw.startsWith("`")) {
      parts.push(
        <code
          key={m.index}
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.88em",
            background: "rgba(163,230,53,.08)",
            border: "1px solid rgba(163,230,53,.18)",
            padding: "1px 5px",
            borderRadius: 2,
            color: "var(--accent)",
          }}
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("**")) {
      parts.push(
        <strong key={m.index} style={{ color: "#fff", fontWeight: 700 }}>
          {raw.slice(2, -2)}
        </strong>,
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function RightPanel() {
  const {
    activePanelMode,
    setPanelMode,
    chatMessages,
    addChatMessage,
    clearChat,
    logs,
    clearLog,
    focusBanner,
  } = useAGI();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, typing, streamingContent]);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function sendMessage(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput("");
    addChatMessage("user", t);
    setTyping(true);
    setStreamingContent("");

    const msgs = [
      ...chatMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: t },
    ];

    if (focusBanner && focusBanner !== "Agent focused on current view") {
      msgs.unshift(
        {
          role: "user",
          content: `[CONTEXT FOCUS: ${focusBanner}] Please keep this context in mind.`,
        },
        {
          role: "assistant",
          content:
            "Understood. I am focused on: " + focusBanner + ". How can I help?",
        },
      );
    }

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: msgs }),
      });

      if (!res.ok) {
        setTyping(false);
        const err = await res.json().catch(() => ({}));
        addChatMessage(
          "assistant",
          "⚠ API Error: " + (err?.error || "HTTP " + res.status),
        );
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) {
          lineBuffer += decoder.decode(undefined, { stream: false });
          break;
        }
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6).trim();
          if (data === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "text_delta") {
              accumulated += parsed.text;
              setStreamingContent(accumulated);
            } else if (parsed.type === "error") {
              streamDone = true;
              addChatMessage("assistant", "⚠ " + parsed.message);
              break;
            }
          } catch {
            // non-JSON data lines — skip
          }
        }
      }

      setTyping(false);
      setStreamingContent("");
      addChatMessage("assistant", accumulated || "(empty response)");
    } catch (e: unknown) {
      setTyping(false);
      setStreamingContent("");
      addChatMessage(
        "assistant",
        "⚠ Network error: " + (e instanceof Error ? e.message : String(e)),
      );
    }
  }

  function quickSend(text: string) {
    sendMessage(text);
  }

  function exportChat() {
    const text = chatMessages
      .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "r3v4-agent-session-" + new Date().toISOString().slice(0, 10) + ".txt";
    a.click();
  }

  const panelModes = ["chat", "log", "memory"];
  const panelLabels = ["Chat", "Session Log", "Memory"];

  const tagColors: Record<
    string,
    { bg: string; color: string; border: string }
  > = {
    "lt-cmd": {
      bg: "rgba(163,230,53,.1)",
      color: "var(--accent)",
      border: "1px solid rgba(163,230,53,.2)",
    },
    "lt-fix": {
      bg: "rgba(163,230,53,.07)",
      color: "var(--accent)",
      border: "1px solid rgba(163,230,53,.18)",
    },
    "lt-p0": {
      bg: "rgba(255,61,113,.12)",
      color: "var(--bad)",
      border: "1px solid rgba(255,61,113,.2)",
    },
  };

  const msgBubbleStyle = (role: string) => ({
    background:
      role === "user" ? "rgba(163,230,53,.03)" : "rgba(255,255,255,.03)",
    border: `1px solid ${role === "user" ? "rgba(163,230,53,.12)" : "var(--border)"}`,
    borderRadius: 3,
    padding: "9px 11px",
    fontSize: 11,
    lineHeight: 1.7,
    color: "var(--text)",
    wordBreak: "break-word" as const,
  });

  return (
    <aside
      style={{
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 13px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexShrink: 0,
          background: "var(--surface)",
        }}
      >
        <span style={{ color: "var(--acid)" }}>⬡</span>
        <span
          style={{
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          AGI Agent
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 8,
            letterSpacing: 1,
            color: "var(--accent)",
            background: "rgba(163,230,53,.07)",
            border: "1px solid rgba(163,230,53,.18)",
            padding: "2px 6px",
            borderRadius: 2,
          }}
        >
          claude-sonnet-4-6
        </span>
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          background: "var(--surface)",
        }}
      >
        {panelModes.map((m, i) => (
          <div
            key={m}
            onClick={() => setPanelMode(m)}
            style={{
              flex: 1,
              padding: "6px 0",
              textAlign: "center",
              fontSize: 9,
              letterSpacing: 1,
              textTransform: "uppercase" as const,
              cursor: "pointer",
              color: activePanelMode === m ? "var(--acid)" : "var(--text2)",
              borderBottom: `2px solid ${activePanelMode === m ? "var(--acid)" : "transparent"}`,
            }}
          >
            {panelLabels[i]}
          </div>
        ))}
      </div>

      {activePanelMode === "chat" && (
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            <div style={{ animation: "fadeUp .18s ease both" }}>
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: 2,
                  textTransform: "uppercase" as const,
                  color: "var(--acid)",
                  marginBottom: 3,
                }}
              >
                R3 AGI AGENT
              </div>
              <div
                style={{
                  ...msgBubbleStyle("assistant"),
                  whiteSpace: "pre-wrap",
                }}
              >
                {`R3 v4 Command Agent online — PRD v4.0 + session context loaded.\n\nContext active:\n• 11 routers wired · aiDecisionLog schema done\n• P0: migration 0005 pending Railway apply\n• LLPTE: 10ms p50 · 847 edges · 0.8ms tick\n• authStore.ts restored · billing.ts removed\n• Tiers: explorer · creator · pro_artist (Stripe only)\n\nSwitch views to focus agent context. Enter key above.`}
              </div>
            </div>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ animation: "fadeUp .18s ease both" }}>
                <div
                  style={{
                    fontSize: 8,
                    letterSpacing: 2,
                    textTransform: "uppercase" as const,
                    color: m.role === "user" ? "var(--text2)" : "var(--acid)",
                    marginBottom: 3,
                  }}
                >
                  {m.role === "user" ? "YOU" : "R3 AGI AGENT"}
                </div>
                <div style={msgBubbleStyle(m.role)}>
                  {m.role === "assistant"
                    ? renderMarkdown(m.content)
                    : m.content}
                </div>
              </div>
            ))}
            {(typing || streamingContent) && (
              <div style={{ animation: "fadeUp .18s ease both" }}>
                <div
                  style={{
                    fontSize: 8,
                    letterSpacing: 2,
                    textTransform: "uppercase" as const,
                    color: "var(--acid)",
                    marginBottom: 3,
                  }}
                >
                  R3 AGI AGENT
                </div>
                <div style={msgBubbleStyle("assistant")}>
                  {streamingContent ? (
                    <>
                      {renderMarkdown(streamingContent)}
                      <span
                        style={{
                          display: "inline-block",
                          width: 7,
                          height: 11,
                          background: "var(--acid)",
                          opacity: 0.8,
                          animation: "blink 1s ease-in-out infinite",
                          verticalAlign: "text-bottom",
                          marginLeft: 2,
                          borderRadius: 1,
                        }}
                      />
                    </>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        gap: 3,
                        alignItems: "center",
                        padding: "3px 0",
                      }}
                    >
                      {[0, 0.22, 0.44].map((d, i) => (
                        <div
                          key={i}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "var(--acid)",
                            animation: `blink 1.3s ${d}s infinite ease-in-out`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              padding: 9,
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flexShrink: 0,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
              {quickPrompts.map((q) => (
                <button
                  key={q.label}
                  onClick={() => quickSend(q.text)}
                  style={{
                    fontSize: 9,
                    padding: "3px 7px",
                    border: "1px solid var(--bor2)",
                    borderRadius: 2,
                    color: "var(--text2)",
                    cursor: "pointer",
                    background: "transparent",
                    fontFamily: "var(--mono)",
                    transition: "all .12s",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.borderColor = "var(--acid)";
                    (e.target as HTMLElement).style.color = "var(--acid)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.borderColor = "var(--bor2)";
                    (e.target as HTMLElement).style.color = "var(--text2)";
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about patches, architecture, or codebase..."
              rows={3}
              style={{
                width: "100%",
                background: "rgba(0,0,0,.4)",
                border: "1px solid var(--bor2)",
                borderRadius: 3,
                color: "var(--text)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                padding: "8px 10px",
                resize: "none" as const,
                outline: "none",
                minHeight: 58,
              }}
            />
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <button
                onClick={clearChat}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: 1,
                  padding: "4px 9px",
                  borderRadius: 2,
                  border: "1px solid var(--bor2)",
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--text2)",
                  textTransform: "uppercase" as const,
                }}
              >
                Clear
              </button>
              <button
                onClick={exportChat}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: 1,
                  padding: "4px 9px",
                  borderRadius: 2,
                  border: "1px solid var(--bor2)",
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--text2)",
                  textTransform: "uppercase" as const,
                }}
              >
                Export
              </button>
              <button
                onClick={() => sendMessage()}
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: 1,
                  padding: "6px 12px",
                  borderRadius: 2,
                  border: "none",
                  cursor: "pointer",
                  background: "var(--accent)",
                  color: "#000",
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                }}
              >
                Send ↵
              </button>
            </div>
          </div>
        </div>
      )}

      {activePanelMode === "log" && (
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {logs.map((log, i) => {
              const tc = tagColors[log.cls] ?? tagColors["lt-cmd"];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    fontSize: 10,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--dim)",
                      flexShrink: 0,
                      fontSize: 9,
                      marginTop: 1,
                    }}
                  >
                    {log.ts}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 2,
                      flexShrink: 0,
                      ...tc,
                    }}
                  >
                    {log.tag}
                  </span>
                  <span style={{ color: "var(--text2)", flex: 1 }}>
                    {log.text}
                  </span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
          <div
            style={{
              padding: 9,
              borderTop: "1px solid var(--border)",
              flexShrink: 0,
              background: "var(--surface)",
            }}
          >
            <button
              onClick={clearLog}
              style={{
                width: "100%",
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: 1,
                padding: "4px 9px",
                borderRadius: 2,
                border: "1px solid var(--bor2)",
                cursor: "pointer",
                background: "transparent",
                color: "var(--text2)",
                textTransform: "uppercase" as const,
              }}
            >
              Clear Log
            </button>
          </div>
        </div>
      )}

      {activePanelMode === "memory" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {memItems.map((item) => (
            <div
              key={item.key}
              style={{
                padding: 9,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 3,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "var(--dim)",
                  textTransform: "uppercase" as const,
                  marginBottom: 4,
                }}
              >
                {item.key}
              </div>
              <div style={{ fontSize: 11, color: "var(--text)" }}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
