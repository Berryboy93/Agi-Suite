import { useState, useRef, useEffect, useCallback } from "react";

// ─── Design Tokens (Wire.txt §5 — acid-techno palette) ────────────────────────
const T = {
  black: "#060606",
  acid: "#a3e635",
  cyan: "#00F5FF",
  violet: "#8B5CF6",
  amber: "#F59E0B",
  red: "#EF4444",
  emerald: "#10B981",
  z950: "#09090b",
  z900: "#18181b",
  z800: "#27272a",
  z700: "#3f3f46",
  z600: "#52525b",
  z500: "#71717a",
  z400: "#a1a1aa",
  z300: "#d4d4d8",
  z100: "#f4f4f5",
};

interface AgentDef {
  id: string;
  category: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  status: "online" | "offline" | "busy";
  sources: string[];
  quickActions: string[];
  systemPrompt: string;
}

// ─── Agent Definitions ────────────────────────────────────────────────────────
const AGENTS: AgentDef[] = [
  {
    id: "wire",
    category: "PRIME",
    name: "The Wire",
    role: "Prime Directive",
    icon: "⬡",
    color: T.acid,
    status: "online",
    sources: ["Wire.txt"],
    quickActions: ["Invariants?", "Hard stops?", "Final Principle?"],
    systemPrompt: "You are The Wire — supreme session contract authority.",
  },
  {
    id: "constitution",
    category: "PRIME",
    name: "Constitution",
    role: "Hard Guards",
    icon: "⚖",
    color: T.acid,
    status: "online",
    sources: ["CLAUDE.md"],
    quickActions: ["8 Hard Guards?", "MVP queue?", "PRD gates?"],
    systemPrompt: "You are the Constitution — project identity authority.",
  },
  {
    id: "llpte",
    category: "AI PIPELINE",
    name: "LLPTE Oracle",
    role: "Pipeline SLAs",
    icon: "≋",
    color: T.violet,
    status: "online",
    sources: ["llpte.md"],
    quickActions: ["Node order?", "Hard SLAs?", "Confidence gating?"],
    systemPrompt: "You are the LLPTE Oracle — AI pipeline expert.",
  },
  {
    id: "arch",
    category: "AI PIPELINE",
    name: "Arch Agent",
    role: "System Architecture",
    icon: "◈",
    color: T.violet,
    status: "online",
    sources: ["ARCHITECTURE.md"],
    quickActions: ["WASM arch?", "WebGPU?", "Tick loop?"],
    systemPrompt: "You are the Arch Agent — system architecture authority.",
  },
  {
    id: "design",
    category: "INTERFACE",
    name: "Design Oracle",
    role: "UI/UX Tokens",
    icon: "◉",
    color: T.cyan,
    status: "online",
    sources: ["DESIGN_SYSTEM.md"],
    quickActions: ["Palette?", "Spacing?", "Elevations?"],
    systemPrompt: "You are the Design Oracle — design system authority.",
  },
  {
    id: "demo",
    category: "INTERFACE",
    name: "Demo Director",
    role: "Onboarding",
    icon: "▶",
    color: T.cyan,
    status: "online",
    sources: ["DEMO.md"],
    quickActions: ["First-time flow?", "Tier demo?", "Onboarding?"],
    systemPrompt: "You are the Demo Director — user experience authority.",
  },
  {
    id: "schema",
    category: "DATA LAYER",
    name: "Schema Architect",
    role: "DB Schema",
    icon: "▤",
    color: T.emerald,
    status: "online",
    sources: ["drizzle/schema.ts"],
    quickActions: ["13 tables?", "aiDecisionLog?", "Migration 0005?"],
    systemPrompt: "You are the Schema Architect — database authority.",
  },
  {
    id: "auth",
    category: "DATA LAYER",
    name: "Auth Guardian",
    role: "Security",
    icon: "🔒",
    color: T.emerald,
    status: "online",
    sources: ["auth.md"],
    quickActions: ["JWT flow?", "Middleware?", "Routes?"],
    systemPrompt: "You are the Auth Guardian — security authority.",
  },
  {
    id: "builder",
    category: "BUILD",
    name: "Build Master",
    role: "CI/CD",
    icon: "🔧",
    color: T.amber,
    status: "online",
    sources: ["turbo.json"],
    quickActions: ["Pipeline?", "Railway?", "Scripts?"],
    systemPrompt: "You are the Build Master — deployment authority.",
  },
  {
    id: "tester",
    category: "BUILD",
    name: "Test Runner",
    role: "Testing",
    icon: "✓",
    color: T.amber,
    status: "online",
    sources: ["vitest.config.ts"],
    quickActions: ["Coverage?", "Run test?", "Fixtures?"],
    systemPrompt: "You are the Test Runner — testing authority.",
  },
  {
    id: "guardian",
    category: "QUALITY",
    name: "Code Guardian",
    role: "Type Safety",
    icon: "🛡",
    color: T.red,
    status: "online",
    sources: ["CLAUDE.md"],
    quickActions: ["TSC errors?", "Violations?", "Fix any?"],
    systemPrompt: "You are the Code Guardian — quality authority.",
  },
  {
    id: "auditor",
    category: "QUALITY",
    name: "Security Auditor",
    role: "Compliance",
    icon: "🔍",
    color: T.red,
    status: "online",
    sources: ["SECURITY.md"],
    quickActions: ["Posture?", "Vulnerabilities?", "Rate limits?"],
    systemPrompt: "You are the Security Auditor — compliance authority.",
  },
  {
    id: "analyst",
    category: "STRATEGY",
    name: "Business Analyst",
    role: "Metrics",
    icon: "📊",
    color: T.z400,
    status: "online",
    sources: ["VALUATION.md"],
    quickActions: ["Valuation?", "Acceptance?", "Growth?"],
    systemPrompt: "You are the Business Analyst — strategy authority.",
  },
  {
    id: "planner",
    category: "STRATEGY",
    name: "Roadmap Planner",
    role: "MVP Queue",
    icon: "🗺",
    color: T.z400,
    status: "online",
    sources: ["ROADMAP.md"],
    quickActions: ["MVP status?", "P0 blockers?", "Schedule?"],
    systemPrompt: "You are the Roadmap Planner — planning authority.",
  },
];

const CATEGORIES = [
  "PRIME",
  "AI PIPELINE",
  "INTERFACE",
  "DATA LAYER",
  "BUILD",
  "QUALITY",
  "STRATEGY",
];

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMessage(text: string, accentColor: string): React.ReactNode[] {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const lang = lines[0]?.trim() ?? "";
      const code = lines.slice(1).join("\n");
      return (
        <div
          key={i}
          style={{
            margin: "8px 0",
            borderRadius: 6,
            border: `1px solid ${T.z700}`,
            overflow: "hidden",
          }}
        >
          {lang && (
            <div
              style={{
                padding: "4px 10px",
                background: T.z800,
                borderBottom: `1px solid ${T.z700}`,
                fontSize: 10,
                color: accentColor,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
              }}
            >
              {lang}
            </div>
          )}
          <pre
            style={{
              margin: 0,
              padding: "10px 12px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: 1.6,
              color: T.z100,
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((ip, j) => {
          if (ip.startsWith("`") && ip.endsWith("`")) {
            return (
              <code
                key={j}
                style={{
                  background: T.z800,
                  border: `1px solid ${T.z700}`,
                  borderRadius: 3,
                  padding: "1px 5px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: accentColor,
                }}
              >
                {ip.slice(1, -1)}
              </code>
            );
          }
          return (
            <span key={j} style={{ whiteSpace: "pre-wrap" }}>
              {ip}
            </span>
          );
        })}
      </span>
    );
  });
}

// ─── Quick Action Chip ────────────────────────────────────────────────────────
function QuickChip({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${color}18` : `${color}0A`,
        border: `1px solid ${hov ? color + "60" : color + "30"}`,
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 11,
        color: hov ? color : T.z400,
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({
  msg,
  agent,
}: {
  msg: { role: string; content: string };
  agent: AgentDef;
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: 10,
        marginBottom: 18,
        alignItems: "flex-start",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: `${agent.color}15`,
            border: `1px solid ${agent.color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: agent.color,
            flexShrink: 0,
            boxShadow: `0 0 12px ${agent.color}30`,
            fontFamily: "monospace",
          }}
        >
          {agent.icon}
        </div>
      )}
      <div style={{ maxWidth: "78%", position: "relative" }}>
        <div
          style={{
            background: isUser ? `${T.z800}CC` : `${agent.color}0C`,
            border: `1px solid ${isUser ? T.z700 : agent.color + "30"}`,
            borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
            padding: "10px 14px",
            fontSize: 13,
            lineHeight: 1.7,
            color: T.z100,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
          ) : (
            renderMessage(msg.content, agent.color)
          )}
        </div>
        {!isUser && (
          <button
            onClick={copy}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: "transparent",
              border: "none",
              color: copied ? agent.color : T.z600,
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              padding: "2px 5px",
              transition: "color 0.15s",
            }}
          >
            {copied ? "✓ copied" : "copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function TypingDots({ agent }: { agent: AgentDef }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 18,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: `${agent.color}15`,
          border: `1px solid ${agent.color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: agent.color,
          flexShrink: 0,
          fontFamily: "monospace",
        }}
      >
        {agent.icon}
      </div>
      <div
        style={{
          background: `${agent.color}0C`,
          border: `1px solid ${agent.color}30`,
          borderRadius: "4px 14px 14px 14px",
          padding: "12px 16px",
          display: "flex",
          gap: 5,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: agent.color,
              animation: `agentBlink 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
interface ChatPanelProps {
  agent: AgentDef;
  messages: { role: string; content: string }[];
  setMessages: (
    msgs:
      | { role: string; content: string }[]
      | ((
          prev: { role: string; content: string }[],
        ) => { role: string; content: string }[]),
  ) => void;
}

function ChatPanel({ agent, messages, setMessages }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingFirst, setAwaitingFirst] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, awaitingFirst]);

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || busy) return;
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setError(null);
      const updated = [...messages, { role: "user", content }];
      setMessages(updated);
      setBusy(true);
      setAwaitingFirst(true);
      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: agent.systemPrompt,
            messages: updated.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: { message?: string } })?.error?.message ||
              `HTTP ${res.status}`,
          );
        }
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        setAwaitingFirst(false);
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;
            try {
              const ev = JSON.parse(raw) as { type: string; text?: string };
              if (ev.type === "text_delta") {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant") {
                    next[next.length - 1] = {
                      ...last,
                      content:
                        last.content + (ev as unknown as { text: string }).text,
                    };
                  }
                  return next;
                });
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setAwaitingFirst(false);
      }
    },
    [input, busy, messages, agent.systemPrompt, setMessages],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => {
    setMessages([]);
    setError(null);
  };
  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${agent.color}25`,
          background: `${agent.color}06`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `${agent.color}15`,
            border: `1.5px solid ${agent.color}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: agent.color,
            boxShadow: `0 0 20px ${agent.color}25`,
            fontFamily: "monospace",
          }}
        >
          {agent.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: agent.color,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.04em",
            }}
          >
            {agent.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.z400,
              fontFamily: "Inter, sans-serif",
              marginTop: 1,
            }}
          >
            {agent.role}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {agent.sources.map((s, i) => (
            <div
              key={i}
              style={{
                fontSize: 9,
                padding: "2px 7px",
                background: T.z800,
                border: `1px solid ${T.z700}`,
                borderRadius: 10,
                color: T.z400,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {s}
            </div>
          ))}
          <button
            onClick={clear}
            style={{
              background: "transparent",
              border: `1px solid ${T.z700}`,
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              color: T.z600,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.15s",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.z500;
              (e.currentTarget as HTMLButtonElement).style.color = T.z300;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.z700;
              (e.currentTarget as HTMLButtonElement).style.color = T.z600;
            }}
          >
            CLEAR
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "10px 20px",
          borderBottom: `1px solid ${T.z800}`,
          display: "flex",
          gap: 7,
          overflowX: "auto",
          flexShrink: 0,
          scrollbarWidth: "none",
        }}
      >
        {agent.quickActions.map((qa, i) => (
          <QuickChip
            key={i}
            label={qa}
            color={agent.color}
            onClick={() => send(qa)}
          />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 20px 8px",
          scrollbarWidth: "thin",
          scrollbarColor: `${agent.color}30 transparent`,
        }}
      >
        {isEmpty && !awaitingFirst && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 14,
              textAlign: "center",
              color: T.z600,
            }}
          >
            <div
              style={{
                fontSize: 52,
                color: agent.color,
                opacity: 0.2,
                fontFamily: "monospace",
                textShadow: `0 0 40px ${agent.color}`,
              }}
            >
              {agent.icon}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                lineHeight: 1.8,
              }}
            >
              <div
                style={{ color: agent.color, opacity: 0.6, marginBottom: 4 }}
              >
                {agent.name}
              </div>
              <div style={{ fontSize: 10, opacity: 0.4 }}>
                {agent.sources.join(" · ")}
              </div>
              <div style={{ fontSize: 10, opacity: 0.35, marginTop: 6 }}>
                use a quick action above or type your question
              </div>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} agent={agent} />
        ))}
        {awaitingFirst && <TypingDots agent={agent} />}
        {error && (
          <div
            style={{
              background: `${T.red}12`,
              border: `1px solid ${T.red}40`,
              borderRadius: 8,
              padding: "8px 12px",
              color: "#FCA5A5",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 12,
            }}
          >
            ⚠ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderTop: `1px solid ${T.z800}`,
          background: `${T.black}CC`,
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Ask ${agent.name}…`}
          rows={1}
          style={{
            flex: 1,
            background: T.z900,
            border: `1px solid ${input ? agent.color + "50" : T.z700}`,
            borderRadius: 8,
            padding: "10px 12px",
            color: T.z100,
            fontSize: 13,
            fontFamily: "Inter, sans-serif",
            resize: "none",
            outline: "none",
            lineHeight: 1.5,
            maxHeight: 120,
            overflowY: "auto",
            transition: "border-color 0.2s",
          }}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || busy}
          style={{
            background: !input.trim() || busy ? T.z800 : agent.color,
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            cursor: !input.trim() || busy ? "not-allowed" : "pointer",
            color: !input.trim() || busy ? T.z600 : T.black,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            transition: "all 0.2s",
            boxShadow:
              !input.trim() || busy ? "none" : `0 0 16px ${agent.color}50`,
            letterSpacing: "0.05em",
          }}
        >
          {busy ? "···" : "SEND"}
        </button>
      </div>
    </div>
  );
}

// ─── Conversation persistence ─────────────────────────────────────────────────
const CONVO_STORAGE_KEY = "r3-agent-convos-v1";

function loadConvos(): Record<string, { role: string; content: string }[]> {
  try {
    const raw = localStorage.getItem(CONVO_STORAGE_KEY);
    return raw
      ? (JSON.parse(raw) as Record<string, { role: string; content: string }[]>)
      : {};
  } catch {
    return {};
  }
}

function saveConvos(
  convos: Record<string, { role: string; content: string }[]>,
) {
  try {
    localStorage.setItem(CONVO_STORAGE_KEY, JSON.stringify(convos));
  } catch {
    /* ignore */
  }
}

// ─── Agent Suite Panel ─────────────────────────────────────────────────────────
interface AgentSuitePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentSuitePanel({ isOpen, onClose }: AgentSuitePanelProps) {
  const [activeId, setActiveId] = useState("wire");
  const [_agentStatuses, setAgentStatuses] = useState<Record<string, string>>(
    {},
  );
  const [convos, setConvos] =
    useState<Record<string, { role: string; content: string }[]>>(loadConvos);
  const activeAgent = AGENTS.find((a) => a.id === activeId)!;

  const setMsgs = useCallback(
    (
      msgs:
        | { role: string; content: string }[]
        | ((
            prev: { role: string; content: string }[],
          ) => { role: string; content: string }[]),
    ) => {
      setConvos((prev) => {
        const updated =
          typeof msgs === "function" ? msgs(prev[activeId] ?? []) : msgs;
        const next = { ...prev, [activeId]: updated };
        saveConvos(next);
        return next;
      });
    },
    [activeId],
  );

  // Real-time status polling
  useEffect(() => {
    if (!isOpen) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/agents/status");
        if (res.ok) {
          const data = await res.json();
          setAgentStatuses(data.statuses ?? {});
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  const msgs = convos[activeId] ?? [];

  const counts: Record<string, number> = {};
  AGENTS.forEach((a) => {
    counts[a.id] = (convos[a.id] ?? []).length;
  });

  return (
    <>
      <style>{`
        @keyframes agentBlink{0%,100%{opacity:0.2;transform:scale(0.75);}50%{opacity:1;transform:scale(1.1);}}
        @keyframes agentSuiteSlideIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes agentSuiteSlideOut{from{transform:translateX(0);opacity:1;}to{transform:translateX(100%);opacity:0;}}
        .agent-suite-panel{animation:agentSuiteSlideIn 0.28s cubic-bezier(0.22,1,0.36,1) both;}
        .agent-suite-scrollbar::-webkit-scrollbar{width:3px;height:3px;}
        .agent-suite-scrollbar::-webkit-scrollbar-track{background:transparent;}
        .agent-suite-scrollbar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
      `}</style>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.25)",
          }}
        />
      )}

      {/* Panel */}
      <div
        className={isOpen ? "agent-suite-panel" : ""}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 680,
          zIndex: 1001,
          display: "flex",
          background: "rgba(6,6,6,0.82)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          fontFamily: "Inter, sans-serif",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: isOpen
            ? "none"
            : "transform 0.25s cubic-bezier(0.4,0,0.6,1)",
          pointerEvents: isOpen ? "auto" : "none",
          borderLeft: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        {/* Sidebar */}
        <div
          className="agent-suite-scrollbar"
          style={{
            width: 200,
            flexShrink: 0,
            background: "rgba(24,24,27,0.6)",
            borderRight: `1px solid rgba(255,255,255,0.05)`,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 14px 12px",
              borderBottom: `1px solid ${T.z800}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 8,
                letterSpacing: "0.2em",
                color: T.z600,
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: 4,
              }}
            >
              R3 V4 · AGI AGENT SUITE
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.acid,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em",
                textShadow: `0 0 20px ${T.acid}60`,
              }}
            >
              EXPERT AGENTS
            </div>
            <div
              style={{
                fontSize: 9,
                color: T.z600,
                fontFamily: "'JetBrains Mono', monospace",
                marginTop: 3,
                letterSpacing: "0.1em",
              }}
            >
              {AGENTS.length} AGENTS · ALL ARTIFACTS
            </div>
          </div>

          {/* Close button */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: `1px solid ${T.z800}`,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                background: "transparent",
                border: `1px solid ${T.z700}`,
                borderRadius: 6,
                cursor: "pointer",
                color: T.z400,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.red + "60";
                e.currentTarget.style.color = T.red;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.z700;
                e.currentTarget.style.color = T.z400;
              }}
            >
              <span style={{ fontSize: 11 }}>✕</span>
              <span>CLOSE AGENT SUITE</span>
            </button>
          </div>

          {/* Agent categories */}
          <div style={{ flex: 1, padding: "8px 6px", overflowY: "auto" }}>
            {CATEGORIES.map((cat) => {
              const catAgents = AGENTS.filter((a) => a.category === cat);
              if (catAgents.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.15em",
                      color: T.z600,
                      padding: "6px 8px 4px",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {cat}
                  </div>
                  {catAgents.map((agent) => {
                    const isActive = agent.id === activeId;
                    const msgCount = counts[agent.id];
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setActiveId(agent.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "8px 8px",
                          background: isActive
                            ? `${agent.color}12`
                            : "transparent",
                          border: `1px solid ${isActive ? agent.color + "40" : "transparent"}`,
                          borderRadius: 7,
                          cursor: "pointer",
                          marginBottom: 2,
                          transition: "all 0.12s",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = `${T.z800}80`;
                            e.currentTarget.style.borderColor = T.z700;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "transparent";
                          }
                        }}
                      >
                        {isActive && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: "18%",
                              bottom: "18%",
                              width: 2,
                              background: agent.color,
                              borderRadius: 1,
                              boxShadow: `0 0 6px ${agent.color}`,
                            }}
                          />
                        )}
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: isActive ? `${agent.color}20` : T.z800,
                            border: `1px solid ${isActive ? agent.color + "50" : T.z700}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            color: isActive ? agent.color : T.z500,
                            flexShrink: 0,
                            fontFamily: "monospace",
                            transition: "all 0.12s",
                            boxShadow: isActive
                              ? `0 0 8px ${agent.color}40`
                              : "none",
                          }}
                        >
                          {agent.icon}
                        </div>
                        <div
                          style={{ flex: 1, minWidth: 0, textAlign: "left" }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isActive ? agent.color : T.z400,
                              fontFamily: "Inter, sans-serif",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              transition: "color 0.12s",
                            }}
                          >
                            {agent.name}
                          </div>
                        </div>
                        {(msgCount ?? 0) > 0 && (
                          <div
                            style={{
                              fontSize: 9,
                              minWidth: 16,
                              height: 16,
                              borderRadius: 8,
                              padding: "0 4px",
                              background: `${agent.color}25`,
                              border: `1px solid ${agent.color}40`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: agent.color,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {msgCount}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${T.z800}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 8,
                color: T.z600,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
                lineHeight: 1.8,
              }}
            >
              ARTIFACT-BOUND · NO HALLUCINATION
              <br />
              Wire.txt · CLAUDE.md · llpte.md
              <br />
              agents.md · auth.md · workflow.md
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "rgba(9,9,11,0.55)",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <ChatPanel
            key={activeId}
            agent={activeAgent}
            messages={msgs}
            setMessages={setMsgs}
          />
        </div>
      </div>
    </>
  );
}

// ─── Toggle Button ────────────────────────────────────────────────────────────
export function AgentSuiteToggle({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen: boolean;
}) {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Open Expert Agent Suite"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 999,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: isOpen ? T.acid : hov ? `${T.acid}20` : `${T.z900}`,
        border: `1.5px solid ${isOpen ? T.acid : hov ? T.acid + "80" : T.z700}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        color: isOpen ? T.black : hov ? T.acid : T.z400,
        transition: "all 0.2s",
        boxShadow: isOpen
          ? `0 0 24px ${T.acid}60`
          : hov
            ? `0 0 16px ${T.acid}30`
            : "0 4px 16px rgba(0,0,0,0.4)",
        fontFamily: "monospace",
      }}
    >
      {isOpen ? "✕" : "⬡"}
    </button>
  );
}
